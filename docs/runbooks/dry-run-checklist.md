# Dry-Run Checklist

Rehearsing the new process before it touches a real customer.

> **Status:** The stages below are a **future end-to-end delivery rehearsal**, not the current client pilot. For this phase, validate a signed Lowe's form (using mocks), provisional review, explicit dispatcher approval, and no automatic checkout/dispatch. Migration `0009` is prepared but unexecuted; actual Mailgun delivery and database transaction verification remain user-run gates. See [05-email-intake](../architecture/05-email-intake.md).
>
> The source material calls for "a rehearsal, an onboarding with the Mitchells, and a first live with the Mitchells." This is that sequence.

---

## Why this is staged

The system has no fallback to the old process — there is no Slack channel and no Google Sheet to retreat to. That makes rehearsal more important than it would otherwise be, not less.

Three stages, each with an explicit exit criterion:

| Stage                      | Participants     | Purpose                              | Exit criterion                                |
| -------------------------- | ---------------- | ------------------------------------ | --------------------------------------------- |
| **1. Internal rehearsal**  | Team only        | Prove the software works end to end  | A complete order from fixture email to `paid` |
| **2. Customer onboarding** | Team + Mitchells | Prove the humans can use it          | Mitchells complete a real checkout unaided    |
| **3. First live**          | Everyone         | Prove it works under real conditions | One real order delivered and paid             |

---

## Pre-flight

Nothing below can be skipped. Several items have external lead times.

### Infrastructure

- [ ] Domain purchased, DNS configured
- [ ] Mailgun inbound routes live for `orders.<domain>`
- [ ] MX records verified — send a test email and confirm it arrives
- [ ] SPF/DKIM/DMARC configured for outbound
- [ ] Supabase production project created (`us-east-1`)
- [ ] `supabase/migrations/0001_baseline.sql` applied; every `public` table reports RLS on **and** at least one policy
- [ ] Vercel production deploy live
- [ ] Stripe live keys configured, webhook endpoint registered
- [ ] Twilio A2P 10DLC registration **approved** — this has a multi-day lead time; start it first
- [ ] Vercel Cron configured (notifications outbox, broadcast expiry)
- [ ] LLM fallback key configured

### Data

- [ ] `retailer_stores` seeded for the Upstate SC service area
- [ ] **Every seeded store verified against the retailer's own store locator** — a wrong address sends a driver to a non-existent place
- [ ] Test company created with an alias
- [ ] Portal login created and credentials verified
- [ ] Dispatcher accounts created
- [ ] Driver accounts created, phones verified

### Fixtures

- [ ] `homedepot/single-item.eml` in the parser fixtures
- [ ] `homedepot/multi-item.eml` captured — **the current sample has only one item; multi-item parsing is unverified**
- [ ] `homedepot/empty-cart.eml` captured
- [ ] A real Lowe's email captured — **without this, Lowe's carts route to the LLM fallback**
- [ ] Replay tests passing against all fixtures

### People

- [ ] Every participant has read their guide: [dispatcher](dispatcher-guide.md), [driver](driver-guide.md), [customer](customer-guide.md)
- [ ] Everyone knows who to call when something breaks
- [ ] A decision-maker is available during the run — not reachable by email, _available_

---

## Stage 1 — Internal rehearsal

**Format:** One room or one call. Walk a synthetic order through every step.

### Script

| #   | Step                                                     | Who                 | Watch for                                                            |
| --- | -------------------------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| 1   | Send the fixture cart email to the test company's alias  | Anyone              | Arrives within a minute; order appears without manual intervention   |
| 2   | Confirm the parse                                        | Dispatcher          | Items match the email exactly; subtotal reconciles                   |
| 3   | Set the store                                            | Dispatcher          | Correct store from the seeded list                                   |
| 4   | Enter fees and send the checkout invite                  | Dispatcher          | Email arrives with correct items and totals                          |
| 5   | Complete checkout                                        | A stand-in customer | Address captured; price accepted; order advances                     |
| 6   | Broadcast to drivers                                     | Dispatcher          | Both drivers get SMS **and** see it in the app                       |
| 7   | **Both drivers tap Accept simultaneously**               | Drivers             | Exactly one succeeds; the other sees a clear "already taken" message |
| 8   | Advance through store → purchased → en route → delivered | Driver              | Photos upload; the customer is emailed                               |
| 9   | Send the payment request                                 | Dispatcher          | Stripe link arrives; amount matches the order                        |
| 10  | Pay                                                      | Stand-in customer   | Order advances to `paid` automatically                               |

