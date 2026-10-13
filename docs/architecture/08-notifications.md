# 08 — Notifications

Every message the system sends, what triggers it, and how duplicates are prevented.

> **Status:** Customer checkout invitations are paused. Earlier prototype actions may have written `queued` notifications and moved orders to `awaiting_customer`, but **no email was sent** and no checkout page exists. Existing rows are preserved; the dispatcher action now refuses to queue new invites or advance the status. The Lowe's email-to-dispatcher milestone sends no customer or driver notification.

---

## Channels

| Channel | Provider | Used for                                                                        |
| ------- | -------- | ------------------------------------------------------------------------------- |
| Email   | Mailgun  | Customer-facing: acknowledgements, checkout invites, payment requests, receipts |
| SMS     | Twilio   | Driver-facing: job available, job assigned                                      |

SMS is reserved for drivers because it is the only channel with a response-time expectation. Customers are email-native — they started the interaction with email.

---

## Trigger matrix

| Key                     | Channel     | Trigger                            | Recipient          | MVP      |
| ----------------------- | ----------- | ---------------------------------- | ------------------ | -------- |
| `order_received_ack`    | email       | Order → `received`                 | Customer           | ✓        |
| `parse_failed_internal` | email       | Order → `needs_review`             | Dispatchers        | ✓        |
| `checkout_invite`       | email       | Order → `awaiting_customer`        | Customer           | ✓        |
| `job_broadcast`         | SMS         | Order → `driver_requested`         | All active drivers | ✓        |
| `job_assigned`          | SMS         | Posting accepted                   | Winning driver     | ✓        |
| `job_declined`          | email       | Driver declines a posting          | Dispatchers        | ✓        |
| `broadcast_expired`     | email       | Broadcast TTL passes with no acceptance | Dispatchers        | ✓        |
| `order_confirmed`       | email       | Order → `customer_confirmed`       | Customer           | ✓        |
| `driver_en_route`       | email       | Order → `en_route`                 | Customer           | ✓        |
| `payment_request`       | email       | Order → `payment_requested`        | Customer           | ✓        |
| `payment_received`      | email       | Order → `paid`                     | Customer           | ✓        |
| `order_stalled`         | email       | Order aging in `awaiting_customer` | Customer           | deferred |
| `status_update_*`       | email / SMS | Any transition                     | Customer           | deferred |

The deferred automated status fan-out is the single highest-value addition after the MVP. It is cheap because `order_status_events` already records every transition — see [12-deferred-and-extension-points](12-deferred-and-extension-points.md).

---

## Idempotency

**`notifications.dedupe_key` is unique**, and is `order_id:template_key` for order-scoped messages (driver-scoped sends append the driver id; a counter suffix covers legitimately repeatable ones).

This is not defensive padding. Sends are retried by the outbox sweep, and the failure a duplicate prevents is severe: a customer receiving two payment requests for one order reads as either a scam or a system they cannot trust.

The send path is:

1. `INSERT … ON CONFLICT (dedupe_key) DO NOTHING` — in the same transaction as the state change that triggered it.
2. If zero rows inserted, this message was already handled — skip and return success.
3. Attempt delivery immediately, then update the row with the provider message id and status.
4. On failure, leave the row `queued`/`failed` with `attempts` incremented — the outbox sweep retries it.

The insert happens **before** the provider call, so a crash mid-send leaves a row in `queued` rather than producing a duplicate on retry.

---

## Delivery tracking

| Status      | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `queued`    | Row written; provider not yet called, or the call is in flight |
| `sent`      | Provider accepted the message                                  |
| `delivered` | Provider confirmed delivery (webhook, where supported)         |
| `failed`    | Provider rejected, or retries exhausted                        |
| `bounced`   | Email bounce reported by Mailgun                               |

Mailgun and Twilio delivery webhooks update these. Failures surface in the dispatcher console's system-health view alongside failed parses.

---

## Templates

Templates are versioned files in `src/lib/notifications/templates/`, rendered server-side. Each declares its required variables so a missing value is a build-time or test-time failure rather than a blank line in a customer's email.

### Variables

| Variable                                 | Source                    |
| ---------------------------------------- | ------------------------- |
| `company.name`                           | `companies`               |
| `order.order_number`                     | `orders`                  |
| `order.items[]`                          | `order_items`             |
| `order.materials_subtotal`               | `orders`                  |
| `order.sizing_fee` / `order.mileage_fee` | `orders`                  |
| `order.total`                            | `orders`                  |
| `order.delivery_address`                 | `orders.delivery_address` |
| `checkout_url`                           | Signed portal link        |
| `payment_url`                            | Stripe Payment Link       |
| `driver.name` / `driver.phone`           | `profiles`                |

### The checkout invite

The most important template. It replaces the runbook's manual "reply with your address and confirm the total" email and must contain:

- Order number and retailer
- The item list with quantities and line totals
- Materials subtotal, sizing fee, mileage fee, and total
- A single prominent link to the portal checkout

Unlike the old email, **it does not ask the customer to reply with an address.** The address is captured in the portal. This is the direct consequence of the no-parallel-run decision — see [00-overview](00-overview.md#risks-and-considerations).

#### What is built today

The previous prototype action could write a `queued` row and move the order to `awaiting_customer`, although **nothing sent**. The action is now guarded off in server code and the button is disabled. Historical rows and statuses remain for audit; the console labels an existing row **"invite queued — not sent"**. Do not treat an old `awaiting_customer` status as evidence that a customer was contacted.

Migration `0007_hold_unsent_notifications.sql` adds `notifications.send_approved boolean not null default false`. Historical and new rows are held by default. Any *future* sender must filter for explicit `send_approved = true`; adding a sender that simply drains `queued` rows could send old messages unexpectedly. No current worker sends them. Nothing in this intake milestone grants send approval or changes existing rows.

**Recipient.** `orders.requester_email` — the address that shared the cart, and the only one known to be live for this customer. `companies.billing_email` is the fallback. The portal user's own email lives in `auth.users`, which needs the admin API to read, so it is not a candidate here.

---

## Failure handling

| Failure                                          | Behaviour                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Provider returns a transient error               | Retried by the outbox sweep with backoff                                                                   |
| Provider returns a permanent error (bad address) | Mark `failed`; surface to dispatchers; do not retry                                                        |
| Send fails entirely                              | The order's status change **stands** — it was already committed. The notification is retried independently |
| Bounce reported later                            | Update to `bounced`; surface to dispatchers so a bad customer address gets fixed                           |

The ordering here is deliberate: a notification failure must never roll back a state change. The order is the source of truth; the message is a consequence of it.

---

## What is out of scope

- Customer-configurable notification preferences
- SMS to customers (email only in the MVP)
- Digest or batched notifications
- Push notifications
- In-app notification centre
- Templating in a third-party system — templates stay in the repo, versioned with the code
