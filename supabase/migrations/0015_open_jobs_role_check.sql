-- 0015_open_jobs_role_check.sql — only drivers and dispatchers list open jobs.
--
-- The baseline's get_open_jobs_for_driver is security definer with no role
-- check, so any signed-in user, a customer included, could call it directly
-- and list posted order numbers and stores. Same function, same return type,
-- plus the check get_job_posting already makes.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

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
