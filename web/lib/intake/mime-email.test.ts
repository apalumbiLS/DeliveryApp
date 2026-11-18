import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseCart } from "@/lib/parsers";

import { readMimeEmail, verifiedSenderDomains } from "./mime-email";

const raw = readFileSync(
  join(import.meta.dir, "../parsers/__fixtures__/lowes/multi-item.eml"),
);

/**
 * Lowe's real DKIM key, as published at 4dkim1._domainkey.e.lowes.com on
 * 2026-11-18, so the test verifies the real signature without DNS.
 */
const LOWES_KEY = [
  "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4+cjtmaAe6MpbZ9Z",
  "ilFVfTv+/qgkHkyB6MdZhzZaf4U9dssr0KSJJtphJ4eIS78JwaT69nQKrKGM",
  "E9F9z+uyHjsKiJI80x+GAbPdjkbi4NWBKD8o+T4DeM1zLVx/ETI1r7qcAAdV",
  "m77aDgfn9lZTd0dANIKeOmx9/DKkZNUcGOX3laeYp+Q5n5DpPG3XRCs+eTeb",
  "yt0CA8kXJ2pExzdd0RqUZJRuUVxfCZBbzYfoDzDwm4GPzOT2NCFyjw8KadYh",
  "Sw/nHp5eysp8ZM573wVwLX6Fuf4Kjxa3WiYLo6rrr7Bbj9mMkqz/FB7VAc0J",
  "y4xqcuaMOWzIrUGQRnfzTQbvtQIDAQAB",
];

function notFound(): never {
  throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
}

/** Knows only Lowe's key; every other lookup misses, as for an unknown domain. */
async function resolver(name: string, type: string) {
  if (name === "4dkim1._domainkey.e.lowes.com" && type === "TXT") {
    return [LOWES_KEY];
  }
  return notFound();
}

describe("readMimeEmail", () => {
  test("reads the raw Lowe's email into a cart the parser accepts", async () => {
    const email = await readMimeEmail(raw);
    expect(email.bodyHtml).toBeTruthy();
    expect(
      email.headers.some(([name]) => name.toLowerCase() === "dkim-signature"),
    ).toBe(true);

    const outcome = parseCart({
      bodyHtml: email.bodyHtml!,
      subject: email.subject,
      senderEmail: "lowes@e.lowes.com",
    });
    expect(outcome.ok && outcome.cart.items).toHaveLength(3);
  });
});

describe("verifiedSenderDomains", () => {
  test("verifies Lowe's own signature, not the relay's", async () => {
    expect(await verifiedSenderDomains(raw, resolver)).toEqual(["e.lowes.com"]);
  });

  test("a changed body no longer verifies", async () => {
    const tampered = Buffer.from(
      raw
        .toString("latin1")
        .replace("Sent from the cart", "Sent from the cast"),
      "latin1",
    );
    expect(tampered.equals(raw)).toBe(false);
    expect(await verifiedSenderDomains(tampered, resolver)).toEqual([]);
  });

  test("a key that cannot be fetched verifies nothing", async () => {
    expect(await verifiedSenderDomains(raw, async () => notFound())).toEqual(
      [],
    );
  });
});
