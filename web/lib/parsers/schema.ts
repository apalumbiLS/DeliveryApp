/**
 * One shape for every retailer, and the checks that establish a cart was read
 * correctly.
 *
 * The schema is deliberately permissive about things that cannot make an order
 * wrong — a missing image URL, an absent brand — and strict about the things
 * that can: an empty description, a zero quantity, a count that does not add up.
 *
 * See docs/architecture/06-cart-parsing.md.
 */

import { z } from "zod";

import type { ParsedCart, ParseSignals } from "./types";

const cents = z.number().int().nonnegative();

export const ParsedItemSchema = z.object({
  lineNo: z.number().int().nonnegative(),
  brand: z.string().nullable(),
  description: z.string().min(1),
  modelNumber: z.string().nullable(),
  storeSku: z.string().nullable(),
  quantity: z.number().int().positive(),
  lineTotalCents: cents.nullable(),
  unitPriceCents: cents.nullable(),
  // Not `z.url()`. A malformed image URL is cosmetic, and failing a whole cart
  // over one would turn a good order into a review-queue entry.
  imageUrl: z.string().nullable(),
  // Defaulted rather than required: parse output stored before the field
  // existed is validated again when a provisional email is finalized.
  productUrl: z.string().nullable().default(null),
  aisle: z.string().nullable(),
  bay: z.string().nullable(),
});

export const ParsedTotalsSchema = z.object({
  subtotalCents: cents,
  shippingCents: cents,
  taxCents: cents,
  estimatedTotalCents: cents,
});

export const ParsedCartSchema = z.object({
  retailer: z.enum(["homedepot", "lowes"]),
  requesterName: z.string().nullable(),
  requesterEmail: z.string().nullable(),
  items: z.array(ParsedItemSchema).min(1),
  totals: ParsedTotalsSchema.nullable(),
});

export type ValidationIssue = { code: string; detail: string };

/** Rounding slack. A cent either way is a rounding artefact, not a misread line. */
const CENT_TOLERANCE = 1;

/**
 * The checks a schema cannot express.
 *
 * A cart that fails any of these is a parse failure, not a warning: the whole
 * point is that we would rather put an order in front of a dispatcher than
 * quietly create a wrong one.
 */
export function validateParsedCart(
  cart: ParsedCart,
  signals: ParseSignals,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Three independent counts of how many items the email holds. They are
  // derived differently on purpose — a block walk, a text marker, and an image
  // host — so agreement is evidence rather than a tautology. This is the
  // structural stand-in for reconciling against a subtotal, which Lowe's does
  // not print.
  const signalCounts: [keyof ParseSignals, number][] = [
    ["itemMarkers", signals.itemMarkers],
    ["quantities", signals.quantities],
    ["productImages", signals.productImages],
  ];

  for (const [name, count] of signalCounts) {
    if (count !== cart.items.length) {
      issues.push({
        code: "count_mismatch",
        detail: `${name} found ${count}, parser produced ${cart.items.length}`,
      });
    }
  }

  // A repeated identifier means a block was matched twice, not that a cart
  // legitimately holds two identical lines.
  const seen = new Map<string, number>();
  for (const item of cart.items) {
    const key = item.modelNumber ?? item.storeSku ?? item.description;
    const previous = seen.get(key);
    if (previous !== undefined) {
      issues.push({
        code: "duplicate_item",
        detail: `line ${item.lineNo} repeats line ${previous} (${key})`,
      });
    } else {
      seen.set(key, item.lineNo);
    }
  }

  // Only when the retailer actually stated totals. Absent totals are not a
  // failure — they are why `lineTotalCents` is nullable.
  if (cart.totals) {
    const lineSum = cart.items.reduce(
      (total, item) => total + (item.lineTotalCents ?? 0),
      0,
    );

    if (Math.abs(lineSum - cart.totals.subtotalCents) > CENT_TOLERANCE) {
      issues.push({
        code: "subtotal_mismatch",
        detail: `lines sum to ${lineSum}, the email states ${cart.totals.subtotalCents}`,
      });
    }

    const components =
      cart.totals.subtotalCents +
      cart.totals.shippingCents +
      cart.totals.taxCents;

    if (Math.abs(components - cart.totals.estimatedTotalCents) > CENT_TOLERANCE) {
      issues.push({
        code: "total_mismatch",
        detail: `subtotal + shipping + tax = ${components}, the email states ${cart.totals.estimatedTotalCents}`,
      });
    }
  }

  return issues;
}

/** A single sentence for `parse_attempts.errors` and the review queue. */
export function describeIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.code}: ${issue.detail}`).join("; ");
}
