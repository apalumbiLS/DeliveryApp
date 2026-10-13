/**
 * Inbound cart email → a stored provisional preview for dispatcher review.
 *
 * Runs inline after the Mailgun transport signature is verified. Mailgun's
 * signature does not authenticate Lowe's, and a DKIM-Signature header can be
 * forged. No order, site claim, customer message or driver job is created here.
 *
 * The raw email is stored first so a parser fix can be replayed. Only a
 * dispatcher can turn a validated preview into an order through the atomic
 * finalization function.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isDomainOrSubdomainOf } from "@/lib/domain";
import { parseCart, selectParser, senderDomain } from "@/lib/parsers";

import {
  dkimSignedDomains,
  firstHeader,
  parseMessageHeaders,
} from "./authenticity";
import {
  inboundDedupeKey,
  parseInboundRecipient,
  resolveRecipient,
} from "./resolve-recipient";

export type InboundEmailInput = {
  recipient: string;
  sender: string;
  subject: string | null;
  bodyHtml: string;
  bodyPlain: string | null;
  strippedHtml: string | null;
  messageHeadersRaw: string | null;
};

export type IntakeStatus =
  | "duplicate"
  | "unattributed"
  | "unsupported_retailer"
  | "provisional"
  | "needs_review";

export type IntakeResult = {
  status: IntakeStatus;
  inboundId?: string;
  detail?: string;
};

type InboundProcessingStatus =
  "pending" | "parsed" | "needs_review" | "failed" | "ignored";

const RESOLVED: InboundProcessingStatus[] = [
  "parsed",
  "needs_review",
  "ignored",
];

async function recordReview(
  supabase: SupabaseClient,
  inboundEmailId: string,
  reason: string,
  companyId: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from("inbound_emails")
    .update({
      processing_status: "needs_review",
      review_status: "pending",
      review_reason: reason,
      company_id: companyId,
    })
    .eq("id", inboundEmailId);
  if (error) throw new Error(`Could not record review: ${error.message}`);
}

export async function processInboundEmail(
  supabase: SupabaseClient,
  input: InboundEmailInput,
  domain: string | undefined = process.env.ORDER_ALIAS_DOMAIN,
): Promise<IntakeResult> {
  const headers = parseMessageHeaders(input.messageHeadersRaw);
  const key = inboundDedupeKey(
    input.recipient,
    firstHeader(headers, "Message-ID"),
    input.sender,
    input.subject,
    input.bodyHtml,
  );
  const recipientAlias = parseInboundRecipient(input.recipient, domain);

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
      review_status: "pending",
      received_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  let inboundEmailId: string;
  if (inserted) {
    inboundEmailId = (inserted as { id: string }).id;
  } else {
    if (insertError && insertError.code !== "23505") {
      throw new Error(`Could not record inbound email: ${insertError.message}`);
    }
    const { data: existing, error: lookupError } = await supabase
      .from("inbound_emails")
      .select("id, processing_status")
      .eq("mailgun_message_id", key)
      .maybeSingle();
    if (lookupError)
      throw new Error(`Could not check duplicate: ${lookupError.message}`);
    const row = existing as {
      id: string;
      processing_status: InboundProcessingStatus;
    } | null;
    if (!row) throw new Error("Duplicate conflict without a recorded email");
    if (RESOLVED.includes(row.processing_status)) {
      return { status: "duplicate", inboundId: row.id };
    }
    inboundEmailId = row.id;
  }

  const resolution = await resolveRecipient(supabase, input.recipient, domain);
  const companyId =
    resolution.kind === "unattributed" ? null : resolution.companyId;

  const parser = selectParser(input.sender);
  if (!parser) {
    const retailerReason = `Unsupported retailer: ${senderDomain(input.sender) || "unknown sender"}`;
    const reason =
      resolution.kind === "unattributed"
        ? `${resolution.reason}; ${retailerReason}`
        : retailerReason;
    await recordReview(supabase, inboundEmailId, reason, companyId);
    return {
      status: "unsupported_retailer",
      inboundId: inboundEmailId,
      detail: reason,
    };
  }

  const startedAt = Date.now();
  const outcome = parseCart({
    bodyHtml: input.bodyHtml,
    subject: input.subject,
    senderEmail: input.sender,
  });
  const { error: attemptError } = await supabase.from("parse_attempts").insert({
    inbound_email_id: inboundEmailId,
    strategy: "deterministic",
    parser_version: outcome.parserVersion,
    succeeded: outcome.ok,
    output: outcome.ok ? outcome.cart : (outcome.partial ?? null),
    errors: outcome.ok ? null : { reason: outcome.reason },
    duration_ms: Date.now() - startedAt,
  });
  if (attemptError) {
    throw new Error(`Could not record parse attempt: ${attemptError.message}`);
  }

  if (!outcome.ok) {
    const reason =
      resolution.kind === "unattributed"
        ? `${resolution.reason}; ${outcome.reason}`
        : outcome.reason;
    await recordReview(supabase, inboundEmailId, reason, companyId);
    return {
      status: "needs_review",
      inboundId: inboundEmailId,
      detail: reason,
    };
  }

  const signedDomains = dkimSignedDomains(headers);
  const hasMatchingDkimHeader = signedDomains.some((signedDomain) =>
    isDomainOrSubdomainOf(signedDomain, parser.senderParentDomain),
  );
  const retailerReason = hasMatchingDkimHeader
    ? "Retailer signature is present but not verified; dispatcher approval required"
    : "Retailer identity unverified; dispatcher approval required";
  const reason =
    resolution.kind === "unattributed"
      ? `${resolution.reason}; ${retailerReason}`
      : retailerReason;
  await recordReview(supabase, inboundEmailId, reason, companyId);
  return {
    status: resolution.kind === "unattributed" ? "unattributed" : "provisional",
    inboundId: inboundEmailId,
    detail: reason,
  };
}
