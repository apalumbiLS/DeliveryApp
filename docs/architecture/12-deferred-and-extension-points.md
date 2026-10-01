# 12 — Deferred Work & Extension Points

Everything deliberately not built in the MVP, and the specific hook that makes each one a small addition rather than a rewrite.

> **Status:** Reference. Consult before proposing new scope.

---

## Why this document exists

"This is out of scope" is not useful on its own. What makes a deferral safe is knowing **what was left in place** so the feature can be added without disturbing what already works.

Each entry below states the hook that already exists. If an item has no hook, that is a design gap worth fixing now rather than later.

---

## Order lifecycle

### Item substitution

|                  |                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **What**         | Driver or dispatcher marks an item out of stock and records a substitute or removes it, recalculating the total                                |
| **Why deferred** | Your dry-run notes flag it as an open question; the policy (who may substitute, whether the customer pre-approves) is undecided                |
| **Hook**         | `order_items.item_status` enum already contains `unavailable` and `substituted`; `order_items.substituted_by_item_id` and `note` columns exist |
| **To build**     | UI to set item status and link a substitute; a recalculation path; a customer notification                                                     |
| **Size**         | Small — schema is done. The work is UI plus a decision about authorisation                                                                     |

### Cancellation

|                  |                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **What**         | Cancel an order at any pre-purchase status, with a reason and a terminal state                                                 |
| **Why deferred** | Listed as an open question in the source material; no policy for refunds or fees on cancellation                               |
| **Hook**         | `cancelled` is in the `order_status` enum **and** in the transition map with no UI; `orders.cancellation_reason` column exists |
| **To build**     | A cancel action on the dispatcher console; posting withdrawal; customer notification                                           |
| **Size**         | Small — the state machine already accepts it                                                                                   |

### Automated customer status fan-out

|                  |                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **What**         | Email or SMS the customer automatically on each status change instead of the dispatcher doing it by hand                               |
| **Why deferred** | Listed as vNext in your workflow doc; the MVP keeps the dispatcher in control while the process is being validated                     |
| **Hook**         | `order_status_events` is an append-only log of every transition — this is the event source. `notifications` already has a `dedupe_key` |
| **To build**     | A fan-out on `order_status_events` (sweep or trigger), plus templates                                                                  |
| **Size**         | Small-to-medium. **This is the highest-value post-MVP addition** — it is the main remaining manual step                                |

### Multi-store orders

|                  |                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **What**         | One order spanning Lowe's and Home Depot                                                                                |
| **Why deferred** | Explicitly a vNext idea; it complicates dispatch (two pickups), pricing (two mileage legs), and evidence (two receipts) |
| **Hook**         | `orders.retailer` is a single value today; `retailer_stores` is already a separate table                                |
| **To build**     | An `order_pickups` child table, per-pickup status, and a rework of the dispatch and evidence flows                      |
| **Size**         | Large — a genuine data model change. Deferring is correct                                                               |

---

## Intake

### In-app cart building (product catalog)

|                  |                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **What**         | Customers search and build a cart inside our app instead of at the retailer                                                                      |
| **Why deferred** | Requires a real product catalog and pricing feed — a separate product, not a feature                                                             |
| **Hook**         | The parser's output schema (`CartSchema`) is the same shape any catalog would produce, so a catalog would feed the identical order-creation path |
| **To build**     | Catalog ingestion, search, cart UI, and a pricing/availability source                                                                            |
| **Size**         | Very large                                                                                                                                       |

### Parts database / concierge procurement

|                  |                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **What**         | A searchable parts database so dispatchers can recommend alternatives when a part doesn't exist |
| **Why deferred** | Your MVP doc asks "Is it an API? Is it static?" — unanswered. Depends on the catalog above      |
| **Hook**         | Depends on the catalog; `order_items.model_number` gives a natural join key once it exists      |
| **To build**     | Catalog plus a recommendation UI                                                                |
| **Size**         | Large                                                                                           |

### Smart iFrame

|                  |                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| **What**         | Embed the retailer's cart in our UI so the customer can skip the email round-trip                      |
| **Why deferred** | Your notes flag it as possibly against terms of service, and "we don't know how plausible this is yet" |
| **Hook**         | None — and none is warranted until the ToS question is answered                                        |
| **To build**     | Unknown; blocked on a legal/product answer                                                             |
| **Size**         | Unknown. **Do not start without a ToS review**                                                         |

### Chat experience

|                  |                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| **What**         | In-app messaging between customer, dispatcher, and driver                                                       |
| **Why deferred** | Listed as an option, not a requirement; email plus the portal covers the MVP loop                               |
| **Hook**         | `orders` is the natural thread container; `order_status_events` already models a chronological per-order stream |
| **To build**     | A `messages` table, realtime subscription, and notifications                                                    |
| **Size**         | Medium                                                                                                          |