### Deliberate failure tests

Run these in the same session. They are the point of the rehearsal.

- [ ] **Send a cart for an unknown alias** → lands in the review queue, does not create a company
- [ ] **Send a corrupted cart email** → parse fails → `needs_review` → dispatcher resolves it
- [ ] **Send the same cart email twice** → exactly one order created
- [ ] **Decline from every driver** → dispatcher is notified immediately; order flagged "nobody available"; no silent stall
- [ ] **Complete checkout on the customer's behalf** → `confirmed_by` records the dispatcher
- [ ] **Skip the receipt photo** → reason required; skip is visible on the order
- [ ] **Change fees after a payment link was created** → the stale link is flagged

### Exit criterion

A complete order from fixture email to `paid`, **plus** every deliberate failure test behaving as described.

---

## Stage 2 — Customer onboarding (Mitchells)

**Format:** In person or on a screen-share call. The goal is that they can do it without us.

- [ ] Walk through building and sharing a real cart
- [ ] Confirm the email arrives at their company alias
- [ ] **Watch them complete checkout unaided** — do not take the mouse
- [ ] Confirm they understand the price before approving
- [ ] Show them the order status page
- [ ] Confirm the delivery address and drop-off instructions are captured correctly
- [ ] Explain that they must check the delivery before paying

### Exit criterion

The Mitchells complete a checkout without anyone guiding them, and can describe the process back in their own words.

### What to collect

- How long did checkout take them?
- Where did they hesitate or ask a question?
- Did they try to reply to the email instead of using the portal?

Every hesitation is a UX bug worth fixing before Stage 3.

---

## Stage 3 — First live order

**Format:** A real order, real money, real delivery. Everyone on standby.

### Before

- [ ] A real cart shared by the customer
- [ ] Dispatcher on standby and watching the queue
- [ ] Driver identified and available
- [ ] Payment confirmed working (a real charge, not a test)

### During

- [ ] Time every step — cart shared → order created → approved → dispatched → accepted → delivered → paid
- [ ] Note anything a human had to do that the system should have done
- [ ] Note anything unclear to any participant

### After

- [ ] Payment received
- [ ] Order closed
- [ ] Debrief within 24 hours, while it's fresh
- [ ] Every manual step recorded as a follow-up item

---

## What to watch for

These are the specific things most likely to go wrong, based on how the system is built.

| Signal                                                    | Meaning                                                              | Action                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Order lands in `needs_review`                             | The parser failed                                                    | Check `parse_attempts` for the strategy and errors. Capture the email as a fixture |
| Subtotal does not reconcile                               | We parsed the wrong rows, or double-parsed the duplicate mobile view | Do not approve. Capture the email                                                  |
| Driver went to the wrong store                            | The manual store step failed                                         | Confirm the store with the customer; consider showing it more prominently          |
| Nobody accepted                                           | Pool too small, or SMS not delivered                                 | Check Twilio delivery status, not just that it was sent                            |
| Customer replied to the email instead of using the portal | The email isn't clear enough about the link                          | A template fix, not a process problem                                              |
| Payment link amount doesn't match                         | Fees changed after the link was created                              | The link must be recreated — this is by design                                     |
| Order stalled in `awaiting_customer`                      | Customer hasn't completed checkout                                   | Call them. There is no automatic expiry                                            |

---

## Rollback

There is no parallel process to fall back to. If the system fails during a live order:

1. **Complete the order manually.** A dispatcher can drive the entire flow by hand: set items, complete checkout on the customer's behalf, call a driver, and send a payment link.
2. **Do not re-enter anything into a spreadsheet.** That reintroduces the double-entry problem the system exists to remove.
3. **Record what failed**, with the order number, so it can be reproduced.

The manual path exists for exactly this. Use it without hesitation — an order completing slowly is far better than an order not completing.

---

## Post-MVP follow-ups this will surface

Expect the rehearsal to produce items for [12-deferred-and-extension-points](../architecture/12-deferred-and-extension-points.md), most likely:

- Automated customer status notifications (the biggest remaining manual step)
- Substitution handling (the most likely in-store surprise)
- Cancellation (the most likely customer request)
- Stalled-checkout reminders

---

## Related

- [Dispatcher guide](dispatcher-guide.md) · [Driver guide](driver-guide.md) · [Customer guide](customer-guide.md)
- [Risks](../architecture/00-overview.md#risks-and-considerations)
