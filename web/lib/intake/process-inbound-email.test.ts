import { describe, expect, test } from "bun:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readEmlFixture } from "@/lib/parsers/__fixtures__/read-eml";

import {
  emptyDatabase,
  fakeSupabase,
  type FakeDatabase,
} from "./__fixtures__/fake-supabase";
import { firstHeader, parseMessageHeaders } from "./authenticity";
import {
  processInboundEmail,
  type InboundEmailInput,
} from "./process-inbound-email";

/**
 * These exercise the pipeline's **branching** against a fake client, not the
 * SQL. The fake does not run the order-number trigger, so `order_number` is
 * absent here and present in production — nothing below asserts on it.
 */

const fixture = readEmlFixture("lowes/multi-item.eml");
const ALIAS = "things.dispatch+acme-construction";

const MESSAGE_ID = firstHeader(
  parseMessageHeaders(JSON.stringify(fixture.headers)),
  "Message-ID",
);

if (!MESSAGE_ID) throw new Error("the fixture must carry a Message-ID");

function inbound(
  overrides: Partial<InboundEmailInput> = {},
): InboundEmailInput {
  return {
    recipient: `${ALIAS}@orders.example.com`,
    sender: fixture.senderEmail,
    subject: fixture.subject,
    bodyHtml: fixture.bodyHtml,
    bodyPlain: null,
    strippedHtml: null,
    messageHeadersRaw: JSON.stringify(fixture.headers),
    ...overrides,
  };
}

function withCompany(): FakeDatabase {
  const db = emptyDatabase();
  db.companies.push({ id: "company-1", order_alias: ALIAS, active: true });
  return db;
}

function run(db: FakeDatabase, input: InboundEmailInput = inbound()) {
  return processInboundEmail(
    fakeSupabase(db) as unknown as SupabaseClient,
    input,
  );
}

