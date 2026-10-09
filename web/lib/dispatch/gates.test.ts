import { describe, expect, test } from "bun:test";

import { blockingGate, computeGates, type GateInput } from "./gates";

function input(overrides: Partial<GateInput> = {}): GateInput {
  return {
    parseSucceeded: true,
    itemCount: 3,
    storeName: "LOWE'S OF APEX, NC",
    storeMiles: 1.8,
    nearestMiles: 1.8,
    hasDeliveryAddress: true,
    deliverySize: "pickup",
    materialsCents: 15_974,
    totalCents: 18_474,
    ...overrides,
  };
}

function stateOf(gates: ReturnType<typeof computeGates>, key: string) {
  return gates.find((gate) => gate.key === key)?.state;
}

describe("computeGates", () => {
  test("passes everything when the order is ready", () => {
    const gates = computeGates(input());

    expect(gates.map((gate) => gate.state)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
    ]);
    expect(blockingGate(gates)).toBeNull();
  });

  test("fails the items when the cart could not be read", () => {
    const gates = computeGates(input({ parseSucceeded: false, itemCount: 0 }));

    expect(stateOf(gates, "items")).toBe("fail");
    expect(blockingGate(gates)?.key).toBe("items");
  });

  test("marks the store as to-do when none is chosen", () => {
    const gates = computeGates(input({ storeName: null, storeMiles: null }));

    // `todo`, not `fail`: nothing is wrong, the dispatcher simply has not
    // chosen yet — and the two call for different reactions.
    expect(stateOf(gates, "store")).toBe("todo");
    expect(blockingGate(gates)?.key).toBe("store");
  });

  test("warns but does not block when the store is much further than the nearest", () => {
    const gates = computeGates(input({ storeMiles: 9, nearestMiles: 1.8 }));

    expect(stateOf(gates, "store")).toBe("warn");
    // The customer chose that store, and may have a reason. A warning that
    // blocks is a warning the dispatcher learns to ignore.
    expect(blockingGate(gates)).toBeNull();
  });

  test("does not warn over a trivial difference", () => {
    const gates = computeGates(input({ storeMiles: 2.0, nearestMiles: 1.8 }));

    expect(stateOf(gates, "store")).toBe("pass");
  });

  test("fails the address when the customer captured none", () => {
    const gates = computeGates(input({ hasDeliveryAddress: false }));

    // `fail` rather than `todo`: the dispatcher cannot conjure an address, and
    // the detail says where it comes from.
    expect(stateOf(gates, "address")).toBe("fail");
    expect(blockingGate(gates)?.key).toBe("address");
  });

  test("marks the price as to-do until a size is picked", () => {
    const gates = computeGates(input({ deliverySize: null, totalCents: 0 }));

    expect(stateOf(gates, "price")).toBe("todo");
    expect(gates.find((gate) => gate.key === "price")?.detail).toContain(
      "pick a size",
    );
  });

  test("names the materials cost specifically once a size is picked", () => {
    // Lowe's prints no prices, so this is the common case rather than an edge.
    const gates = computeGates(input({ materialsCents: 0, totalCents: 0 }));

    expect(gates.find((gate) => gate.key === "price")?.detail).toContain(
      "materials cost",
    );
  });

  test("does not block on distance when either side has no coordinates", () => {
    // A typed address gets a ZIP centroid, and a ZIP outside the seeded area
    // gets nothing. The gate must not invent a warning from missing data.
    const gates = computeGates(input({ storeMiles: null, nearestMiles: null }));

    expect(stateOf(gates, "store")).toBe("pass");
  });
});
