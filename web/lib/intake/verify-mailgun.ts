/**
 * Mailgun's webhook signature.
 *
 * Mailgun signs `timestamp + token` with HMAC-SHA256 and posts all three. This
 * is what establishes that the POST came from Mailgun rather than from anyone
 * who found the endpoint — see
 * docs/architecture/05-email-intake.md#signature-verification.
 *
 * It does **not** authenticate the email's sender. That is a separate check in
 * `authenticity.ts`.
 *
 * ## Why there is no single-use token store
 *
 * `05-email-intake.md` describes rejecting a `(timestamp, token)` pair that has
 * been seen before, to stop a captured request being replayed with a different
 * body — Mailgun's signature covers the timestamp and token, not the payload.
 *
 * That is deliberately **not** implemented. Mailgun retries a delivery when the
 * endpoint returns a non-2xx, and ADR-0009 makes those retries the recovery path
 * for an email we failed to record. If a retry reuses its timestamp and token —
 * which is not documented either way — a single-use check would reject exactly
 * the retries the design depends on, and a cart would be lost. Losing a real
 * order is worse than the replay window.
 *
 * The timestamp window bounds the exposure instead. Add the token store once
 * Mailgun's retry behaviour is confirmed against a real account.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * How far a request's timestamp may be from now.
 *
 * Five minutes is generous for clock skew and short enough that a captured
 * request has to be replayed almost immediately.
 */
export const MAX_AGE_SECONDS = 300;

export type MailgunVerification = { ok: true } | { ok: false; reason: string };

export function verifyMailgunSignature(input: {
  signingKey: string | undefined;
  timestamp: string | null;
  token: string | null;
  signature: string | null;
  /** Injectable so a test does not depend on the wall clock. */
  nowSeconds?: number;
}): MailgunVerification {
  const { signingKey, timestamp, token, signature } = input;

  if (!signingKey) return { ok: false, reason: "no signing key configured" };
  if (!timestamp || !token || !signature) {
    return { ok: false, reason: "missing timestamp, token, or signature" };
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, reason: "timestamp is not a number" };
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const age = Math.abs(now - sentAt);

  if (age > MAX_AGE_SECONDS) {
    return { ok: false, reason: `timestamp is ${age}s from now` };
  }

  const expected = createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return { ok: false, reason: "signature is not hex" };
  }

  // `timingSafeEqual` throws on a length mismatch, so check first — and doing so
  // is itself not a meaningful timing leak, since the length is not secret.
  if (provided.length !== expected.length) {
    return { ok: false, reason: "signature is the wrong length" };
  }

  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "signature does not match" };
  }

  return { ok: true };
}
