-- 0013_driver_jobs.sql — the driver flow: payout, posting, accept, the four
-- driver steps, and the evidence bucket.
--
-- Customer approval now posts the job: approve_order moves the order through
-- customer_confirmed straight to driver_requested, with no dispatcher step. No
-- text goes out yet; the dispatcher copies the job link from the console.
--
-- Drivers still hold no write policy on orders. Every driver write goes through
-- a security definer function below that checks the caller explicitly.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

-- Payout ---------------------------------------------------------------------

-- What the driver is paid for the job. The company's cost, not a customer
-- charge: it is not part of total_cents and the portal never shows it.
-- Null until set by a dispatcher or defaulted when the job posts.
alter table orders add column driver_payout_cents int
  check (driver_payout_cents between 0 and 10000000);

-- Placeholder rule until payout is configured deliberately (docs/backlog.md):
-- 90% of the delivery fees. The console prefills the same figure.
create function public.default_driver_payout_cents(
  p_sizing_cents int,
  p_mileage_cents int
)
returns int
language sql
immutable
as $$
  select round((coalesce(p_sizing_cents, 0) + coalesce(p_mileage_cents, 0)) * 0.9)::int
$$;

-- The dispatcher may change the payout until a driver accepts. After that it is
-- locked, so the driver is paid what they saw.
create function public.set_driver_payout(
  p_order_id uuid,
  p_payout_cents int
)
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

  if p_payout_cents is null or p_payout_cents not between 0 and 10000000 then
    raise exception 'Invalid payout';
  end if;

  select o.* into v_order
    from public.orders o
   where o.id = p_order_id
   for update;
  if not found or v_order.status not in (
    'received', 'needs_review', 'awaiting_customer', 'customer_confirmed',
    'driver_requested'
  ) then
    raise exception 'Payout is locked once a driver accepts';
  end if;

  update public.orders o set driver_payout_cents = p_payout_cents
   where o.id = p_order_id;

  insert into public.order_status_events (
    order_id, from_status, to_status, actor_profile_id, actor_role, source, note,
    metadata
  ) values (
    p_order_id, v_order.status, v_order.status, auth.uid(), 'dispatcher',
    'console', 'Driver payout set by dispatcher',
    jsonb_build_object('draft_field', 'payout')
  );

  return p_order_id;
end;
$$;

revoke all on function public.set_driver_payout(uuid, int) from public, anon;
grant execute on function public.set_driver_payout(uuid, int) to authenticated;

-- Approval posts the job -----------------------------------------------------

