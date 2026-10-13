/**
 * Mailgun's inbound route posts here.
 *
 * Configure one domain-scoped route with `forward()` to this parsed-email
 * endpoint. Optional `store()` must have no `notify` URL here: storage
 * notifications use a different payload and this handler cannot parse them.
 *
 * See docs/architecture/05-email-intake.md for the operator-run route setup.
 *
 * Response policy: `406` when the signature does not verify — write nothing and
 * let Mailgun give up. `500` when our own work failed, so Mailgun retries a
 * delivery we never recorded. `200` otherwise, including for a duplicate and for
 * an email we chose not to turn into an order: retrying those would only repeat
 * the decision.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  isParsedMailgunContentType,
  MAX_MAILGUN_BODY_BYTES,
  parseMailgunForm,
} from "@/lib/intake/mailgun-form";
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

  const contentType = request.headers.get("content-type");
  if (!isParsedMailgunContentType(contentType)) {
    return NextResponse.json(
      { error: "unsupported mail format" },
      { status: 406 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_MAILGUN_BODY_BYTES) {
    return NextResponse.json({ error: "email too large" }, { status: 406 });
  }

  let form: FormData;
  try {
    if (!request.body) throw new Error("Missing body");
    const reader = request.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MAILGUN_BODY_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "email too large" }, { status: 406 });
      }
      chunks.push(Buffer.from(value));
    }
    form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType! },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 406 });
  }

  const parsed = parseMailgunForm(form);
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
    // Deliberately terse. A caller probing the endpoint learns nothing about
    // which part failed.
    return NextResponse.json({ error: "invalid signature" }, { status: 406 });
  }

  try {
    const result = await processInboundEmail(createAdminClient(), parsed.email);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // A real failure — the database rejected a write, most likely. Let Mailgun
    // retry rather than swallowing it; the retry re-runs an unfinished attempt.
    console.error(
      "[mailgun inbound] processing failed",
      error instanceof Error ? error.name : "Unknown error",
    );

    return NextResponse.json(
      { error: "could not process the email" },
      { status: 500 },
    );
  }
}
