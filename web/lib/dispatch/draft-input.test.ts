import { describe, expect, test } from "bun:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deliveryFields,
  parseDeliveryDraft,
  parseQuoteDraft,
  saveDispatcherDraft,
} from "./draft-input";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const address = {
  line1: "42 Test Street",
  line2: "Building B",
  city: "Greenville",
  state: "SC",
  postalCode: "29601",
  contactName: "Site lead",
  contactPhone: "(864) 555-0100",
  instructions: "Call on arrival",
};

describe("dispatcher draft inputs", () => {
  test("accepts a complete delivery snapshot with contact", () => {
    expect(parseDeliveryDraft(form(address))).toEqual({
      ok: true,
      value: address,
    });
  });

  test("rejects missing address or on-site contact", () => {
    expect(parseDeliveryDraft(form({ ...address, city: "" })).ok).toBe(false);
    expect(parseDeliveryDraft(form({ ...address, contactName: "" })).ok).toBe(
      false,
    );
    expect(
      parseDeliveryDraft(form({ ...address, contactPhone: "123" })).ok,
    ).toBe(false);
  });

  test("reads a portal address without inventing a contact", () => {
    expect(
      deliveryFields({ line1: "42 Test Street", city: "Greenville" }, null),
    ).toEqual({
      line1: "42 Test Street",
      line2: "",
      city: "Greenville",
      state: "",
      postalCode: "",
      contactName: "",
      contactPhone: "",
      instructions: "",
    });
  });

  test("sends one audited RPC and reports database errors", async () => {
    const calls: unknown[] = [];
    const fake = {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return { data: "order-1", error: null };
      },
    } as unknown as SupabaseClient;
    expect(
      await saveDispatcherDraft(fake, "order-1", "store", {
        storeId: "store-1",
      }),
    ).toBe(true);
    expect(calls).toEqual([
      [
        "update_dispatcher_draft",
        {
          p_order_id: "order-1",
          p_kind: "store",
          p_values: { storeId: "store-1" },
        },
      ],
    ]);
    const failing = {
      rpc: async () => ({ data: null, error: { message: "write failed" } }),
    } as unknown as SupabaseClient;
    expect(
      await saveDispatcherDraft(failing, "order-1", "quote", {
        materialsCents: 0,
      }),
    ).toBe(false);
    const disconnected = {
      rpc: async () => {
        throw new Error("Network unavailable");
      },
    } as unknown as SupabaseClient;
    expect(
      await saveDispatcherDraft(disconnected, "order-1", "store", {
        storeId: "store-1",
      }),
    ).toBe(false);
  });

  test("prices exact cents and rejects malformed or oversized amounts", () => {
    expect(
      parseQuoteDraft(
        form({
          deliverySize: "pickup",
          materials: "$1,234.56",
          sizing: "5",
          mileage: "",
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        deliverySize: "pickup",
        materialsCents: 123456,
        sizingCents: 500,
        mileageCents: 0,
      },
    });
    for (const amount of ["1.999", "-1", "1000000", "unknown"]) {
      expect(
        parseQuoteDraft(form({ deliverySize: "pickup", materials: amount })).ok,
      ).toBe(false);
    }
    expect(
      parseQuoteDraft(form({ deliverySize: "", materials: "10" })).ok,
    ).toBe(false);
  });
});