-- Unchanged from 0012 up to the update; from there it also defaults the payout
-- and records the posting as its own transition.
create or replace function public.approve_order(
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
         driver_payout_cents = coalesce(
           o.driver_payout_cents,
           public.default_driver_payout_cents(o.sizing_fee_cents, o.mileage_fee_cents)
         ),
         status = 'driver_requested',
         customer_confirmed_at = now()
   where o.id = p_order_id;

  insert into public.order_status_events (
    order_id, from_status, to_status, actor_profile_id, actor_role, source, note
  ) values (
    p_order_id, 'awaiting_customer', 'customer_confirmed', auth.uid(),
    'customer', 'portal', 'Approved by customer'
  ), (
    p_order_id, 'customer_confirmed', 'driver_requested', null,
    null, 'system', 'Posted to drivers — no text sent'
  );

  return p_order_id;
end;
$$;

-- The job link ---------------------------------------------------------------

-- What the job link shows. Before accepting, a driver sees the posting only:
-- the store, the town, the size and the payout, never the street address or
-- the customer's contact. Like get_open_jobs_for_driver, the redaction is in the
-- return type. After accepting, the driver reads the full order through the
-- orders_driver policy instead.
--
-- Returns nothing for an order that is neither posted nor the caller's, so it
-- does not confirm which orders exist.
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
  delivery_city text,
  delivery_state text,
  delivery_size delivery_size,
  item_count int,
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
         ord.delivery_address->>'city', ord.delivery_address->>'state',
         ord.delivery_size,
         (select count(*)::int from order_items i where i.order_id = ord.id),
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

-- Accept ---------------------------------------------------------------------

-- First accept wins (docs/architecture/07-dispatch.md). The conditional update
-- is the whole claim: concurrent accepts serialise on the row and the loser
-- matches nothing. A retried accept from the winner is success, not an error.
-- This is the only writer of assigned_driver_id outside the dispatcher console.
create function public.accept_job(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claimed uuid;
begin
  if not public.is_driver() then
    raise exception 'Active driver required';
  end if;

  update public.orders o
     set assigned_driver_id = auth.uid(),
         status = 'driver_assigned'
   where o.id = p_order_id
     and o.status = 'driver_requested'
     and o.assigned_driver_id is null
  returning o.id into v_claimed;

  if v_claimed is not null then
    insert into public.order_status_events (
      order_id, from_status, to_status, actor_profile_id, actor_role, source, note
    ) values (
      p_order_id, 'driver_requested', 'driver_assigned', auth.uid(),
      'driver', 'driver_app', 'Accepted by driver'
    );
    return 'accepted';
  end if;

  if exists (
    select 1 from public.orders o
     where o.id = p_order_id and o.assigned_driver_id = auth.uid()
  ) then
    return 'accepted';
  end if;

  return 'taken';
end;
$$;

revoke all on function public.accept_job(uuid) from public, anon;
grant execute on function public.accept_job(uuid) to authenticated;

-- Evidence -------------------------------------------------------------------

-- A skipped photo is a row with a reason and no file, so "prompt but never
-- block" stays auditable. Baseline required a file on every row.
alter table attachments alter column storage_path drop not null;
alter table attachments add constraint attachments_file_or_reason
  check (storage_path is not null or nullif(btrim(skip_reason), '') is not null);

-- Customers see the delivery photo, never the receipt. Dispatchers and the
-- assigned driver see both, through the orders policies as before.
drop policy attachments_read on attachments;
create policy attachments_read on attachments for select
  using (
    exists (select 1 from orders o where o.id = attachments.order_id)
    and (kind = 'delivery' or is_dispatcher() or is_driver())
  );

-- Private; served by signed URLs only. Files live under `<order id>/`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence', 'evidence', false, 26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- The assigned driver uploads while the job is under way.
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

create policy evidence_dispatcher on storage.objects for all
  to authenticated
  using (bucket_id = 'evidence' and public.is_dispatcher())
  with check (bucket_id = 'evidence' and public.is_dispatcher());

-- Reading follows the attachments row: whoever may see the row may see its
-- file. The driver also reads their own uploads on their job.
create policy evidence_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (
      exists (
        select 1 from public.attachments a
         where a.storage_path = storage.objects.name
      )
      or exists (
        select 1 from public.orders o
         where o.id::text = (storage.foldername(name))[1]
           and o.assigned_driver_id = auth.uid()
           and public.is_driver()
      )
    )
  );

-- The four driver steps ------------------------------------------------------

-- Forward only, one step at a time. The assigned driver or a dispatcher may
-- advance; a dispatcher's advance is how a wrong tap gets corrected.
-- Items Purchased and Delivered take a photo or a skip reason (receipt and
-- delivery respectively). A retried tap that already landed is success.
create function public.advance_job(
  p_order_id uuid,
  p_to_status order_status,
  p_photo_path text default null,
  p_content_type text default null,
  p_size_bytes int default null,
  p_skip_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_from order_status;
  v_kind attachment_kind;
  v_role user_role;
  v_reason text := nullif(btrim(coalesce(p_skip_reason, '')), '');
  v_path text := nullif(btrim(coalesce(p_photo_path, '')), '');
begin
  v_from := case p_to_status
    when 'driver_at_store' then 'driver_assigned'
    when 'items_purchased' then 'driver_at_store'
    when 'en_route' then 'items_purchased'
    when 'delivered' then 'en_route'
  end;
  if v_from is null then
    raise exception 'Not a driver step';
  end if;

  select o.* into v_order
    from public.orders o
   where o.id = p_order_id
   for update;

  if public.is_dispatcher() then
    v_role := 'dispatcher';
  elsif public.is_driver() and found and v_order.assigned_driver_id = auth.uid() then
    v_role := 'driver';
  end if;
  if not found or v_role is null then
    raise exception 'Job not found';
  end if;

  if v_order.status = p_to_status then
    return p_order_id;
  end if;
  if v_order.status <> v_from then
    raise exception 'Job is not at that step';
  end if;

  v_kind := case p_to_status
    when 'items_purchased' then 'receipt'::attachment_kind
    when 'delivered' then 'delivery'::attachment_kind
  end;

  if v_kind is not null then
    if v_path is null and v_reason is null then
      raise exception 'Photo or reason required';
    end if;
    if length(coalesce(v_reason, '')) > 500 then
      raise exception 'Reason is too long';
    end if;
    if v_path is not null and not exists (
      select 1 from storage.objects so
       where so.bucket_id = 'evidence'
         and so.name = v_path
         and (storage.foldername(so.name))[1] = p_order_id::text
    ) then
      raise exception 'Photo not found';
    end if;

    insert into public.attachments (
      order_id, kind, storage_path, content_type, size_bytes, uploaded_by,
      skip_reason
    ) values (
      p_order_id, v_kind, v_path,
      case when v_path is not null then left(p_content_type, 100) end,
      case when v_path is not null then p_size_bytes end,
      auth.uid(),
      case when v_path is null then v_reason end
    );
  end if;

  update public.orders o set status = p_to_status where o.id = p_order_id;

  insert into public.order_status_events (
    order_id, from_status, to_status, actor_profile_id, actor_role, source, note
  ) values (
    p_order_id, v_from, p_to_status, auth.uid(), v_role,
    case v_role when 'driver' then 'driver_app' else 'console' end,
    case when v_kind is not null and v_path is null
      then 'Photo skipped: ' || v_reason end
  );

  return p_order_id;
end;
$$;

revoke all on function public.advance_job(uuid, order_status, text, text, int, text)
  from public, anon;
grant execute on function public.advance_job(uuid, order_status, text, text, int, text)
  to authenticated;
