# Customer guide — Lowe's cart intake prototype

> **Status:** This describes the cart-request stage only. Dispatcher review, driver delivery, checkout, automatic updates and payment are not end-to-end customer features yet. Do not use this as a same-day delivery promise. The previous low-tech runbook is historical.

## How to submit a request

1. Build a cart on **Lowe's** for the location where the materials should be purchased. Check that the items appear available for pickup. **Do not purchase or check out at Lowe's.** A shared cart is a request, not a reservation or an order.
2. Use Lowe's **Share Cart** feature and enter **the Mailgun address assigned to your construction company** as the recipient. The dispatcher supplies that address after receiving-domain MX and the application webhook have been verified. It may retain a `things.dispatch+<company>`-style local part from the pilot, but it must be on the **new receiving domain, not `@gmail.com`**. Sharing to the former Gmail inbox does not create an order in this app.
3. Alternatively, if you have a portal login, you can use the optional start-an-order flow first to record your job site and preferred Lowe's store. Once migration `0008` is applied **and** the receiving path is verified, that flow shows an address specific to this cart; share the cart to that address. If you skip the portal, use your company's stable Mailgun address and the dispatcher collects site/store details. Neither address should be used while the app says cart intake is not ready.
4. A dispatcher checks the items against the original Lowe's email and contacts you for any missing job-site address, store, on-site contact, materials estimate and delivery fee. **Lowe's share-cart email does not include prices, store or job-site information.**

```mermaid
flowchart LR
    A[Build Lowe's cart] --> B[Share to company Mailgun address]
    B --> C[App records and parses mail]
    C --> D[Dispatcher reviews items and collects missing details]
    D --> E[Human follow-up; no automatic checkout email]
```

## Before you share

- Use the **exact company address** supplied by the dispatcher; the message comes from Lowe's, so the address it was sent *to* determines which company owns the request.
- If you have several active job sites, provide the specific delivery address and preferred Lowe's location directly to the dispatcher. Do not assume the application inferred either from the cart.
- Do not treat a successful share or a status in the portal as confirmation that a driver has accepted a job, that materials have been purchased, or that any email from the application was sent.
- If you need to correct the cart, tell the dispatcher which email is the replacement. A genuinely new share-cart message may become a separate request; the old one is not automatically overwritten.

## What is not live yet

Automatic customer acknowledgement, checkout/price approval links, in-app substitutions, driver status alerts, payment links and Home Depot/Ace cart parsing remain future work. Existing `awaiting_customer` orders from the earlier prototype **did not cause an email to be sent**. Contact the dispatcher for status; do not wait for an automated message that has not been built.

## Related

- [Dispatcher guide](dispatcher-guide.md) · [Email intake architecture](../architecture/05-email-intake.md)
