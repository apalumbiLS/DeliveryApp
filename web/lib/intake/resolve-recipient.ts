import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

const TOKEN_ADDRESS = /^cart-([0-9a-f]{32})$/;

export type InboundIntent = {
  id: string;
  company_id: string;
  status: string;
  retailer: string;
  retailer_store_id: string | null;
  site_id: string | null;
  delivery_address: unknown;
};

export type RecipientResolution =
  | { kind: "company"; companyId: string; alias: string }
  | {
      kind: "intent";
      companyId: string;
      alias: string;
      intent: InboundIntent;
    }
  | { kind: "unattributed"; alias: string | null; reason: string };

export function parseInboundRecipient(
  recipient: string,
  domain: string | undefined,
): string | null {
  const match = /^([a-z0-9][a-z0-9.+_-]{0,63})@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(
    recipient.trim(),
  );
  if (!match || !domain) return null;
  return match[2].toLowerCase() === domain.trim().toLowerCase()
    ? match[1].toLowerCase()
    : null;
}

export function inboundDedupeKey(
  recipient: string,
  messageId: string | null,
  sender: string,
  subject: string | null,
  bodyHtml: string,
): string {
  const identity = messageId?.trim()
    ? [recipient.trim().toLowerCase(), messageId.trim()]
    : [recipient.trim().toLowerCase(), sender.toLowerCase(), subject, bodyHtml];
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export async function resolveRecipient(
  supabase: SupabaseClient,
  recipient: string,
  domain: string | undefined,
): Promise<RecipientResolution> {
  const alias = parseInboundRecipient(recipient, domain);
  if (!alias) {
    return {
      kind: "unattributed",
      alias: null,
      reason: "Unknown receiving domain",
    };
  }

  if (alias.startsWith("cart-")) {
    const token = TOKEN_ADDRESS.exec(alias)?.[1];
    if (!token) {
      return { kind: "unattributed", alias, reason: "Invalid cart address" };
    }

    const { data, error } = await supabase
      .from("order_intents")
      .select(
        "id, company_id, status, retailer, retailer_store_id, site_id, delivery_address",
      )
      .eq("email_token", token)
      .maybeSingle();
    if (error) {
      throw new Error(`Could not look up cart address: ${error.message}`);
    }

    const intent = data as InboundIntent | null;
    if (!intent) {
      return { kind: "unattributed", alias, reason: "Unknown cart address" };
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", intent.company_id)
      .eq("active", true)
      .maybeSingle();
    if (companyError) {
      throw new Error(`Could not look up company: ${companyError.message}`);
    }
    if (!company) {
      return { kind: "unattributed", alias, reason: "Inactive company" };
    }
    return { kind: "intent", companyId: intent.company_id, alias, intent };
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("order_alias", alias)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`Could not look up company: ${error.message}`);

  const company = data as { id: string } | null;
  return company
    ? { kind: "company", companyId: company.id, alias }
    : { kind: "unattributed", alias, reason: "Unknown company address" };
}
