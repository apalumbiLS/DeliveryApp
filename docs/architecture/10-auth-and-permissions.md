# 10 — Auth & Permissions

Identity, route guards, and the Row Level Security policies that enforce access.

> **Status:** Built. Sign-in and all four consoles exist: dispatch (`/dispatch`), driver (`/driver`), admin (`/admin`) and the customer portal (`/portal`). Migrations `0001`–`0018` are applied. RLS policies ship in the same migration as their tables. Password change and reset are not built.

---

## Auth model

Supabase Auth with **email as the username and a password**. No magic links, no SSO.

| Aspect      | Decision                                                     |
| ----------- | ------------------------------------------------------------ |
| Identifier  | Email address                                                |
| Credential  | Password (Supabase-managed, bcrypt)                          |
| Sessions    | Supabase JWT in an HTTP-only cookie, refreshed by middleware |
| MFA         | Out of scope for MVP                                         |
| Self-signup | **Disabled.** All accounts are created by a dispatcher       |

Self-signup is disabled because every user belongs to a company or the dispatch team. An uninvited account has no valid `profiles` row and would be unable to do anything — better to not create it at all.

See [ADR-0007](../adr/0007-email-password-auth.md).

---

## Roles

`profiles.role` is the single authority. It is **never** read from a client-supplied value.

| Role         | Scope                          | Bound to     |
| ------------ | ------------------------------ | ------------ |
| `dispatcher` | All data                       | Nothing      |
| `driver`     | Own declines and assigned jobs | —            |
| `customer`   | Own company's data             | `company_id` |

A fourth concept — **admin** — is not a role. Dispatchers hold administrative permissions, so there is no separate admin account to manage in the MVP.

---

## Route guards

| Route group       | Required role             | Behaviour on failure |
| ----------------- | ------------------------- | -------------------- |
| `/dispatch/*`     | `dispatcher`              | No session → `/login`; other role → `/` |
| `/driver/*`       | `driver` (a dispatcher may view) | No session → `/login`; other role → `/` |
| `/portal/*`       | `customer`                | No session → `/login`; dispatcher → `/admin`; driver → `/driver` |
| `/admin/*`        | `dispatcher`              | No session → `/login`; other role → `/portal` |
| `/login`          | none                      | —                    |
| `/request-access` | none                      | —                    |
| `/api/webhooks/*` | none — signature-verified | `400` / `406`        |

Route guards are a **UX affordance, not a security boundary**. They stop a driver from seeing a dispatcher page; they do not protect data. RLS does that, and it holds even if a guard is bypassed or a route is added without one.

The role is read from `profiles`, not from the JWT. Each console's layout or `require*` helper checks it on the server.

### As built

| Piece                                  | Where                                          |
| -------------------------------------- | ---------------------------------------------- |
| Session refresh + optimistic redirects | `web/proxy.ts` (Next 16 renamed `middleware`)  |
| Cookie-based server client             | `web/lib/supabase/server.ts`                   |
| Browser client                         | `web/lib/supabase/client.ts`                   |
| Sign-in / sign-out server actions      | `web/app/actions/auth.ts`                      |
| Sign-in screen                         | `web/app/(auth)/login/`                        |
| Access request (no self-signup)        | `web/app/(auth)/request-access/`               |
| Customer guard and chrome              | `web/app/portal/layout.tsx`                    |
| Dispatcher guard (dispatch + admin)    | `web/app/(console)/layout.tsx`, `web/lib/dispatch/require-dispatcher.ts` |
| Driver guard                           | `web/app/driver/layout.tsx`, `web/lib/driver/require-driver.ts` |
| Start-an-order flow (writes an intent) | `web/app/portal/start/`                        |
| Customer mutation guard                | `web/lib/portal/require-customer.ts`           |
| Admin guard and directory              | `web/app/(console)/admin/`                               |
| Privileged user operations             | `web/lib/admin/` (`users.ts`, `require-admin.ts`) |
| Secret-key client                      | `web/lib/supabase/admin.ts`                    |
| Role → landing page                    | `web/lib/auth/home.ts`                         |

Only the first dispatcher is created by hand, in the dashboard — the console cannot promote anyone until a dispatcher exists. Every account after that is created from `/admin`, which also assigns role and company and deactivates. Deactivation is `profiles.active = false`, the same mechanism as the RLS helpers check.

The proxy answers only "is there a session?" via `getClaims()`, for `/portal`, `/admin` and `/driver`. Each console's layout enforces the role, and RLS enforces the data. The portal sends a dispatcher to `/admin` and a driver to `/driver`; any other signed-in user without a usable profile sees a notice.

