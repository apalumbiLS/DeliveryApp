"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { finalizeProvisionalEmail } from "@/lib/intake/finalize-provisional";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  parseDeliveryDraft,
  parsePayoutDraft,
  parseQuoteDraft,
  saveDispatcherDraft,
  type DraftResult,
} from "./draft-input";
import { canSendForApproval, SENDABLE_STATUSES } from "./approval";
import { requireDispatcher } from "./require-dispatcher";
import { loadOrderDetail } from "./review-queue";

/**
 * Dispatcher edits are checked and audited in one database call. A server action
 * can be invoked directly, so its form fields are never authorization evidence.
 *
 * Each returns its outcome to the form that sent it rather than redirecting, so
 * the form can say "Saved" or name the problem beside its own button.
 */
function finishDraftUpdate(orderId: string, saved: boolean): DraftResult {
  if (!saved) return { outcome: "error" };
  revalidatePath(`/dispatch/review/${orderId}`);
  revalidatePath("/dispatch/review");
  return { outcome: "saved" };
}

function orderIdFrom(formData: FormData): string | null {
  const orderId = String(formData.get("orderId") ?? "");
  return /^[0-9a-f-]{36}$/i.test(orderId) ? orderId : null;
}

export async function updateOrderStore(
  _previous: DraftResult,
  formData: FormData,
): Promise<DraftResult> {
  const { supabase } = await requireDispatcher();
  const orderId = orderIdFrom(formData);
  if (!orderId) return { outcome: "error" };
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return { outcome: "invalid" };

  // A store belongs to this order only when its retailer matches; the RPC
  // validates that association again under the dispatcher's own RLS session.
  const saved = await saveDispatcherDraft(supabase, orderId, "store", {
    storeId,
  });
  return finishDraftUpdate(orderId, saved);
}

export async function updateOrderQuote(
  _previous: DraftResult,
  formData: FormData,
): Promise<DraftResult> {
  const { supabase } = await requireDispatcher();
  const orderId = orderIdFrom(formData);
  if (!orderId) return { outcome: "error" };
  const draft = parseQuoteDraft(formData);
  if (!draft.ok) return { outcome: "invalid" };

  const saved = await saveDispatcherDraft(
    supabase,
    orderId,
    "quote",
    draft.value,
  );
  return finishDraftUpdate(orderId, saved);
}

export async function updateOrderDelivery(
  _previous: DraftResult,
  formData: FormData,
): Promise<DraftResult> {
  const { supabase } = await requireDispatcher();
  const orderId = orderIdFrom(formData);
  if (!orderId) return { outcome: "error" };
  const draft = parseDeliveryDraft(formData);
  if (!draft.ok) return { outcome: "invalid" };

  const saved = await saveDispatcherDraft(
    supabase,
    orderId,
    "delivery",
    draft.value,
  );
  return finishDraftUpdate(orderId, saved);
}

/**
 * The driver payout. Its own call rather than part of the quote, because it
 * stays editable after review — until a driver accepts.
 */
export async function updateOrderPayout(
  _previous: DraftResult,
  formData: FormData,
): Promise<DraftResult> {
  const { supabase } = await requireDispatcher();
  const orderId = orderIdFrom(formData);
  if (!orderId) return { outcome: "error" };
  const draft = parsePayoutDraft(formData);
  if (!draft.ok) return { outcome: "invalid" };

  let saved = false;
  try {
    const { data, error } = await supabase.rpc("set_driver_payout", {
      p_order_id: orderId,
      p_payout_cents: draft.value,
    });
    saved = !error && data === orderId;
  } catch {
    saved = false;
  }
  return finishDraftUpdate(orderId, saved);
}

/** Why an order-page action did not happen, shown in the gate bar. */
export type OrderActionError = "send" | "undo" | "undo_failed" | "release";

/**
 * Back to the order's plain URL, so a tab picked by hand gives way to the one
 * the order is in, with the error when the action did not happen.
 */
function backToOrder(orderId: string, error?: OrderActionError): never {
  revalidatePath(`/dispatch/review/${orderId}`);
  revalidatePath("/dispatch/review");
  redirect(`/dispatch/review/${orderId}${error ? `?error=${error}` : ""}`);
}

/**
 * Send a verified order to the customer for approval.
 *
 * Moves it to `awaiting_customer` and records who did it. **No email goes out
 * and nothing is queued**: the checkout email is a later, extra trigger on this
 * same step.
 */
