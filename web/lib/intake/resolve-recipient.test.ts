import { describe, expect, test } from "bun:test";

import { inboundDedupeKey, parseInboundRecipient } from "./resolve-recipient";

const domain = "orders.example.com";
const messageId = "<message@lowes.com>";

describe("inbound recipient", () => {
  test("accepts a stable plus-tag alias on the configured domain", () => {
    expect(
      parseInboundRecipient("Things.Dispatch+Acme@ORDERS.EXAMPLE.COM", domain),
    ).toBe("things.dispatch+acme");
  });

  test("rejects mismatched domains and malformed addresses", () => {
    for (const address of [
      "things.dispatch+acme@gmail.com",
      "cart@notorders.example.com",
      "two@@orders.example.com",
    ]) {
      expect(parseInboundRecipient(address, domain)).toBeNull();
    }
    const missingDomain = parseInboundRecipient(
      "cart@orders.example.com",
      undefined,
    );
    expect(missingDomain).toBeNull();
  });

  test("dedupes retries to one recipient but not separate recipients", () => {
    const first = inboundDedupeKey(
      "COMPANY@orders.example.com",
      messageId,
      "lowes@e.lowes.com",
      "Cart",
      "<p>cart</p>",
    );
    expect(
      inboundDedupeKey(
        "company@ORDERS.EXAMPLE.COM",
        messageId,
        "lowes@e.lowes.com",
        "Cart",
        "<p>cart</p>",
      ),
    ).toBe(first);
    expect(
      inboundDedupeKey(
        "other@orders.example.com",
        messageId,
        "lowes@e.lowes.com",
        "Cart",
        "<p>cart</p>",
      ),
    ).not.toBe(first);
  });

  test("uses the contents when a message ID is absent", () => {
    const first = inboundDedupeKey(
      "company@orders.example.com",
      null,
      "lowes@e.lowes.com",
      "Cart",
      "<p>cart</p>",
    );
    expect(first).toHaveLength(64);
    expect(
      inboundDedupeKey(
        "company@orders.example.com",
        null,
        "lowes@e.lowes.com",
        "Cart",
        "<p>different cart</p>",
      ),
    ).not.toBe(first);
  });
});
