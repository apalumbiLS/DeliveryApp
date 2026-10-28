/**
 * Lowe's share-cart emails — "Check out this Lowe's shopping cart."
 *
 * What this email gives us, and what it does not:
 *
 *   - **Three or more items**, each with a name, an `Item: #`, a `Model: #`, and
 *     a `Quantity`. Confirmed against a real 3-item cart.
 *   - **No prices at all.** No line totals, no subtotal, no tax — not a single
 *     `$` in the document. So there is nothing to reconcile against, and the
 *     dispatcher enters the materials cost by hand.
 *   - **No store, no aisle, no cart URL.** The only links are click-tracking
 *     redirects. The store comes from the customer's order intent (ADR-0010).
 *     Each item's redirect is kept anyway, so the review queue can link to it.
 *   - **No requester name.** The body says `Sent from the cart of <address>`,
 *     and the subject is generic.
 *
 * See docs/architecture/06-cart-parsing.md.
 */

import { load } from "cheerio";

import { isDomainOrSubdomainOf } from "@/lib/domain";

import type {
  CartParser,
  ParsedCart,
  ParsedItem,
  ParseInput,
  ParseResult,
  ParseSignals,
} from "./types";

const RETAILER = "lowes" as const;
const VERSION = "lowes@1.1.0";

/** Observed sender is `lowes@e.lowes.com`; the reply-to is also on this domain. */
const SENDER_PARENT_DOMAIN = "lowes.com";

/** Product images. `image.e.lowes.com` holds logos and spacer gifs, not products. */
const PRODUCT_IMAGE_HOST = "mobileimages.lowes.com";

/**
 * An item link, kept only when it is HTTPS on Lowe's own domain. The review
 * queue renders it outside the email's sandbox, so it is held to more than
 * "the email said so".
 */
function lowesLink(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === "https:" &&
      isDomainOrSubdomainOf(url.hostname, SENDER_PARENT_DOMAIN)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export const lowesCartParser: CartParser = {
  retailer: RETAILER,
  version: VERSION,
  senderParentDomain: SENDER_PARENT_DOMAIN,

  matches(senderDomain) {
    return isDomainOrSubdomainOf(senderDomain, SENDER_PARENT_DOMAIN);
  },

  parse({ bodyHtml }: ParseInput): ParseResult {
    const $ = load(bodyHtml);

    // Three counts of how many items the email holds, each derived a different
    // way: a text marker, a quantity marker, and an image host — none of them
    // by walking the blocks the parser walks. Agreement between them is
    // evidence; the block walk agreeing with itself would not be.
    const signals: ParseSignals = {
      itemMarkers: (bodyHtml.match(/Item:\s*#/g) ?? []).length,
      quantities: (bodyHtml.match(/Quantity\s+\d+/g) ?? []).length,
      productImages: (
        bodyHtml.match(
          new RegExp(`${PRODUCT_IMAGE_HOST.replace(/\./g, "\\.")}/productimages/`, "g"),
        ) ?? []
      ).length,
    };

    const items: ParsedItem[] = [];
    const problems: string[] = [];

    $(`img[src*="${PRODUCT_IMAGE_HOST}"]`).each((index, element) => {
      const $image = $(element);

      // The image lives in a nested table inside the item's own
      // `table.container`, which also holds the name, the identifiers, and the
      // quantity. Scoping to that container keeps one item's fields from
      // bleeding into the next.
      const $container = $image.closest("table.container");
      const $scope = $container.length > 0 ? $container : $image.closest("td");
      const text = $scope.text().replace(/\s+/g, " ");

      // The name is the only `<strong>` inside an anchor. `Quantity 3` is also
      // a `<strong>`, so this matches by structure, never by tag alone.
      const $name = $scope.find("a strong").first();
      const description = $name.text().replace(/\s+/g, " ").trim();
      const productUrl = lowesLink($name.closest("a").attr("href"));

      const storeSku = text.match(/Item:\s*#([^|\s]+)/)?.[1] ?? null;
      const modelNumber = text.match(/Model:\s*#([^\s|]+)/)?.[1] ?? null;
      const quantity = Number(text.match(/Quantity\s+(\d+)/)?.[1] ?? Number.NaN);

      const missing = [
        description ? null : "name",
        storeSku ? null : "item number",
        modelNumber ? null : "model number",
        Number.isInteger(quantity) && quantity > 0 ? null : "quantity",
      ].filter((entry): entry is string => entry !== null);

      if (missing.length > 0) {
        problems.push(`block ${index + 1} is missing its ${missing.join(", ")}`);
        return;
      }

      items.push({
        lineNo: items.length + 1,
        // Lowe's prints no brand separately; the name often leads with it, but
        // guessing where the brand ends would be worse than leaving it null.
        brand: null,
        description,
        modelNumber,
        storeSku,
        quantity,
        // The email states no prices whatsoever.
        lineTotalCents: null,
        unitPriceCents: null,
        imageUrl: $image.attr("src") ?? null,
        productUrl,
        aisle: null,
        bay: null,
      });
    });

    if (items.length === 0) {
      return {
        ok: false,
        reason:
          problems.length > 0
            ? `no readable item blocks — ${problems.join("; ")}`
            : "no item blocks found",
      };
    }

    // A partial cart is never an order. One unreadable block means we cannot
    // say what the customer asked for, and the review queue is the right place
    // for it.
    if (problems.length > 0) {
      return {
        ok: false,
        reason: `read ${items.length} of ${items.length + problems.length} blocks — ${problems.join("; ")}`,
        partial: { items },
      };
    }

    const cart: ParsedCart = {
      retailer: RETAILER,
      // The subject is generic ("Check out this Lowe's shopping cart.") and the
      // body gives an address rather than a name.
      requesterName: null,
      requesterEmail:
        bodyHtml.match(/Sent from the cart of\s*([^\s<]+@[^\s<]+)/)?.[1] ?? null,
      items,
      // Nothing to reconcile against, so `validateParsedCart` falls back to the
      // structural checks. This is the whole reason `totals` is nullable.
      totals: null,
    };

    return { ok: true, data: cart, signals, warnings: [] };
  },
};
