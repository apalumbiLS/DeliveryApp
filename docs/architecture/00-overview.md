# Delivery App MVP — Systems Architecture & Delivery Plan

Establish the full system architecture, data model, and phased build plan for a construction-site delivery MVP — starting with a repo-committed set of Markdown + Mermaid design documents.

> **Status:** Approved architecture. Phase 0 (design artifacts) complete.
> **Owner:** Delivery App team · **Last updated:** 2026-09-16

---

## Summary

Build the systems needed for a construction-site delivery MVP: a Next.js app (three role-guarded UIs) on Supabase, with a Mailgun-driven email-cart intake that parses **Lowe's** share-cart emails into structured orders, a dispatcher console that drives the order through a guarded state machine, a driver job board with first-accept-wins dispatch, and Stripe Payment Links for collection.

This document describes the longer-term product roadmap, **not the set of features already live**. The current prototype milestone is narrower: a customer shares a Lowe's cart to a company-specific Mailgun address without needing the portal; the app parses it into dispatcher review, where a person supplies missing site/store/price details. The portal's pre-cart flow is optional. Customer checkout invitations, outbound mail, automated dispatch and payments are **not enabled**. [05-email-intake](05-email-intake.md) documents the current receiving setup and outstanding hardening.

---

## Source material reviewed

