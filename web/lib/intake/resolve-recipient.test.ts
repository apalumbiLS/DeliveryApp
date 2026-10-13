import { describe, expect, test } from "bun:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { emptyDatabase, fakeSupabase } from "./__fixtures__/fake-supabase";
import {
  inboundDedupeKey,
  parseInboundRecipient,
  resolveRecipient,
} from "./resolve-recipient";

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

  test("resolves both new and previously issued token addresses", async () => {
    const db = emptyDatabase();
    const token = "a".repeat(32);
    db.order_intents.push({
      id: "intent-1",
      company_id: "company-1",
      email_token: token,
    });
    db.companies.push({ id: "company-1", active: true });
    const client = fakeSupabase(db) as unknown as SupabaseClient;
    for (const prefix of ["delivery+", "cart-"]) {
      const result = await resolveRecipient(
        client,
        `${prefix}${token}@${domain}`,
        domain,
      );
      expect(result.kind).toBe("intent");
      if (result.kind === "intent") expect(result.intent.id).toBe("intent-1");
    }
    expect(
      (await resolveRecipient(client, `delivery+invalid@${domain}`, domain))
        .kind,
    ).toBe("unattributed");
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
