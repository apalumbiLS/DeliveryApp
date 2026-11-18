# Runbooks

Operational guides, one per persona.

> These describe the **new** system. The PDFs in `External Notes/` describe the retired low-tech process (Google Sheets + Slack) and are kept for historical reference only.

## Guides

| Guide | Audience | Covers |
|---|---|---|
| [Dispatcher guide](dispatcher-guide.md) | Dispatch team | Order review, store assignment, pricing, sending for approval, finding a driver, tracking, exception handling |
| [Driver guide](driver-guide.md) | Delivery drivers | Accepting jobs, buying materials, status steps, photo evidence, payout |
| [Customer guide](customer-guide.md) | Construction customers | Building and sharing a cart, approving in the portal, tracking delivery |

## Which guide to read

- **New to the system?** Read your own guide first, then the [dispatcher guide](dispatcher-guide.md) — it explains why the process is shaped the way it is.
- **Debugging a specific order?** [Order lifecycle](../architecture/04-order-lifecycle.md) is the authoritative state machine.

## A note on what changed

The biggest difference from the old process is that **the dispatcher stops being a data conduit**. No copying between systems and no transcribing driver updates.

If anyone finds themselves doing work the guides say they shouldn't need to, that's a bug worth reporting — it means something is missing from the system.

## Related

- [Architecture](../architecture/00-overview.md) · [ADRs](../adr/README.md)
