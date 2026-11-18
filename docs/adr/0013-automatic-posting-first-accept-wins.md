# ADR-0013: Approval posts the job to every driver; the first to accept gets it

- **Status:** Accepted
- **Date:** 2026-11-18
- **Deciders:** Delivery App team

## Context

[07-dispatch](../architecture/07-dispatch.md) planned a dispatcher step after the customer confirms: the dispatcher moves the order to `driver_requested`, and texts go out to every active driver.

By the time the customer approves, a dispatcher has already reviewed the order: items, store, address and contact, size and price. A second dispatcher step to post it adds a wait without adding a check.

The pilot's drivers are a small, known and trusted group in one market.

## Decision

1. **Customer approval posts the job automatically.** `approve_order` records `customer_confirmed` and moves the order straight to `driver_requested`. There is no dispatcher step. Once payment is built, a cleared payment does this instead ([ADR-0011](0011-pay-on-approval.md)).
2. **Every active driver sees every open job.** The posting shows the payout, store, full delivery address, items and vehicle needed. The on-site contact and drop-off notes appear only after accepting.
3. **The first driver to accept gets it.** `accept_job` claims the order in one conditional update and returns `accepted` or `taken`. A retried accept by the winner returns `accepted`.
4. **Until notifications exist, the dispatcher copies the job link by hand** from the console and sends it to drivers ([ADR-0012](0012-web-push-before-texts.md)).
5. **Release driver reposts.** A dispatcher can take a job back from its driver at any step before delivery, and it is posted again at the same link. Photos are kept.

The driver payout defaults to 90% of the sizing and mileage fees. The dispatcher can change it until a driver accepts; after that it is locked.

## Consequences

### Positive

- No wait between the customer approving and drivers seeing the job.
- One clean answer to the only real race: two drivers accepting at once. Exactly one wins; the other is told it was taken.
- Release driver covers a driver who falls through without a separate withdraw-and-repost flow.

### Negative / trade-offs

- **Posting is only as fast as the link.** Until push exists, a job sits unseen until a dispatcher copies and sends its link.
- **No choice of driver.** The first to accept wins, not the closest or best suited.
- **Unfilled jobs are not flagged yet.** Decline is not built; when it is, a job every driver has declined will be marked "All drivers declined" in the Finding driver tab.
- Drivers see the full delivery address before accepting. This suits a trusted pilot group and would need revisiting for a larger, open pool.

## Alternatives considered

| Alternative | Why not |
|---|---|
| **Dispatcher posts after approval (07-dispatch)** | A second step after a review that already happened |
| **Dispatcher assigns a driver directly** | Slower, and needs the dispatcher to know who is free |
| **Per-driver offers in turn** | Per-driver offer state and timeouts for a handful of drivers |
| **Automatic matching (nearest or best suited)** | Needs location and availability data the pilot does not have |

## Related

- [07-dispatch](../architecture/07-dispatch.md)
- [04-order-lifecycle](../architecture/04-order-lifecycle.md)
- [ADR-0011](0011-pay-on-approval.md) — a cleared payment will trigger the posting
- [ADR-0012](0012-web-push-before-texts.md) — notifications that replace the copied link
