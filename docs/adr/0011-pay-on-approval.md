# ADR-0011: The customer pays when they approve the order

- **Status:** Accepted
- **Date:** 2026-11-18
- **Deciders:** Delivery App team
- **Supersedes:** [ADR-0006](0006-stripe-payment-links.md) — the timing of payment. Stripe remains the documented processor.

## Context

[ADR-0006](0006-stripe-payment-links.md) planned payment after delivery: the dispatcher sends a payment link once the job is done, often hours later, and the customer pays whenever they see it.

The order flow has since been built differently from what that design assumed:

- The dispatcher reviews the cart and sets the total (materials estimate, sizing fee, mileage fee) before sending it to the customer.
- The customer approves in the portal (`approve_order`). Approval records `customer_confirmed` and posts the job to drivers at once.
- A driver then buys the materials and delivers them.

So the amount is known, and the customer is present in the portal, at the moment they approve. Under ADR-0006, the materials are bought and delivered before any money is collected.

Nothing about payments is built yet. A teammate (Stephen) is setting up the payment processor account.

## Decision

**Approval is payment.** Approving takes the customer to pay. The order stays `awaiting_customer` until the payment clears. Only a cleared payment approves the order and posts it to drivers.

The rest of ADR-0006 that does not depend on timing stands: a Stripe-hosted page, so no card data touches our servers; the amount taken from `orders.total_cents` and stored in `payments.amount_cents`; a signed webhook that checks the paid amount and is safe to receive twice.

Whether to use Payment Links or Checkout Sessions is left to when this is built. A customer present at approval suits a session-style checkout.

## Consequences

### Positive

- The company is paid before a driver buys anything.
- No dispatcher step to request payment, and no link to chase or resend after delivery.
- The amount is fixed when it is charged: the dispatcher's quote is final once the customer has seen it, so a stale-link problem largely goes away.
- One customer action (approve and pay) instead of two at different times.

### Negative / trade-offs

- **`approve_order` changes.** Today it approves and posts at once. With payment, the webhook does the approving and posting, and the portal's approval step and progress steps change with it.
- **The materials figure is an estimate.** The customer pays it before the driver shops. If the receipt differs, there is no adjustment or refund path yet.
- A customer who cannot pay at that moment holds up their own order.
- "Approve on the customer's behalf" now means the dispatcher taking payment for a customer who calls in. Pilot customers approve and pay themselves.
- A failed webhook leaves a paid order unposted. That has to be visible to a dispatcher, not assumed.

## Alternatives considered

| Alternative | Why not |
|---|---|
| **Pay after delivery (ADR-0006)** | Materials are bought and delivered before money is collected, and the dispatcher has to send and chase a link |
| **Approve and post at once, charge separately** | Drivers could start on an order that is never paid |
| **Dispatcher confirms payment by hand, then posts** | Brings back a manual step that approval now removes |
| **Invoice on account** | Not part of the pilot; needs credit terms and collections |

## Related

- [ADR-0006](0006-stripe-payment-links.md) — superseded by this record for timing
- [09-payments](../architecture/09-payments.md)
- [04-order-lifecycle](../architecture/04-order-lifecycle.md)
- [ADR-0013](0013-automatic-posting-first-accept-wins.md) — what a cleared payment triggers
