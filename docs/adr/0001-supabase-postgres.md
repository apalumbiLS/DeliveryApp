# ADR-0001: Supabase as the persistence, auth, and storage platform

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Delivery App team

## Context

The MVP needs a relational database, authentication for three distinct roles, and private file storage for receipt and delivery photos. The team has an existing preference for Supabase.

The access-control requirement is unusually shaped. A customer must see only their own company's orders; a driver must see only jobs assigned to them, and must see an _unaccepted_ posting's contents but **not** the customer's address until they accept; a dispatcher sees everything. Enforcing that correctly in application code across three UIs, several route handlers, and background jobs is a large and error-prone surface.

## Decision

Use Supabase for Postgres, Auth, and Storage.

Access control is enforced by **Row Level Security policies on every table**, with the default posture of deny. Application code is not the security boundary; the database is.

## Consequences

### Positive

- RLS means an authorisation mistake in a route handler cannot leak another company's data — the query returns nothing rather than someone else's rows.
- The redaction rule for unaccepted postings is enforced structurally (a `security definer` function whose return type omits the address) rather than by remembering to hide a field in a UI.
- Postgres gives us the concurrency primitive the dispatch race requires: row-level locking on the order row, so exactly one accept wins.
- One vendor for database, auth, and storage reduces the number of things to configure and pay for.
- Local development runs against real Postgres via the Supabase CLI, so RLS is exercised locally rather than only in production.

### Negative / trade-offs

- RLS policies are SQL and are genuinely hard to get right. They require a dedicated test suite (Phase 7).
- `security definer` helper functions are needed to avoid recursive policy evaluation on `profiles`, and each must pin `search_path` — a subtle correctness requirement.
- The service role key bypasses RLS entirely. Its use is restricted to the places enumerated ([10-auth-and-permissions](../architecture/10-auth-and-permissions.md#service-role-usage)); any new use is a security review event.
- Vendor coupling: migrating off Supabase would mean reimplementing auth and storage, not just moving a database.

## Alternatives considered

| Alternative                              | Why not                                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Postgres + custom auth (NextAuth)**    | Full control, but we would hand-roll session management, password reset, and the entire authorisation layer. RLS would not be available, so access control would live in application code — exactly the failure mode we want to avoid |
| **Firebase**                             | Document-oriented. The domain is strongly relational (orders → items, jobs → drivers) and the dispatch race needs row-level locking, which Firestore does not offer                                                                   |
| **PlanetScale / Neon + separate auth**   | Viable databases, but auth and storage become two more vendors and RLS is not the enforcement model                                                                                                                                   |
| **Application-level authorisation only** | Simplest to write, hardest to keep correct. Every new query is a chance to leak data, and there is no safety net                                                                                                                      |

## Related

- [03-data-model](../architecture/03-data-model.md)
- [10-auth-and-permissions](../architecture/10-auth-and-permissions.md)
