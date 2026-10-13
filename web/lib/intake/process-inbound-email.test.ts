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
import { inboundDedupeKey } from "./resolve-recipient";

/**
 * These exercise the pipeline's **branching** against a fake client, not the
 * SQL. The fake does not run the order-number trigger, so `order_number` is
 * absent here and present in production — nothing below asserts on it.
 */

const fixture = readEmlFixture("lowes/multi-item.eml");
const ALIAS = "things.dispatch+acme-construction";
const DOMAIN = "orders.example.com";
const EMAIL_TOKEN = "a".repeat(32);

const MESSAGE_ID = firstHeader(
  parseMessageHeaders(JSON.stringify(fixture.headers)),
  "Message-ID",
);

if (!MESSAGE_ID) throw new Error("the fixture must carry a Message-ID");

function inbound(
  overrides: Partial<InboundEmailInput> = {},
): InboundEmailInput {
  return {
    recipient: `${ALIAS}@${DOMAIN}`,
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

function withIntent(db: FakeDatabase, status = "open", retailer = "lowes") {
  db.order_intents.push({
    id: "intent-1",
    company_id: "company-1",
    email_token: EMAIL_TOKEN,
    status,
    retailer,
    retailer_store_id: "store-9",
    site_id: "site-9",
    delivery_address: { line1: "421 Commerce Rd" },
  });
}

function withMessageId(id: string): Partial<InboundEmailInput> {
  return {
    messageHeadersRaw: JSON.stringify(
      fixture.headers.map(([name, value]) =>
        name.toLowerCase() === "message-id" ? [name, id] : [name, value],
      ),
    ),
  };
}

function run(db: FakeDatabase, input: InboundEmailInput = inbound()) {
  return processInboundEmail(
    fakeSupabase(db) as unknown as SupabaseClient,
    input,
    DOMAIN,
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
    const mail = inbound();
    db.inbound_emails.push({
      id: "inbound-1",
      mailgun_message_id: inboundDedupeKey(
        mail.recipient,
        MESSAGE_ID,
        mail.sender,
        mail.subject,
        mail.bodyHtml,
      ),
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
    withIntent(db);

    const result = await run(
      db,
      inbound({ recipient: `cart-${EMAIL_TOKEN}@${DOMAIN}` }),
    );

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

  test("stable company mail never takes even the newest open intent", async () => {
    const db = withCompany();
    withIntent(db);
    const result = await run(db);

    expect(result.status).toBe("parsed");
    expect(db.orders[0].retailer_store_id ?? null).toBeNull();
    expect(db.orders[0].delivery_address ?? null).toBeNull();
    expect(db.order_intents[0].status).toBe("open");
  });

  test("an intent address selects its own site, not a newer intent", async () => {
    const db = withCompany();
    withIntent(db);
    db.order_intents.push({
      id: "intent-2",
      company_id: "company-1",
      email_token: "b".repeat(32),
      status: "open",
      retailer: "lowes",
      retailer_store_id: "other-store",
      delivery_address: { line1: "Other job site" },
    });

    await run(db, inbound({ recipient: `cart-${EMAIL_TOKEN}@${DOMAIN}` }));

    expect(db.orders[0].retailer_store_id).toBe("store-9");
    expect(db.order_intents[0].status).toBe("matched");
    expect(db.order_intents[1].status).toBe("open");
  });

  test("an unreadable cart does not consume a one-use intent", async () => {
    const db = withCompany();
    withIntent(db);
    const recipient = `cart-${EMAIL_TOKEN}@${DOMAIN}`;

    const failed = await run(
      db,
      inbound({ recipient, bodyHtml: "<html>No cart items</html>" }),
    );
    const valid = await run(
      db,
      inbound({ recipient, ...withMessageId("<valid@lowes.com>") }),
    );

    expect(failed.status).toBe("needs_review");
    expect(valid.status).toBe("parsed");
    expect(db.orders[0].retailer_store_id ?? null).toBeNull();
    expect(db.orders[1].retailer_store_id).toBe("store-9");
    expect(db.order_intents[0].order_id).toBe(db.orders[1].id);
  });

  test("a retry to an intent address remains the same order", async () => {
    const db = withCompany();
    withIntent(db);
    const mail = inbound({ recipient: `cart-${EMAIL_TOKEN}@${DOMAIN}` });
    await run(db, mail);
    const retry = await run(db, mail);

    expect(retry.status).toBe("duplicate");
    expect(db.orders).toHaveLength(1);
    expect(db.order_intents[0].order_id).toBe(db.orders[0].id);
  });

  test("another distinct email to a consumed token inherits company only", async () => {
    const db = withCompany();
    withIntent(db);
    const recipient = `cart-${EMAIL_TOKEN}@${DOMAIN}`;
    await run(db, inbound({ recipient }));
    const next = await run(
      db,
      inbound({ recipient, ...withMessageId("<another@lowes.com>") }),
    );

    expect(next.status).toBe("parsed");
    expect(next.detail).toContain("collect site and store");
    expect(db.orders).toHaveLength(2);
    expect(db.orders[1].company_id).toBe("company-1");
    expect(db.orders[1].retailer_store_id ?? null).toBeNull();
    expect(db.orders[1].delivery_address ?? null).toBeNull();
    expect(db.order_intents[0].order_id).toBe(db.orders[0].id);
  });

  test("an expired or retailer-mismatched token never supplies a site", async () => {
    for (const [status, retailer] of [
      ["expired", "lowes"],
      ["open", "homedepot"],
    ]) {
      const db = withCompany();
      withIntent(db, status, retailer);
      const result = await run(
        db,
        inbound({ recipient: `cart-${EMAIL_TOKEN}@${DOMAIN}` }),
      );
      expect(result.status).toBe("parsed");
      expect(db.orders[0].company_id).toBe("company-1");
      expect(db.orders[0].retailer_store_id ?? null).toBeNull();
      expect(db.order_intents[0].order_id ?? null).toBeNull();
    }
  });

  test("unknown tokens and domains create no operational order", async () => {
    for (const recipient of [
      `cart-${"b".repeat(32)}@${DOMAIN}`,
      `${ALIAS}@gmail.com`,
      `cart-${EMAIL_TOKEN}@notorders.example.com`,
    ]) {
      const db = withCompany();
      withIntent(db);
      const result = await run(db, inbound({ recipient }));
      expect(result.status).toBe("unattributed");
      expect(db.orders).toHaveLength(0);
      expect(db.inbound_emails[0].processing_status).toBe("needs_review");
    }
  });

  test("the same Message-ID at two company addresses creates two orders", async () => {
    const db = withCompany();
    db.companies.push({
      id: "company-2",
      order_alias: "things.dispatch+second-company",
      active: true,
    });
    await run(db);
    const second = await run(
      db,
      inbound({ recipient: `things.dispatch+second-company@${DOMAIN}` }),
    );

    expect(second.status).toBe("parsed");
    expect(db.orders).toHaveLength(2);
    expect(db.orders[1].company_id).toBe("company-2");
    expect(db.inbound_emails).toHaveLength(2);
    expect(db.inbound_emails[0].mailgun_message_id).not.toBe(
      db.inbound_emails[1].mailgun_message_id,
    );
  });
});
