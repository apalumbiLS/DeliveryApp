create function public.update_dispatcher_draft(
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
       or coalesce(p_values->>'deliverySize', '') not in ('car', 'pickup', 'truck') then
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
