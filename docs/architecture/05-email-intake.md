# 05 — Lowe's email intake

A customer builds a Lowe's cart and uses Lowe's **Share Cart** to send it to the shared `delivery@` address or an order-specific `delivery+<token>` address on the prototype Mailgun receiving domain. The application parses it into dispatcher work. A portal visit is **optional**.

> **Status:** Built for Lowe's. Migrations `0001`–`0018` are applied. Shared-address and `delivery+<token>` carts have been tested through Mailgun, provisional review and dispatcher approval. The `/mime` route (verified carts become orders, migration `0017`) was built 2026-11-18; Mailgun's forward URL still points at `/inbound` until it is switched. Only Lowe's is parsed; Home Depot is planned for the pilot. No email is sent to the customer: after dispatcher review the order waits for the customer's approval in the portal.

## The critical detail: the sender is the retailer, not the customer

The captured Lowe's message has a generic subject and `From: Lowe’s Home Improvement <lowes@e.lowes.com>`. Its body contains `Sent from the cart of <requester email>`, three product names, Lowe's item/model numbers and quantities. It has **no prices, job-site address, store or aisle**. The company's identity comes from the SMTP **envelope recipient** in Mailgun's `recipient` field, not the retailer's sender, a displayed `To:` header or an inferred address. The requester email in the body is informational, not proof of ownership.

## Addressing and prerequisites

- **Email-only entry:** the portal advertises the shared `delivery@<ORDER_ALIAS_DOMAIN>` pilot address. The dispatcher manually verifies and selects the company before approving the cart. The existing `companies.order_alias` local parts remain in the database, but company-specific addresses are **not advertised**: a Mailgun `delivery*@mg.getlockstep.io` rule does not forward them. Those addresses need an additional non-overlapping forward or a domain-wide rule before anyone may use them. Neither address is the old Gmail inbox.
- **Optional portal (token-address pilot tested):** each newly created `order_intents` row receives a cryptographically random 128-bit `email_token`. After the customer chooses site and Lowe's store, the portal displays `delivery+<32-lowercase-hex>@<ORDER_ALIAS_DOMAIN>` for that intent. Existing `cart-<token>` addresses remain recognizable in the app and SQL function, but Mailgun must still forward them if any were previously shared. The first **successfully parsed** distinct email that becomes an order (dispatcher-approved, or verified on the `/mime` route) claims its site and store; an unreadable cart does not consume the intent. A retry of the *same* email remains one order. A later different email to the used address resolves to the same company but is a **new order without the old site/store**. Sending to the stable company alias **never auto-matches** an open intent. If the customer changes a choice after getting an address, the flow creates another intent/address; the old address stays associated with the old choices until used.
- **The pilot's `mg.getlockstep.io` MX was confirmed and one real shared-address cart reached the deployed webhook.** A token-address cart has also reached dispatcher review and inherited its intended company/site/store after approval. `ORDER_INTAKE_READY=true` is an **operator confirmation** of all advertised addresses, not an automated DNS probe. `MAILGUN_SIGNING_KEY` is the HTTP webhook signing key, never the Mailgun API key.
- **Stable HTTPS URL:** Mailgun must reach the Vercel deployment from the public internet. Check Vercel deployment protection: a protected preview can reject provider POSTs before the Next.js route runs. Use a stable, reachable endpoint; if a preview bypass is required, manage its secret out of the repo.

