import { describe, expect, test } from "bun:test";

import type { Gate } from "./gates";
import { canQueueInvite, CHECKOUT_INVITES_ENABLED } from "./invite";

const PASSING: Gate[] = [
  { key: "items", label: "Items", state: "pass" },
  { key: "store", label: "Store", state: "pass" },
  { key: "address", label: "Address", state: "pass" },
  { key: "price", label: "Size & price", state: "pass" },
];

function input(overrides: Partial<Parameters<typeof canQueueInvite>[0]> = {}) {
  return {
    status: "received",
    gates: PASSING,
    inviteRecipient: "customer@example.com",
    inviteQueued: false,
    ...overrides,
  };
}

describe("canQueueInvite", () => {
  test("keeps actual checkout invitation delivery disabled for this prototype", () => {
    expect(CHECKOUT_INVITES_ENABLED).toBe(false);
  });

  test("allows an order that is verified, addressed and still in the queue", () => {
    expect(canQueueInvite(input())).toEqual({ ok: true });
  });

  test("allows one that came from the review queue", () => {
    expect(canQueueInvite(input({ status: "needs_review" }))).toEqual({
      ok: true,
    });
  });

  test("refuses a second invite", () => {
    const decision = canQueueInvite(input({ inviteQueued: true }));
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toContain("already queued");
  });

  test("refuses while any gate is unresolved", () => {
    // The button is disabled in this state, but a server action can be invoked
    // directly — this is the guard that actually holds.
    for (const state of ["fail", "todo"] as const) {
      const gates = PASSING.map((gate) =>
        gate.key === "price" ? { ...gate, state } : gate,
      );
      const decision = canQueueInvite(input({ gates }));
      expect(decision.ok).toBe(false);
      if (decision.ok) continue;
      expect(decision.reason).toContain("size & price");
    }
  });

  test("allows a warning, because a warning is not a block", () => {
    const gates = PASSING.map((gate) =>
      gate.key === "store" ? { ...gate, state: "warn" as const } : gate,
    );
    expect(canQueueInvite(input({ gates }))).toEqual({ ok: true });
  });

  test("refuses when there is no address to invite", () => {
    const decision = canQueueInvite(input({ inviteRecipient: null }));
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toContain("no address");
  });

  test("refuses once the order has moved past the queue", () => {
    for (const status of [
      "awaiting_customer",
      "customer_confirmed",
      "driver_requested",
      "delivered",
      "paid",
      "closed",
      "cancelled",
    ]) {
      const decision = canQueueInvite(input({ status }));
      expect(decision.ok).toBe(false);
      if (decision.ok) continue;
      expect(decision.reason).toContain(status);
    }
  });
});
