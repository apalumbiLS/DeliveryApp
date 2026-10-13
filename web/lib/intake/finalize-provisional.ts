import type { SupabaseClient } from "@supabase/supabase-js";

import { ParsedCartSchema } from "@/lib/parsers";

import { parseInboundRecipient, resolveRecipient } from "./resolve-recipient";

export type FinalizeResult = { orderId: string; orderNumber: string };

export async function finalizeProvisionalEmail(
  dispatcher: SupabaseClient,
  admin: SupabaseClient,
  inboundId: string,
  companyId: string,
  reviewerId: string,
  domain: string | undefined,
): Promise<FinalizeResult> {
  const { data: rawEmail, error: emailError } = await dispatcher
    .from("inbound_emails")
    .select("id, recipient, company_id, review_status, order_id")
    .eq("id", inboundId)
    .maybeSingle();
  if (emailError || !rawEmail) {
    throw new Error("Inbound email unavailable");
  }
  const email = rawEmail as {
    recipient: string;
    company_id: string | null;
    review_status: string;
    order_id: string | null;
  };
  if (email.company_id && email.company_id !== companyId) {
    throw new Error("Company does not match the recipient");
  }
  if (email.review_status !== "pending" || email.order_id) {
    throw new Error("Email is no longer awaiting review");
  }

  const { data: company, error: companyError } = await dispatcher
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("active", true)
    .maybeSingle();
  if (companyError || !company) {
    throw new Error("Active company required");
  }

  const { data: attempt, error: attemptError } = await dispatcher
    .from("parse_attempts")
    .select("output")
    .eq("inbound_email_id", inboundId)
    .eq("succeeded", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attemptError || !attempt) {
    throw new Error("No validated cart preview");
  }
  const output = (attempt as { output: unknown }).output;
  const parsed = ParsedCartSchema.safeParse(output);
  if (!parsed.success || parsed.data.retailer !== "lowes") {
    throw new Error("Cart preview does not match Lowe's");
  }

  if (!parseInboundRecipient(email.recipient, domain)) {
    throw new Error("Receiving domain is not configured");
  }
  const recipient = await resolveRecipient(dispatcher, email.recipient, domain);
  if (recipient.kind !== "unattributed" && recipient.companyId !== companyId) {
    throw new Error("Company does not match the recipient");
  }
  const intentId =
    recipient.kind === "intent" &&
    recipient.companyId === companyId &&
    recipient.intent.status === "open" &&
    recipient.intent.retailer === "lowes"
      ? recipient.intent.id
      : null;

  const { data, error } = await admin.rpc("finalize_inbound_cart", {
    p_inbound_email_id: inboundId,
    p_company_id: companyId,
    p_items: parsed.data.items,
    p_reviewer_id: reviewerId,
    p_requester_email: parsed.data.requesterEmail,
    p_intent_id: intentId,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error("Could not finalize inbound cart");
  }
  return {
    orderId: (data[0] as { order_id: string }).order_id,
    orderNumber: (data[0] as { order_number: string }).order_number,
  };
}
