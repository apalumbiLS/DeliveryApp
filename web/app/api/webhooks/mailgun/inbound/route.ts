/**
 * Mailgun's inbound route posts here.
 *
 * Configure the route as:
 *
 *   match_recipient("(?P<alias>[^@]+)@<your-inbound-domain>")
 *   store(notify="https://<app>/api/webhooks/mailgun/inbound")
 *   forward("https://<app>/api/webhooks/mailgun/inbound")
 *
 * See docs/architecture/05-email-intake.md.
 *
 * Response policy: `406` when the signature does not verify — write nothing and
 * let Mailgun give up. `500` when our own work failed, so Mailgun retries a
 * delivery we never recorded. `200` otherwise, including for a duplicate and for
 * an email we chose not to turn into an order: retrying those would only repeat
 * the decision.
 */

import { NextResponse, type NextRequest } from "next/server";

import { processInboundEmail } from "@/lib/intake/process-inbound-email";
import { verifyMailgunSignature } from "@/lib/intake/verify-mailgun";
import { isMailgunConfigured } from "@/lib/mailgun/config";
import { createAdminClient } from "@/lib/supabase/admin";

// Node, not edge: the HMAC uses node:crypto, and Supabase's client wants a
// normal runtime.
export const runtime = "nodejs";

// Never cached, never prerendered — this is a POST endpoint that must run every
// time it is called.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isMailgunConfigured()) {
    return NextResponse.json(
      { error: "Mailgun is not configured" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "expected form data" }, { status: 400 });
  }

  const field = (name: string): string | null => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };

  const verification = verifyMailgunSignature({
    signingKey: process.env.MAILGUN_SIGNING_KEY,
    timestamp: field("timestamp"),
    token: field("token"),
    signature: field("signature"),
  });

  if (!verification.ok) {
    // Deliberately terse. A caller probing the endpoint learns nothing about
    // which part failed.
    return NextResponse.json({ error: "invalid signature" }, { status: 406 });
  }

  try {
    const result = await processInboundEmail(createAdminClient(), {
      recipient: field("recipient") ?? "",
      sender: field("sender") ?? field("from") ?? "",
      subject: field("subject"),
      bodyHtml: field("body-html") ?? "",
      bodyPlain: field("body-plain"),
      strippedHtml: field("stripped-html"),
      messageHeadersRaw: field("message-headers"),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // A real failure — the database rejected a write, most likely. Let Mailgun
    // retry rather than swallowing it; the retry re-runs an unfinished attempt.
    console.error("[mailgun inbound] processing failed", error);

    return NextResponse.json(
      { error: "could not process the email" },
      { status: 500 },
    );
  }
}