---

## Data enrichment

### Product enrichment API

|                  |                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **What**         | Pull dimensions, weight, and product URLs to auto-classify job size                             |
| **Why deferred** | Costs a vendor (~$66+/mo for Home Depot alone) and the email already carries what the MVP needs |
| **Hook**         | `order_items` has room for additional columns; `quote_breakdown` is jsonb                       |
| **To build**     | A vendor integration keyed on `model_number`, plus caching                                      |
| **Size**         | Small-to-medium                                                                                 |

### Aisle / Bay location data

|                  |                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What**         | Tell the driver exactly where in the store each item is                                                                                                                   |
| **Why deferred** | Home Depot does populate them (one sample carries `Aisle 15`/`Bay 002`), but they are store-scoped and the email never names the store — so they are only trustworthy once the order carries a customer-confirmed store                                                                    |
| **Hook**         | `order_items.aisle` and `order_items.bay` columns exist and are already parsed                                                                                            |
| **To build**     | Nothing to parse. The gate is store confirmation on the order, not data capture                                                                                           |
| **Size**         | Small, once store confirmation exists                                                                                                                                     |

### Live price and stock re-verification

|                  |                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| **What**         | Confirm price and availability before dispatching a driver                                                           |
| **Why deferred** | The shared cart page returned **HTTP 403** to a plain fetch. Doing this needs residential proxies and a browser farm |
| **Hook**         | `order_items` can hold a verified price alongside the email price                                                    |
| **To build**     | Bot-bypass infrastructure and ongoing maintenance                                                                    |
| **Size**         | Large and permanent — a standing maintenance cost, not a one-time build                                              |

---

## Money

### Fee rule engine

|                  |                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **What**         | Automatic sizing fee and mileage calculation from size class and distance                                                                                                            |
| **Why deferred** | Your docs say "we need to sort out the fee structure" — the model itself is unsettled, so automating it now would encode a guess                                                     |
| **Hook**         | `orders.quote_breakdown` is jsonb; `sizing_fee_cents` and `mileage_fee_cents` are already separate columns; `company_sites.lat/lng` and `retailer_stores.lat/lng` exist for distance |
| **To build**     | A `fee_rules` config table, a geocoding call, and a calculator                                                                                                                       |
| **Size**         | Medium. **The schema was designed for exactly this** — adding it will not reshape `orders`                                                                                           |

### Refunds

|                  |                                                                         |
| ---------------- | ----------------------------------------------------------------------- |
| **What**         | Full or partial refunds                                                 |
| **Why deferred** | No refund policy yet; unlikely to be needed during a supervised dry run |
| **Hook**         | `refunded` is already in the `payment_status` enum                      |
| **To build**     | A Stripe refund call and a dispatcher action                            |
| **Size**         | Small                                                                   |

### Driver payouts

|                  |                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **What**         | Pay drivers through the platform                                                                                                   |
| **Why deferred** | Stripe Connect brings driver KYC, tax reporting, and 1099 obligations — a compliance project, not a feature                        |
| **Hook**         | `orders.assigned_driver_id` and `order_status_events` record who did what, so payout amounts are derivable once a pay model exists |
| **To build**     | Stripe Connect onboarding, transfer logic, and reconciliation                                                                      |
| **Size**         | Large. **Requires a decision about driver classification first**                                                                   |

### Subscription / prepaid bucket billing

|                  |                                                           |
| ---------------- | --------------------------------------------------------- |
| **What**         | The "prepay bucket per month" idea from your workflow doc |
| **Why deferred** | Pricing model is undecided                                |
| **Hook**         | `companies` is the natural billing entity                 |
| **To build**     | A billing model and Stripe subscription integration       |
| **Size**         | Medium                                                    |

---

## Communication

### Customer SMS

|                  |                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What**         | Text updates to customers, not just drivers                                                                                                               |
| **Why deferred** | Customers are email-native and started the interaction by email; A2P registration is already needed for drivers, so the marginal cost is low but not zero |
| **Hook**         | `notifications.channel` already supports `sms`; Twilio is already integrated                                                                              |
| **To build**     | A phone field on the checkout flow and a template                                                                                                         |
| **Size**         | Small                                                                                                                                                     |

### Slack integration

|                  |                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What**         | Post order events to a Slack channel                                                                                                                                                           |
| **Why deferred** | You chose a clean break from the Slack + Sheets process — the app is the system of record. Slack as a _notification_ is different from Slack as a _workflow_, but it is not needed for the MVP |
| **Hook**         | `order_status_events` is the event source, same as the status fan-out                                                                                                                          |
| **To build**     | A webhook post on status events                                                                                                                                                                |
| **Size**         | Small — but only if it stays a notification, never a workflow                                                                                                                                  |

---

## Platform

### Native mobile apps

