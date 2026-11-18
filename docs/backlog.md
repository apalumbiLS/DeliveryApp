# Backlog

Everything planned but not finished, gathered from the docs, the runbooks and the code on 2026-11-18, then cut to what the pilot needs. Each item is meant to become one ticket in the team's task tracker; once it is there, it can come out of this file.

- **Pilot** is the work for the pilot.
- **Later** is real but not needed for a pilot: small volumes, manual workarounds, or features not yet decided on.
- **Deferred (post-MVP)** comes from [12-deferred](architecture/12-deferred-and-extension-points.md).

## Pilot

- **Integrate payments; approval happens on payment.** Once Stephen has set up the payment processor account, build it into the app so a customer's approval is their payment: approving takes them to pay, the order stays awaiting the customer until the payment clears, and only a cleared payment approves it and posts it to drivers (decided 2026-11-18; replaces the pay-after-delivery design in [09-payments](architecture/09-payments.md)). Today `approve_order` approves and posts at once, so that changes. Also: a signed payment webhook that checks the amount and records it, a receipt, the portal's "After you approve" list (still ends "Delivered → You pay") and progress steps, the payment states in [04-order-lifecycle](architecture/04-order-lifecycle.md), and whether tax or a discount applies.
- **Push notifications (before texts).** Web Push to the home-screen app, for drivers and the pilot's customers, who will be trained to install it and turn notifications on. Chosen over texts first because a tapped notification opens the installed app, signed in, while a link in a text opens Safari on iPhone. Pieces: a service worker; a VAPID key pair generated once and set as environment variables in Vercel and `.env.local` (changing it later breaks every subscription); a migration for each person's push subscriptions; a "Turn on notifications" button that handles a refusal; sending on a new job (all drivers) and on sent for approval, driver on the way and delivered (the customer), dropping dead subscriptions; and showing dispatchers which drivers have notifications on. iPhone push only works on the deployed site, so testing needs real phones.
- **Home Depot parser.** Only Lowe's carts parse (`web/lib/parsers/index.ts`); Home Depot mail lands in review. Finalizing a cart is hardcoded to Lowe's (`0012_customer_approval_and_item_links.sql`, `web/lib/intake/finalize-provisional.ts`), and no Home Depot stores are seeded. The portal still says "Home Depot or Lowe's". Also needs Home Depot sample emails (single item, multi item, empty cart), and the same sender verification as Lowe's: Home Depot carts come from `HomeDepot@order.homedepot.com`, signed by `order.homedepot.com` (sample: `External Notes/Share Cart Invitation From Joe Haas.eml`).
- **Test the cart parsers against many real emails.** Rather than letting dispatchers fix misread carts, get the parsers right. Collect a batch of real cart emails from Lowe's and Home Depot covering the variety customers will send: one item, many items, large quantities, long or unusual product names, special characters, and an empty cart. Add each as a fixture (`web/lib/parsers/__fixtures__/`) with a test of what it should parse to, and fix whatever fails. Today there is one Lowe's fixture and none for Home Depot (two real Home Depot emails are in `External Notes/`).
- **Dispatcher item editing, as a safety net.** The dispatcher can see the original email on the review page but can't change anything: a cart that couldn't be read can only be dismissed, and an order's items, quantities and retailer can't be edited (the draft RPC covers store, delivery and fees only). Let the dispatcher type in or fix items from the email in both cases (for a failed cart, a `manual` parse attempt). The dispatcher guide's exception table already promises "correct items".
- **Declining a job.** Add a Decline button to the driver's job page and record each decline (`job_declines` exists; nothing writes to it, and a driver's open-jobs list already hides jobs they declined). When every active driver has declined a job, it moves to the top of the dispatcher's "Finding driver" tab marked "All drivers declined", and, once push notifications exist, dispatchers get a notification. The dispatcher handles it from there, by calling a driver or the customer (decided 2026-11-18). The longer "warn when a job sits unaccepted too long" alert is not part of this.
- **Change password, and reset by hand.** Smallest version for the pilot (decided 2026-11-18): a "Change password" page any signed-in customer, driver or dispatcher can reach, and a "Set new password" action on each user in `/admin`, so a dispatcher can reset a forgotten password by hand and pass it on. Today passwords are only set when the account is created (`web/lib/admin/users.ts`). A "forgot password" email waits for outbound email (Later).
- **Phone number on user accounts.** Add a phone field to creating and editing a user in `/admin` (`web/components/admin/create-user-form.tsx`, `user-row-actions.tsx`), saved to `profiles.phone`. The review page already shows a driver's phone next to their name when there is one (`web/lib/dispatch/review-queue.ts`), so dispatchers can call drivers on a job.
- **Production logs.** Make sure server logs never carry sensitive data: customer contact details, addresses, tokens, keys or raw email bodies. Review every `console.*` call and what the host keeps. One example: `approveOrder` in `web/app/portal/orders/actions.ts` logs the database error and order id when an approval fails.
- **Security and privilege pass.** Review every RLS policy, every `security definer` function's role checks, the storage bucket policies, server actions that skip a role check, and use of the secret key ([10-auth-and-permissions](architecture/10-auth-and-permissions.md)). Includes a fourth secret-key use doc 10 doesn't list (`approveInboundEmail` in `web/lib/dispatch/actions.ts`) and `/dispatch` missing from the proxy's guarded paths (the layout still guards it). Add security headers (content security policy, frame-ancestors, HSTS) in `web/next.config.ts`. Check by hand the cases a full database test suite would cover (Later): a customer can't see another company's orders, a driver can't read a job they don't hold, and two drivers accepting the same job leaves one winner.
- **Pilot data.** Create the pilot companies, aliases and accounts (dispatchers, customers, drivers with phones). Apply the SC store seed (`supabase/seed/0003_sc_stores.sql`) to each environment and check the 52 stores against Lowe's store locator.
- **Clear test data before going live.** Delete everything created while testing: orders with their items, status events and attachments; inbound emails and parse attempts; order intents; the test photos in the `evidence` storage bucket; and test companies, job sites and user accounts (accounts also in Supabase Auth). Keep the Lowe's store data and the real dispatcher accounts. Decide whether to restart order numbers (`0005_order_number_sequence.sql`). Do it as one reviewed SQL script, run once in the SQL editor, after a backup: the status events are otherwise append-only, so this is a deliberate one-time exception. Run it before creating the real pilot data.
- **Pilot prep.** Show each pilot driver and customer how to add the app to their phone's home screen (Safari → Share → Add to Home Screen on iPhone) and turn on notifications once push is built; push only works on iPhone from the home-screen app. Have everyone read their guide in `docs/runbooks/` (customer, driver, dispatcher) once the docs ticket has brought them up to date.