export async function sendForApproval(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireDispatcher();

  // A bad ID or a missing order goes back to the queue rather than leaving
  // the button doing nothing.
  const orderId = orderIdFrom(formData);
  if (!orderId) redirect("/dispatch/review");

  // Re-derive everything rather than trusting the render that produced the
  // form. A disabled button is a UI state; a server action can be invoked
  // directly, so this is the actual guard.
  const detail = await loadOrderDetail(supabase, orderId);
  if (!detail) redirect("/dispatch/review");

  const decision = canSendForApproval({
    status: detail.order.status,
    gates: detail.gates,
  });

  if (!decision.ok) {
    // Already sent, by someone else a moment ago, is not a failure: the page
    // will say so. Anything still in review that cannot go is.
    backToOrder(
      orderId,
      SENDABLE_STATUSES.includes(detail.order.status) ? "send" : undefined,
    );
  }

  // Conditional on the status just checked, so two dispatchers sending at
  // once move it once and record one event.
  const { data: moved, error } = await supabase
    .from("orders")
    .update({ status: "awaiting_customer" })
    .eq("id", orderId)
    .eq("status", detail.order.status)
    .select("id")
    .maybeSingle();
  if (error) backToOrder(orderId, "send");

  if (moved) {
    await supabase.from("order_status_events").insert({
      order_id: orderId,
      from_status: detail.order.status,
      to_status: "awaiting_customer",
      actor_profile_id: userId,
      actor_role: "dispatcher",
      source: "console",
      note: "sent for approval — no email sent",
    });
  }

  backToOrder(orderId);
}

/**
 * Undo a send for approval sent by mistake: the order goes back to review.
 * Only while the customer has not approved — conditional on the status, so a
 * customer approving at the same moment wins or loses cleanly.
 */
export async function undoSendForApproval(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireDispatcher();
  const orderId = orderIdFrom(formData);
  if (!orderId) return;

  const { data: moved, error } = await supabase
    .from("orders")
    .update({ status: "needs_review" })
    .eq("id", orderId)
    .eq("status", "awaiting_customer")
    .select("id")
    .maybeSingle();

  if (moved) {
    await supabase.from("order_status_events").insert({
      order_id: orderId,
      from_status: "awaiting_customer",
      to_status: "needs_review",
      actor_profile_id: userId,
      actor_role: "dispatcher",
      source: "console",
      note: "send for approval undone",
    });
  }

  if (error) backToOrder(orderId, "undo_failed");
  if (moved) backToOrder(orderId);

  // Not moved: if another dispatcher undid it a moment ago, it is back in
  // review and that is what was wanted. Otherwise the customer approved first.
  const { data: current } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  const status = (current as { status: string } | null)?.status;
  backToOrder(
    orderId,
    status && SENDABLE_STATUSES.includes(status) ? undefined : "undo",
  );
}

/**
 * Take a job back from its driver and post it to drivers again, at the same
 * link. Allowed at any step before delivery; `release_driver` checks that.
 */
export async function releaseDriver(formData: FormData): Promise<void> {
  const { supabase } = await requireDispatcher();
  const orderId = orderIdFrom(formData);
  if (!orderId) return;

  const { error } = await supabase.rpc("release_driver", {
    p_order_id: orderId,
  });

  backToOrder(orderId, error ? "release" : undefined);
}

export async function approveInboundEmail(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireDispatcher();
  const inboundId = String(formData.get("inboundId") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  if (!inboundId || !companyId) return;

  let orderId: string;
  try {
    const result = await finalizeProvisionalEmail(
      supabase,
      createAdminClient(),
      inboundId,
      companyId,
      userId,
      process.env.ORDER_ALIAS_DOMAIN,
    );
    orderId = result.orderId;
  } catch {
    redirect(`/dispatch/review/inbound/${inboundId}?error=approval-failed`);
  }
  revalidatePath("/dispatch/review");
  redirect(`/dispatch/review/${orderId}`);
}

export async function dismissInboundEmail(formData: FormData): Promise<void> {
  const { supabase } = await requireDispatcher();
  const inboundId = String(formData.get("inboundId") ?? "");
  if (!inboundId) return;

  const { data, error } = await supabase
    .from("inbound_emails")
    .update({ review_status: "dismissed", processing_status: "ignored" })
    .eq("id", inboundId)
    .eq("review_status", "pending")
    .is("order_id", null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    redirect(`/dispatch/review/inbound/${inboundId}?error=dismissal-failed`);
  }
  revalidatePath("/dispatch/review");
  redirect("/dispatch/review");
}