| Document                                                        | What it established                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `External Notes/Low Tech Flow.pdf` (23pp)                       | Full manual runbook, 10 status names, 3 persona guides, email template, fee model |
| `External Notes/Delivery App Workflow.pdf` (4pp)                | Persona step lists, vNext ideas, 14 open questions                                |
| `External Notes/MVP for Delivery App.pdf` (1p)                  | Four intake options, checkout requirements, deferred concepts                     |
| `External Notes/Share Cart Invitation From Anthony Palumbi.eml` | Analyzed field-by-field — see [Findings](#findings-from-the-example-email)        |

---

## Findings from the example email

These five findings were derived by inspecting the real Home Depot share-cart email and drove several locked decisions. They are recorded here because they are the empirical basis for the parser design and the store-capture decision.

| Finding                               | Evidence                                                                                                                                    | Consequence                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Full line items are in the email body | `Model #9988872`, `Store SKU #1014148280`, `Aisle`/`Bay` columns, qty `1`, `$216.60`, image URL `…/deckmate-deck-screws-9988872-64_400.jpg` | No scraping needed for items. Parsing is a solved, deterministic problem.      |
| **No store identifier anywhere**      | 0 matches for store name/number/zip across 136KB of HTML. `pickup-store` is an empty CSS wrapper class, not data.                           | Confirms dispatcher-sets-store is required, not a shortcut.                    |
| Shared cart page is bot-blocked       | `curl` on the supplied `sharedCartId` URL → **HTTP 403** (Akamai Bot Manager)                                                               | Fetching the cart link is not a cheap MVP path. Rules out store-scraping.      |
| Items appear twice                    | `desktop_item_list` (visible) and `mobile_item_list` (`display:none`) both contain the cart                                                 | Parser must scope to `desktop_item_list` or dedupe, or every order doubles.    |
| HTML-only, no plain-text part         | Single `text/html` MIME part, `quoted-printable`                                                                                            | Parser operates on HTML; Mailgun's `body-plain` is auto-synthesized and lossy. |

---

## Locked decisions

| Area            | Decision                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------- |
| Persistence     | Supabase (Postgres + Auth + Storage + RLS)                                                |
| Front end       | Next.js App Router, **one app, 3 route groups**: `/dispatch`, `/driver`, `/portal`        |
| Hosting         | Vercel                                                                                    |
| Email in + out  | **Mailgun** inbound webhook; outbound customer email deferred from current milestone      |
| Retailers       | **Lowe's only.** Home Depot and Ace are deferred — no parser and no seeded stores         |
| SMS             | Twilio                                                                                    |
| Payments        | Stripe Payment Links + webhook                                                            |
| Background jobs | **Vercel Cron sweeps** over a notifications outbox + broadcast expiry. No workflow engine |
| Intake paths    | Stable company Mailgun address is enough; optional pre-cart portal flow; no live checkout |
| Order identity  | Stable plus-tag local part per company; optional portal one-use addresses coded in migration `0008` |
| Company model   | Company = org, **one portal login** per company                                           |
| Auth            | Email-as-username + password (Supabase Auth)                                              |
| Store capture   | Customer supplies it in optional portal flow; dispatcher collects it for direct-email orders |
| Parsing         | Deterministic parser → schema validation → dispatcher review queue. **LLM fallback deferred** |
| Item metadata   | Email fields only. No enrichment API, no scraping.                                        |
| Quote           | **Manual fee entry** by dispatcher                                                        |
| Driver comms    | In-app job board + SMS notify; first-accept-wins                                          |
| Customer UX     | Simplified portal: login, history, order detail/status, checkout                          |
| Photo gates     | **Prompt but never block**; skip requires a reason                                        |
| Parallel run    | **None.** No Slack, no Google Sheets. App is the sole system of record.                   |
| Market          | North Carolina → Supabase `us-east-1`                                                     |
| Docs            | Markdown + Mermaid, committed in-repo                                                     |

Each decision has a corresponding ADR in [`docs/adr/`](../adr/README.md).

---

## MVP scope

### In scope

- Email alias intake → deterministic **Lowe's** cart parse → order created
- Dispatcher console: review queue, order board, item verification/edit, store assignment, fee entry, status transitions, complete-checkout-on-behalf, payment link send
- Customer portal: login, order list + history, order detail with status timeline, checkout wizard (verify items → address + instructions → fees → accept → pay)
- Driver app (mobile-first): job board, accept, status advance, photo upload (skippable with reason)
- SMS/email notifications for checkout invite, job broadcast, payment request
- Stripe Payment Links + paid-state webhook
- Admin: companies + aliases + portal users, store seeding, driver management

### Explicitly deferred

Designed for, not built. Each item's extension hook is documented in [12-deferred-and-extension-points.md](12-deferred-and-extension-points.md).

Item substitution · cancellation UI · automated customer status fan-out · multi-store orders · parts catalog / concierge procurement · smart iFrame · chat experience · aisle/bay data · product enrichment API · native mobile apps · driver payouts (Stripe Connect) · fee rule engine · Slack integration · **Home Depot and Ace parsers** · **LLM fallback tier**

---

## Target architecture

```mermaid
flowchart TB
    subgraph Actors
        C[Construction Customer]
        D[Dispatcher]
        R[Delivery Driver]
    end

    subgraph Retailers
        HD[Home Depot]
        LW["Lowe's"]
    end

    subgraph App["Next.js on Vercel (single app)"]
        PORTAL["/portal — customer"]
        DISP["/dispatch — dispatcher"]
        DRIVER["/driver — driver PWA"]
        API[Route handlers + server actions]
    end

    subgraph Supabase
        PG[(Postgres + RLS)]
        AUTH[Auth]
        STORE[(Storage: evidence)]
    end

    MG["Mailgun<br/>inbound + outbound"]
    TW[Twilio SMS]
    ST[Stripe Payment Links]
    CRON["Vercel Cron<br/>sweeps"]

    C -->|builds cart| HD
    C -->|builds cart| LW
    HD -.->|share-cart email| MG
    LW -.->|share-cart email| MG
    MG -->|HMAC-signed webhook| API
    CRON -->|scheduled| API
    API --> PG
    API --> STORE
    API --> MG
    API --> TW
    API --> ST
    ST -->|paid webhook| API
    C --> PORTAL
    D --> DISP
    R --> DRIVER
    PORTAL --> AUTH
    DISP --> AUTH
    DRIVER --> AUTH
```

### Order lifecycle (guarded state machine)

```mermaid
stateDiagram-v2
    [*] --> received
    received --> needs_review : parse failed
    needs_review --> awaiting_customer : dispatcher resolves items
    received --> awaiting_customer : checkout invite sent
    awaiting_customer --> customer_confirmed : items + address + fees accepted
    awaiting_customer --> customer_confirmed : dispatcher completes on behalf
    customer_confirmed --> driver_requested : broadcast to drivers
    driver_requested --> driver_assigned : first accept wins
    driver_assigned --> driver_at_store
    driver_at_store --> items_purchased : receipt photo prompted
    items_purchased --> en_route
    en_route --> delivered : delivery photo prompted
    delivered --> payment_requested : Stripe link sent
    payment_requested --> paid : Stripe webhook
    paid --> closed
    cancelled --> [*]
    closed --> [*]
```

`cancelled` exists in the enum and the transition map from day one, but has no UI in the MVP — that is what makes cancellation a small later addition rather than a refactor.

### Parsing fallback ladder

```mermaid
flowchart TD
    A[Inbound email arrives] --> B{Retailer identified<br/>from sender domain}
    B -->|e.lowes.com| D[LowesCartParser]
    B -->|no parser for that retailer| K["Email → needs_review<br/>no order created"]
    D --> E{zod + structural<br/>validation}
    E -->|yes| F[Create order → received]
    E -->|no| I[Order → needs_review]
    I --> J[Dispatcher review queue]
    J -->|correct items| F
```

Every attempt — deterministic or manual — is recorded in `parse_attempts` with parser version, output, and errors, so template drift is visible rather than silent. The LLM tier is deferred; when it lands it slots in between `E -->|no|` and `I`.

---

## Data model

```mermaid
erDiagram
    COMPANIES ||--o{ PROFILES : employs
    COMPANIES ||--o{ COMPANY_SITES : has
    COMPANIES ||--o{ ORDERS : places
    INBOUND_EMAILS ||--o| ORDERS : becomes
    ORDERS ||--|{ ORDER_ITEMS : contains
    ORDERS ||--o{ ORDER_STATUS_EVENTS : logs
    ORDERS ||--o{ JOB_DECLINES : "declined by"
    ORDERS ||--o{ ATTACHMENTS : evidences
    ORDERS ||--o{ NOTIFICATIONS : sends
    ORDERS ||--o{ PAYMENTS : bills
    RETAILER_STORES ||--o{ ORDERS : fulfills
    PROFILES ||--o{ JOB_DECLINES : declines
    INBOUND_EMAILS ||--o{ PARSE_ATTEMPTS : attempts

    ORDERS {
        uuid id PK
        text order_number
        uuid company_id FK
        uuid inbound_email_id FK
        uuid retailer_store_id FK
        text retailer
        text status
        int materials_subtotal_cents
        int sizing_fee_cents
        int mileage_fee_cents
        int total_cents
        jsonb quote_breakdown
        text delivery_address_json
        text delivery_instructions
        uuid assigned_driver_id FK
        timestamptz created_at
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        int line_no
        text description
        text brand
        text model_number
        text store_sku
        int quantity
        int unit_price_cents
        int line_total_cents
        text image_url
        text item_status
    }
    INBOUND_EMAILS {
        uuid id PK
        text mailgun_message_id
        text recipient_alias
        text sender_email
        text subject
        text body_html
        text processing_status
        uuid order_id FK
    }
```

Full table list (Phase 1 migrations): `companies`, `profiles`, `company_sites`, `retailer_stores`, `inbound_emails`, `parse_attempts`, `orders`, `order_items`, `order_status_events`, `job_declines`, `attachments`, `notifications`, `payments`, plus enums for `user_role`, `order_status`, `retailer`, `item_status`, `notification_status`, `payment_status`.

Two design choices that protect the deferred features:

- **`order_status_events` is an append-only event log.** Automated customer status emails become a fan-out on this table — no schema change.
- **`quote_breakdown` is jsonb** alongside the scalar fee columns. Adding a fee rule engine later doesn't reshape the order table.

---

## Documentation structure

All 27 documents below are written. See [docs/README.md](../README.md) for the index.

```
docs/
  README.md                              # index + reading order
  architecture/
    00-overview.md                       # this document
    01-system-context.md                 # C4 L1
    02-containers.md                     # C4 L2
    03-data-model.md                     # ERD + table-by-table reference
    04-order-lifecycle.md                # state machine + transition/permission table
    05-email-intake.md                   # Mailgun route, alias scheme, webhook contract
    06-cart-parsing.md                   # parser design, HD field map, fallback ladder
    07-dispatch.md                       # postings, declines, first-accept-wins
    08-notifications.md                  # templates + trigger matrix
    09-payments.md                       # Stripe links + webhook
    10-auth-and-permissions.md           # roles, RLS, route guards
    11-deployment-and-environments.md
    12-deferred-and-extension-points.md  # each deferred item + its hook
  adr/
    0001-supabase-postgres.md
    0002-single-nextjs-app-three-route-groups.md
    0003-mailgun-for-inbound-cart-email.md
    0004-deterministic-parser-with-llm-fallback.md
    0005-inngest-durable-workflows.md
    0006-stripe-payment-links.md
    0007-email-password-auth.md
    0008-dispatcher-assigns-store.md
    0009-inline-intake-and-cron-sweeps.md
  runbooks/
    customer-guide.md
    dispatcher-guide.md
    driver-guide.md
    dry-run-checklist.md
```

---

## Implementation roadmap

### Phase 0 — Design artifacts ✅ complete

1. ✅ Created the `docs/` tree above.
2. ✅ Wrote `00-overview.md`: locked decisions table, MVP in/out scope, the source findings.
3. ✅ Wrote the 12 architecture docs with embedded Mermaid diagrams (context, containers, ERD, state machine, intake sequence, dispatch sequence, delivery + payment sequence, parsing ladder, deployment).
4. ✅ Wrote 8 ADRs — each with context / decision / consequences / alternatives rejected.
5. ✅ Rewrote the three persona runbooks against the _new_ system (the PDFs describe the retired low-tech process).
6. ✅ Wrote `12-deferred-and-extension-points.md`, mapping every deferred item to the specific hook that makes it cheap later, plus a full source-material traceability table.
7. ➖ **Skipped:** SVG exports. Every diagram renders correctly on GitHub, so there was nothing to work around.

**Verified:** 16/16 Mermaid diagrams parse; 104 file links and 11 anchor links resolve. See the [verification checklist](#verification-checklist).

### Phase 1 — Foundation

Next.js/Bun and Supabase schema are scaffolded; the pilot has North Carolina Lowe's store data. Your temporary Mailgun domain is verified for ownership but receiving MX and the Vercel callback still require an operator-run live test. Historical phase names below describe the broader roadmap, not the order in which to enable customer checkout.

### Phase 2 — Email intake + parsing _(highest risk — deliberately early)_

Lowe's parser, signed Mailgun `forward()` handler, recipient-domain validation and one-use portal addresses exist in code (the last requires migration `0008`). Route the verified inbound domain to that **single parsed-email callback**; optional `store()` has no `notify` URL. Provisional parsing, a same-queue exception view, and an atomic SQL finalization contract are drafted in Phase 3; **migration `0009` and real Mailgun payload behavior are not verified**. Keep intake readiness off until the client pilot's real receiving test passes; Home Depot and AI fallback are deferred.

### Phase 3 — Dispatcher console

Review queue · order board with aging indicators · order detail (verify/edit items, assign store, enter fees, advance status, complete-on-behalf) · admin for companies, aliases, portal users, stores, drivers.

### Phase 4 — Customer portal + checkout

Login · order list + history · order detail with status timeline · checkout wizard · saved job sites · checkout-invite email.

### Phase 5 — Dispatch + driver app

Job board (all open postings) · atomic first-accept-wins through the transition choke point · Twilio broadcast · mobile-first driver UI · status advance · photo upload with skip-reason.

### Phase 6 — Payments

Stripe Payment Link creation · send on `delivered` · `checkout.session.completed` webhook → `paid` · receipt email.

### Phase 7 — Hardening

Structured logging + error tracking · system-health panel · RLS test suite · concurrency test on the accept race · runbooks.

---

## Verification checklist

Phase 0 self-verification, with the evidence for each item.

- [x] **Every Mermaid block parses.** 16 diagrams across 9 files validated against the `mermaid` parser — not eyeballed. All 16 pass.
- [x] **All documentation links resolve.** 104 file links and 11 anchor links verified programmatically. No dead links.
- [x] **ADR coverage.** 9 ADRs cover the decisions with real trade-offs — persistence, app structure, email vendor, parsing strategy, background work, payments, auth, and store assignment. The remaining locked decisions (fee entry, photo gating, market) are recorded in the decisions table above; they are configuration choices rather than architectural ones and do not warrant a record each.
- [x] **Source traceability.** Every intake option and vNext idea from the source PDFs is mapped to a disposition in [12-deferred-and-extension-points](12-deferred-and-extension-points.md#traceability-source-material-to-disposition).
- [x] **Runbook ↔ state machine consistency.** Dispatcher, driver, and customer guides were checked against the transitions in [04-order-lifecycle](04-order-lifecycle.md). This check caught a real gap: the customer guide's status list omitted `driver_requested` and `payment_requested`, both of which a customer can see. Fixed.
- [x] **Parser field maps match the real emails.** Lowe's is implemented and covered by golden-file tests. Home Depot's map in [06-cart-parsing](06-cart-parsing.md#appendix-home-depot-field-map-reference) was extracted from both actual `.eml` files, including the duplicate-view trap and the Aisle/Bay sub-row (empty in one sample, populated in the other).
- [ ] **Diagram legibility review.** Rendering correctness is verified; _legibility_ needs a human. Confirm the container diagram, ERD, and state machine read clearly before the team relies on them.
- [x] **Open blockers documented** — see below.

### Gaps this verification did not close

- **The Lowe's sample is a single cart.** It has 3 items, which confirms multi-row carts — but it is one sample. A second cart, ideally with a different item count, would strengthen the extractor's evidence before it is trusted.
- **The Lowe's email carries no prices.** Captured and analysed: it contains no money at all — no line totals, no subtotal, no tax. Reconciliation therefore cannot run for Lowe's, so validation is structural and the dispatcher enters the materials cost by hand. See [06-cart-parsing](06-cart-parsing.md).

---

## Risks and considerations

| Risk                                                                          | Mitigation                                                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Lowe's gives no prices, so nothing reconciles arithmetically**               | Validation is structural — three independently-derived item counts must agree — and the review queue is the human backstop |
| **An unsupported retailer's cart is invisible in the UI** — it lands in `needs_review` with no order, and unattributed handling is out of scope | Home Depot is unselectable in the portal, so it should be rare. Recorded as a known gap rather than left implicit |
| Template drift silently breaks parsing                                        | Golden-file tests + versioned parser + `parse_attempts` telemetry + review queue as backstop                     |
| Mailgun `forward()` retries if the webhook is slow                            | Persist the email before parsing, re-process duplicates that are still pending, and keep the parser fast         |
| Job-accept race (two drivers accept simultaneously)                           | Enforced by the row-locking state transition on the order, never in app code                                     |
| PII exposure (addresses, phones, receipt photos)                              | RLS on every table, private storage bucket, signed URLs only                                                     |
| Three UIs in one app risks a muddled boundary                                 | Route groups + role guards from commit one; the ADR records when to split                                        |
| "Prompt but never block" photos weakens the dispute evidence trail            | Every skip records a reason and is visible on the order detail and to the dispatcher                             |
| Portal is load-bearing with no email fallback for address/acceptance          | Dispatcher can complete checkout on the customer's behalf; treat portal availability as critical during dry runs |

---

## Open blockers

To resolve before Phase 2:

1. **A temporary Mailgun account** — API key, signing key, and inbound domain, set as environment variables. Replacing it with the client's is a config-only change; see [11-deployment](11-deployment-and-environments.md#swapping-the-mailgun-account).
2. **A second Lowe's cart** — one sample is thin evidence for the extractor.
3. **Stripe and Twilio accounts** — Supabase and Vercel already exist; Mailgun is temporary.
4. **A domain, eventually** — the customer-facing alias address changes when the client's account replaces the temporary one.
