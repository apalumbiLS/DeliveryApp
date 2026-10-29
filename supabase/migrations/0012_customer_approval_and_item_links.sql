-- Customer approval, and the retailer's link for each cart line.
--
-- 1. `order_items.product_url` — the item's link from the cart email (Lowe's
--    wraps it in a click-tracking redirect). Kept at finalization because the
--    customer's order page cannot read `inbound_emails`, which is
--    dispatcher-only. Orders finalized before this have none.
-- 2. `finalize_inbound_cart`, unchanged from 0010 except that it now stores
--    `productUrl`.
-- 3. `approve_order` — the customer approves their order: transition 5 in
--    docs/architecture/04-order-lifecycle.md. It saves the on-site contact and
--    delivery instructions, the only delivery details a customer may change,
--    and moves the order to `customer_confirmed`.

alter table order_items add column product_url text;

create or replace function public.finalize_inbound_cart(
  p_inbound_email_id uuid,
  p_company_id uuid,
  p_items jsonb,
  p_reviewer_id uuid,
  p_requester_email text,
  p_intent_id uuid default null
)
returns table (order_id uuid, order_number text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_email public.inbound_emails%rowtype;
  v_intent public.order_intents%rowtype;
  v_order public.orders%rowtype;
begin
  select e.* into v_email
    from public.inbound_emails e
   where e.id = p_inbound_email_id
   for update;

  if not found then
    raise exception 'Inbound email not found';
  end if;

  if v_email.order_id is not null then
    return query
      select o.id, o.order_number
        from public.orders o
       where o.id = v_email.order_id;
    return;
  end if;

  if v_email.review_status <> 'pending' then
    raise exception 'Inbound email has already been reviewed';
  end if;

  if v_email.processing_status <> 'needs_review' then
    raise exception 'Inbound email is not ready for review';
  end if;

  if v_email.company_id is not null and v_email.company_id <> p_company_id then
    raise exception 'Company does not match the recipient';
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_reviewer_id and p.role = 'dispatcher' and p.active
  ) then
    raise exception 'Active dispatcher required';
  end if;

  if not exists (
    select 1 from public.companies c
     where c.id = p_company_id and c.active
  ) then
    raise exception 'Active company required';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Invalid cart item list';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid cart item list';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as line(item)
     where nullif(btrim(line.item->>'description'), '') is null
        or nullif(btrim(line.item->>'storeSku'), '') is null
        or nullif(btrim(line.item->>'modelNumber'), '') is null
        or (line.item->>'quantity') is null
        or (line.item->>'quantity') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Invalid cart item';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as line(item)
     group by line.item->>'storeSku'
    having count(*) > 1
  ) then
    raise exception 'Duplicate cart item number';
  end if;

  if p_intent_id is not null then
    select i.* into v_intent
      from public.order_intents i
     where i.id = p_intent_id
     for update;
    if not found
       or v_intent.company_id <> p_company_id
       or v_intent.retailer <> 'lowes'
       or v_intent.email_token is null
       or (
         lower(v_email.recipient_alias::text) is distinct from 'delivery+' || v_intent.email_token
         and lower(v_email.recipient_alias::text) is distinct from 'cart-' || v_intent.email_token
       )
       or v_intent.status <> 'open' then
      p_intent_id := null;
    end if;
  end if;

  insert into public.orders (
    company_id, inbound_email_id, retailer, status, requester_email,
    retailer_store_id, site_id, delivery_address
  ) values (
    p_company_id, p_inbound_email_id, 'lowes', 'received', p_requester_email,
    case when p_intent_id is not null then v_intent.retailer_store_id else null end,
    case when p_intent_id is not null then v_intent.site_id else null end,
    case when p_intent_id is not null then v_intent.delivery_address else null end
  ) returning * into v_order;

  insert into public.order_items (
    order_id, line_no, description, brand, model_number, store_sku,
    quantity, image_url, product_url, line_total_cents
  )
  select v_order.id, position::int, item->>'description', item->>'brand',
         item->>'modelNumber', item->>'storeSku', (item->>'quantity')::int,
         item->>'imageUrl',
         -- The parser keeps only HTTPS links on the retailer's own domain; this
         -- holds the scheme and size line even if a caller does not.
         case
           when item->>'productUrl' ~ '^https://' and length(item->>'productUrl') <= 2000
           then item->>'productUrl'
         end,
         0
    from jsonb_array_elements(p_items) with ordinality as line(item, position);

  if p_intent_id is not null then
    update public.order_intents i
       set status = 'matched', order_id = v_order.id, matched_at = now()
     where i.id = p_intent_id;
  end if;

  insert into public.order_status_events (
    order_id, from_status, to_status, actor_profile_id, actor_role, source
  ) values (
    v_order.id, null, 'received', p_reviewer_id, 'dispatcher', 'console'
  );

  update public.inbound_emails e
     set company_id = p_company_id, order_id = v_order.id,
         processing_status = 'parsed', review_status = 'approved',
         review_reason = null
   where e.id = p_inbound_email_id;

  return query select v_order.id, v_order.order_number;
