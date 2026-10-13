# 05 — Lowe's email intake

A customer builds a Lowe's cart and uses Lowe's **Share Cart** to send it to their company's address on the prototype Mailgun receiving domain. The application parses it into dispatcher work. A portal visit is **optional**.

> **Status:** The parser, signed webhook and one-use portal address code exist; migration `0008_intent_mail_tokens.sql` still requires your review/application. The temporary domain's receiving MX and a real Mailgun → Vercel delivery are **not verified**. Keep `ORDER_INTAKE_READY=false` until atomic persistence, trusted/provisional sender handling, exception review and a real end-to-end test are complete.

## The critical detail: the sender is the retailer, not the customer

The captured Lowe's message has a generic subject and `From: Lowe’s Home Improvement <lowes@e.lowes.com>`. Its body contains `Sent from the cart of <requester email>`, three product names, Lowe's item/model numbers and quantities. It has **no prices, job-site address, store or aisle**. The company's identity comes from the SMTP **envelope recipient** in Mailgun's `recipient` field, not the retailer's sender, a displayed `To:` header or an inferred address. The requester email in the body is informational, not proof of ownership.

## Addressing and prerequisites

- **Email-only entry:** the pilot company retains its existing `companies.order_alias` local part (`things.dispatch+acme-construction`). Its customer-facing address is `<company.order_alias>@<ORDER_ALIAS_DOMAIN>`. It is a **Mailgun-domain** address, not the old `@gmail.com` inbox. You may give it to the customer without requiring portal login.
- **Optional portal (code implemented; migration pending):** each newly created `order_intents` row receives a cryptographically random 128-bit `email_token`. After the customer chooses site and Lowe's store, the portal displays `cart-<32-lowercase-hex>@<ORDER_ALIAS_DOMAIN>` for that intent. The first **successfully parsed eligible** distinct email claims its site and store; an unreadable cart does not consume the intent. A retry of the *same* email remains one order. A later different email to the used address resolves to the same company but is a **new order without the old site/store**. Sending to the stable company alias **never auto-matches** an open intent. If the customer changes a choice after getting an address, the flow creates another intent/address; the old address stays associated with the old choices until used.
- **The prototype domain is already verified for ownership, but its receiving MX is not yet confirmed.** In the user's Mailgun account, configure MX using the exact records provided by Mailgun for that domain, confirm inbound delivery, then the route and Vercel destination. `ORDER_INTAKE_READY=true` is an **operator confirmation**, not an automated DNS probe. `MAILGUN_SIGNING_KEY` is the HTTP webhook signing key, never the Mailgun API key.
- **Stable HTTPS URL:** Mailgun must reach the Vercel deployment from the public internet. Check Vercel deployment protection: a protected preview can reject provider POSTs before the Next.js route runs. Use a stable, reachable endpoint; if a preview bypass is required, manage its secret out of the repo.

