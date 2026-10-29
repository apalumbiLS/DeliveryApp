import { expect, test } from "bun:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  emptyDatabase,
  fakeSupabase,
} from "@/lib/intake/__fixtures__/fake-supabase";

import {
  isQueueView,
  listInboundExceptions,
  loadInboundIntentPreview,
  viewForStatus,
} from "./review-queue";

test("an order is listed in the tab its status belongs to", () => {
  expect(viewForStatus("received")).toBe("review");
  expect(viewForStatus("needs_review")).toBe("review");
  // Sent for approval: it leaves the queue but stays findable.
  expect(viewForStatus("awaiting_customer")).toBe("customer");
  for (const status of ["customer_confirmed", "delivered", "cancelled"]) {
    expect(viewForStatus(status)).toBe("all");
  }
});

test("only the three tabs are accepted from the URL", () => {
  for (const view of ["review", "customer", "all"]) {
    expect(isQueueView(view)).toBe(true);
  }
  for (const value of ["", "ALL", "paid", undefined, ["all"]]) {
    expect(isQueueView(value)).toBe(false);
  }
});

test("review includes pending inbound mail but excludes resolved mail", async () => {
  const db = emptyDatabase();
  db.companies.push({ id: "company-1", name: "Pilot company" });
  db.inbound_emails.push(
    {
      id: "provisional",
      company_id: "company-1",
      recipient: "company@orders.example.com",
      sender_email: "bounce@e.lowes.com",
      review_reason: "Retailer unverified",
      review_status: "pending",
      order_id: null,
      received_at: "2026-10-12T12:00:00Z",
    },
    {
      id: "unknown",
      company_id: null,
      recipient: "wrong@orders.example.com",
      sender_email: "bounce@e.lowes.com",
      review_reason: "Unknown company address",
      review_status: "pending",
      order_id: null,
      received_at: "2026-10-12T13:00:00Z",
    },
    {
      id: "finished",
      company_id: "company-1",
      review_status: "approved",
      order_id: "order-1",
      received_at: "2026-10-12T14:00:00Z",
    },
    {
      id: "dismissed",
      company_id: null,
      review_status: "dismissed",
      order_id: null,
      received_at: "2026-10-12T15:00:00Z",
    },
  );
  const rows = await listInboundExceptions(
    fakeSupabase(db) as unknown as SupabaseClient,
  );
  expect(rows.map((row) => row.id)).toEqual(["provisional", "unknown"]);
  expect(rows[0].companyName).toBe("Pilot company");
  expect(rows[1].companyName).toBeNull();
  expect(rows[1].reason).toBe("Unknown company address");
});

test("a fresh token previews its company, site and store; a used token does not reuse them", async () => {
  const db = emptyDatabase();
  const token = "a".repeat(32);
  db.companies.push({ id: "company-1", active: true });
  db.order_intents.push({
    id: "intent-1",
    email_token: token,
    company_id: "company-1",
    retailer: "lowes",
    status: "open",
    site_id: "site-1",
    retailer_store_id: "store-1",
    delivery_address: {
      line1: "42 Test Street",
      city: "Greenville",
      state: "SC",
      postalCode: "29601",
    },
  });
  db.company_sites = [{ id: "site-1", label: "Pilot site" }];
  db.retailer_stores = [{ id: "store-1", name: "Pilot Lowe's" }];
  const client = fakeSupabase(db) as unknown as SupabaseClient;
  const recipient = `delivery+${token}@orders.example.com`;
  expect(
    await loadInboundIntentPreview(client, recipient, "orders.example.com"),
  ).toEqual({
    companyId: "company-1",
    eligible: true,
    store: "Pilot Lowe's",
    site: "Pilot site",
    address: "42 Test Street · Greenville, SC · 29601",
  });
  db.order_intents[0].status = "matched";
  expect(
    await loadInboundIntentPreview(client, recipient, "orders.example.com"),
  ).toEqual({
    companyId: "company-1",
    eligible: false,
    store: null,
    site: null,
    address: null,
  });
});
