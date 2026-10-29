"use server";

import { revalidatePath } from "next/cache";

import { parseApproval, type ApproveResult } from "@/lib/portal/approval";
import { requireCustomer } from "@/lib/portal/require-customer";

/**
 * The customer approves an order that is awaiting their approval.
 *
 * `approve_order` does the checking — that the order is this customer's, that
 * it is awaiting approval, and that it has an address, items and a price — and
 * moves it on in one call. Checking here first only saves a round trip for a
 * form that was filled in wrong.
 */
export async function approveOrder(
  _previous: ApproveResult,
  formData: FormData,
): Promise<ApproveResult> {
  const { supabase } = await requireCustomer();

  const orderId = String(formData.get("orderId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { outcome: "error" };

  const input = parseApproval(formData);
  if (!input.ok) return { outcome: "invalid" };

  let approved = false;
  try {
    const { data, error } = await supabase.rpc("approve_order", {
      p_order_id: orderId,
      p_contact_name: input.value.contactName,
      p_contact_phone: input.value.contactPhone,
      p_instructions: input.value.instructions,
    });
    approved = !error && data === orderId;
  } catch {
    approved = false;
  }

  // Either way, show the order as it now is: one approved in another tab, say,
  // should read as approved here rather than offer the button again.
  revalidatePath(`/portal/orders/${orderId}`);
  revalidatePath("/portal/orders");
  revalidatePath("/portal");

  return { outcome: approved ? "approved" : "error" };
}
