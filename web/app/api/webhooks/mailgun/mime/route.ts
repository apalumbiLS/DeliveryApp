/**
 * Mailgun's inbound route posts here when its forward URL ends in `mime`: the
 * whole raw email in `body-mime`, rather than the pre-split fields the
 * `inbound` route takes.
 *
 * The raw message is what makes the retailer's DKIM signature checkable. A
 * cart signed by its own retailer and sent to a known company's address
 * becomes an order straight away; anything else lands in dispatcher review,
 * exactly as through the `inbound` route. See
 * docs/architecture/05-email-intake.md.
 *
 * Response policy is the `inbound` route's: `406` for a bad signature or a
 * payload we cannot read, `500` when our own work failed so Mailgun retries,
 * `200` otherwise.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  isParsedMailgunContentType,
  MAX_MAILGUN_MIME_BYTES,
  parseMailgunMimeForm,
  readBoundedForm,
} from "@/lib/intake/mailgun-form";
import { readMimeEmail, verifiedSenderDomains } from "@/lib/intake/mime-email";
import { processInboundEmail } from "@/lib/intake/process-inbound-email";
import { verifyMailgunSignature } from "@/lib/intake/verify-mailgun";
import { isMailgunConfigured } from "@/lib/mailgun/config";
import { createAdminClient } from "@/lib/supabase/admin";

// Node, not edge: the HMAC and DKIM checks use node:crypto, and DKIM looks up
// the signer's key in DNS.
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isMailgunConfigured()) {
    return NextResponse.json(
      { error: "Mailgun is not configured" },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type");
  if (!isParsedMailgunContentType(contentType)) {
    return NextResponse.json(
      { error: "unsupported mail format" },
      { status: 406 },
    );
  }

  const form = await readBoundedForm(
    request,
    contentType!,
    MAX_MAILGUN_MIME_BYTES,
  );
  if (!form) {
    return NextResponse.json(
      { error: "invalid or oversized form data" },
      { status: 406 },
    );
  }

  const parsed = await parseMailgunMimeForm(form);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.reason }, { status: 406 });
  }

  const verification = verifyMailgunSignature({
    signingKey: process.env.MAILGUN_SIGNING_KEY,
    timestamp: parsed.timestamp,
    token: parsed.token,
    signature: parsed.signature,
  });
  if (!verification.ok) {
    return NextResponse.json({ error: "invalid signature" }, { status: 406 });
  }

  let email: Awaited<ReturnType<typeof readMimeEmail>>;
  try {
    email = await readMimeEmail(parsed.mime);
  } catch {
    return NextResponse.json({ error: "unreadable email" }, { status: 406 });
  }
  if (!email.bodyHtml?.trim()) {
    return NextResponse.json(
      { error: "Expected one HTML email part" },
      { status: 406 },
    );
  }

  try {
    const result = await processInboundEmail(createAdminClient(), {
      recipient: parsed.recipient,
      sender: parsed.sender,
      subject: email.subject,
      bodyHtml: email.bodyHtml,
      bodyPlain: email.bodyPlain,
      strippedHtml: null,
      messageHeadersRaw: JSON.stringify(email.headers),
      verifiedDomains: await verifiedSenderDomains(parsed.mime),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      "[mailgun mime] processing failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    return NextResponse.json(
      { error: "could not process the email" },
      { status: 500 },
    );
  }
}
