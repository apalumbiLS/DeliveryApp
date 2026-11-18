# Backlog

Everything planned but not finished, gathered from the docs, the runbooks and the code on 2026-11-18. Each item is meant to become one ticket in the team's task tracker; once it is there, it can come out of this file.

Things deliberately left out of the MVP are under [Deferred (post-MVP)](#deferred-post-mvp) at the end, from [12-deferred](architecture/12-deferred-and-extension-points.md).

## Decisions still open

- **Does a job post to drivers before payment clears?** Needed before pay-on-approval is built.
- **Driver payout rule.** Driver payout defaults to 90% of the sizing fee plus the mileage fee, editable until a driver accepts. The 90% is a placeholder, hardcoded in two places that must agree: `default_driver_payout_cents` (`supabase/migrations/0013_driver_jobs.sql`) and `web/lib/dispatch/payout.ts`.
- **How drivers pay for materials and get reimbursed** (company card or reimbursement), and how driver payouts are settled. The driver guide defers to "what the dispatcher told you".
- **Pricing model.** Sizing and mileage fees are typed by hand (each at least $0.50). A rate card exists only as a mockup (`web/app/mockups/dispatch/review-guided.tsx`), and mileage is never computed from distance.
- **Should dispatchers be creatable in the app?** Doc 10 says only in the Supabase dashboard; the admin form allows it. Block it in code or change the doc.
- **Staging environment.** Whether to create a separate staging Supabase project and Mailgun subdomain ([11-deployment](architecture/11-deployment-and-environments.md)).

## Payments

- **Pay on approval.** When a customer approves an order, prompt them to pay right away (decided 2026-11-18; replaces the pay-after-delivery link in [09-payments](architecture/09-payments.md)). Waiting on the payment processor account a teammate is setting up.
- **Payment integration.** Create the payment, a signed webhook route, check the amount against `payments.amount_cents`, write `payments` rows, move the order to paid, send a receipt, and alert when payment and order state disagree. Only the baseline `payments` table exists.
- **Lifecycle for payment.** Redo the payment states in [04-order-lifecycle](architecture/04-order-lifecycle.md) for pay-on-approval; nothing moves an order past `delivered` today (`payment_requested`, `paid`, `closed` are unused).
- **Check the payment key matches the environment at startup** (test key outside production, live key in it).
- **Update the portal's "After you approve" list,** which still ends "Delivered → You pay" (`web/components/portal/approve-order.tsx`), and add a payment step to the portal's progress.
- **Tax and discount.** Both feed the total, but nothing ever sets them.

## Notifications

- **Push notifications (before texts).** Web Push to the home-screen app, for drivers and the pilot's customers, who will be trained to install it and turn notifications on. Chosen over texts first because a tapped notification opens the installed app, signed in, while a link in a text opens Safari on iPhone. Pieces: a service worker; a VAPID key pair generated once and set as environment variables in Vercel and `.env.local` (changing it later breaks every subscription); a migration for each person's push subscriptions; a "Turn on notifications" button that handles a refusal; sending on a new job (all drivers) and on sent for approval, driver on the way and delivered (the customer), dropping dead subscriptions; and showing dispatchers which drivers have notifications on. iPhone push only works on the deployed site, so testing needs real phones.
- **Job texts (after push).** No text message goes out yet; the dispatcher copies the job link from the console. Twilio and US carrier (A2P 10DLC) registration are still needed, with a multi-day lead time. About $20 to register and $20/month at 50 texts a day (checked 2026-11-18). Mainly a fallback for anyone whose push notifications stop working.
- **Outbound email.** Nothing sends email yet: no order-received acknowledgement, no parse-failed alert to dispatchers, no approval or status emails, no receipt. Needs templates, sending through Mailgun, and SPF/DKIM/DMARC on a sending domain ([08-notifications](architecture/08-notifications.md)).
- **Notifications outbox sender and retries.** The `notifications` table exists but nothing drains it; `attempts` and `dedupe_key` are unused. Show failed notifications to dispatchers.
- **Mailgun delivery and bounce webhook.** Not built.

## Intake and email

- **Home Depot parser.** Only Lowe's carts parse (`web/lib/parsers/index.ts`); Home Depot mail lands in review. Finalizing a cart is hardcoded to Lowe's (`0012_customer_approval_and_item_links.sql`, `web/lib/intake/finalize-provisional.ts`), and no Home Depot stores are seeded. The portal still says "Home Depot or Lowe's". Also needs Home Depot sample emails (single item, multi item, empty cart), and the same sender verification as Lowe's: Home Depot carts come from `HomeDepot@order.homedepot.com`, signed by `order.homedepot.com` (sample: `External Notes/Share Cart Invitation From Joe Haas.eml`).
- **Fix items when a cart can't be read.** A failed parse can only be dismissed; the dispatcher can't type or correct items (no `manual` parse attempt). The dispatcher guide's exception table promises "correct items".
- **Edit items on an order.** The dispatcher can't change items, quantities or retailer; the draft RPC covers store, delivery and fees only.
- **Store the raw email** (`inbound_emails.raw_storage_path`, never written), with a way to re-parse it.
- **Switch Mailgun to the raw-email route.** Real DKIM verification is built at `/api/webhooks/mailgun/mime` (migration `0017`). After deploying, change the Mailgun forward URL from `…/api/webhooks/mailgun/inbound` to `…/api/webhooks/mailgun/mime`, send a test cart, then retire the old route.
- **Webhook replay protection.** A store of seen Mailgun tokens, deliberately deferred (`web/lib/intake/verify-mailgun.ts`).
- **Two Mailgun signing keys during the account handoff,** so the old address keeps working while moving to the client's Mailgun account and domain. Code reads only `MAILGUN_SIGNING_KEY`.
- **Test with a real Mailgun payload.** Capture a redacted real webhook POST as a test, and check retry and timestamp behaviour.
- **Expire abandoned order intents.** A cron sweep; matching itself is built.

## Dispatch console

- **Approve on the customer's behalf** (sets `confirmed_by_profile_id`). Not built; the dispatcher guide and dry-run checklist rely on it.
- **Withdraw a posted job** (take it off the drivers' list before anyone accepts).
- **Correct a driver's mistaken step.** `advance_job` allows dispatchers, but the app action rejects non-drivers and there is no console control; steps are forward only.
- **Release after purchase.** Releasing a driver at Items purchased or En route restarts the steps at the store, with no handoff for goods already bought.
- **Assign or reassign a driver by hand.** Only Release exists.
- **Jobs nobody takes.** Warn the dispatcher when a posting sits unaccepted too long, and flag "nobody available" once every driver declines (needs Decline).
- **Close out or cancel an order.** Nothing moves a delivered order on, and nothing cancels one (`cancelled` and `cancellation_reason` are unused).
- **Show waiting time** on queue entries; today they only sort oldest first.
- **Search and paging in the queue.** Each tab shows at most 50 orders.
- **One transaction per status change.** Send for approval and Undo send change the status and write the audit event in separate calls. Move each into one database function ([04-order-lifecycle](architecture/04-order-lifecycle.md) requires one transaction).

## Customer portal

- **Request changes or decline** an order awaiting approval; today the customer can only approve.
- **Password change and reset** (customers, drivers, dispatchers). The dispatcher sets passwords by hand and nobody can change theirs; no reset email.
- **Manage saved job sites** (edit, delete); sites are only added through the start flow.
- **Order history paging** (capped at 50).
- **Item outcomes.** Record unavailable or substituted items (`item_status`, `substituted_by_item_id` are unused).

## Driver app

- **Declining a job.** A Decline button, recording it (`job_declines` exists, nothing writes to it), reporting each decline to the dispatcher, and "nobody available" once every driver has declined ([07-dispatch](architecture/07-dispatch.md)).
- **Report a problem mid-job.** The driver guide acknowledges it's missing.
- **Earnings history.** Payout totals across jobs; Delivered lists only the last 50.

## Admin and accounts

- **Company management.** Create and edit companies and their order alias; today it's SQL only.
- **Phone number on user accounts.** The admin form has no phone field, so drivers show no number to dispatchers.
- **Store and site management.** No console for job sites or for Lowe's stores (active flag, new stores).

## Operations and launch setup

- **Payment processor account** with live keys and per-environment webhooks (a teammate is setting it up).
- **Vercel Cron and `CRON_SECRET`.** No `vercel.json` and no `/api/cron/*` routes yet; needed for the outbox, intent expiry and stale-job alerts.
- **CI.** No pipeline runs lint, typecheck and tests; the release process in 11-deployment assumes one. Add a post-deploy check that sends a sample email.
- **Monitoring.** Structured logging, error tracking and a system-health view.
- **Apply and verify the SC store seed** (`supabase/seed/0003_sc_stores.sql`) in each environment and check the 52 stores against Lowe's store locator.
- **Pilot data.** Create the pilot companies, aliases and accounts (dispatchers, customers, drivers with phones).
- **LLM fallback key** — deferred with the fallback itself.

## Before launch

- **Production logs.** Make sure server logs never carry sensitive data: customer contact details, addresses, tokens, keys or raw email bodies. Review every `console.*` call and what the host keeps. One example: `approveOrder` in `web/app/portal/orders/actions.ts` logs the database error and order id when an approval fails.
- **Security and privilege pass.** Review every RLS policy, every `security definer` function's role checks, the storage bucket policies, server actions that skip a role check, and use of the secret key ([10-auth-and-permissions](architecture/10-auth-and-permissions.md)). Includes a fourth secret-key use doc 10 doesn't list (`approveInboundEmail` in `web/lib/dispatch/actions.ts`) and `/dispatch` missing from the proxy's guarded paths (the layout still guards it).
- **Security headers** (content security policy, frame-ancestors, HSTS) in `web/next.config.ts`.
- **Database tests.** Run the SQL functions and RLS against real Postgres (`approve_order`, `accept_job`, `advance_job`, `release_driver`, `update_dispatcher_draft`, `finalize_inbound_cart`, storage policies), including two drivers accepting at once.
- **App code tests.** The email sanitizer (`web/lib/dispatch/email-html.ts`), the server actions, `web/lib/driver/job.ts`, `web/lib/portal/progress.ts`, `payout.ts` and `geo.ts` have none.
- **Lifecycle rules as database constraints.** 04's invariants are checked inside functions, not enforced by the schema.

## Pilot rollout

- **Rewrite the dry-run script** (`docs/runbooks/dry-run-checklist.md`) for the current flow: portal approval, automatic posting, a copied job link, pay on approval. Drop failure tests that can't pass yet or mark them pending.
- **Train drivers and customers** to add the app to the home screen and turn on notifications.
- **People prep.** Everyone reads their guide, a call tree, a decision-maker on hand.
- **Stage 2 and 3.** Onboard the first customer (watch an unaided approval), run the first live order, and hold a 24-hour debrief.

## Docs to update

These docs no longer match the code or today's decisions.

- **Runbooks.**
  - Customer guide: approval is live in the portal; add pay on approval when built.
  - Dispatcher guide: drop "customers can't approve yet", the broadcast/SMS step and "address hidden until accept"; describe auto-posting, Copy job link, Release driver and Undo send.
  - Driver guide: drop "not yet implemented", texts, hidden address, automatic customer emails, Decline and dispatcher corrections until they exist.
  - Dry-run checklist: see Pilot rollout.
  - Remove "apply 0011" notes everywhere; 0001–0016 are applied.
- **00-overview.** Locked decisions, roadmap and lifecycle diagram (pay on approval, push before texts, Car/Truck, auto-posting); phase status doesn't mention the driver app.
- **01-system-context and 02-containers.** Add push; module layout and route groups don't match `web/app/(console)/dispatch`, `web/app/driver`, `lib/dispatch`, `lib/driver` (ADR-0002 too).
- **03-data-model.** Add `orders.driver_payout_cents`, `order_items.product_url`, the evidence bucket and policies, nullable `attachments.storage_path`, the driver and approval functions, and migrations 0004–0016; fix the order-number example and the status line.
- **04-order-lifecycle.** Describe the real transitions (approval straight to posted, Undo send, Release driver) instead of the unbuilt `transitionOrder()`; redo payment states.
- **05-email-intake and 06-cart-parsing.** Fix the contradictory migration status, "no checkout destination exists", and the claim that failed parses become editable orders.
- **07-dispatch.** Not "not implemented" any more; posting is automatic and the link is copied by hand.
- **08-notifications.** Push is in scope now; update channels and triggers.
- **09-payments and ADR-0006.** Rewrite for pay on approval with a superseding ADR.
- **10-auth-and-permissions.** Consoles are built; complete the secret-key list; in-app dispatcher creation; update the `get_open_jobs_for_driver` SQL (0015) and add driver functions and evidence storage policies.
- **11-deployment.** Migration status, MX status, env vars (add VAPID; `APP_URL`, `APP_ENV`, `LLM_*` are unused), and the CI assumption.
- **12-deferred.** Order-intent matching is built (only the sweep is left); aisle/bay is parsed for Home Depot only.
- **New ADRs** for pay on approval, push before texts, and automatic posting with first-come-first-served drivers.
- **`web/README.md`** (route groups exist; mention `/admin`), **`web/AGENTS.md`** (seed data exists), **`ai_docs/_wireframes_company_portal.md`** (pay-after-delivery and share-step items are superseded), and the mockup hub's "Order detail" placeholder (the real page is built).

## Deferred (post-MVP)

From [12-deferred](architecture/12-deferred-and-extension-points.md). Not planned for the pilot.

- Item substitution flow
- Customer cancellation UI
- Refunds
- Multi-store orders
- Ace parser, and the LLM fallback parse tier
- In-app product catalog, parts database, product enrichment, live price and stock re-check
- Fee rule engine
- Driver payouts through Stripe Connect
- Subscription or prepaid billing
- Customer texts, Slack, chat
- Native mobile apps (needed for background driver location tracking)
- Several portal users per company
- Automatic re-posting when a job expires
- QR handoff at delivery