---

## User provisioning

Because self-signup is off, account creation uses the Supabase **admin API**, which requires the secret key (`sb_secret_...`). That key must never reach the browser.

```mermaid
sequenceDiagram
    participant D as Dispatcher
    participant App as Server action (service role)
    participant SA as Supabase Auth
    participant DB as Postgres

    Note over D,DB: The company already exists (created in SQL; no screen)
    D->>App: create user (email, password, role, company)
    App->>SA: admin.createUser(email, password, email_confirm)
    SA-->>App: user id
    App->>DB: insert profiles (role, company_id)
    App->>D: user appears in the directory; hand over credentials
```

| Role         | Provisioning                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| `customer`   | The company is created in SQL (there is no company screen). A dispatcher then creates the portal login in `/admin`. Credentials are handed over out-of-band |
| `driver`     | Dispatcher creates the account in `/admin`. No password change yet (planned: a change-password page and an admin "set new password") |
| `dispatcher` | The first one is created by hand in the Supabase dashboard. After that, any dispatcher can create another, or change a user's role to dispatcher, from `/admin` |

Dispatchers can see everything, so creating one is limited to existing dispatchers. In-app creation was allowed on 2026-11-18 because the pilot needs more than one dispatcher and the dashboard is a clumsy place to manage them. A dispatcher cannot change their own role or deactivate themselves, so the console cannot lock out its last admin by accident.

---

## RLS helper functions

Policies that query `profiles` from within a policy on `profiles` recurse infinitely. These `security definer` helpers break the cycle and are `stable` so they're evaluated once per statement.

```sql
create or replace function public.is_dispatcher() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid() and role = 'dispatcher' and active
  )
$$;

create or replace function public.current_company_id() returns uuid
language sql security definer stable set search_path = public as $$
  select company_id from profiles where id = auth.uid() and active
$$;

create or replace function public.is_driver() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid() and role = 'driver' and active
  )
$$;
```

`security definer` functions must always pin `search_path`. Without it, a caller can shadow `profiles` with a table in a schema they control and subvert the check.

---

## Policies

RLS is enabled on every table in `public`. Default posture: **deny**. Access is granted explicitly.

### Reference data

```sql
alter table companies enable row level security;

create policy companies_select on companies for select using (
  is_dispatcher() or id = current_company_id()
);
create policy companies_write on companies for all
  using (is_dispatcher()) with check (is_dispatcher());
```

Same shape for `company_sites` and `retailer_stores` (readable by everyone authenticated, writable by dispatchers only), with one addition: a customer may **insert** a site for their own company, which is what lets the start-an-order flow save a new address.

```sql
create policy company_sites_customer_insert on company_sites for insert
  with check (company_id = current_company_id());
```

Policies for the same command are ORed, so this widens INSERT without touching dispatcher access — and a customer still cannot update or delete a site.

`zip_centroids` follows the same read-everything, write-dispatchers shape as `retailer_stores`. Customers read it to turn a typed ZIP into coordinates; only a dispatcher — or the seed, which runs as the owner — may write it:

```sql
alter table zip_centroids enable row level security;

create policy zip_centroids_select on zip_centroids for select
  using (auth.uid() is not null);
create policy zip_centroids_write on zip_centroids for all
  using (is_dispatcher()) with check (is_dispatcher());
```

### Orders

```sql
alter table orders enable row level security;

-- Dispatchers see everything.
create policy orders_dispatcher on orders for all
  using (is_dispatcher()) with check (is_dispatcher());

-- Customers see their own company's orders.
create policy orders_customer on orders for select using (
  company_id = current_company_id()
);

-- Drivers see only orders assigned to them.
create policy orders_driver on orders for select using (
  is_driver() and assigned_driver_id = auth.uid()
);
```

**Drivers deliberately cannot select `orders` for postings they have not accepted.** A posting must show enough to decide — store, address, items, payout — but must **not** reveal the customer's on-site contact or drop-off instructions before they commit.

That is served by a redacted read path instead:

```sql
-- As replaced in 0015_open_jobs_role_check.sql.
create or replace function public.get_open_jobs_for_driver()
returns table (
  order_id uuid,
  order_number text,
  retailer retailer,
  store_name text,
  store_address text,
  item_count int,
  posted_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select ord.id, ord.order_number, ord.retailer,
         s.name, s.address_line1, count(i.id)::int, ord.updated_at
    from orders ord
    left join retailer_stores s on s.id = ord.retailer_store_id
    left join order_items i on i.order_id = ord.id
   where ord.status = 'driver_requested'
     and (public.is_driver() or public.is_dispatcher())
     and not exists (
       select 1 from job_declines d
        where d.order_id = ord.id and d.driver_id = auth.uid()
     )
   group by ord.id, s.name, s.address_line1
$$;
```

