-- 0014_posting_details_and_release.sql — a fuller job posting, and putting a
-- job back up for drivers.
--
-- The posting now shows the full delivery address and the items before a
-- driver accepts: a town alone was too broad to decide on, and the pilot's
-- drivers are known and trusted. The on-site contact and drop-off notes still
-- wait until the driver accepts.
--
-- release_driver lets a dispatcher take a job back from a driver and post it
-- again, at the same link.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

-- The return type changes, which `create or replace` cannot do.
drop function public.get_job_posting(uuid);

-- What the job link shows. Returns nothing for an order that is neither posted
-- nor the caller's, so it does not confirm which orders exist. After
-- accepting, the driver reads the full order through the orders_driver policy.
create function public.get_job_posting(p_order_id uuid)
returns table (
  order_id uuid,
  order_number text,
  status order_status,
  retailer retailer,
  store_name text,
  store_address text,
  store_city text,
  store_state text,
  delivery_line1 text,
  delivery_line2 text,
  delivery_city text,
  delivery_state text,
  delivery_postal_code text,
  delivery_size delivery_size,
  items jsonb,
  payout_cents int,
  posted_at timestamptz,
  is_mine boolean
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select ord.id, ord.order_number, ord.status, ord.retailer,
         s.name, s.address_line1, s.city, s.state,
         ord.delivery_address->>'line1', ord.delivery_address->>'line2',
         ord.delivery_address->>'city', ord.delivery_address->>'state',
         ord.delivery_address->>'postalCode',
         ord.delivery_size,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', i.id,
                    'description', i.description,
                    'storeSku', i.store_sku,
                    'modelNumber', i.model_number,
                    'quantity', i.quantity,
                    'productUrl', i.product_url
                  ) order by i.line_no)
             from order_items i
            where i.order_id = ord.id
         ), '[]'::jsonb),
         ord.driver_payout_cents, ord.updated_at,
         coalesce(ord.assigned_driver_id = auth.uid(), false)
    from orders ord
    left join retailer_stores s on s.id = ord.retailer_store_id
   where ord.id = p_order_id
     and (public.is_driver() or public.is_dispatcher())
     and (
       ord.status = 'driver_requested'
       or ord.assigned_driver_id = auth.uid()
       or public.is_dispatcher()
     )
$$;

revoke all on function public.get_job_posting(uuid) from public, anon;
grant execute on function public.get_job_posting(uuid) to authenticated;

-- Release ---------------------------------------------------------------------

-- Takes a job back from its driver at any step before delivery and posts it
-- again. The payout unlocks with it. Photos already taken stay on the order.
create function public.release_driver(p_order_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_dispatcher() then
    raise exception 'Active dispatcher required';
  end if;

  select o.* into v_order
    from public.orders o
   where o.id = p_order_id
   for update;
  if not found or v_order.status not in (
    'driver_assigned', 'driver_at_store', 'items_purchased', 'en_route'
  ) then
    raise exception 'Job is not with a driver';
  end if;

  update public.orders o
     set assigned_driver_id = null,
         status = 'driver_requested'
   where o.id = p_order_id;

  insert into public.order_status_events (
    order_id, from_status, to_status, actor_profile_id, actor_role, source, note,
    metadata
  ) values (
    p_order_id, v_order.status, 'driver_requested', auth.uid(), 'dispatcher',
    'console', 'Driver released by dispatcher',
    jsonb_build_object('released_driver_id', v_order.assigned_driver_id)
  );

  return p_order_id;
end;
$$;

revoke all on function public.release_driver(uuid) from public, anon;
grant execute on function public.release_driver(uuid) to authenticated;
