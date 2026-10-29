"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { finalizeProvisionalEmail } from "@/lib/intake/finalize-provisional";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  parseDeliveryDraft,
  parseQuoteDraft,
  saveDispatcherDraft,
  type DraftResult,
} from "./draft-input";
import { canSendForApproval } from "./approval";
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
 * Send a verified order to the customer for approval.
 *
 * Moves it to `awaiting_customer` and records who did it. **No email goes out
 * and nothing is queued**: the checkout email is a later, extra trigger on this
 * same step. Rows an earlier prototype queued stay held by `send_approved`, and
 * a future outbox worker must not drain them by default.
 */
export async function sendForApproval(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireDispatcher();

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  // Re-derive everything rather than trusting the render that produced the
  // form. A disabled button is a UI state; a server action can be invoked
  // directly, so this is the actual guard.
  const detail = await loadOrderDetail(supabase, orderId);
  if (!detail) return;

  const decision = canSendForApproval({
    status: detail.order.status,
    gates: detail.gates,
  });

  if (decision.ok) {
    // Conditional on the status just checked, so two dispatchers sending at
    // once move it once and record one event.
    const { data: moved } = await supabase
      .from("orders")
      .update({ status: "awaiting_customer" })
      .eq("id", orderId)
      .eq("status", detail.order.status)
      .select("id")
      .maybeSingle();

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
  }

  // Either way the page should show what is true now. Back to the order's
  // plain URL, so a tab picked by hand gives way to the one the order is in.
  revalidatePath(`/dispatch/review/${orderId}`);
  revalidatePath("/dispatch/review");
  redirect(`/dispatch/review/${orderId}`);
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