|                  |                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **What**         | Real iOS/Android apps, especially for drivers                                                                                                                      |
| **Why deferred** | Your workflow doc lists phone apps for both company and driver as vNext. The driver app is a mobile-first PWA, which covers the MVP need at a fraction of the cost |
| **Hook**         | The driver UI is already mobile-first and API-shaped, so a native client would consume the same endpoints                                                          |
| **To build**     | Two apps, two release pipelines, two review processes                                                                                                              |
| **Size**         | Very large                                                                                                                                                         |

### Multiple portal users per company

|                  |                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **What**         | More than one login per construction company                                                      |
| **Why deferred** | You chose one login per company for the MVP                                                       |
| **Hook**         | **`profiles` already supports many rows per `company_id`.** The data model does not change at all |
| **To build**     | A user-management UI in the dispatcher console                                                    |
| **Size**         | Small — deliberately designed as a UI-only change                                                 |

### Order-intent matching and the abandoned-intent sweep

|                  |                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What**         | Tie an arriving cart email to the intent the customer started, and expire intents nobody followed through on                                              |
| **Why deferred** | Matching belongs to email intake, which is not built. The portal writes and reads intents today, but nothing consumes them yet                            |
| **Hook**         | `order_intents.status` already carries `matched` and `expired`, and the `(status, created_at)` index exists for the sweep                                 |
| **To build**     | A matcher on the inbound path, and a cron sweep over open intents older than a window                                                                     |
| **Size**         | Medium                                                                                                                                                    |

### Automated re-broadcast on expiry

|                  |                                                                                 |
|----------------|-------------------------------------------------------------------------------|
| **What**         | Re-broadcast automatically when nobody accepts                                  |
| **Why deferred** | An unfilled order is a signal a human should see, especially early on           |
| **Hook**         | The expiry sweep already runs; it currently notifies instead of re-broadcasting |
| **To build**     | Widen the pool and re-broadcast in the existing sweep                           |
| **Size**         | Small                                                                           |

---

## Traceability: source material to disposition

Every intake option and vNext idea from the source PDFs, and where it landed.

| Source item                                        | Disposition                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Email the cart with alias                          | **MVP** — [05-email-intake](05-email-intake.md)                                              |
| Per-user alias (`stephen_orders@…`)                | **MVP, modified** — alias is per _company_, not per person                                   |
| Parser (could be done by a person)                 | **MVP** — [06-cart-parsing](06-cart-parsing.md); the human path survives as the review queue |
| Attach order to the appropriate user               | **MVP** — alias-based attribution                                                            |
| Temp email from website                            | **Rejected** — a per-company alias is simpler and stable                                     |
| Notification the order has been parsed             | **MVP** — `order_received_ack`                                                               |
| Standard checkout experience                       | **MVP** — post-intake portal checkout                                                        |
| Verify order items / total cost                    | **MVP** — checkout wizard                                                                    |
| Delivery address / fee / instructions              | **MVP** — checkout wizard                                                                    |
| Payment (might direct to external site)            | **MVP** — Stripe Payment Links                                                               |
| Parts database (concierge procurement)             | Deferred                                                                                     |
| Smart iFrame                                       | Deferred — blocked on ToS                                                                    |
| Chat experience                                    | Deferred                                                                                     |
| Basic web app                                      | **MVP** — three route groups                                                                 |
| Order history                                      | **MVP** — customer portal                                                                    |
| Order status page                                  | **MVP** — order detail timeline                                                              |
| Driver/dispatcher updates status in admin view     | **MVP** — dispatcher console + driver app                                                    |
| Automated texting of status                        | Deferred — see automated status fan-out                                                      |
| Replenish funds                                    | Deferred — see prepaid billing                                                               |
| Automate dispatcher                                | **Partially MVP** — broadcast, acceptance, and fee capture automated; review remains human   |
| Broadcasting to agents based on filters            | **MVP (unfiltered)** — fan-out to all active drivers                                         |
| Automated cart parsing                             | **MVP** — this is the core of the product                                                    |
| Highlighted item numbers / aisles / store location | **Partial** — model numbers and store are MVP; aisle/bay deferred                            |
| Centralizing confirmation photos                   | **MVP** — `attachments` + private storage                                                    |
| Phone app for company / agent                      | Deferred — PWA covers the MVP                                                                |
| Fee/price point modelling                          | **Deferred by decision** — manual fee entry                                                  |
| Substitutions                                      | Deferred                                                                                     |
| Order cancellation                                 | Deferred                                                                                     |
| Who places the order                               | **Resolved** — the driver purchases; the customer never does                                 |
| Driver selection vs volunteering                   | **Resolved** — volunteer, first-accept-wins                                                  |
| Communication channels                             | **Resolved** — in-app + SMS; email to customers                                              |
| QR/handoff confirmation                            | Deferred                                                                                     |
