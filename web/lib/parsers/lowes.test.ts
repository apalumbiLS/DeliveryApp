import { describe, expect, test } from "bun:test";

import { readEmlFixture } from "./__fixtures__/read-eml";
import { parseCart, selectParser, senderDomain } from "./index";

/**
 * The golden file: a real Lowe's cart, committed as the retailer sent it.
 *
 * It is an `.eml` rather than a `.html` so the test exercises the whole input
 * path — headers, transfer encoding, and body — and cannot drift from the
 * artifact a customer actually produced.
 *
 * Note this cart is a **3-item** one. That is what confirms the parser handles
 * more than a single row, which the Home Depot samples never did.
 */
const fixture = readEmlFixture("lowes/multi-item.eml");

describe("LowesCartParser", () => {
  test("reads a redacted structural excerpt from a second pilot cart", () => {
    const bodyHtml = `
      <p>Sent from the cart of pilot@example.com</p>
      <table class="container"><tr><td>
        <img src="https://mobileimages.lowes.com/productimages/washer.jpeg">
        <a><strong>Top-load washer</strong></a>
        Item: #5684052 | Model: #GTW485ASWWB <strong>Quantity 1</strong>
      </td></tr></table>
      <table class="container"><tr><td>
        <img src="https://mobileimages.lowes.com/productimages/hose.jpeg">
        <a><strong>Stainless washing machine connector</strong></a>
        Item: #246995 | Model: #98506 <strong>Quantity 1</strong>
      </td></tr></table>
      <table class="container"><tr><td>
        <img src="https://mobileimages.lowes.com/productimages/trim.jpeg">
        <a><strong>Oak reducer floor moulding trim</strong></a>
        Item: #6570526 | Model: #LX50305083 <strong>Quantity 1</strong>
      </td></tr></table>`;
    const outcome = parseCart({
      bodyHtml,
      senderEmail: "bounce@bounce.e.lowes.com",
      subject: "Check out this Lowe's shopping cart.",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      outcome.cart.items.map((item) => [
        item.storeSku,
        item.modelNumber,
        item.quantity,
      ]),
    ).toEqual([
      ["5684052", "GTW485ASWWB", 1],
      ["246995", "98506", 1],
      ["6570526", "LX50305083", 1],
    ]);
    expect(outcome.cart.requesterEmail).toBe("pilot@example.com");
    expect(outcome.cart.totals).toBeNull();
  });

  test("reads the captured cart exactly", () => {
    const outcome = parseCart(fixture);

    if (!outcome.ok) {
      throw new Error(`expected a parse, got: ${outcome.reason}`);
    }

    expect(outcome.retailer).toBe("lowes");
    expect(outcome.parserVersion).toBe("lowes@1.1.0");

    // Lowe's gives an address, not a name, and the subject is generic.
    expect(outcome.cart.requesterEmail).toBe(
      "anthony.palumbi@locksmithconsulting.com",
    );
    expect(outcome.cart.requesterName).toBeNull();

    expect(
      outcome.cart.items.map((item) => [
        item.storeSku,
        item.modelNumber,
        item.quantity,
      ]),
    ).toEqual([
      ["552328", "Y2L40408-GC", 3],
      ["95991", "LUS26Z", 6],
      ["132109", "354502999", 2],
    ]);

    expect(outcome.cart.items.map((item) => item.description)).toEqual([
      "4-in x 4-in x 8-ft #2 Southern yellow pine Ground contact Pressure Treated Lumber (Recommended for Deck Boards)",
      "LUS 2-in x 6-in Single 18 -Gauge ZMAX Face mount joist hanger",
      "50 -lb Concrete mix",
    ]);

    expect(outcome.cart.items.map((item) => item.imageUrl)).toEqual([
      "https://mobileimages.lowes.com/productimages/7b2b609f-cfe1-43b9-b163-34542d5d3a1c/02331019.jpg",
      "https://mobileimages.lowes.com/productimages/63968777-1108-4ceb-9383-da328eda5776/102235444.jpeg",
      "https://mobileimages.lowes.com/productimages/d359a7bc-47af-4e15-b9a8-db195147ac9d/62218573.jpg",
    ]);

    // Each name links through Lowe's click tracker, and each line gets its own.
    const links = outcome.cart.items.map((item) => item.productUrl);
    expect(
      links.every((link) =>
        link?.startsWith("https://click.e.lowes.com/u/?qs="),
      ),
    ).toBe(true);
    expect(new Set(links).size).toBe(links.length);
  });

  test("invents no money, because the email states none", () => {
    const outcome = parseCart(fixture);
    if (!outcome.ok) throw new Error(outcome.reason);

    // The whole reason `totals` and the money fields are nullable: a missing
    // price must never be mistaken for a price of zero.
    expect(outcome.cart.totals).toBeNull();
    expect(
      outcome.cart.items.every(
        (item) => item.lineTotalCents === null && item.unitPriceCents === null,
      ),
    ).toBe(true);
  });

  test("agrees across three independently-derived item counts", () => {
    const outcome = parseCart(fixture);
    if (!outcome.ok) throw new Error(outcome.reason);

    // Derived by a text marker, a quantity marker, and an image host — none of
    // them by walking the blocks the parser walks. This is the structural
    // stand-in for reconciling against a subtotal Lowe's does not print.
    expect(outcome.signals).toEqual({
      itemMarkers: 3,
      quantities: 3,
      productImages: 3,
    });
    expect(outcome.cart.items).toHaveLength(3);
  });

  test("rejects a cart whose blocks repeat, which is how a duplicated view would look", () => {
    // The email carries no totals, so nothing would reconcile a doubled cart
    // arithmetically. The duplicate-identifier check is what stands in for
    // that: a second view of the same items repeats their item numbers.
    const doubled = fixture.bodyHtml
      .replace(/Item:\s*#95991/, "Item: #552328")
      .replace(/Model:\s*#LUS26Z/, "Model: #Y2L40408-GC");

    const outcome = parseCart({ ...fixture, bodyHtml: doubled });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("duplicate_item");
  });

  test("rejects a block whose quantity marker is gone", () => {
    const broken = fixture.bodyHtml.replace(/Quantity\s+6\b/, "Qty 6");

    const outcome = parseCart({ ...fixture, bodyHtml: broken });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    // The block is unreadable, so the parser stops before the cross-count check
    // would have run. Precedence matters: name the real cause, not a symptom.
    expect(outcome.reason).toContain("missing its quantity");
  });

  test("rejects a cart whose counts disagree", () => {
    // An extra marker that no block claims: the block walk still finds three,
    // the text-derived count finds four. Nothing else about the cart changes,
    // which is exactly the drift the cross-count exists to catch.
    const outcome = parseCart({
      ...fixture,
      bodyHtml: `${fixture.bodyHtml}<p>Item: #999999</p>`,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("count_mismatch");
  });

  test("rejects a body with no items at all", () => {
    const outcome = parseCart({
      ...fixture,
      bodyHtml: "<html><body><p>Nothing here.</p></body></html>",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain("no item blocks");
  });

  test("rejects a block that is missing an identifier", () => {
    // A partial cart is never an order: one unreadable block means we cannot
    // say what the customer asked for.
    const broken = fixture.bodyHtml.replace(/Item:\s*#132109/, "Item: #");

    const outcome = parseCart({ ...fixture, bodyHtml: broken });

    expect(outcome.ok).toBe(false);
  });
});

describe("parser selection", () => {
  test("claims Lowe's senders, including subdomains", () => {
    for (const sender of [
      "lowes@e.lowes.com",
      "lowes@lowes.com",
      "no-reply@click.lowes.com",
      "LOWES@E.LOWES.COM",
    ]) {
      expect(selectParser(sender)?.retailer).toBe("lowes");
    }
  });

  test("does not claim a domain that merely ends in the same letters", () => {
    // `endsWith("lowes.com")` without a dot boundary would accept all of these,
    // handing a spoofed sender the wrong parser — or any parser at all.
    for (const sender of [
      "phish@notlowes.com",
      "phish@evillowes.com",
      "phish@lowes.com.attacker.net",
    ]) {
      expect(selectParser(sender)).toBeNull();
    }
  });

  test("finds no parser for a retailer that is deferred", () => {
    // Home Depot is deferred; its mail must land in the review queue rather
    // than being handed to a parser that does not exist.
    expect(selectParser("HomeDepot@order.homedepot.com")).toBeNull();
  });

  test("extracts the domain from a bare address or a full header", () => {
    expect(senderDomain("lowes@e.lowes.com")).toBe("e.lowes.com");
    expect(senderDomain("Lowe's Home Improvement <lowes@e.lowes.com>")).toBe(
      "e.lowes.com",
    );
    expect(senderDomain("LOWES@E.LOWES.COM")).toBe("e.lowes.com");
    expect(senderDomain("no-at-sign")).toBe("");
  });
});
