import { describe, expect, test } from "bun:test";

import { canSendForApproval } from "./approval";
import type { Gate } from "./gates";

const PASSING: Gate[] = [
  { key: "items", label: "Items", state: "pass" },
  { key: "store", label: "Store", state: "pass" },
  { key: "address", label: "Address", state: "pass" },
  { key: "price", label: "Size & price", state: "pass" },
];

function input(
  overrides: Partial<Parameters<typeof canSendForApproval>[0]> = {},
) {
  return { status: "received", gates: PASSING, ...overrides };
}

describe("canSendForApproval", () => {
  test("allows an order that is verified and still in the queue", () => {
    expect(canSendForApproval(input())).toEqual({ ok: true });
  });

  test("allows one that came from the review queue", () => {
    expect(canSendForApproval(input({ status: "needs_review" }))).toEqual({
      ok: true,
    });
  });

  test("refuses while any gate is unresolved", () => {
    // The button is disabled in this state, but a server action can be invoked
    // directly — this is the guard that actually holds.
    for (const state of ["fail", "todo"] as const) {
      const gates = PASSING.map((gate) =>
        gate.key === "price" ? { ...gate, state } : gate,
      );
      const decision = canSendForApproval(input({ gates }));
      expect(decision.ok).toBe(false);
      if (decision.ok) continue;
      expect(decision.reason).toContain("size & price");
    }
  });

  test("allows a warning, because a warning is not a block", () => {
    const gates = PASSING.map((gate) =>
      gate.key === "store" ? { ...gate, state: "warn" as const } : gate,
    );
    expect(canSendForApproval(input({ gates }))).toEqual({ ok: true });
  });

  test("refuses once the order has been sent or moved past the queue", () => {
    for (const status of [
      "awaiting_customer",
      "customer_confirmed",
      "driver_requested",
      "delivered",
      "paid",
      "closed",
      "cancelled",
    ]) {
      const decision = canSendForApproval(input({ status }));
      expect(decision.ok).toBe(false);
      if (decision.ok) continue;
      expect(decision.reason).toContain(status);
    }
  });
});