See [11-deployment-and-environments](11-deployment-and-environments.md#temporary-mailgun-receiving-setup) for the user-run setup and later account handoff.

## Mailgun route configuration

For the pilot's **Mailgun Forwards** screen, use recipient pattern `delivery*@mg.getlockstep.io` and forward URL `https://<stable-vercel-host>/api/webhooks/mailgun/inbound`. This wildcard covers `delivery@` and `delivery+<token>@` but **not** the older per-company aliases or previously issued `cart-<token>` addresses. If either must receive mail, use a single `*@mg.getlockstep.io` rule instead, or carefully configured non-overlapping rules. Do not leave an exact `delivery@` rule overlapping a broader one.

The older Mailgun **Routes** expression UI instead accepts a complete expression:

```text
Expression: match_recipient("^.+@<receiving-domain-escaped-for-regex>$")
Action: forward("https://<stable-vercel-host>/api/webhooks/mailgun/inbound")
Optional additional action: store()
```

In a Routes expression, replace the placeholder with the actual domain and escape dots for Mailgun's regular expression; the Forwards recipient-pattern field accepts wildcards and literal characters, not `match_recipient(...)` or regex. `forward()` delivers the **parsed email** (typically form-encoded; multipart if attachments are present). Optional `store()` retains a recoverable copy at Mailgun for its plan-dependent limited retention. **Never configure `store(notify=".../api/webhooks/mailgun/inbound")`**: it sends a *different notification payload* to the same route and can be misinterpreted as a cart. A future storage-notification handler, if needed, gets its own endpoint. A forward URL ending in `mime` makes Mailgun post the raw message instead; that is what `/api/webhooks/mailgun/mime` is built for. Avoid a URL ending in `json`.

Do not point a second Mailgun route at the same recipient and handler without confirming its behavior. One signed forward per incoming recipient is the acceptance contract.

## Webhook contract and current gaps

| Concern | Current code | Required before declaring live |
|---|---|---|
| Endpoint | `POST /api/webhooks/mailgun/inbound`, `web/app/api/webhooks/mailgun/inbound/route.ts`; form-encoded/multipart only, one non-empty HTML part, bounded payload | Capture and test a **real** redacted Mailgun form payload; `.eml` export alone is not a provider-contract test |
| Signature | HMAC-SHA256 of timestamp + token using `MAILGUN_SIGNING_KEY`; 406 on mismatch | Verify current account key and retry/timestamp behavior. Never log the key, token or raw body |
| Recipient | `lib/intake/resolve-recipient.ts` validates the configured domain and resolves a stable company alias, `delivery+<token>`, or a legacy `cart-<token>` | Pair current/legacy keys to domains during the later account handoff; Mailgun must actually forward each supported address |
| Idempotency | `mailgun_message_id` holds SHA-256 of **recipient + Message-ID** (or recipient + content fallback); completed or review-pending duplicates are no-ops | Confirm actual retry behavior in Mailgun; SQL finalization uses a row lock and `orders.inbound_email_id` unique constraint |
| Retailer authenticity | Through `/api/webhooks/mailgun/mime` (Mailgun forward URL ending in `mime`), the retailer's DKIM signature is verified cryptographically (`lib/intake/mime-email.ts`, `mailauth`) and must align with the From domain. A verified Lowe's cart to a known company address becomes an order (`received`) directly (migration `0017`); everything else stays provisional. The older `/inbound` route verifies nothing and keeps every cart provisional | Switch the Mailgun forward URL to the `mime` route after deploying it, then send a test cart |
| Persistence | Persist raw inbound mail, parse attempt and explicit review reason; approved message calls `finalize_inbound_cart` for order + items + initial event + one-use intent claim + inbound status in one SQL transaction | `finalize_inbound_cart` is applied and real approvals have succeeded. Unit tests mock the RPC and do not prove atomicity or RLS |
| Dispatcher review | `/dispatch/review` includes provisional/failed/unknown inbound entries; sanitized, sandboxed email preview and explicit approve/dismiss actions | Only a validated Lowe's preview can be approved as an order. A failed parse can only be dismissed; dispatcher item editing is planned |
| Customer email | No outbound email. After review, Send for approval puts the order in the customer's portal, where they approve it ([04-order-lifecycle](04-order-lifecycle.md)) | Notifications are planned (Web Push first) |

The current route accepts `formData` and calls the processor inline. Do not assume tests using `fake-supabase.ts` prove real Postgres/RLS behavior. For permanent invalid requests (e.g. bad signature) return 406 without creating an order; for transient persistence failures return a retryable 5xx; return 200 only after a durable decision. Mailgun's `store(notify=…)` is not a fallback for an unverified/blocked `forward()` endpoint.

## Signature verification

A Mailgun signature authenticates **Mailgun's POST**, not the author of the retailer email. The form payload's HMAC uses `timestamp + token`, not the HTML body. Treat a malformed or expired signature as invalid, but test the timestamp window against actual retries before relying on it for recovery. A token cache must not reject Mailgun's legitimate retry of a delivery that failed to commit.

For the retailer, a displayed From address or `DKIM-Signature d=` is **not sufficient**. Mailgun can add `X-Mailgun-Dkim-Check-Result` when spam filtering is configured to *mark with MIME headers*, but `Pass` alone does not prove which domain signed and inbound headers may contain sender-supplied copies. The `inbound` route therefore **always parses to a provisional preview**. The `mime` route receives the raw message, which makes a real DKIM check possible: the signer's key is fetched from DNS and the signed headers and body are re-hashed. Only a passing signature whose domain aligns with the From address and belongs to the retailer counts (Lowe's signs as `e.lowes.com`; the relaying marketing platform's own signature does not count). Such a cart, sent to a known company or intent address, becomes an order directly; the dispatcher still reviews it before it goes to the customer. Any failure, including a DNS error, falls back to the provisional preview. An unrecognized sender, unknown alias, or failed parser stays visibly unresolved.

## Processing flow

```mermaid
sequenceDiagram
    participant Customer
    participant Lowe as Lowe's
    participant Mailgun
    participant App as Signed Vercel webhook
    participant DB as Supabase
    participant Dispatcher
    Customer->>Lowe: Share Cart to company's Mailgun address
    Lowe->>Mailgun: HTML email
    Mailgun->>App: one signed forward() with envelope recipient + body
    App->>DB: record/dedupe inbound message
    App->>DB: resolve company via stable alias or one-use intent alias
    App->>DB: parse; record parse attempt
    alt /mime route, Lowe's DKIM verified, known company or intent address
        App->>DB: finalize_inbound_cart (no reviewer) creates order, status received
        DB-->>Dispatcher: order in the Review tab
    else anything else (incl. every /inbound cart)
        App->>DB: provisional preview or exception, no order yet
        DB-->>Dispatcher: provisional cart or visible exception in one worklist
        Dispatcher->>DB: approve validated cart via finalize_inbound_cart, or dismiss
        DB-->>Dispatcher: order (received) with items
    end
    App-->>Mailgun: 200 only after a durable decision
    Dispatcher->>DB: review store, address, size and price, then Send for approval
    Note over App,Dispatcher: No customer email on receipt or on Send for approval
```

Lowe's does not state a materials price, so **zero in the current schema means unknown, not a free order**. The dispatcher enters the materials estimate as part of review.

## Idempotency and intent matching

Mailgun retries and can redeliver. The inbox's unique key is SHA-256 of `normalized envelope recipient + Message-ID` (or recipient + sender/subject/body fingerprint without Message-ID). A retry of the same message produces one order; the same Message-ID delivered to **different** company addresses is not suppressed. Two different messages to one consumed token create distinct orders, and only the first eligible one carries the intent's site/store. An expired or retailer-mismatched intent still identifies its company but **does not** donate site/store. Never fall back to the company's "latest open" intent for stable-alias mail. A dispatcher-approved preview, or a verified `/mime` cart, is finalized by `finalize_inbound_cart` (migration `0009`, current version `0017`): order, items, one-use intent, status event and inbound link either all commit or all roll back. Migration `0010` added the `delivery+<token>` address check. Both are applied.

## Sender authenticity and unknown aliases

An unknown company alias/token, unsupported sender, unverified retailer, or failed parse is a **visible dispatcher exception**, not a silently ignored message or an automatically dispatchable order. The same `/dispatch/review` worklist includes `inbound_emails` with `review_status='pending'` and no order. A validated provisional Lowe's cart can be approved (and an unknown alias assigned after off-platform company verification) or dismissed. A failed parse has no valid items to approve, so it can only be dismissed; ask for a new cart. Dispatcher item editing is planned. No company is auto-created from inbound mail. Historical review records and raw messages are not deleted.

## Not built

Home Depot parser (planned for the pilot), Ace, scraping retailer sites, AI fallback, any customer email, driver texts or push, and payments. The optional portal remains supported; it is no longer the only way to request a delivery.
