-- 0002_order_intents_and_store_urls.sql — start-an-order capture
--
-- Adds what the portal's start-an-order flow needs to record a customer's
-- choices before they build a cart:
--
--   1. retailer_stores.store_url / store_label — the verified store page and
--      the retailer's own label for the store (ADR-0010).
--   2. order_intents — the draft the flow writes. An intent is NOT an order:
--      the order still originates only from a cart email (ADR-0010).
--   3. A company_sites insert policy so a customer can add a site.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

-- ---------------------------------------------------------------------------
-- Store pages
-- ---------------------------------------------------------------------------

-- Verified once, at seed time. Null means the store page is unknown, and the
-- portal falls back to the retailer's homepage rather than guessing a URL.
alter table retailer_stores add column store_url text;

-- The retailer's own label for the store, so "Check your store" can show the
-- customer the same words they will see on the retailer's site.
alter table retailer_stores add column store_label text;

-- ---------------------------------------------------------------------------
-- Order intents
-- ---------------------------------------------------------------------------

-- `open` is the only state the portal writes. `matched` is set when a cart
-- email is tied to the intent; `expired` is what the (deferred) sweep applies
-- to an open intent nobody followed through on.
create type order_intent_status as enum ('open', 'matched', 'expired');

create table order_intents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id),
  created_by_profile_id uuid references profiles (id),
  -- The saved site the customer picked, when they picked one.
  site_id uuid references company_sites (id),
  -- Snapshot of where it is going. Set even when the customer typed a new
  -- address rather than choosing a saved site: an intent has to stand on its
  -- own if the site row later changes.
  delivery_address jsonb,
  retailer retailer not null,
  retailer_store_id uuid references retailer_stores (id),
  status order_intent_status not null default 'open',
  order_id uuid references orders (id),
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_intents_company_id_created_at_idx
  on order_intents (company_id, created_at desc);

-- Serves the deferred sweep over intents nobody followed through on.
create index order_intents_status_created_at_idx
  on order_intents (status, created_at);

-- One intent per order. Multiple NULLs are allowed, which is correct: most
-- intents never become an order, and a cart can arrive with no intent at all.
create unique index order_intents_order_id_key on order_intents (order_id);

create trigger order_intents_set_updated_at
  before update on order_intents
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table order_intents enable row level security;

create policy order_intents_dispatcher on order_intents for all
  using (is_dispatcher()) with check (is_dispatcher());

-- A customer writes an intent for their own company, attributed to themselves.
-- The `created_by_profile_id = auth.uid()` half is what stops one portal user
-- forging an intent in another user's name inside the same company.
create policy order_intents_customer_insert on order_intents for insert
  with check (
    company_id = current_company_id()
    and created_by_profile_id = auth.uid()
  );

create policy order_intents_customer_read on order_intents for select
  using (company_id = current_company_id());

-- Customers may add a site to their own company ("Enter a new address"). The
-- existing company_sites_write policy is dispatcher-only; policies for the same
-- command are ORed, so this widens INSERT without touching dispatcher access.
create policy company_sites_customer_insert on company_sites for insert
  with check (company_id = current_company_id());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- The baseline granted on "all tables in schema public" as they existed then,
-- and Postgres does not extend that to tables created later. Without these the
-- policies above are unreachable: RLS is on, a policy matches, and the query
-- still fails with "permission denied for table order_intents".
grant select, insert, update, delete on order_intents to authenticated;
grant all on order_intents to service_role;
