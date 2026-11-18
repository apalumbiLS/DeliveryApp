# 08 — Notifications

Every message the system sends, what triggers it, and how duplicates are prevented.

> **Status (2026-11-18):** **Nothing is sent today** — no push, email or SMS. The dispatcher's _Send for approval_ moves the order to `awaiting_customer` without sending anything; the customer sees it in the portal. Drivers get the job link from the dispatcher by hand. **Decided:** Web Push to the home-screen app comes first; Twilio texts later as a fallback; outbound email later.

---

## Channels

| Channel  | Provider                       | Used for                                                                    | Status |
| -------- | ------------------------------ | --------------------------------------------------------------------------- | ------ |
| Push     | Web Push to the home-screen app | Drivers, customers and dispatchers — see the trigger matrix                 | **Planned, first** |
| SMS      | Twilio                         | Fallback for anyone whose push stops working                                | Later  |
| Email    | Mailgun                        | Customer-facing email, such as receipts                                     | Later  |

Push comes first because a tapped notification opens the installed app, already signed in, while a link in a text opens the browser on iPhone. iPhone push only works from the app added to the home screen, so pilot drivers and customers will be shown how to install it and turn notifications on. Texts need Twilio and US carrier (A2P 10DLC) registration, which takes several days.

---

## Trigger matrix

Decided 2026-11-18. **None of these is built yet.**

| Message             | Channel | Trigger                                   | Recipient                         | When    |
| ------------------- | ------- | ----------------------------------------- | --------------------------------- | ------- |
| New job             | push    | Order → `driver_requested`                | All drivers with notifications on | Pilot   |
| Sent for approval   | push    | Order → `awaiting_customer`               | Customer                          | Pilot   |
| Driver on the way   | push    | Order → `en_route`                        | Customer                          | Pilot   |
| Delivered           | push    | Order → `delivered`                       | Customer                          | Pilot   |
| All drivers declined | push   | Every active driver has declined a posting | Dispatchers                      | Pilot (needs Decline) |
| Job texts           | SMS     | As above, as a fallback                   | Drivers                           | Later   |
| Receipt            | email   | Payment clears                            | Customer                          | Later   |
| Job unaccepted too long | —   | Posting sits past a time limit            | Dispatchers                       | Later   |
| `status_update_*`   | any     | Any other transition                      | Customer                          | Deferred |

The planned push messages are the first slice of the automated status fan-out. It is cheap because `order_status_events` already records every transition — see [12-deferred-and-extension-points](12-deferred-and-extension-points.md).

---

## Idempotency

The rest of this document is the design for the sender; none of it is built. The `notifications` table exists, but its `channel` enum holds only `email` and `sms`, so push will need a migration (plus one for each person's push subscriptions).

**`notifications.dedupe_key` is unique**, and is `order_id:template_key` for order-scoped messages (driver-scoped sends append the driver id; a counter suffix covers legitimately repeatable ones).

This is not defensive padding. Sends are retried by the outbox sweep, and the failure a duplicate prevents is severe: a customer receiving two receipts for one order reads as either a scam or a system they cannot trust.

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

Provider delivery webhooks, where they exist, update these. Failures surface in the dispatcher console's system-health view alongside failed parses.

---

## Templates

Templates will be versioned files in the app (there is no `lib/notifications` yet), rendered server-side. Each declares its required variables so a missing value is a build-time or test-time failure rather than a blank line in a customer's email.

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
| `order_url`                              | Portal or driver app link |
| `driver.name` / `driver.phone`           | `profiles`                |

### Sent for approval

The customer-facing message when the dispatcher sends an order for approval. Today it is not sent; the customer finds the order in the portal. When push is built it should carry the order number and a link straight to the order, where the customer reviews items, store, address and total and approves. The address and approval are captured in the portal, never by reply.

**Email recipient (later).** `orders.requester_email` — the address that shared the cart, and the only one known to be live for this customer. `companies.billing_email` is the fallback. The portal user's own email lives in `auth.users`, which needs the admin API to read, so it is not a candidate here.

#### What is built today

_Send for approval_ moves the order to `awaiting_customer` and records a status event noting that no email was sent. It writes no `notifications` row.

Migration `0007_hold_unsent_notifications.sql` adds `notifications.send_approved boolean not null default false`. Rows are held by default. Any *future* sender must filter for explicit `send_approved = true`; a sender that simply drains `queued` rows could send old prototype rows unexpectedly. No current worker sends them.

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
- Digest or batched notifications
- In-app notification centre
- Templating in a third-party system — templates stay in the repo, versioned with the code
