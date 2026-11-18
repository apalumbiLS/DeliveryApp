/**
 * What still blocks a complete dispatcher draft and any future checkout invite.
 *
 * Pure, so it can be tested without a database or a browser — and so the screen
 * and any future server-side guard agree on what "ready" means.
 *
 * The distinction that matters: **`todo` means the dispatcher has not filled
 * something in yet; `fail` means something is wrong.** Both block the invite,
 * but they call for different reactions, and a queue that blurs them teaches the
 * dispatcher to ignore the red ones.
 *
 * See docs/architecture/06-cart-parsing.md and the mockups at
 * app/mockups/dispatch/review-queue.tsx.
 */

import type { CheckState } from "@/components/console/check-row";

export type GateKey = "items" | "store" | "address" | "price";

export type Gate = {
  key: GateKey;
  label: string;
  state: CheckState;
  detail?: string;
};

export type GateInput = {
  /** Whether the parser read the cart. */
  parseSucceeded: boolean;
  itemCount: number;
  storeName: string | null;
  /** Distance from the job site, when both ends have coordinates. */
  storeMiles: number | null;
  nearestMiles: number | null;
  hasDeliveryAddress: boolean;
  hasSiteContact: boolean;
  deliverySize: string | null;
  materialsCents: number;
  sizingCents: number;
  mileageCents: number;
  /** Materials + sizing + mileage + tax − discount. */
  totalCents: number;
};

/**
 * How much further than the nearest store is worth flagging.
 *
 * A warning, never a block: the customer chose the store, and they may have a
 * reason — a trade account, stock they checked, a route they already drive.
 */
export const STORE_DISTANCE_WARNING_MILES = 2;

/**
 * The least either delivery fee can be. Fees start blank, and a floor above
 * zero means one left out by accident blocks the send, while a deal can still
 * bring a fee down to almost nothing.
 */
export const MIN_FEE_CENTS = 50;

function miles(value: number | null): string {
  return value === null ? "" : `${value.toFixed(1)} mi`;
}

/**
 * What the price still needs, short enough for the gate bar: the field when
 * one is missing, a count when several are. The form highlights which.
 */
function missingPrice(input: GateInput): string | null {
  const fee = (cents: number, name: string) =>
    cents >= MIN_FEE_CENTS
      ? null
      : cents > 0
        ? `${name} under $${(MIN_FEE_CENTS / 100).toFixed(2)}`
        : `${name} missing`;
  const missing = [
    input.deliverySize ? null : "pick a size",
    input.materialsCents > 0 ? null : "materials missing",
    fee(input.sizingCents, "sizing fee"),
    fee(input.mileageCents, "mileage fee"),
  ].filter((part): part is string => part !== null);
  if (missing.length === 0) {
    return input.totalCents > 0 ? null : "total is $0";
  }
  return missing.length === 1 ? missing[0] : `${missing.length} to fill in`;
}

export function computeGates(input: GateInput): Gate[] {
  const items: Gate =
    input.parseSucceeded && input.itemCount > 0
      ? {
          key: "items",
          label: "Items",
          state: "pass",
          detail: `${input.itemCount} line${input.itemCount === 1 ? "" : "s"}`,
        }
      : {
          key: "items",
          label: "Items",
          state: "fail",
          detail: "the cart could not be read — correct the lines",
        };

  let store: Gate;
  if (!input.storeName) {
    store = {
      key: "store",
      label: "Store",
      state: "todo",
      detail: "no store chosen",
    };
  } else if (
    input.storeMiles !== null &&
    input.nearestMiles !== null &&
    input.storeMiles - input.nearestMiles >= STORE_DISTANCE_WARNING_MILES
  ) {
    store = {
      key: "store",
      label: "Store",
      state: "warn",
      detail: `${(input.storeMiles - input.nearestMiles).toFixed(1)} mi further than the nearest`,
    };
  } else {
    store = {
      key: "store",
      label: "Store",
      state: "pass",
      detail:
        input.storeMiles === null ? input.storeName : miles(input.storeMiles),
    };
  }

  const address: Gate =
    input.hasDeliveryAddress && input.hasSiteContact
      ? { key: "address", label: "Address & contact", state: "pass" }
      : {
          key: "address",
          label: "Address & contact",
          state: "todo",
          detail: !input.hasDeliveryAddress
            ? "enter the delivery address"
            : "confirm an on-site contact",
        };

  // Lowe's prints no prices, so materials starts at zero and the dispatcher
  // enters it, and the fees too. That is a `todo`, not a failure.
  const priceMissing = missingPrice(input);
  const price: Gate =
    priceMissing === null
      ? {
          key: "price",
          label: "Size & price",
          state: "pass",
          detail: input.deliverySize ?? undefined,
        }
      : {
          key: "price",
          label: "Size & price",
          state: "todo",
          detail: priceMissing,
        };

  return [items, store, address, price];
}

/**
 * The first gate that blocks the invite, or null when nothing does.
 *
 * A `warn` is a warning and never blocks — see `STORE_DISTANCE_WARNING_MILES`.
 */
export function blockingGate(gates: Gate[]): Gate | null {
  return (
    gates.find((gate) => gate.state === "fail" || gate.state === "todo") ?? null
  );
}