The baseline version had no role check, so any signed-in user could list open jobs; `0015` added it.

The job link uses `get_job_posting(order_id)` (`0014`, recreated in `0016`), also `security definer`. Before accepting, a driver sees the payout, store, **full delivery address**, items and vehicle size — the pilot's drivers are known and trusted, and a town alone was too broad to decide on. The on-site contact and drop-off notes are **not** in its return type; the driver reads them only after accepting, through the normal `orders` policy. **Redaction is structural, not a UI concern.**

### Order children

`order_items`, `order_status_events`, and `attachments` inherit visibility from their order:

```sql
create policy order_items_read on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id)
);
```

The subquery is itself subject to the `orders` policies, so visibility composes correctly for all three roles without restating the rules. `attachments` adds one rule (`0013`): customers see only `delivery` photos, never the receipt.

```sql
create policy attachments_read on attachments for select
  using (
    exists (select 1 from orders o where o.id = attachments.order_id)
    and (kind = 'delivery' or is_dispatcher() or is_driver())
  );
```

### Order intents

```sql
alter table order_intents enable row level security;

create policy order_intents_dispatcher on order_intents for all
  using (is_dispatcher()) with check (is_dispatcher());

create policy order_intents_customer_insert on order_intents for insert
  with check (
    company_id = current_company_id()
    and created_by_profile_id = auth.uid()
  );

create policy order_intents_customer_read on order_intents for select
  using (company_id = current_company_id());
```

The insert policy is deliberately two-sided. `company_id = current_company_id()` keeps a customer inside their own company; `created_by_profile_id = auth.uid()` stops one portal user forging an intent in a colleague's name, which starts to matter as soon as a company has more than one login.

### Job declines

```sql
create policy job_declines_driver_insert on job_declines for insert
  with check (driver_id = auth.uid());

create policy job_declines_read on job_declines for select using (
  driver_id = auth.uid() or is_dispatcher()
);
```

Drivers may insert and read only their own declines (Decline has no screen yet; planned for the pilot). Drivers hold no write policy on `orders`, so an assignment cannot be fabricated by writing rows directly.

### Driver functions

Every driver write goes through a `security definer` function that checks the caller itself (`0013`, `0014`):

| Function | Who | Check |
| --- | --- | --- |
| `accept_job(order_id)` | Active driver | Conditional update from `driver_requested` with no driver; first accept wins; returns `accepted` or `taken` |
| `advance_job(order_id, to_status, …)` | The assigned driver, or a dispatcher | One step forward only; Items purchased and Delivered need a photo in `evidence` or a skip reason |
| `get_job_posting(order_id)` | Driver or dispatcher | Returns nothing unless the order is posted, is the caller's, or the caller is a dispatcher |
| `release_driver(order_id)` | Dispatcher (`security invoker`) | Order is with a driver and not delivered |

The customer's one write, `approve_order`, works the same way: `security definer`, and it checks that the caller is an active customer of the order's company.

### Evidence storage

Receipt and delivery photos live in the private Storage bucket `evidence`, under `<order id>/`. Policies on `storage.objects`:

```sql
-- 0013: the assigned driver uploads while at a photo step.
create policy evidence_driver_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and exists (
      select 1 from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_driver_id = auth.uid()
         and o.status in ('driver_at_store', 'en_route')
         and public.is_driver()
    )
  );

-- 0013: dispatchers do anything in the bucket.
create policy evidence_dispatcher on storage.objects for all
  to authenticated
  using (bucket_id = 'evidence' and public.is_dispatcher())
  with check (bucket_id = 'evidence' and public.is_dispatcher());

-- 0013: whoever may read the attachments row may read its file; the
-- assigned driver also reads uploads on their job.
create policy evidence_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (
      exists (select 1 from public.attachments a
               where a.storage_path = storage.objects.name)
      or exists (select 1 from public.orders o
                  where o.id::text = (storage.foldername(name))[1]
                    and o.assigned_driver_id = auth.uid()
                    and public.is_driver())
    )
  );

-- 0018: the uploader may delete a file no attachments row points at,
-- while still at a photo step on that job.
create policy evidence_driver_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and owner_id = auth.uid()::text
    and exists (
      select 1 from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_driver_id = auth.uid()
         and o.status in ('driver_at_store', 'en_route')
         and public.is_driver()
    )
    and not exists (select 1 from public.attachments a
                     where a.storage_path = storage.objects.name)
  );
```