describe("processInboundEmail", () => {
  test("creates an order carrying the cart's items", async () => {
    const db = withCompany();
    const result = await run(db);

    expect(result.status).toBe("parsed");
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].status).toBe("received");
    expect(db.orders[0].retailer).toBe("lowes");
    expect(db.orders[0].requester_email).toBe(
      "anthony.palumbi@locksmithconsulting.com",
    );

    expect(db.order_items).toHaveLength(3);
    expect(
      db.order_items.map((item) => [
        item.store_sku,
        item.model_number,
        item.quantity,
      ]),
    ).toEqual([
      ["552328", "Y2L40408-GC", 3],
      ["95991", "LUS26Z", 6],
      ["132109", "354502999", 2],
    ]);

    expect(db.parse_attempts).toHaveLength(1);
    expect(db.parse_attempts[0].succeeded).toBe(true);
    expect(db.parse_attempts[0].parser_version).toBe("lowes@1.0.0");

    expect(db.inbound_emails).toHaveLength(1);
    expect(db.inbound_emails[0].processing_status).toBe("parsed");
    expect(db.inbound_emails[0].order_id).toBe(db.orders[0].id);
  });

  test("invents no money, because Lowe's states none", async () => {
    const db = withCompany();
    await run(db);

    expect(db.orders[0].materials_subtotal_cents).toBe(0);
    expect(db.orders[0].total_cents).toBe(0);
    expect(db.order_items.every((item) => item.line_total_cents === 0)).toBe(
      true,
    );
  });

  test("treats a redelivery of a resolved email as a duplicate", async () => {
    const db = withCompany();
    await run(db);
    const second = await run(db);

    expect(second.status).toBe("duplicate");
    // The whole point: one email, one order, however many times Mailgun sends it.
    expect(db.orders).toHaveLength(1);
    expect(db.order_items).toHaveLength(3);
  });

  test("re-processes a redelivery that never finished", async () => {
    const db = withCompany();

    // A previous attempt recorded the email and then died — exactly what a
    // Mailgun retry is for, and why a duplicate must not be a blanket no-op.
    db.inbound_emails.push({
      id: "inbound-1",
      mailgun_message_id: MESSAGE_ID,
      processing_status: "pending",
    });

    const result = await run(db);

    expect(result.status).toBe("parsed");
    expect(db.orders).toHaveLength(1);
    expect(db.inbound_emails[0].processing_status).toBe("parsed");
  });

  test("records an email whose alias matches no company", async () => {
    const db = emptyDatabase();
    const result = await run(db);

    expect(result.status).toBe("unattributed");
    expect(db.orders).toHaveLength(0);
    expect(db.inbound_emails[0].processing_status).toBe("needs_review");
    expect(db.inbound_emails[0].order_id ?? null).toBeNull();
  });

  test("records a Home Depot cart without creating an order", async () => {
    // Home Depot is a deferred retailer: no parser, and no order, because the
    // retailer value would be a guess.
    const db = withCompany();
    const result = await run(
      db,
      inbound({ sender: "HomeDepot@order.homedepot.com" }),
    );

    expect(result.status).toBe("unsupported_retailer");
    expect(db.orders).toHaveLength(0);
    expect(db.inbound_emails[0].processing_status).toBe("needs_review");
  });

  test("ignores a Lowe's-looking email with no DKIM signature", async () => {
    const db = withCompany();
    const result = await run(db, inbound({ messageHeadersRaw: "[]" }));

    expect(result.status).toBe("not_authentic");
    expect(db.orders).toHaveLength(0);
    expect(db.inbound_emails[0].processing_status).toBe("ignored");
  });

  test("rejects a signature from a domain the retailer does not own", async () => {
    // A `From` header is free to forge. This is the check that a forged one has
    // to get past as well.
    const db = withCompany();
    const result = await run(
      db,
      inbound({
        messageHeadersRaw: JSON.stringify([
          ["Message-ID", "<forged@example.com>"],
          ["DKIM-Signature", "v=1; a=rsa-sha256; d=attacker.net; s=selector"],
        ]),
      }),
    );

    expect(result.status).toBe("not_authentic");
    expect(db.orders).toHaveLength(0);
  });

  test("takes the store and address from the customer's open intent", async () => {
    const db = withCompany();
    db.order_intents.push({
      id: "intent-1",
      company_id: "company-1",
      status: "open",
      created_at: "2026-10-01T00:00:00.000Z",
      retailer_store_id: "store-9",
      site_id: "site-9",
      delivery_address: { line1: "421 Commerce Rd" },
    });

    const result = await run(db);

    expect(result.status).toBe("parsed");
    expect(db.orders[0].retailer_store_id).toBe("store-9");
    expect(db.orders[0].site_id).toBe("site-9");
    expect(db.orders[0].delivery_address).toEqual({ line1: "421 Commerce Rd" });

    expect(db.order_intents[0].status).toBe("matched");
    expect(db.order_intents[0].order_id).toBe(db.orders[0].id);
  });

  test("creates the order without a store when there is no open intent", async () => {
    // ADR-0010's fallback: a cart forwarded from the retailer's app, or from a
    // customer who never started an order in the portal.
    const db = withCompany();
    const result = await run(db);

    expect(result.status).toBe("parsed");
    expect(db.orders[0].retailer_store_id ?? null).toBeNull();
  });

  test("creates a needs_review order when the cart cannot be read", async () => {
    const db = withCompany();
    const result = await run(
      db,
      inbound({ bodyHtml: "<html><body><p>nothing here</p></body></html>" }),
    );

    expect(result.status).toBe("needs_review");
    // The customer's cart is never silently dropped.
    expect(db.orders).toHaveLength(1);
    expect(db.orders[0].status).toBe("needs_review");
    expect(db.order_items).toHaveLength(0);
    expect(db.parse_attempts[0].succeeded).toBe(false);
    expect(db.inbound_emails[0].processing_status).toBe("needs_review");
  });
});
