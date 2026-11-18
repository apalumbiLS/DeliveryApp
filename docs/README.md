# Delivery App — Documentation

Design and architecture documentation for the construction-site delivery MVP.

## Start here

**[architecture/00-overview.md](architecture/00-overview.md)** — the entry point. Locked technical decisions, MVP in/out scope, the full architecture with diagrams, the data model, the phased roadmap, and open blockers.

## Architecture

| #   | Document                                                          | What it covers                                 |
| --- | ----------------------------------------------------------------- | ---------------------------------------------- |
| 00  | [Overview](architecture/00-overview.md)                           | Decisions, scope, roadmap — read first         |
| 01  | [System context](architecture/01-system-context.md)               | Actors and external systems (C4 L1)            |
| 02  | [Containers](architecture/02-containers.md)                       | Deployable units and how they talk (C4 L2)     |
| 03  | [Data model](architecture/03-data-model.md)                       | ERD and table-by-table reference               |
| 04  | [Order lifecycle](architecture/04-order-lifecycle.md)             | State machine, transitions, permissions        |
| 05  | [Email intake](architecture/05-email-intake.md)                   | Mailgun routes, alias scheme, webhook contract |
| 06  | [Cart parsing](architecture/06-cart-parsing.md)                   | Parser design, field map, fallback ladder      |
| 07  | [Dispatch](architecture/07-dispatch.md)                           | Postings, declines, and first-accept-wins      |
| 08  | [Notifications](architecture/08-notifications.md)                 | Templates and trigger matrix                   |
| 09  | [Payments](architecture/09-payments.md)                           | Stripe Payment Links and webhooks              |
| 10  | [Auth & permissions](architecture/10-auth-and-permissions.md)     | Roles, RLS, route guards                       |
| 11  | [Deployment](architecture/11-deployment-and-environments.md)      | Environments and release process               |
| 12  | [Deferred work](architecture/12-deferred-and-extension-points.md) | What we're not building, and its hook          |

## Backlog

**[backlog.md](backlog.md)** — planned work that isn't finished yet. Check it before starting new work.

## Other directories

- **[adr/README.md](adr/README.md)** — Architecture Decision Records. One per locked decision, with the alternatives we rejected and why.
- **[runbooks/README.md](runbooks/README.md)** — Operational guides per persona. These describe the **new** system; the PDFs in `External Notes/` describe the retired low-tech process.

### Runbooks

| Guide                                              | Audience                                            |
| -------------------------------------------------- | --------------------------------------------------- |
| [Dispatcher guide](runbooks/dispatcher-guide.md)   | The operational core — review through delivery      |
| [Driver guide](runbooks/driver-guide.md)           | Accepting jobs, buying, delivering, evidence        |
| [Customer guide](runbooks/customer-guide.md)       | Sharing a cart, approving, tracking delivery        |

## Where to look for what

| Question                                       | Document                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Why did we choose X?                           | [adr/README.md](adr/README.md)                                                                                           |
| What happens when an order is cancelled?       | [04-order-lifecycle](architecture/04-order-lifecycle.md)                                                                 |
| Why can't we get the store from the email?     | [ADR-0008](adr/0008-dispatcher-assigns-store.md)                                                                         |
| Why does parsing have three tiers?             | [06-cart-parsing](architecture/06-cart-parsing.md)                                                                       |
| What stops two drivers accepting the same job? | [07-dispatch](architecture/07-dispatch.md)                                                                               |
| Is feature X in the MVP?                       | [00-overview](architecture/00-overview.md#mvp-scope) and [12-deferred](architecture/12-deferred-and-extension-points.md) |
| What's blocking the build?                     | [00-overview](architecture/00-overview.md#open-blockers)                                                                 |

## Conventions

- Diagrams are [Mermaid](https://mermaid.js.org/) in fenced code blocks so they render on GitHub and in most editors, and diff cleanly in review.
- Anything not built in the MVP is listed in [Deferred work](architecture/12-deferred-and-extension-points.md) alongside the specific hook that makes it a small addition later.
