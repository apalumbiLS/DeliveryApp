# Customer guide — Lowe's cart intake prototype

> **Status:** This describes the cart-request stage only. Dispatcher review, driver delivery, checkout, automatic updates and payment are not end-to-end customer features yet. Do not use this as a same-day delivery promise. The previous low-tech runbook is historical.

## How to submit a request

1. **Recommended:** Sign in to the portal and start a request before building the cart. Choose your job site and preferred Lowe's store; the portal provides a unique `delivery+<token>@<receiving-domain>` address for this request.
2. Build a cart on **Lowe's** for the selected store. Check availability, then use **Share Cart** to send it to the exact order-specific address the portal gave you. **Do not purchase or check out at Lowe's.** A shared cart is a request, not a reservation or an order.
3. **Fallback:** If you skip the portal, send the cart to `delivery@mg.getlockstep.io`. The dispatcher must confirm your company, job site, and store manually. Do not use an address the app says is not ready; the old Gmail inbox and previously seeded `things.dispatch+<company>` address are not the advertised pilot route.
4. A dispatcher checks the items against the original Lowe's email and contacts you for missing on-site contact, materials estimate and delivery fee. **Lowe's share-cart email does not include prices, store or job-site information.**

```mermaid
flowchart LR
    A[Choose site and store in portal] --> B[Get order-specific address]
    B --> C[Build and share Lowe's cart]
    X[Skip portal: use shared address] --> C
    C --> D[Dispatcher reviews items and missing details]
    D --> E[Human follow-up; no automatic checkout email]
```

## Before you share

- Use the **exact receiving address** supplied by the dispatcher or optional portal. The message comes from Lowe's; a one-use address identifies your saved site/store, while the shared `delivery@` address requires manual company confirmation.
- If you have several active job sites, provide the specific delivery address and preferred Lowe's location directly to the dispatcher. Do not assume the application inferred either from the cart.
- Do not treat a successful share or a status in the portal as confirmation that a driver has accepted a job, that materials have been purchased, or that any email from the application was sent.
- If you need to correct the cart, tell the dispatcher which email is the replacement. A genuinely new share-cart message may become a separate request; the old one is not automatically overwritten.

## What is not live yet

Automatic customer acknowledgement, checkout/price approval links, in-app substitutions, driver status alerts, payment links and Home Depot/Ace cart parsing remain future work. Existing `awaiting_customer` orders from the earlier prototype **did not cause an email to be sent**. Contact the dispatcher for status; do not wait for an automated message that has not been built.

## Related

- [Dispatcher guide](dispatcher-guide.md) · [Email intake architecture](../architecture/05-email-intake.md)
