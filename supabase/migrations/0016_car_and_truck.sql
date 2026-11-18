-- 0016_car_and_truck.sql — two delivery sizes, Car and Truck.
--
-- Pickup is gone: anything that needs more than a car goes by truck. Orders
-- already marked pickup become truck.
--
-- Postgres cannot drop an enum value, so the type is rebuilt. get_job_posting
-- returns the type, so it is dropped first and recreated unchanged from 0014.
-- update_dispatcher_draft is replaced so it accepts only the two sizes.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

drop function public.get_job_posting(uuid);

update public.orders set delivery_size = 'truck' where delivery_size = 'pickup';

alter type public.delivery_size rename to delivery_size_old;
create type public.delivery_size as enum ('car', 'truck');
alter table public.orders
  alter column delivery_size type public.delivery_size
  using delivery_size::text::public.delivery_size;
drop type public.delivery_size_old;

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

-- Same as 0011, but only car and truck pass the quote check.
create or replace function public.update_dispatcher_draft(
  p_order_id uuid,
  p_kind text,
  p_values jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_store_id uuid;
  v_address jsonb;
  v_name text;
  v_phone text;
  v_materials integer;
  v_sizing integer;
  v_mileage integer;
  v_size public.delivery_size;
  v_note text;
begin
  if not public.is_dispatcher() then
    raise exception 'Active dispatcher required';
  end if;

  select o.* into v_order
    from public.orders o
   where o.id = p_order_id
   for update;
  if not found or v_order.status not in ('received', 'needs_review') then
    raise exception 'Order is not open for dispatcher review';
  end if;

  if p_kind = 'store' then
    v_store_id := (p_values->>'storeId')::uuid;
    if not exists (
      select 1 from public.retailer_stores s
       where s.id = v_store_id and s.retailer = v_order.retailer and s.active
    ) then
      raise exception 'Store is unavailable for this retailer';
    end if;
    update public.orders o set retailer_store_id = v_store_id where o.id = p_order_id;
    v_note := 'Store confirmed by dispatcher';

  elsif p_kind = 'delivery' then
    v_name := btrim(p_values->>'contactName');
    v_phone := btrim(p_values->>'contactPhone');
    if nullif(btrim(p_values->>'line1'), '') is null
       or nullif(btrim(p_values->>'city'), '') is null
       or nullif(btrim(p_values->>'state'), '') is null
       or nullif(btrim(p_values->>'postalCode'), '') is null
       or length(p_values->>'line1') > 200
       or length(coalesce(p_values->>'line2', '')) > 200
       or length(p_values->>'city') > 100
       or length(p_values->>'state') > 40
       or length(p_values->>'postalCode') > 16
       or coalesce(length(v_name), 0) not between 1 and 120
       or coalesce(length(v_phone), 0) not between 7 and 40
       or length(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g')) not between 7 and 15
       or length(coalesce(p_values->>'instructions', '')) > 1000 then
      raise exception 'Invalid delivery or contact details';
    end if;
    v_address := jsonb_build_object(
      'line1', btrim(p_values->>'line1'),
      'line2', nullif(btrim(p_values->>'line2'), ''),
      'city', btrim(p_values->>'city'),
      'state', btrim(p_values->>'state'),
      'postalCode', btrim(p_values->>'postalCode'),
      'contactName', v_name,
      'contactPhone', v_phone
    );
    update public.orders o
       set delivery_address = v_address,
           delivery_instructions = nullif(btrim(p_values->>'instructions'), ''),
           site_id = case
             when v_order.delivery_address->>'line1' = v_address->>'line1'
              and v_order.delivery_address->>'line2' is not distinct from v_address->>'line2'
              and v_order.delivery_address->>'city' = v_address->>'city'
              and v_order.delivery_address->>'state' = v_address->>'state'
              and v_order.delivery_address->>'postalCode' = v_address->>'postalCode'
             then v_order.site_id else null end
     where o.id = p_order_id;
    v_note := 'Delivery and contact confirmed by dispatcher';

  elsif p_kind = 'quote' then
    v_materials := (p_values->>'materialsCents')::integer;
    v_sizing := (p_values->>'sizingCents')::integer;
    v_mileage := (p_values->>'mileageCents')::integer;
    if v_materials is null or v_sizing is null or v_mileage is null
       or v_materials not between 0 and 10000000
       or v_sizing not between 0 and 10000000
       or v_mileage not between 0 and 10000000
       or coalesce(p_values->>'deliverySize', '') not in ('car', 'truck') then
      raise exception 'Invalid quote';
    end if;
    v_size := (p_values->>'deliverySize')::public.delivery_size;
    update public.orders o
       set delivery_size = v_size,
           materials_subtotal_cents = v_materials,
           sizing_fee_cents = v_sizing,
           mileage_fee_cents = v_mileage,
           total_cents = greatest(0, v_materials + v_sizing + v_mileage + v_order.tax_cents - v_order.discount_cents)
     where o.id = p_order_id;
    v_note := 'Materials estimate and delivery fees confirmed by dispatcher';
  else
    raise exception 'Unknown draft update';
  end if;

  insert into public.order_status_events (
    order_id, from_status, to_status, actor_profile_id, actor_role, source, note,
    metadata
  ) values (
    p_order_id, v_order.status, v_order.status, auth.uid(), 'dispatcher',
    'console', v_note, jsonb_build_object('draft_field', p_kind)
  );

  return p_order_id;
end;
$$;

revoke all on function public.update_dispatcher_draft(uuid, text, jsonb)
  from public, anon;
grant execute on function public.update_dispatcher_draft(uuid, text, jsonb)
  to authenticated;
