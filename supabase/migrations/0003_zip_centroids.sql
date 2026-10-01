-- 0003_zip_centroids.sql — ZIP centroids for customer-entered addresses
--
-- A customer-entered address has no coordinates, so the start-an-order flow
-- cannot rank stores by distance. This table supplies a centroid per ZIP.
--
-- A ZIP centroid is **not** the address. It is accurate to a couple of miles in
-- a metro ZIP and can be tens of miles out in a large rural one. That is good
-- enough to answer "which store is nearest", which is the only thing it is used
-- for. It is deliberately not a geocoding service: no key, no billing, no
-- network call, and it works offline.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

create table zip_centroids (
  -- text, not an integer type: leading zeros are significant (00501).
  zip text primary key,
  city text,
  state text,
  lat double precision not null,
  lng double precision not null
);

-- No index on state. The only query is a primary-key lookup by ZIP, and the
-- state comes back with the row.

alter table zip_centroids enable row level security;

-- Reference data, like retailer_stores: readable by any authenticated user,
-- writable only by dispatchers — and by the seed, which runs as the owner.
create policy zip_centroids_select on zip_centroids for select
  using (auth.uid() is not null);

create policy zip_centroids_write on zip_centroids for all
  using (is_dispatcher()) with check (is_dispatcher());

-- Grants do not extend to tables created after the baseline's
-- "grant ... on all tables in schema public".
grant select, insert, update, delete on zip_centroids to authenticated;
grant all on zip_centroids to service_role;
