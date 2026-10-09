/**
 * Inbound cart email → an order, or a `needs_review` order, or a recorded
 * reason why neither.
 *
 * Runs **inline** in the webhook request. The deterministic parser is a
 * sub-second HTML extraction, so there is nothing to defer; a failure is
 * recorded and lands in the review queue rather than being retried blindly.
 * See ADR-0009.
 *
 * The order of the checks below is deliberate and each one is cheap:
 *
 *   1. Record the raw email. Always, before interpreting anything, so a parser
 *      fix can be replayed over history.
 *   2. Attribute it to a company, from the **recipient** alias — the retailer
 *      sends every customer's cart from the same address, so the sender cannot
 *      identify anyone.
 *   3. Select a parser by sender domain. No parser means no order at all.
 *   4. Require the same domain to have signed the message. A `From` header is
 *      free to forge; a DKIM signature at least has to look right.
 *   5. Parse, record the attempt, and create the order.
 */

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isDomainOrSubdomainOf } from "@/lib/domain";
import { parseCart, selectParser, senderDomain } from "@/lib/parsers";

import {
  dkimSignedDomains,
  firstHeader,
  parseMessageHeaders,
} from "./authenticity";

export type InboundEmailInput = {
  /** SMTP envelope recipient — the only field a customer cannot influence. */
  recipient: string;
  sender: string;
  subject: string | null;
  bodyHtml: string;
  bodyPlain: string | null;
  strippedHtml: string | null;
  /** Mailgun's `message-headers`, a JSON array of `[name, value]` pairs. */
  messageHeadersRaw: string | null;
};

export type IntakeStatus =
  | "duplicate"
  | "unattributed"
  | "unsupported_retailer"
  | "not_authentic"
  | "parsed"
  | "needs_review";

export type IntakeResult = {
  status: IntakeStatus;
  orderId?: string;
  orderNumber?: string;
  detail?: string;
};

type InboundProcessingStatus =
  | "pending"
  | "parsed"
  | "needs_review"
  | "failed"
  | "ignored";

/** `RESOLVED` statuses mean the email has already been dealt with. */
const RESOLVED: InboundProcessingStatus[] = ["parsed", "needs_review", "ignored"];

function aliasFrom(recipient: string): string | null {
  const at = recipient.lastIndexOf("@");
  if (at <= 0) return null;
  return recipient.slice(0, at).trim().toLowerCase() || null;
}

/**
 * The email's own `Message-ID`.
 *
 * Mailgun's `forward()` payload carries no message id of its own — the
 * documented fields are signature, timestamp, token, subject, sender, from,
 * recipient, message-headers, and the bodies — so idempotency keys on the
 * header. It is stable across a retry and unique per email, which is exactly
 * what `inbound_emails.mailgun_message_id` needs.
 *
 * A message without one falls back to a hash of its content, which is also
 * stable across a redelivery.
 */
function idempotencyKey(
  input: InboundEmailInput,
  messageIdHeader: string | null,
): string {
  if (messageIdHeader) return messageIdHeader;

  return createHash("sha256")
    .update(`${input.recipient}\n${input.subject ?? ""}\n${input.bodyHtml}`)
    .digest("hex");
}

async function setProcessingStatus(
  supabase: SupabaseClient,
  inboundEmailId: string,
  status: InboundProcessingStatus,
): Promise<void> {
  await supabase
    .from("inbound_emails")
    .update({ processing_status: status })
    .eq("id", inboundEmailId);
}

