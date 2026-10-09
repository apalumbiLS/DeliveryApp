/**
 * The contract every retailer parser satisfies.
 *
 * A parser is a pure function over an email: `{ bodyHtml, subject, senderEmail }`
 * in, a validated `ParsedCart` or a reason out. It knows nothing about the
 * database, the webhook, or who called it — which is what makes it testable
 * against a committed fixture and what lets a second retailer be added without
 * touching the intake pipeline.
 *
 * See docs/architecture/06-cart-parsing.md.
 */

export type Retailer = "homedepot" | "lowes";

export type ParsedItem = {
  /** 1-based, in the order the retailer printed them. */
  lineNo: number;
  brand: string | null;
  description: string;
  /**
   * The manufacturer's model number.
   *
   * Note the two retailers label differently: Lowe's prints `Model: #Y2L40408-GC`
   * and that is this field, while Home Depot's `Model #9988872` is *its own*
   * catalogue number and lands here too. Revisit if Home Depot returns.
   */
  modelNumber: string | null;
  /** The retailer's own identifier — Lowe's `Item: #552328`. */
  storeSku: string | null;
  quantity: number;
  /**
   * Null when the retailer's email carries no prices. Lowe's does not, which is
   * why these are nullable: a missing price must not be mistaken for a zero.
   */
  lineTotalCents: number | null;
  /** Derived from `lineTotalCents / quantity`. Display only — the line total is authoritative. */
  unitPriceCents: number | null;
  imageUrl: string | null;
  /** Store-scoped, so only meaningful against a confirmed store. */
  aisle: string | null;
  bay: string | null;
};

export type ParsedTotals = {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  estimatedTotalCents: number;
};

export type ParsedCart = {
  retailer: Retailer;
  /** Home Depot puts this in the subject; Lowe's provides no name at all. */
  requesterName: string | null;
  /** Lowe's prints `Sent from the cart of <address>`; Home Depot prints nothing. */
  requesterEmail: string | null;
  items: ParsedItem[];
  /** Null when the email states no totals — see `lineTotalCents`. */
  totals: ParsedTotals | null;
};

export type ParseInput = {
  /** The HTML part. Production gets this from Mailgun, which has already decoded MIME. */
  bodyHtml: string;
  subject: string | null;
  senderEmail: string;
};

/**
 * Independent counts of how many items the email appears to contain.
 *
 * The three are derived differently — a block walk, a text marker, and an image
 * host — so agreement between them is real evidence rather than a tautology.
 * This is the structural replacement for reconciling against a stated subtotal,
 * which Lowe's does not print.
 */
export type ParseSignals = {
  itemMarkers: number;
  quantities: number;
  productImages: number;
};

export type ParseResult =
  | {
      ok: true;
      data: ParsedCart;
      signals: ParseSignals;
      warnings: string[];
    }
  | {
      ok: false;
      reason: string;
      /** Best-effort output, for diagnostics on `parse_attempts`. Never an order. */
      partial?: unknown;
    };

export interface CartParser {
  readonly retailer: Retailer;
  /** Recorded on every `parse_attempts` row, so drift is attributable to a version. */
  readonly version: string;
  /**
   * The domain this retailer's mail comes from, and the domain its DKIM
   * signature must be under.
   *
   * One value serving both keeps them from drifting apart: intake selects this
   * parser by sender domain and then requires the same domain to have signed the
   * message. See docs/architecture/05-email-intake.md#sender-authenticity.
   */
  readonly senderParentDomain: string;
  /** Whether this parser handles mail from that sender domain. */
  matches(senderDomain: string): boolean;
  parse(input: ParseInput): ParseResult;
}
