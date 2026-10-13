import { describe, expect, test } from "bun:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readEmlFixture } from "@/lib/parsers/__fixtures__/read-eml";

import {
  emptyDatabase,
  fakeSupabase,
  type FakeDatabase,
} from "./__fixtures__/fake-supabase";
import {
  processInboundEmail,
  type InboundEmailInput,
} from "./process-inbound-email";

const fixture = readEmlFixture("lowes/multi-item.eml");
const alias = "things.dispatch+acme-construction";
const domain = "orders.example.com";
const token = "a".repeat(32);

function inbound(
  overrides: Partial<InboundEmailInput> = {},
): InboundEmailInput {
  return {
    recipient: `${alias}@${domain}`,
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
  db.companies.push({ id: "company-1", order_alias: alias, active: true });
  return db;
}

function withIntent(db: FakeDatabase) {
  db.order_intents.push({
    id: "intent-1",
    company_id: "company-1",
    email_token: token,
    status: "open",
    retailer: "lowes",
    retailer_store_id: "store-9",
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
    domain,
  );
}

describe("signed Mailgun intake", () => {
  test("stores a three-item provisional preview but no operational order", async () => {
    const db = withCompany();
    const result = await run(db);

    expect(result.status).toBe("provisional");
    expect(db.orders).toHaveLength(0);
    expect(db.order_items).toHaveLength(0);
    expect(db.inbound_emails).toHaveLength(1);
    expect(db.inbound_emails[0].company_id).toBe("company-1");
    expect(db.inbound_emails[0].processing_status).toBe("needs_review");
    expect(db.inbound_emails[0].review_status).toBe("pending");
    expect(db.parse_attempts[0].succeeded).toBe(true);
    const cart = db.parse_attempts[0].output as {
      items: unknown[];
      totals: unknown;
    };
    expect(cart.items).toHaveLength(3);
    expect(cart.totals).toBeNull();
  });

  test("dedupes a redelivery and can recover a pending message", async () => {
    const db = withCompany();
    const first = await run(db);
    expect((await run(db)).status).toBe("duplicate");
    expect(db.inbound_emails).toHaveLength(1);
    expect(db.parse_attempts).toHaveLength(1);

    db.inbound_emails[0].processing_status = "pending";
    expect((await run(db)).status).toBe("provisional");
    expect(db.inbound_emails[0].id).toBe(first.inboundId);
    expect(db.inbound_emails).toHaveLength(1);
  });

  test("a transient parse-attempt write failure stays retryable", async () => {
    const db = withCompany();
    const fake = fakeSupabase(db);
    const failing = {
      from(table: string) {
        if (table === "parse_attempts") {
          return {
            insert: async () => ({ error: { message: "temporary failure" } }),
          };
        }
        return fake.from(table);
      },
    } as unknown as SupabaseClient;

    await expect(
      processInboundEmail(failing, inbound(), domain),
    ).rejects.toThrow("Could not record parse attempt");
    expect(db.inbound_emails[0].processing_status).toBe("pending");
    expect((await run(db)).status).toBe("provisional");
    expect(db.inbound_emails).toHaveLength(1);
  });

  test("unknown alias and unknown domain stay visible as exceptions", async () => {
    for (const recipient of [`unknown@${domain}`, `${alias}@gmail.com`]) {
      const db = withCompany();
      const result = await run(db, inbound({ recipient }));
      expect(result.status).toBe("unattributed");
      expect(db.orders).toHaveLength(0);
      expect(db.inbound_emails[0].review_reason).toBeTruthy();
      expect(db.inbound_emails[0].processing_status).toBe("needs_review");
      expect(db.parse_attempts[0].succeeded).toBe(true);
    }
  });

  test("an unsupported retailer remains in the inbound review list", async () => {
    const db = withCompany();
    const result = await run(db, inbound({ sender: "other@example.com" }));
    expect(result.status).toBe("unsupported_retailer");
    expect(db.orders).toHaveLength(0);
    expect(db.inbound_emails[0].company_id).toBe("company-1");
    expect(db.inbound_emails[0].review_reason).toContain("Unsupported");
  });

  test("an unreadable cart is reviewable rather than acknowledged as an order", async () => {
    const db = withCompany();
    const result = await run(db, inbound({ bodyHtml: "<html>empty</html>" }));
    expect(result.status).toBe("needs_review");
    expect(db.orders).toHaveLength(0);
    expect(db.parse_attempts[0].succeeded).toBe(false);
    expect(db.inbound_emails[0].review_reason).toBeTruthy();
  });

  test("a forgeable DKIM header never upgrades a message to an order", async () => {
    const db = withCompany();
    const forged = JSON.stringify([
      ["Message-ID", "<spoof@e.lowes.com>"],
      ["DKIM-Signature", "v=1; d=e.lowes.com; s=fake; b=fake"],
    ]);
    const result = await run(db, inbound({ messageHeadersRaw: forged }));
    expect(result.status).toBe("provisional");
    expect(db.orders).toHaveLength(0);
  });

  test("a token address belongs to the company but never claims its site yet", async () => {
    const db = withCompany();
    withIntent(db);
    const recipient = `cart-${token}@${domain}`;
    const first = await run(db, inbound({ recipient }));
    const second = await run(
      db,
      inbound({ recipient, ...withMessageId("<second@lowes.com>") }),
    );
    expect(first.status).toBe("provisional");
    expect(second.status).toBe("provisional");
    expect(db.inbound_emails).toHaveLength(2);
    expect(db.order_intents[0].status).toBe("open");
    expect(db.orders).toHaveLength(0);
  });

  test("one Message-ID addressed to two companies records both", async () => {
    const db = withCompany();
    db.companies.push({
      id: "company-2",
      order_alias: "things.dispatch+second-company",
      active: true,
    });
    await run(db);
    await run(
      db,
      inbound({ recipient: `things.dispatch+second-company@${domain}` }),
    );
    expect(db.inbound_emails).toHaveLength(2);
    expect(db.inbound_emails.map((row) => row.company_id)).toEqual([
      "company-1",
      "company-2",
    ]);
  });
});