Photos are shown through `/dispatch/photo/[id]` and `/portal/photo/[id]`, which use the signed-in user's client (RLS applies) and sign a fresh short-lived URL per request.

### Notifications, payments, inbound email

```sql
-- Notifications: dispatchers only.
create policy notifications_dispatcher on notifications for all
  using (is_dispatcher()) with check (is_dispatcher());

-- Payments: dispatchers write; customers may read their own company's.
create policy payments_dispatcher on payments for all
  using (is_dispatcher()) with check (is_dispatcher());
create policy payments_customer_read on payments for select using (
  exists (select 1 from orders o where o.id = payments.order_id
            and o.company_id = current_company_id())
);

-- Inbound email and parse attempts: dispatchers only.
create policy inbound_emails_dispatcher on inbound_emails for all
  using (is_dispatcher()) with check (is_dispatcher());
```

`inbound_emails` holds raw customer email including any PII the retailer embedded. It is dispatcher-only and is never exposed to customers or drivers.

---

## Service role usage

The secret key (`sb_secret_...`, formerly the `service_role` key) bypasses RLS entirely. `createAdminClient()` (`web/lib/supabase/admin.ts`) is called in exactly these places:

| Location                                                 | Why                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `web/app/api/webhooks/mailgun/inbound/route.ts`, `web/app/api/webhooks/mailgun/mime/route.ts` | No user context exists; the caller is Mailgun, verified by HMAC signature. Records the email and, for a verified `/mime` cart, calls `finalize_inbound_cart` |
| `web/lib/admin/users.ts` — `listDirectory` (`auth.admin.listUsers`) and `createPortalUser` (`auth.admin.createUser`, and `deleteUser` if the profile insert fails) | The Supabase admin API requires it; every caller runs `requireAdmin()` first |
| `web/lib/dispatch/actions.ts` — `approveInboundEmail` | `finalize_inbound_cart` is granted to `service_role` only; the action runs `requireDispatcher()` first and passes the dispatcher as reviewer |

There are no Stripe webhooks or cron routes yet.

Rules that keep this safe:

1. The service role client lives in `lib/supabase/admin.ts` and is **never** imported into a client component. It throws if it runs in the browser.
2. Server actions that use it must independently verify the caller's role first — RLS will not do it for them.
3. Every service-role code path is listed above. Adding another requires updating this document.

The risk is concrete: a server action that uses the service role and forgets to check the caller's role is a full data breach. That is why the list is short and enumerated.

---

## Permission matrix

| Action                                 | Dispatcher | Driver           | Customer   |
| -------------------------------------- | ---------- | ---------------- | ---------- |
| View all orders                        | ✓          |                  |            |
| View own company's orders              |            |                  | ✓          |
| View assigned job                      | ✓          | ✓                |            |
| View an open posting (unaccepted)      | ✓          | ✓ no contact or drop-off notes |  |
| See delivery address                   | ✓          | on the posting   | own orders |
| See on-site contact and drop-off notes | ✓          | after accepting  | own orders |
| Edit order items                       | planned    |                  |            |
| Set store, address, size and fees      | ✓          |                  |            |
| Set driver payout (until accepted)     | ✓          |                  |            |
| Send for approval / Undo send          | ✓          |                  |            |
| Approve own order (posts it to drivers) |           |                  | ✓          |
| Accept a job                           |            | ✓                |            |
| Decline a posting                      |            | planned          |            |
| Advance delivery status                | ✓          | ✓ assigned only  |            |
| Upload evidence                        | ✓          | ✓ assigned, at a photo step |  |
| Release a driver                       | ✓          |                  |            |
| See delivery photo                     | ✓          | ✓ own job        | own orders |
| See receipt photo                      | ✓          | ✓ own job        |            |
| Create users, change role/company, deactivate | ✓   |                  |            |
| Create companies                       | SQL only   |                  |            |
| Read inbound email                     | ✓          |                  |            |

---

## Session and password handling

| Concern              | Approach                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Session storage      | HTTP-only, `Secure`, `SameSite=Lax` cookie set by Supabase                                                                                     |
| Refresh              | Middleware refreshes on navigation                                                                                                             |
| Password reset       | Not built. Planned: a change-password page and an admin "set new password"                                                                   |
| Password policy      | Minimum length enforced by Supabase; no forced rotation                                                                                        |
| Account deactivation | `profiles.active = false` — the helper functions all check it, so a deactivated user loses access immediately while their history is preserved |
| Deleted users        | Never deleted. `active = false` preserves order history and audit integrity                                                                    |
