# ADR-0010: The customer captures the store and the delivery address when starting an order

- **Status:** Accepted
- **Date:** 2026-09-21
- **Deciders:** Delivery App team
- **Amends:** [ADR-0008](0008-dispatcher-assigns-store.md)

## Context

[ADR-0008](0008-dispatcher-assigns-store.md) established that a dispatcher selects the store from a seeded `retailer_stores` table during order review, because the share-cart email carries no store identifier. That finding has since been confirmed on a **second** Home Depot sample: no store name, number, address, or zip appears anywhere in the message, and the "View Cart" link resolves to the requester's own account cart, not a store-scoped page.

Two unknowns therefore sit at the *front* of every order:

1. **Which store** the cart was built against. Store-scoped data — aisle/bay, availability, pricing — depends on it, and a wrong pick sends a driver to the wrong place.
2. **Where it goes.** The delivery address is only collected at checkout, after the cart has arrived and been priced.

Both are answerable by the customer before they ever leave for the retailer's site, and the portal is the only place to ask.

## Decision

**The portal's "start an order" flow captures the delivery site, the retailer, and the store _before_ the customer builds the cart**, and stores them as an **order intent**:

1. **Site** — a saved `company_sites` row or a new address. This is also the anchor for the store lookup.
2. **Retailer** — Home Depot or Lowe's.
3. **Store** — the nearest store to the site from the seeded `retailer_stores` list, which the customer can override. Seeding a store now also captures its **store-page URL** (verified once, at seed time) and the retailer's own label for it.
4. **Instructions** — one screen per step: check your store, then build & share the cart, with a deep link to the store page and per-retailer copy for the button that sets it ("Set as My Store" / "Shop This Store").

> **Changed 2026-10-28:** the two instruction screens became one finish step — copy the address, then open the store page — with a first-time tutorial over it: set your store, shop Pickup Today items, email us your cart (Lowe's has no "Share Cart" button; it's the ✉ / Share icon, which opens Email Cart). The decision itself — capture site, retailer and store first, deep-link to the store page — stands.

The intent is matched to the order when the cart email arrives. **The order still originates only from an email** — an intent is a draft, not a new order source, so the email-intake decision is untouched.

The dispatcher's store step becomes a **confirmation** of the customer's choice rather than an entry, and the order page's store step remains the second human check.

## Consequences

### Positive

- The store is known before the cart is built, so the dispatcher starts from an answer instead of a guess, and the address is captured without a second conversation.
- The customer is guided to set their store on the retailer's site — the only place that setting actually lives.
- Aisle/bay becomes usable: it is store-scoped, and the order now carries a confirmed store to scope it to (see [12-deferred](../architecture/12-deferred-and-extension-points.md)).
- Deep-linking to the **store page** (not the homepage) removes the "find the store selector" hunt, which is the step most likely to defeat a non-technical user.
- Repeat customers converge: the last confirmed store per company can be defaulted next time, shrinking the flow to a confirmation.

### Negative / trade-offs

- **A new table and a matching problem.** Intents must be matched to arriving carts by alias and recency, and abandoned intents need a sweep.
- **Seeding grows.** Each store now needs a verified store-page URL and the retailer's own label, in addition to address and hours.
- **The gap narrows but does not close.** Nothing verifies the cart was actually built against the chosen store; the order page confirmation and the driver's card remain the backstops.
- **Carts can still arrive with no intent** — forwarded from the retailer's app, or from a new customer. The fallback is the ADR-0008 path: dispatcher enters the store, checkout collects the address.

## Alternatives considered

| Alternative | Why not |
|---|---|
| **Keep dispatcher-entered stores** (status quo) | Works, but leaves the store unknown until after the cart arrives, and it is the last manual step in intake |
| **Ask for the store at checkout instead** | Later is worse: the cart is already built, and the answer is no more reliable |
| **Infer the store from the delivery address** | A guess between several nearby stores, invisible until the driver arrives |
| **Read the store from the retailer's cart page** | HTTP 403 to non-browser requests (ADR-0008), and scraping it is a standing maintenance burden |
| **A store parameter in the retailer's URL** | No documented parameter exists on either site; Lowe's store selection is cookie-based and set by their own JavaScript |

## Revisit if

A retailer's share-cart email starts carrying the store, or either retailer ships a documented deep link that preselects one — either would remove the manual check and shrink the instructions to a single link.

## Related

- [ADR-0008](0008-dispatcher-assigns-store.md) — amended by this record
- [03-data-model](../architecture/03-data-model.md) — `order_intents` and `retailer_stores.store_url` to be added at implementation planning
- [06-cart-parsing](../architecture/06-cart-parsing.md) — the email carries no store, confirmed across two samples
- Portal mockups: `web/app/mockups/start` (the flow) and `web/app/mockups/orders/detail` (the order page)