See [11-deployment-and-environments](11-deployment-and-environments.md#temporary-mailgun-receiving-setup) for the user-run setup and later account handoff.

## Mailgun route configuration

Use **one** route scoped to the exact receiving domain. Its required action is:

```text
Expression: match_recipient("^.+@<receiving-domain-escaped-for-regex>$")
Action: forward("https://<stable-vercel-host>/api/webhooks/mailgun/inbound")
Optional additional action: store()
```

In the real route, replace the placeholder with the actual domain and escape dots for Mailgun's regular expression. `forward()` delivers the **parsed email** (typically form-encoded; multipart if attachments are present). Optional `store()` retains a recoverable copy at Mailgun for its plan-dependent limited retention. **Never configure `store(notify=".../api/webhooks/mailgun/inbound")`**: it sends a *different notification payload* to the same route and can be misinterpreted as a cart. A future storage-notification handler, if needed, gets its own endpoint. Avoid a callback URL ending in `json` or `mime` unless the route is deliberately updated to handle that format and its distinct signature rules.

Do not point a second Mailgun route at the same recipient and handler without confirming its behavior. One signed forward per incoming recipient is the acceptance contract.

## Webhook contract and current gaps

| Concern | Current code | Required before declaring live |
|---|---|---|
| Endpoint | `POST /api/webhooks/mailgun/inbound`, `web/app/api/webhooks/mailgun/inbound/route.ts` | Capture and test a **real** Mailgun form payload, not just a Gmail-exported `.eml` |
| Signature | HMAC-SHA256 of timestamp + token using `MAILGUN_SIGNING_KEY`; 406 on mismatch | Verify current account key and retry/timestamp behavior. Never log the key, token or raw body |
| Recipient | `lib/intake/resolve-recipient.ts` validates the full address's configured domain. Exact stable company alias resolves the company only; a known `cart-<token>` resolves its owner and an eligible unused intent. Unknown token/domain has no order | Pair current/legacy account keys with the respective domains during the later account handoff; do not infer company from an unrecognized address |
| Idempotency | The legacy-named `mailgun_message_id` column now holds SHA-256 of **normalized recipient + Message-ID** (or recipient + message content when Message-ID is absent) | The whole intake must become atomic; current separate writes can strand a partial order on failure |
| Retailer authenticity | Checks only for a `DKIM-Signature d=` header | Presence is **forgeable**, not verified authentication. Quarantine uncertain messages visibly; validate provider evidence with a real signed capture |
| Persistence | Records inbound email, attempt, order, items, intent and state in separate calls | Check every write and finalize related records transactionally so retries cannot strand half-orders |
| Customer email | No actual sending or checkout destination exists | **No automatic customer email or driver dispatch** in this intake milestone |

The current route accepts `formData` and calls the processor inline. Do not assume tests using `fake-supabase.ts` prove real Postgres/RLS behavior. For permanent invalid requests (e.g. bad signature) return 406 without creating an order; for transient persistence failures return a retryable 5xx; return 200 only after a durable decision. Mailgun's `store(notify=…)` is not a fallback for an unverified/blocked `forward()` endpoint.

## Signature verification

A Mailgun signature authenticates **Mailgun's POST**, not the author of the retailer email. The form payload's HMAC uses `timestamp + token`, not the HTML body. Treat a malformed or expired signature as invalid, but test the timestamp window against actual retries before relying on it for recovery. A token cache must not reject Mailgun's legitimate retry of a delivery that failed to commit.

For the retailer, a displayed From address or `DKIM-Signature d=` is **not sufficient**. Mailgun can add `X-Mailgun-Dkim-Check-Result` when spam filtering is configured to *mark with MIME headers*, but `Pass` alone does not prove which domain signed and inbound headers may contain sender-supplied copies. Until a real payload and spoofed-header test establish reliable, aligned provider evidence, parse as a **read-only provisional preview**, then require an authorized dispatcher to approve it before creating an operational order.

## Processing flow (target)

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
    App->>DB: parse and persist trusted order atomically OR provisional exception
    App-->>Mailgun: 200 only after durable decision
    DB-->>Dispatcher: ordinary order or visible exception in one worklist
    Dispatcher->>DB: verify and complete missing site/store/materials
    Note over App,Dispatcher: No customer email or automatic dispatch on receipt
```

Lowe's does not state a materials price, so **zero in the current schema means unknown, not a free order**. The dispatcher enters the materials estimate as part of review.

## Idempotency and intent matching

Mailgun retries and can redeliver. The inbox's unique key is SHA-256 of `normalized envelope recipient + Message-ID` (or recipient + sender/subject/body fingerprint without Message-ID). A retry of the same message produces one order; the same Message-ID delivered to **different** company addresses is not suppressed. Two different messages to one consumed token create distinct orders, and only the first eligible one carries the intent's site/store. An expired or retailer-mismatched intent still identifies its company but **does not** donate site/store. Never fall back to the company's "latest open" intent for stable-alias mail. Existing order, items, token claim and inbound status are still separate writes; the next phase must make them atomic before live pilot intake.

## Sender authenticity and unknown aliases

An unknown company alias/token, unsupported sender, unverified retailer, or failed parse is a **visible dispatcher exception**, not a silently ignored message or an automatically dispatchable order. The current implementation stores some such messages with no order, but the existing dispatcher query only lists `orders` in `received`/`needs_review`; the unified exception view is pending. A dispatcher must manually verify a questionable message before accepting/attributing it. Never auto-create companies from inbound mail.

## Out of scope for this milestone

Home Depot and Ace parsers, scraping retailer sites, AI fallback, automatic customer receipt/checkout email, driver broadcasting and payments. The optional portal remains supported; it is no longer the only way to request a delivery.
