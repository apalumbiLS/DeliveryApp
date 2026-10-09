-- 0006_order_delivery_size.sql — the vehicle class the sizing fee is keyed to
--
-- The review queue asks a dispatcher to pick Car, Pickup, or Truck. It sets the
-- sizing fee, and later tells a driver what to bring.
--
-- `quote_breakdown` was the documented extension point for pricing, but the
-- vehicle class is a domain fact used outside the quote — a driver's job card
-- reads it — so it belongs in a column rather than a jsonb blob.
--
-- An enum rather than text: the set is small and closed, and the console renders
-- a fixed picker for it.
--
-- Nullable on purpose. An order created from an email has no size until a
-- dispatcher chooses one, and the gate blocks the checkout invite until they do.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

create type delivery_size as enum ('car', 'pickup', 'truck');

alter table orders add column delivery_size delivery_size;
