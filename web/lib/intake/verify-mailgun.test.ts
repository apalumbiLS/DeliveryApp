import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import { verifyMailgunSignature } from "./verify-mailgun";

const KEY = "test-signing-key";
const NOW = 1_800_000_000;
const TOKEN = "a".repeat(50);

function sign(timestamp: string, token: string, key = KEY): string {
  return createHmac("sha256", key).update(timestamp + token).digest("hex");
}

function verify(overrides: Partial<Parameters<typeof verifyMailgunSignature>[0]> = {}) {
  const timestamp = String(NOW - 10);
  return verifyMailgunSignature({
    signingKey: KEY,
    timestamp,
    token: TOKEN,
    signature: sign(timestamp, TOKEN),
    nowSeconds: NOW,
    ...overrides,
  });
}

describe("verifyMailgunSignature", () => {
  test("accepts a correctly signed, fresh request", () => {
    expect(verify()).toEqual({ ok: true });
  });

  test("rejects a signature made with a different key", () => {
    const timestamp = String(NOW - 10);
    const result = verify({ signature: sign(timestamp, TOKEN, "not-our-key") });
    expect(result.ok).toBe(false);
  });

  test("rejects a token that does not match the signature", () => {
    const timestamp = String(NOW - 10);
    const result = verify({
      timestamp,
      token: "b".repeat(50),
      signature: sign(timestamp, TOKEN),
    });
    expect(result.ok).toBe(false);
  });

  test("rejects a timestamp outside the window", () => {
    const stale = String(NOW - 3600);
    const result = verify({ timestamp: stale, signature: sign(stale, TOKEN) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("from now");
  });

  test("rejects a timestamp far in the future", () => {
    const ahead = String(NOW + 3600);
    const result = verify({ timestamp: ahead, signature: sign(ahead, TOKEN) });
    expect(result.ok).toBe(false);
  });

  test("accepts a request at the edge of the window", () => {
    const edge = String(NOW - 300);
    expect(verify({ timestamp: edge, signature: sign(edge, TOKEN) })).toEqual({
      ok: true,
    });
  });

  test("rejects missing fields rather than throwing", () => {
    for (const missing of [
      { timestamp: null },
      { token: null },
      { signature: null },
    ]) {
      expect(verify(missing).ok).toBe(false);
    }
  });

  test("rejects a signature that is not hex, without throwing", () => {
    // `timingSafeEqual` throws on a length mismatch, so this has to be handled
    // before it is reached.
    expect(verify({ signature: "zzzz" }).ok).toBe(false);
    expect(verify({ signature: "" }).ok).toBe(false);
  });

  test("rejects when no signing key is configured", () => {
    const result = verify({ signingKey: undefined });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("signing key");
  });
});
