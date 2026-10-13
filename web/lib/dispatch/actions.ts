"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { finalizeProvisionalEmail } from "@/lib/intake/finalize-provisional";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  parseDeliveryDraft,
  parseQuoteDraft,
  saveDispatcherDraft,
} from "./draft-input";
import { canQueueInvite, CHECKOUT_INVITES_ENABLED } from "./invite";
import { requireDispatcher } from "./require-dispatcher";
import { loadOrderDetail } from "./review-queue";

/**
 * Dispatcher edits are checked and audited in one database call. A server action
 * can be invoked directly, so its form fields are never authorization evidence.
 */
function finishDraftUpdate(
  orderId: string,
  kind: "store" | "delivery" | "quote",
  outcome: "saved" | "invalid" | "error",
): never {
  const path = `/dispatch/review/${orderId}`;
  if (outcome === "saved") {
    revalidatePath(path);
    revalidatePath("/dispatch/review");
  }
  redirect(`${path}?draft=${kind}-${outcome}`);
}

export async function updateOrderStore(formData: FormData): Promise<void> {
  const { supabase } = await requireDispatcher();
  const orderId = String(formData.get("orderId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return;
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) finishDraftUpdate(orderId, "store", "invalid");

  // A store belongs to this order only when its retailer matches; the RPC
  // validates that association again under the dispatcher's own RLS session.
  const saved = await saveDispatcherDraft(supabase, orderId, "store", {
    storeId,
  });
  finishDraftUpdate(orderId, "store", saved ? "saved" : "error");
}

export async function updateOrderQuote(formData: FormData): Promise<void> {
  const { supabase } = await requireDispatcher();
  const orderId = String(formData.get("orderId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return;
  const draft = parseQuoteDraft(formData);
  if (!draft.ok) finishDraftUpdate(orderId, "quote", "invalid");

  const saved = await saveDispatcherDraft(
    supabase,
    orderId,
    "quote",
    draft.value,
  );
  finishDraftUpdate(orderId, "quote", saved ? "saved" : "error");
}

export async function updateOrderDelivery(formData: FormData): Promise<void> {
  const { supabase } = await requireDispatcher();
  const orderId = String(formData.get("orderId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return;
  const draft = parseDeliveryDraft(formData);
  if (!draft.ok) finishDraftUpdate(orderId, "delivery", "invalid");

  const saved = await saveDispatcherDraft(
    supabase,
    orderId,
    "delivery",
    draft.value,
  );
  finishDraftUpdate(orderId, "delivery", saved ? "saved" : "error");
}

/**
 * Future checkout invitation action, currently blocked on real delivery.
 *
 * **Nothing sends or queues now.** The checkout page and outbound delivery do
 * not exist yet. Historical queued rows remain untouched. Only after a real
 * customer confirmation flow exists may this action be enabled and reviewed;
 * a future outbox worker must not drain legacy rows by default.
 */
export async function queueCheckoutInvite(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireDispatcher();
  if (!CHECKOUT_INVITES_ENABLED) return;

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  // Re-derive everything rather than trusting the render that produced the
  // form. A disabled button is a UI state; a server action can be invoked
  // directly, so this is the actual guard.
  const detail = await loadOrderDetail(supabase, orderId);
  if (!detail) return;

  const decision = canQueueInvite({
    status: detail.order.status,
    gates: detail.gates,
    inviteRecipient: detail.inviteRecipient,
    inviteQueued: detail.inviteQueued,
  });

  if (!decision.ok) return;

  // Already proven by the decision above; repeated only to narrow the type.
  const recipient = detail.inviteRecipient;
  if (!recipient) return;

  // The notification goes in **before** the status changes. If the status write
  // then fails, the order stays in the queue and a second click is a no-op on
  // the unique dedupe key — it simply completes the flip. The other order would
  // leave an order that looks invited with nothing queued to send it, and
  // nothing on screen to say so.
  const { error: notifyError } = await supabase.from("notifications").insert({
    order_id: orderId,
    channel: "email",
    template_key: "checkout_invite",
    to_address: recipient,
    status: "queued",
    dedupe_key: `${orderId}:checkout_invite`,
  });

  // A unique violation means it is already queued, which is exactly what a
  // retry should find. Anything else is a real failure and the order stays put.
  if (notifyError && notifyError.code !== "23505") return;

  await supabase
    .from("orders")
    .update({ status: "awaiting_customer" })
    .eq("id", orderId);

  await supabase.from("order_status_events").insert({
    order_id: orderId,
    from_status: detail.order.status,
    to_status: "awaiting_customer",
    actor_profile_id: userId,
    actor_role: "dispatcher",
    source: "console",
    note: "checkout invite queued — not sent",
  });

  revalidatePath(`/dispatch/review/${orderId}`);
  revalidatePath("/dispatch/review");
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