export async function processInboundEmail(
  supabase: SupabaseClient,
  input: InboundEmailInput,
): Promise<IntakeResult> {
  const headers = parseMessageHeaders(input.messageHeadersRaw);
  const key = idempotencyKey(input, firstHeader(headers, "Message-ID"));
  const recipientAlias = aliasFrom(input.recipient);

  // ---------------------------------------------------------------------------
  // 1. Record the raw email, or recognise a redelivery.
  // ---------------------------------------------------------------------------
  const { data: inserted, error: insertError } = await supabase
    .from("inbound_emails")
    .insert({
      mailgun_message_id: key,
      message_id_header: firstHeader(headers, "Message-ID"),
      recipient: input.recipient,
      recipient_alias: recipientAlias,
      sender_email: input.sender,
      subject: input.subject,
      body_html: input.bodyHtml,
      body_plain: input.bodyPlain,
      stripped_html: input.strippedHtml,
      headers,
      processing_status: "pending",
      received_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  let inboundEmailId: string;

  if (inserted) {
    inboundEmailId = (inserted as { id: string }).id;
  } else {
    // A unique violation is the expected conflict; anything else is a real
    // failure and must surface, not be mistaken for a duplicate.
    if (insertError && insertError.code !== "23505") {
      throw new Error(`could not record inbound email: ${insertError.message}`);
    }

    const { data: existing } = await supabase
      .from("inbound_emails")
      .select("id, processing_status")
      .eq("mailgun_message_id", key)
      .maybeSingle();

    const row = existing as
      | { id: string; processing_status: InboundProcessingStatus }
      | null;

    if (!row) {
      return { status: "duplicate", detail: "conflict but no row to read back" };
    }

    // A retry is **recovery**, not a no-op. Mailgun retries on non-2xx, so an
    // attempt that never finished is exactly the case worth re-running. One
    // already resolved is a genuine duplicate delivery.
    if (RESOLVED.includes(row.processing_status)) {
      return { status: "duplicate", detail: row.processing_status };
    }

    inboundEmailId = row.id;
  }

  // ---------------------------------------------------------------------------
  // 2. Attribute to a company, from the recipient.
  // ---------------------------------------------------------------------------
  if (!recipientAlias) {
    await setProcessingStatus(supabase, inboundEmailId, "needs_review");
    return { status: "unattributed", detail: "recipient has no local part" };
  }

  const { data: companyData } = await supabase
    .from("companies")
    .select("id")
    .eq("order_alias", recipientAlias)
    .eq("active", true)
    .maybeSingle();

  const company = companyData as { id: string } | null;

  if (!company) {
    // Deliberately not an auto-create: silently turning unverified inbound mail
    // into companies is how a spam flood becomes a customer database.
    await setProcessingStatus(supabase, inboundEmailId, "needs_review");
    return { status: "unattributed", detail: recipientAlias };
  }

  // ---------------------------------------------------------------------------
  // 3. Select a parser by sender domain.
  // ---------------------------------------------------------------------------
  const parser = selectParser(input.sender);

  if (!parser) {
    // No parser means no order — not even a `needs_review` one, since the
    // retailer enum value would be a guess. The email is still recorded, and
    // the reason is visible in the database. See 00-overview's known gaps.
    await setProcessingStatus(supabase, inboundEmailId, "needs_review");
    return {
      status: "unsupported_retailer",
      detail: senderDomain(input.sender) || "sender has no domain",
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Require the retailer to have signed it.
  // ---------------------------------------------------------------------------
  const signedDomains = dkimSignedDomains(headers);
  const signed = signedDomains.some((domain) =>
    isDomainOrSubdomainOf(domain, parser.senderParentDomain),
  );

  if (!signed) {
    await setProcessingStatus(supabase, inboundEmailId, "ignored");
    return {
      status: "not_authentic",
      detail: signedDomains.length
        ? `signed by ${signedDomains.join(", ")}`
        : "no DKIM-Signature header",
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Parse.
  // ---------------------------------------------------------------------------
  const startedAt = Date.now();
  const outcome = parseCart({
    bodyHtml: input.bodyHtml,
    subject: input.subject,
    senderEmail: input.sender,
  });
  const durationMs = Date.now() - startedAt;

  await supabase.from("parse_attempts").insert({
    inbound_email_id: inboundEmailId,
    strategy: "deterministic",
    parser_version: outcome.parserVersion,
    succeeded: outcome.ok,
    output: outcome.ok ? outcome.cart : (outcome.partial ?? null),
    errors: outcome.ok ? null : { reason: outcome.reason },
    duration_ms: durationMs,
  });

  // ---------------------------------------------------------------------------
  // 6. An order either way — `received` when it parsed, `needs_review` when it
  //    did not. The customer's cart is never silently dropped.
  // ---------------------------------------------------------------------------
  const { data: intentData } = await supabase
    .from("order_intents")
    .select("id, retailer, retailer_store_id, site_id, delivery_address")
    .eq("company_id", company.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const intent = intentData as
    | {
        id: string;
        retailer: string;
        retailer_store_id: string | null;
        site_id: string | null;
        delivery_address: unknown;
      }
    | null;

  const cart = outcome.ok ? outcome.cart : null;

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert({
      company_id: company.id,
      inbound_email_id: inboundEmailId,
      retailer: parser.retailer,
      status: outcome.ok ? "received" : "needs_review",
      requester_name: cart?.requesterName ?? null,
      requester_email: cart?.requesterEmail ?? null,
      materials_subtotal_cents: cart?.totals?.subtotalCents ?? 0,
      tax_cents: cart?.totals?.taxCents ?? 0,
      total_cents: cart?.totals?.estimatedTotalCents ?? 0,
    })
    .select("id, order_number")
    .single();

  if (orderError || !orderData) {
    // The order is the point of the whole pipeline; failing to create it is a
    // real error, and a 5xx lets Mailgun retry a delivery we did not record.
    throw new Error(`could not create the order: ${orderError?.message ?? "unknown"}`);
  }

  const order = orderData as { id: string; order_number: string };

  if (cart) {
    await supabase.from("order_items").insert(
      cart.items.map((item) => ({
        order_id: order.id,
        line_no: item.lineNo,
        description: item.description,
        brand: item.brand,
        model_number: item.modelNumber,
        store_sku: item.storeSku,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        // Not nullable in the schema, and `null` here means "the retailer
        // printed no price", which is not the same as a price of zero — but the
        // column cannot hold that distinction, so it reads as zero and the
        // dispatcher enters the real figure.
        line_total_cents: item.lineTotalCents ?? 0,
        image_url: item.imageUrl,
        aisle: item.aisle,
        bay: item.bay,
      })),
    );
  }

  // Claim the intent **after** the order exists, and only if it is still open.
  // Two carts arriving together must not both take the same store and address,
  // so the update is conditional on the status it was read at.
  if (intent) {
    const { data: claimed } = await supabase
      .from("order_intents")
      .update({
        status: "matched",
        order_id: order.id,
        matched_at: new Date().toISOString(),
      })
      .eq("id", intent.id)
      .eq("status", "open")
      .select("id")
      .maybeSingle();

    if (claimed) {
      await supabase
        .from("orders")
        .update({
          retailer_store_id: intent.retailer_store_id,
          site_id: intent.site_id,
          delivery_address: intent.delivery_address,
        })
        .eq("id", order.id);
    }
  }

  await setProcessingStatus(
    supabase,
    inboundEmailId,
    outcome.ok ? "parsed" : "needs_review",
  );

  await supabase
    .from("inbound_emails")
    .update({ order_id: order.id })
    .eq("id", inboundEmailId);

  return outcome.ok
    ? { status: "parsed", orderId: order.id, orderNumber: order.order_number }
    : {
        status: "needs_review",
        orderId: order.id,
        orderNumber: order.order_number,
        detail: outcome.reason,
      };
}
