# Architecture Decision Records

One record per significant technical decision: what we chose, what we rejected, and what it costs us.

Format follows [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — context, decision, consequences, alternatives.

## Index

| ADR                                                    | Decision                                                          | Status                                                      |
|------------------------------------------------------|-----------------------------------------------------------------|-----------------------------------------------------------|
| [0001](0001-supabase-postgres.md)                      | Supabase as the persistence, auth, and storage platform           | Accepted                                                    |
| [0002](0002-single-nextjs-app-three-route-groups.md)   | A single Next.js application with three role-guarded route groups | Accepted                                                    |
| [0003](0003-mailgun-for-inbound-cart-email.md)         | Mailgun for inbound cart email and outbound customer email        | Accepted                                                    |
| [0004](0004-deterministic-parser-with-llm-fallback.md) | Deterministic parsers with an LLM fallback and a human backstop   | Accepted                                                    |
| [0005](0005-inngest-durable-workflows.md)              | Inngest for durable workflows                                     | Superseded by [0009](0009-inline-intake-and-cron-sweeps.md) |
| [0006](0006-stripe-payment-links.md)                   | Stripe Payment Links for collection                               | Superseded by [0011](0011-pay-on-approval.md)               |
| [0007](0007-email-password-auth.md)                    | Email and password authentication                                 | Accepted                                                    |
| [0008](0008-dispatcher-assigns-store.md)               | The dispatcher assigns the store                                  | Amended by [0010](0010-customer-captures-store-and-address.md) |
| [0009](0009-inline-intake-and-cron-sweeps.md)          | Inline intake and cron-swept background work                      | Accepted                                                    |
| [0010](0010-customer-captures-store-and-address.md)    | The customer captures the store and address when starting an order | Accepted                                                    |
| [0011](0011-pay-on-approval.md)                        | The customer pays when they approve the order                     | Accepted                                                    |
| [0012](0012-web-push-before-texts.md)                  | Web Push to the home-screen app before text messages              | Accepted                                                    |
| [0013](0013-automatic-posting-first-accept-wins.md)    | Approval posts the job to every driver; the first to accept gets it | Accepted                                                  |

## Adding a record

1. Copy the structure of an existing ADR.
2. Number it sequentially — numbers are never reused.
3. **Always include the alternatives you rejected and why.** A decision without its alternatives is a statement, not a record, and the next person will re-litigate it.
4. State the negative consequences honestly. An ADR with no downsides is a sales document.
5. If a decision changes, do not edit the record — add a new ADR that supersedes it, and mark the old one `Superseded by ADR-XXXX`.

## Related

- [Architecture documentation](../architecture/00-overview.md)