end;
$$;

revoke all on function public.finalize_inbound_cart(uuid, uuid, jsonb, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_inbound_cart(uuid, uuid, jsonb, uuid, text, uuid)
  to service_role;


create function public.approve_order(
  p_order_id uuid,
  p_contact_name text,
  p_contact_phone text,
  p_instructions text
)
returns uuid
language plpgsql
-- Definer, because customers hold only a select policy on orders. Every check
-- RLS would have made is made explicitly below instead.
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_name text := btrim(coalesce(p_contact_name, ''));
  v_phone text := btrim(coalesce(p_contact_phone, ''));
  v_instructions text := nullif(btrim(coalesce(p_instructions, '')), '');
begin
  select o.* into v_order
    from public.orders o
   where o.id = p_order_id
   for update;

  -- One message for "no such order" and "not yours", so this does not confirm
  -- which orders exist.
  if not found or not exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'customer' and p.active
       and p.company_id = v_order.company_id
  ) then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'awaiting_customer' then
    raise exception 'Order is not awaiting approval';
  end if;

  -- The same limits the dispatcher's delivery form holds (0011).
  if length(v_name) not between 1 and 120
     or length(v_phone) not between 7 and 40
     or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15
     or length(coalesce(v_instructions, '')) > 1000 then
    raise exception 'Invalid contact details';
  end if;

  -- This transition's guards, and lifecycle invariants 1, 4 and 7.
  if nullif(btrim(v_order.delivery_address->>'line1'), '') is null
     or nullif(btrim(v_order.delivery_address->>'city'), '') is null
     or nullif(btrim(v_order.delivery_address->>'state'), '') is null
     or nullif(btrim(v_order.delivery_address->>'postalCode'), '') is null
     or v_order.total_cents <= 0
     or v_order.retailer_store_id is null
     or not exists (
       select 1 from public.order_items i where i.order_id = p_order_id
     ) then
    raise exception 'Order is not ready for approval';
  end if;

  -- `confirmed_by_profile_id` stays null: per the lifecycle doc it marks a
  -- dispatcher approving on the customer's behalf. The event row says who.
  update public.orders o
     set delivery_address = coalesce(o.delivery_address, '{}'::jsonb)
           || jsonb_build_object('contactName', v_name, 'contactPhone', v_phone),
         delivery_instructions = v_instructions,
         status = 'customer_confirmed',
         customer_confirmed_at = now()
   where o.id = p_order_id;

  insert into public.order_status_events (
    order_id, from_status, to_status, actor_profile_id, actor_role, source, note
  ) values (
    p_order_id, 'awaiting_customer', 'customer_confirmed', auth.uid(),
    'customer', 'portal', 'Approved by customer'
  );

  return p_order_id;
end;
$$;

revoke all on function public.approve_order(uuid, text, text, text)
  from public, anon;
grant execute on function public.approve_order(uuid, text, text, text)
  to authenticated;
