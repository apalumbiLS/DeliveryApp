import { expect, test } from "bun:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  emptyDatabase,
  fakeSupabase,
} from "@/lib/intake/__fixtures__/fake-supabase";

import { listInboundExceptions } from "./review-queue";

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
