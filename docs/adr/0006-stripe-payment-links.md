# ADR-0006: Stripe Payment Links for collection

- **Status:** Superseded by [ADR-0011](0011-pay-on-approval.md) — the customer now pays at approval, not after delivery.
- **Date:** 2026-09-16
- **Deciders:** Delivery App team

## Context

Payment happens at an unusual moment: after the driver has purchased materials and delivered them. The dispatcher triggers the request, often hours after the customer completed checkout, and the customer may not be at a computer when it arrives.

The current low-tech process sends a payment link by message. The MVP should preserve that shape while removing the manual step.

Constraints:

- No card data may touch our servers.
- The amount is known and fixed at the moment of request.
- The customer may lose the link and need it resent.
- The dispatcher, not the customer, decides when to request payment.

## Decision

Use **Stripe Payment Links**, created server-side per order for the exact `orders.total_cents`, delivered by email, and reconciled by webhook.

## Consequences

### Positive

- A Payment Link is a durable object with a stable URL. It can be created when the job is done and re-sent if the customer loses it — unlike a Checkout Session, which is bound to a single attempt and expires.
- Card data never reaches our servers, which removes an entire class of compliance obligation.
- `checkout.session.completed` gives a reliable, signed signal to flip the order to `paid`, replacing a dispatcher manually noticing that money arrived.
- Stripe's test mode means the whole flow is exercisable before any real money moves.

### Negative / trade-offs

- **A Payment Link's amount is fixed at creation.** If the dispatcher changes fees or the customer edits quantities afterwards, the existing link is stale. The app must expire and recreate it, and the webhook must compare the paid amount against the order total rather than trusting the link. This is real complexity that a session-per-checkout would avoid.
- Links are bearer tokens: anyone with the URL can pay. This is acceptable for a delivery invoice but would not be for account credit.
- Stripe fees apply per transaction.
- No partial payments or instalments.

### Guardrail

The webhook compares `amount_total` against `payments.amount_cents`. A mismatch raises a reconciliation flag and **does not** mark the order paid. Silently accepting a wrong amount is worse than surfacing a discrepancy.

## Alternatives considered

| Alternative | Why not |
|---|---|
| **Stripe Checkout Sessions** | Created per attempt while the customer is present. Our trigger is dispatcher-driven and asynchronous, and we need a re-sendable URL |
| **Stripe Invoicing** | Proper invoices with line items and PDFs. Heavier than needed for a single-amount delivery charge, and slower to issue |
| **Track payment externally (Venmo, check, Zelle)** | Zero integration, but no automated confirmation and no revenue leverage. This is what the process does today and what we are replacing |
| **Stripe Connect with driver payouts** | Solves a different problem (paying drivers) and brings driver KYC and tax obligations. Deferred; see [12-deferred-and-extension-points](../architecture/12-deferred-and-extension-points.md) |
| **Custom card form with Stripe Elements** | Requires PCI scope and building a payment form for no benefit over a hosted link |

## Related

- [09-payments](../architecture/09-payments.md)
- [04-order-lifecycle](../architecture/04-order-lifecycle.md)
