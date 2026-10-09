-- 0005_order_number_sequence.sql — human-readable order numbers
--
-- `orders.order_number` is `text not null unique` but nothing has ever filled it:
-- the portal writes `order_intents`, never orders, so until now only the dev seed
-- carried a number. A cart email is the first thing that creates an order, and a
-- dispatcher needs a short reference they can say out loud.
--
-- A sequence rather than a count or a timestamp: monotonic, needs no
-- coordination, and cannot collide under concurrent inserts. A BEFORE INSERT
-- trigger fills it so the application never has to guess a number and retry.
--
-- Starts at 2000 to stay clear of the demo orders in supabase/seed/0001_dev.sql,
-- which occupy the 1031–1053 range. Those insert an explicit order_number, and
-- the guard below leaves it alone.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

create sequence order_number_seq start with 2000;

create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := '#' || lpad(nextval('order_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger orders_set_order_number
  before insert on orders
  for each row
  execute function public.set_order_number();
