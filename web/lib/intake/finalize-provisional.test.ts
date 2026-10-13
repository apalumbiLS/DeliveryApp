import { describe, expect, test } from "bun:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseCart } from "@/lib/parsers";
import { readEmlFixture } from "@/lib/parsers/__fixtures__/read-eml";

import { emptyDatabase, fakeSupabase } from "./__fixtures__/fake-supabase";
import { finalizeProvisionalEmail } from "./finalize-provisional";

const domain = "orders.example.com";
const fixture = readEmlFixture("lowes/multi-item.eml");
const parsed = parseCart(fixture);
if (!parsed.ok) throw new Error("Lowe's fixture must parse");
const cart = parsed.cart;

function setup(intentStatus = "open", prefix = "delivery+") {
  const db = emptyDatabase();
  db.companies.push({ id: "company-1", active: true });
  db.inbound_emails.push({
    id: "email-1",
    company_id: "company-1",
    recipient: `${prefix}${"a".repeat(32)}@${domain}`,
    review_status: "pending",
    order_id: null,
  });
  db.order_intents.push({
    id: "intent-1",
    company_id: "company-1",
    email_token: "a".repeat(32),
    status: intentStatus,
    retailer: "lowes",
  });
  db.parse_attempts.push({
    inbound_email_id: "email-1",
    succeeded: true,
    output: cart,
  });
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const admin = {
    async rpc(name: string, params: Record<string, unknown>) {
      calls.push({ name, params });
      return {
        data: [{ order_id: "order-1", order_number: "#2000" }],
        error: null,
      };
    },
  } as unknown as SupabaseClient;
  const dispatcher = fakeSupabase(db) as unknown as SupabaseClient;
  const approve = () =>
    finalizeProvisionalEmail(
      dispatcher,
      admin,
      "email-1",
      "company-1",
      "reviewer-1",
      domain,
    );
  return { db, calls, approve };
}

describe("finalization RPC contract (mocked, not SQL execution)", () => {
  test("passes only validated items and the first eligible intent", async () => {
    const { calls, approve } = setup();
    expect(await approve()).toEqual({
      orderId: "order-1",
      orderNumber: "#2000",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("finalize_inbound_cart");
    expect(calls[0].params.p_intent_id).toBe("intent-1");
    expect(calls[0].params.p_reviewer_id).toBe("reviewer-1");
    expect(calls[0].params.p_items).toEqual(cart.items);
  });

  test("a previously issued cart- address can still claim its intent", async () => {
    const { calls, approve } = setup("open", "cart-");
    await approve();
    expect(calls[0].params.p_intent_id).toBe("intent-1");
  });

  test("a consumed intent belongs to the company but supplies no site", async () => {
    const { calls, approve } = setup("matched");
    await approve();
    expect(calls[0].params.p_intent_id).toBeNull();
  });

  test("refuses a different company or a parse failure before calling the RPC", async () => {
    const { db, calls, approve } = setup();
    db.inbound_emails[0].company_id = "company-2";
    await expect(approve()).rejects.toThrow("Company does not match");
    db.inbound_emails[0].company_id = "company-1";
    db.parse_attempts[0].succeeded = false;
    await expect(approve()).rejects.toThrow("No validated cart preview");
    expect(calls).toHaveLength(0);
  });

  test("an unknown company address can be assigned manually after verification", async () => {
    const { db, calls, approve } = setup();
    db.inbound_emails[0].recipient = `unrecognized@${domain}`;
    db.inbound_emails[0].company_id = null;
    await approve();
    expect(calls[0].params.p_company_id).toBe("company-1");
    expect(calls[0].params.p_intent_id).toBeNull();
  });

  test("a recipient on an unrelated domain cannot be approved", async () => {
    const { db, calls, approve } = setup();
    db.inbound_emails[0].recipient = "unrecognized@gmail.com";
    db.inbound_emails[0].company_id = null;
    await expect(approve()).rejects.toThrow(
      "Receiving domain is not configured",
    );
    expect(calls).toHaveLength(0);
  });
});