## Later

Not needed for the pilot. Each still makes sense as a ticket when its time comes.

- **Database tests.** Run the SQL functions and RLS against real Postgres (`approve_order`, `accept_job`, `advance_job`, `release_driver`, `update_dispatcher_draft`, `finalize_inbound_cart`, storage policies), including two drivers accepting at once.
- **Correct a driver's mistaken step.** `advance_job` allows dispatchers, but the app action rejects non-drivers and there is no console control; steps are forward only. Left out of the pilot to keep scope small (decided 2026-11-18).
- **Approve on the customer's behalf** (sets `confirmed_by_profile_id`). Since approval now means payment, this means the dispatcher taking payment for a customer who calls in. Pilot customers approve and pay themselves (decided 2026-11-18).
- **Staging environment.** One Supabase project for the pilot (decided 2026-11-18). Add a separate staging Supabase project and Mailgun subdomain before real customers depend on the app ([11-deployment](architecture/11-deployment-and-environments.md)).
- **Pricing model.** Fees stay typed by hand for the pilot, each at least $0.50 (decided 2026-11-18). Later: a rate card (mockup in `web/app/mockups/dispatch/review-guided.tsx`) and mileage worked out from the store-to-site distance the app already knows.
- **Revisit the driver payout rule** after the first real jobs. It stays 90% of the sizing fee plus the mileage fee for the pilot (decided 2026-11-18), editable by the dispatcher until a driver accepts. Hardcoded in two places that must agree: `default_driver_payout_cents` (`supabase/migrations/0013_driver_jobs.sql`) and `web/lib/dispatch/payout.ts`.
- **Job texts (after push).** No text message goes out yet; the dispatcher copies the job link from the console. Twilio and US carrier (A2P 10DLC) registration are still needed, with a multi-day lead time. About $20 to register and $20/month at 50 texts a day (checked 2026-11-18). Mainly a fallback for anyone whose push notifications stop working.
- **Outbound email.** Nothing sends email yet: no order-received acknowledgement, no parse-failed alert to dispatchers, no approval or status emails, no receipt. Needs templates, sending through Mailgun, and SPF/DKIM/DMARC on a sending domain ([08-notifications](architecture/08-notifications.md)).
- **Notifications outbox sender and retries.** The `notifications` table exists but nothing drains it; `attempts` and `dedupe_key` are unused. Show failed notifications to dispatchers.
- **Mailgun delivery and bounce webhook.** Not built.
- **Store the raw email** (`inbound_emails.raw_storage_path`, never written), with a way to re-parse it.
- **Webhook replay protection.** A store of seen Mailgun tokens, deliberately deferred (`web/lib/intake/verify-mailgun.ts`).
- **Two Mailgun signing keys during the account handoff,** so the old address keeps working while moving to the client's Mailgun account and domain. Code reads only `MAILGUN_SIGNING_KEY`.
- **Test with a real Mailgun payload.** Capture a redacted real webhook POST as a test, and check retry and timestamp behaviour.
- **Expire abandoned order intents.** A cron sweep; matching itself is built.
- **Withdraw a posted job** (take it off the drivers' list before anyone accepts).
- **Release after purchase.** Releasing a driver at Items purchased or En route restarts the steps at the store, with no handoff for goods already bought.
- **Assign or reassign a driver by hand.** Only Release exists.
- **Close out or cancel an order.** Nothing moves a delivered order on, and nothing cancels one (`cancelled` and `cancellation_reason` are unused).
- **Show waiting time** on queue entries; today they only sort oldest first.
- **Search and paging in the queue.** Each tab shows at most 50 orders.
- **One transaction per status change.** Send for approval and Undo send change the status and write the audit event in separate calls. Move each into one database function ([04-order-lifecycle](architecture/04-order-lifecycle.md) requires one transaction).
- **Request changes or decline** an order awaiting approval; today the customer can only approve.
- **Manage saved job sites** (edit, delete); sites are only added through the start flow.
- **Order history paging** (capped at 50).
- **Item outcomes.** Record unavailable or substituted items (`item_status`, `substituted_by_item_id` are unused).
- **Report a problem mid-job.** The driver guide acknowledges it's missing.
- **Earnings history.** Payout totals across jobs; Delivered lists only the last 50.
- **Company management.** Create and edit companies and their order alias; today it's SQL only.
- **Store and site management.** No console for job sites or for Lowe's stores (active flag, new stores).
- **Vercel Cron and `CRON_SECRET`.** No `vercel.json` and no `/api/cron/*` routes yet; needed for the outbox, intent expiry and stale-job alerts.
- **CI.** No pipeline runs lint, typecheck and tests; the release process in 11-deployment assumes one. Add a post-deploy check that sends a sample email.
- **Monitoring.** Structured logging, error tracking and a system-health view.
- **App code tests.** The email sanitizer (`web/lib/dispatch/email-html.ts`), the server actions, `web/lib/driver/job.ts`, `web/lib/portal/progress.ts`, `payout.ts` and `geo.ts` have none.
- **Lifecycle rules as database constraints.** 04's invariants are checked inside functions, not enforced by the schema.

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
