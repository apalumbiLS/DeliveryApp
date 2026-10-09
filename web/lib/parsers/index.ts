/**
 * Parser selection and the one entry point intake calls.
 *
 * Retailer is identified by **sender domain**, never by the recipient and never
 * by anything in the body: the retailer sends the email, so the domain is the
 * only field a customer cannot influence. Attribution to a company happens
 * elsewhere, from the recipient alias.
 *
 * See docs/architecture/06-cart-parsing.md.
 */

import { lowesCartParser } from "./lowes";
import {
  ParsedCartSchema,
  describeIssues,
  validateParsedCart,
} from "./schema";
import type { CartParser, ParsedCart, ParseInput, ParseSignals } from "./types";

export const PARSERS: readonly CartParser[] = [lowesCartParser];

/**
 * The domain of a sender, from either a bare address (`lowes@e.lowes.com`) or a
 * full header (`Lowe's Home Improvement <lowes@e.lowes.com>`).
 *
 * Mailgun's `sender` field is the bare envelope address, but accepting the
 * header form too costs one line and removes a footgun for any caller holding
 * the raw `From`.
 */
export function senderDomain(senderEmail: string): string {
  const address = senderEmail.match(/<([^>]+)>/)?.[1] ?? senderEmail;
  const at = address.lastIndexOf("@");
  return at === -1 ? "" : address.slice(at + 1).trim().toLowerCase();
}

/** The parser for this sender, or null when no retailer claims it. */
export function selectParser(senderEmail: string): CartParser | null {
  const domain = senderDomain(senderEmail);
  if (!domain) return null;
  return PARSERS.find((parser) => parser.matches(domain)) ?? null;
}

export type CartParseOutcome =
  | {
      ok: true;
      retailer: ParsedCart["retailer"];
      parserVersion: string;
      cart: ParsedCart;
      signals: ParseSignals;
      warnings: string[];
    }
  | {
      ok: false;
      /** Null when no parser claimed the sender, so there is no version to blame. */
      parserVersion: string | null;
      reason: string;
      /** Best-effort output for `parse_attempts`. Never becomes an order. */
      partial?: unknown;
    };

/**
 * Select a parser, run it, and hold the result to the shared schema and checks.
 *
 * A failure here is a `needs_review` order, not an exception: the dispatcher
 * resolves it, and the reason is recorded so drift is visible.
 */
export function parseCart(input: ParseInput): CartParseOutcome {
  const parser = selectParser(input.senderEmail);

  if (!parser) {
    const domain = senderDomain(input.senderEmail);
    return {
      ok: false,
      parserVersion: null,
      reason: domain
        ? `no parser handles mail from ${domain}`
        : "sender address has no domain",
    };
  }

  const result = parser.parse(input);

  if (!result.ok) {
    return {
      ok: false,
      parserVersion: parser.version,
      reason: result.reason,
      partial: result.partial,
    };
  }

  // A runtime guard on the parser's own output. It should never fire; if it
  // does, the parser has a bug and the cart must not become an order.
  const shape = ParsedCartSchema.safeParse(result.data);

  if (!shape.success) {
    return {
      ok: false,
      parserVersion: parser.version,
      reason: `shape: ${shape.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}`,
      partial: result.data,
    };
  }

  const issues = validateParsedCart(shape.data, result.signals);

  if (issues.length > 0) {
    return {
      ok: false,
      parserVersion: parser.version,
      reason: describeIssues(issues),
      partial: shape.data,
    };
  }

  return {
    ok: true,
    retailer: shape.data.retailer,
    parserVersion: parser.version,
    cart: shape.data,
    signals: result.signals,
    warnings: result.warnings,
  };
}

export { lowesCartParser };
export * from "./types";
export { ParsedCartSchema, validateParsedCart, describeIssues } from "./schema";
