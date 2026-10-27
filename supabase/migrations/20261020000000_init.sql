-- Iyer Mess: schema, row-level security, stock functions.
-- Every stock change goes through the functions at the bottom of this file;
-- no role has direct write access to inventory, combos.boxed_stock or orders.

create extension if not exists pgcrypto;

-- ───────────────────────────── helpers ─────────────────────────────

create type public.user_role as enum ('customer', 'staff', 'owner');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  phone text,
  name text,
  email text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

-- True for the website server (service-role key), pg_cron and the SQL editor.
-- Uses session_user: inside security-definer functions current_user is always the owner.
create or replace function public.is_service() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'owner'));
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone, email) values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_role() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and not (public.is_owner() or public.is_service()) then
    raise exception 'only the owner can change roles' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- ───────────────────────────── catalog ─────────────────────────────

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ta text not null default '',
  category text not null check (category in ('sweet', 'savory')),
  price_per_kg numeric(10, 2) not null check (price_per_kg >= 0),
  image text,
  description_en text,
  description_ta text,
  sell_sizes int[] not null default '{250,500,1000}',
  low_stock_g int not null default 2000,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.inventory (
  product_id uuid primary key references public.products on delete cascade,
  stock_g int not null default 0 check (stock_g >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.products_create_inventory() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into inventory (product_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger products_inventory after insert on public.products
  for each row execute function public.products_create_inventory();

create table public.combos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ta text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  packing_charge numeric(10, 2) not null default 20,
  image text,
  boxed_stock int not null default 0 check (boxed_stock >= 0),
  low_stock_boxes int not null default 5,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.combo_items (
  combo_id uuid not null references public.combos on delete cascade,
  product_id uuid not null references public.products on delete restrict,
  grams int not null check (grams > 0),
  primary key (combo_id, product_id)
);

-- ───────────────────────────── settings ─────────────────────────────

create table public.settings (
  id int primary key default 1 check (id = 1),
  orders_open boolean not null default true,
  closed_message_en text,
  closed_message_ta text,
  shop_name text not null default 'Iyer Mess',
  shop_address text,
  shop_phone text,
  shop_lat double precision,
  shop_lng double precision,
  local_radius_km numeric(6, 2) not null default 7,
  allowed_state text not null default 'Tamil Nadu',
  hold_minutes int not null default 15,
  booking_days_ahead int not null default 7,
  updated_at timestamptz not null default now()
);

create table public.delivery_slabs (
  id uuid primary key default gen_random_uuid(),
  from_km numeric(7, 2) not null check (from_km >= 0),
  to_km numeric(7, 2) check (to_km is null or to_km > from_km),
  fee numeric(10, 2) not null check (fee >= 0),
  eta_label_en text not null,
  eta_label_ta text,
  active boolean not null default true
);

create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_time time not null,
  end_time time not null,
  capacity int not null default 20 check (capacity > 0),
  days_of_week int[] not null default '{0,1,2,3,4,5,6}', -- 0 = Sunday
  applies_to text[] not null default '{takeaway,delivery_local}',
  active boolean not null default true,
  sort int not null default 0
);

-- ───────────────────────────── orders ─────────────────────────────

create sequence public.order_code_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique default ('IM' || nextval('public.order_code_seq')),
  channel text not null check (channel in ('online', 'walkin')),
  fulfilment text not null check (fulfilment in ('delivery_local', 'courier', 'takeaway', 'counter')),
  user_id uuid references auth.users on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  address jsonb,
  distance_km numeric(7, 2),
  delivery_fee numeric(10, 2) not null default 0,
  slot_date date,
  slot_id uuid references public.time_slots on delete set null,
  slot_label text,
  subtotal numeric(10, 2) not null default 0,
  packing numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  payment_mode text not null check (payment_mode in ('cash', 'upi_online', 'upi_on_delivery', 'upi_counter')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded', 'failed')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  status text not null check (status in ('pending_payment', 'confirmed', 'preparing', 'ready',
                                         'out_for_delivery', 'shipped', 'completed', 'cancelled')),
  hold_expires_at timestamptz,
  tracking_no text,
  courier_name text,
  needs_attention boolean not null default false,
  notes text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_slot_idx on public.orders (slot_date, slot_id) where status <> 'cancelled';
create index orders_hold_idx on public.orders (hold_expires_at) where status = 'pending_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid references public.products on delete set null,
  combo_id uuid references public.combos on delete set null,
  name_en text not null,
  name_ta text,
  grams int,
  qty int not null check (qty > 0),
  unit_price numeric(10, 2) not null,
  line_total numeric(10, 2) not null,
  -- what was taken from stock, so a cancel can put back exactly that
  fulfilment jsonb not null default '{}'
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders on delete cascade,
  status text not null,
  note text,
  actor_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid references public.products on delete cascade,
  combo_id uuid references public.combos on delete cascade,
  delta int not null, -- grams for products, boxes for combos
  balance_after int not null,
  reason text not null check (reason in ('restock', 'manual_adjust', 'sale_online', 'sale_walkin',
                                         'cancel_restore', 'combo_build', 'combo_unbox')),
  order_id uuid references public.orders on delete set null,
  actor_id uuid references auth.users on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check ((product_id is null) <> (combo_id is null))
);

create index stock_movements_created_idx on public.stock_movements (created_at desc);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text,
  line text not null,
  landmark text,
  lat double precision not null,
  lng double precision not null,
  place_id text,
  district text,
  state text,
  pincode text,
  created_at timestamptz not null default now()
);

-- ───────────────────────────── views ─────────────────────────────

create view public.combo_availability with (security_invoker = true) as
select c.id as combo_id,
       c.boxed_stock,
       coalesce((select min(i.stock_g / ci.grams)
                 from combo_items ci join inventory i on i.product_id = ci.product_id
                 where ci.combo_id = c.id), 0)::int as buildable
from combos c;

create view public.low_stock with (security_invoker = true) as
select 'product'::text as kind, p.id, p.name_en, i.stock_g as stock, p.low_stock_g as threshold
from products p join inventory i on i.product_id = p.id
where p.active and i.stock_g <= p.low_stock_g
union all
select 'combo', c.id, c.name_en, c.boxed_stock + a.buildable, c.low_stock_boxes
from combos c join combo_availability a on a.combo_id = c.id
where c.active and c.boxed_stock + a.buildable <= c.low_stock_boxes;

-- ───────────────────────────── row-level security ─────────────────────────────

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.combos enable row level security;
alter table public.combo_items enable row level security;
alter table public.settings enable row level security;
alter table public.delivery_slabs enable row level security;
alter table public.time_slots enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.stock_movements enable row level security;
alter table public.addresses enable row level security;

create policy "profiles: self or staff read" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profiles: self update" on public.profiles for update using (id = auth.uid() or public.is_owner());

-- public storefront data
create policy "products: read" on public.products for select using (true);
create policy "inventory: read" on public.inventory for select using (true);
create policy "combos: read" on public.combos for select using (true);
create policy "combo_items: read" on public.combo_items for select using (true);
create policy "settings: read" on public.settings for select using (true);
create policy "delivery_slabs: read" on public.delivery_slabs for select using (true);
create policy "time_slots: read" on public.time_slots for select using (true);

-- owner-managed catalog & configuration (stock columns are guarded by a trigger below)
create policy "products: owner write" on public.products for all using (public.is_owner()) with check (public.is_owner());
create policy "combos: owner write" on public.combos for all using (public.is_owner()) with check (public.is_owner());
create policy "combo_items: owner write" on public.combo_items for all using (public.is_owner()) with check (public.is_owner());
create policy "settings: owner write" on public.settings for update using (public.is_owner());
create policy "delivery_slabs: owner write" on public.delivery_slabs for all using (public.is_owner()) with check (public.is_owner());
create policy "time_slots: owner write" on public.time_slots for all using (public.is_owner()) with check (public.is_owner());

create policy "orders: own or staff read" on public.orders for select using (user_id = auth.uid() or public.is_staff());
create policy "order_items: read with order" on public.order_items for select
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
create policy "order_events: read with order" on public.order_events for select
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
create policy "stock_movements: staff read" on public.stock_movements for select using (public.is_staff());
create policy "addresses: own" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- boxed_stock may only change through the stock functions
create or replace function public.guard_boxed_stock() returns trigger
language plpgsql as $$
begin
  if new.boxed_stock is distinct from old.boxed_stock and current_setting('iyer.stock_fn', true) is distinct from 'on' then
    raise exception 'use adjust_stock()/build_combo_boxes() to change combo stock' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger combos_guard_boxed before update on public.combos
  for each row execute function public.guard_boxed_stock();

-- ───────────────────────────── stock functions ─────────────────────────────

create or replace function public._stock_fn_on() returns void
language sql as $$ select set_config('iyer.stock_fn', 'on', true); $$;

/*
  place_order(p jsonb)
  {
    channel: 'online' | 'walkin', fulfilment, user_id?, actor_id?,
    customer_name?, customer_phone?, customer_email?, address?, distance_km?, delivery_fee?,
    slot_date?, slot_id?, payment_mode, notes?,
    items: [{ type: 'product', id, grams, qty } | { type: 'combo', id, qty }]
  }
  Online orders: only via the server (service role), which has already priced delivery.
  Walk-in orders: staff. Prices always come from the tables, never from the payload.
*/
create or replace function public.place_order(p jsonb) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  s settings%rowtype;
  v_channel text := p ->> 'channel';
  v_actor uuid := coalesce(nullif(p ->> 'actor_id', '')::uuid, auth.uid());
  v_order orders%rowtype;
  it jsonb;
  v_prod products%rowtype;
  v_combo combos%rowtype;
  v_slot time_slots%rowtype;
  ci record;
  v_qty int; v_grams int; v_need int; v_bal int; v_from_box int; v_build int; v_used int;
  v_unit numeric; v_line numeric;
  v_subtotal numeric := 0; v_packing numeric := 0;
  v_components jsonb;
  v_status text; v_pay_status text := 'unpaid'; v_hold timestamptz;
  v_reason text;
  v_mode text := p ->> 'payment_mode';
  v_fulfil text := p ->> 'fulfilment';
begin
  if v_channel = 'online' then
    if not public.is_service() then
      raise exception 'online orders are placed through the website server' using errcode = '42501';
    end if;
    if v_fulfil not in ('delivery_local', 'courier', 'takeaway') then raise exception 'BAD_FULFILMENT'; end if;
    if v_fulfil = 'courier' and v_mode <> 'upi_online' then raise exception 'COURIER_PREPAID_ONLY'; end if;
    if v_mode = 'upi_counter' then raise exception 'BAD_PAYMENT_MODE'; end if;
  elsif v_channel = 'walkin' then
    if not (public.is_service() or public.is_staff()) then
      raise exception 'staff only' using errcode = '42501';
    end if;
    v_fulfil := 'counter';
    if v_mode not in ('cash', 'upi_counter') then raise exception 'BAD_PAYMENT_MODE'; end if;
  else
    raise exception 'BAD_CHANNEL';
  end if;

  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then raise exception 'EMPTY_ORDER'; end if;

  select * into s from settings where id = 1;
  if v_channel = 'online' and not s.orders_open then raise exception 'ORDERS_CLOSED'; end if;

  if v_channel = 'online' and v_fulfil in ('delivery_local', 'takeaway') then
    if p ->> 'slot_id' is null or p ->> 'slot_date' is null then raise exception 'SLOT_REQUIRED'; end if;
  end if;

  if p ->> 'slot_id' is not null then
    select * into v_slot from time_slots where id = (p ->> 'slot_id')::uuid and active for update;
    if not found or not (v_fulfil = any (v_slot.applies_to)) then raise exception 'SLOT_INVALID'; end if;
    if (p ->> 'slot_date')::date < current_date
       or (p ->> 'slot_date')::date > current_date + s.booking_days_ahead
       or not (extract(dow from (p ->> 'slot_date')::date)::int = any (v_slot.days_of_week)) then
      raise exception 'SLOT_INVALID';
    end if;
    select count(*) into v_used from orders
      where slot_id = v_slot.id and slot_date = (p ->> 'slot_date')::date and status <> 'cancelled';
    if v_used >= v_slot.capacity then raise exception 'SLOT_FULL'; end if;
  end if;

  -- lock every row we may touch, in a fixed order, so concurrent orders can't deadlock or oversell
  perform 1 from combos
    where id in (select (x ->> 'id')::uuid from jsonb_array_elements(p -> 'items') x where x ->> 'type' = 'combo')
    order by id for update;
  perform 1 from inventory
    where product_id in (
      select (x ->> 'id')::uuid from jsonb_array_elements(p -> 'items') x where x ->> 'type' = 'product'
      union
      select cx.product_id from combo_items cx
        where cx.combo_id in (select (x ->> 'id')::uuid from jsonb_array_elements(p -> 'items') x where x ->> 'type' = 'combo'))
    order by product_id for update;

  if v_channel = 'walkin' then
    v_status := 'completed'; v_pay_status := 'paid'; v_reason := 'sale_walkin';
  elsif v_mode = 'upi_online' then
    v_status := 'pending_payment'; v_hold := now() + make_interval(mins => s.hold_minutes); v_reason := 'sale_online';
  else
    v_status := 'confirmed'; v_reason := 'sale_online';
  end if;

  insert into orders (channel, fulfilment, user_id, customer_name, customer_phone, customer_email, address,
                      distance_km, delivery_fee, slot_date, slot_id, slot_label, payment_mode, payment_status,
                      status, hold_expires_at, notes, created_by)
  values (v_channel, v_fulfil, nullif(p ->> 'user_id', '')::uuid, p ->> 'customer_name', p ->> 'customer_phone',
          p ->> 'customer_email', p -> 'address', nullif(p ->> 'distance_km', '')::numeric,
          case when v_fulfil in ('delivery_local', 'courier') then coalesce((p ->> 'delivery_fee')::numeric, 0) else 0 end,
          nullif(p ->> 'slot_date', '')::date, v_slot.id,
          case when v_slot.id is not null then v_slot.label end,
          v_mode, v_pay_status, v_status, v_hold, p ->> 'notes', v_actor)
  returning * into v_order;

  for it in select * from jsonb_array_elements(p -> 'items') loop
    v_qty := coalesce((it ->> 'qty')::int, 1);
    if v_qty < 1 then raise exception 'BAD_QTY'; end if;

    if it ->> 'type' = 'product' then
      select * into v_prod from products where id = (it ->> 'id')::uuid and active;
      if not found then raise exception 'ITEM_UNAVAILABLE'; end if;
      v_grams := (it ->> 'grams')::int;
      if v_grams is null or v_grams <= 0 then raise exception 'BAD_WEIGHT'; end if;
      if v_channel = 'online' and not (v_grams = any (v_prod.sell_sizes)) then raise exception 'BAD_WEIGHT'; end if;
      v_need := v_grams * v_qty;

      update inventory set stock_g = stock_g - v_need, updated_at = now()
        where product_id = v_prod.id and stock_g >= v_need
        returning stock_g into v_bal;
      if not found then raise exception 'OUT_OF_STOCK:%', v_prod.name_en; end if;
      insert into stock_movements (product_id, delta, balance_after, reason, order_id, actor_id)
        values (v_prod.id, -v_need, v_bal, v_reason, v_order.id, v_actor);

      v_unit := round(v_prod.price_per_kg * v_grams / 1000.0, 2);
      v_line := v_unit * v_qty;
      v_subtotal := v_subtotal + v_line;
      insert into order_items (order_id, product_id, name_en, name_ta, grams, qty, unit_price, line_total, fulfilment)
        values (v_order.id, v_prod.id, v_prod.name_en, v_prod.name_ta, v_grams, v_qty, v_unit, v_line,
                jsonb_build_object('grams', v_need));

    elsif it ->> 'type' = 'combo' then
      select * into v_combo from combos where id = (it ->> 'id')::uuid and active;
      if not found then raise exception 'ITEM_UNAVAILABLE'; end if;

      v_from_box := least(v_combo.boxed_stock, v_qty);
      v_build := v_qty - v_from_box;
      perform public._stock_fn_on();

      if v_from_box > 0 then
        update combos set boxed_stock = boxed_stock - v_from_box where id = v_combo.id returning boxed_stock into v_bal;
        insert into stock_movements (combo_id, delta, balance_after, reason, order_id, actor_id)
          values (v_combo.id, -v_from_box, v_bal, v_reason, v_order.id, v_actor);
      end if;

      v_components := '[]'::jsonb;
      if v_build > 0 then
        for ci in select * from combo_items where combo_id = v_combo.id order by product_id loop
          update inventory set stock_g = stock_g - ci.grams * v_build, updated_at = now()
            where product_id = ci.product_id and stock_g >= ci.grams * v_build
            returning stock_g into v_bal;
          if not found then raise exception 'OUT_OF_STOCK:%', v_combo.name_en; end if;
          insert into stock_movements (product_id, delta, balance_after, reason, order_id, actor_id, note)
            values (ci.product_id, -ci.grams * v_build, v_bal, v_reason, v_order.id, v_actor, 'for ' || v_combo.name_en);
          v_components := v_components || jsonb_build_object('product_id', ci.product_id, 'grams', ci.grams * v_build);
        end loop;
      end if;

      v_line := v_combo.price * v_qty;
      v_subtotal := v_subtotal + v_line;
      v_packing := v_packing + v_combo.packing_charge * v_qty;
      insert into order_items (order_id, combo_id, name_en, name_ta, qty, unit_price, line_total, fulfilment)
        values (v_order.id, v_combo.id, v_combo.name_en, v_combo.name_ta, v_qty, v_combo.price, v_line,
                jsonb_build_object('from_box', v_from_box, 'built', v_build, 'components', v_components));
    else
      raise exception 'BAD_ITEM';
    end if;
  end loop;

  update orders set subtotal = v_subtotal, packing = v_packing, total = v_subtotal + v_packing + delivery_fee
    where id = v_order.id returning * into v_order;

  insert into order_events (order_id, status, actor_id) values (v_order.id, v_order.status, v_actor);
  return v_order;
end $$;

-- Puts back exactly what an order took. Internal: no permission check.
create or replace function public._cancel_order(p_order uuid, p_note text, p_actor uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  oi record;
  c jsonb;
  v_bal int;
begin
  select * into v_order from orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'cancelled' then return v_order; end if;

  perform public._stock_fn_on();
  for oi in select * from order_items where order_id = p_order loop
    if oi.product_id is not null and (oi.fulfilment ->> 'grams') is not null then
      update inventory set stock_g = stock_g + (oi.fulfilment ->> 'grams')::int, updated_at = now()
        where product_id = oi.product_id returning stock_g into v_bal;
      insert into stock_movements (product_id, delta, balance_after, reason, order_id, actor_id)
        values (oi.product_id, (oi.fulfilment ->> 'grams')::int, v_bal, 'cancel_restore', p_order, p_actor);
    elsif oi.combo_id is not null then
      if coalesce((oi.fulfilment ->> 'from_box')::int, 0) > 0 then
        update combos set boxed_stock = boxed_stock + (oi.fulfilment ->> 'from_box')::int
          where id = oi.combo_id returning boxed_stock into v_bal;
        insert into stock_movements (combo_id, delta, balance_after, reason, order_id, actor_id)
          values (oi.combo_id, (oi.fulfilment ->> 'from_box')::int, v_bal, 'cancel_restore', p_order, p_actor);
      end if;
      for c in select * from jsonb_array_elements(coalesce(oi.fulfilment -> 'components', '[]'::jsonb)) loop
        update inventory set stock_g = stock_g + (c ->> 'grams')::int, updated_at = now()
          where product_id = (c ->> 'product_id')::uuid returning stock_g into v_bal;
        if found then
          insert into stock_movements (product_id, delta, balance_after, reason, order_id, actor_id, note)
            values ((c ->> 'product_id')::uuid, (c ->> 'grams')::int, v_bal, 'cancel_restore', p_order, p_actor,
                    'from ' || oi.name_en);
        end if;
      end loop;
    end if;
  end loop;

  update orders set status = 'cancelled', hold_expires_at = null, updated_at = now()
    where id = p_order returning * into v_order;
  insert into order_events (order_id, status, note, actor_id) values (p_order, 'cancelled', p_note, p_actor);
  return v_order;
end $$;

create or replace function public.cancel_order(p_order uuid, p_note text default null) returns public.orders
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_staff() or public.is_service()) then raise exception 'staff only' using errcode = '42501'; end if;
  return public._cancel_order(p_order, p_note, auth.uid());
end $$;

-- Releases stock held by unpaid online-UPI orders. Run every minute by pg_cron and before each new order.
create or replace function public.expire_holds() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in select id from orders where status = 'pending_payment' and hold_expires_at < now()
           for update skip locked loop
    perform public._cancel_order(r.id, 'Payment not completed in time', null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Razorpay verified a payment (checkout callback or webhook). Idempotent.
create or replace function public.confirm_payment(p_order uuid, p_rp_order text, p_rp_payment text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  if not public.is_service() then raise exception 'server only' using errcode = '42501'; end if;
  select * into v_order from orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.razorpay_order_id is distinct from p_rp_order then raise exception 'RAZORPAY_ORDER_MISMATCH'; end if;
  if v_order.payment_status = 'paid' then return v_order; end if;

  if v_order.status = 'pending_payment' then
    update orders set payment_status = 'paid', razorpay_payment_id = p_rp_payment, status = 'confirmed',
                      hold_expires_at = null, updated_at = now()
      where id = p_order returning * into v_order;
    insert into order_events (order_id, status, note) values (p_order, 'confirmed', 'UPI payment received');
  else
    -- paid after the hold expired and stock was released: flag for the shop to refund or re-confirm
    update orders set payment_status = 'paid', razorpay_payment_id = p_rp_payment, needs_attention = true, updated_at = now()
      where id = p_order returning * into v_order;
    insert into order_events (order_id, status, note)
      values (p_order, v_order.status, 'Payment arrived after the order was released. Refund or re-confirm.');
  end if;
  return v_order;
end $$;

create or replace function public.set_order_status(
  p_order uuid, p_status text, p_note text default null,
  p_tracking text default null, p_courier text default null, p_mark_paid boolean default false
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_status = 'cancelled' then return public._cancel_order(p_order, p_note, auth.uid()); end if;
  if p_status not in ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'shipped', 'completed') then
    raise exception 'BAD_STATUS';
  end if;

  select * into v_order from orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.status = 'pending_payment' and v_order.payment_status <> 'paid' then raise exception 'AWAITING_PAYMENT'; end if;

  update orders set status = p_status,
                    tracking_no = coalesce(p_tracking, tracking_no),
                    courier_name = coalesce(p_courier, courier_name),
                    payment_status = case when p_mark_paid then 'paid' else payment_status end,
                    needs_attention = case when p_status = 'completed' then false else needs_attention end,
                    updated_at = now()
    where id = p_order returning * into v_order;
  insert into order_events (order_id, status, note, actor_id) values (p_order, p_status, p_note, auth.uid());
  return v_order;
end $$;

/*
  adjust_stock: manual stock update.
  p_mode 'add' (restock), 'remove', or 'set' (count to an exact value).
  Products are counted in grams, combos in pre-packed boxes.
*/
create or replace function public.adjust_stock(
  p_product uuid, p_combo uuid, p_mode text, p_value int, p_note text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_old int; v_new int; v_reason text;
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if (p_product is null) = (p_combo is null) then raise exception 'pass exactly one of product or combo'; end if;
  if p_value is null or p_value < 0 then raise exception 'BAD_VALUE'; end if;
  if p_mode not in ('add', 'remove', 'set') then raise exception 'BAD_MODE'; end if;

  if p_product is not null then
    select stock_g into v_old from inventory where product_id = p_product for update;
    if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  else
    select boxed_stock into v_old from combos where id = p_combo for update;
    if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  end if;

  v_new := case p_mode when 'add' then v_old + p_value when 'remove' then v_old - p_value else p_value end;
  if v_new < 0 then raise exception 'NOT_ENOUGH_STOCK'; end if;
  if v_new = v_old then return v_new; end if;
  v_reason := case when p_mode = 'add' then 'restock' else 'manual_adjust' end;

  if p_product is not null then
    update inventory set stock_g = v_new, updated_at = now() where product_id = p_product;
  else
    perform public._stock_fn_on();
    update combos set boxed_stock = v_new where id = p_combo;
  end if;
  insert into stock_movements (product_id, combo_id, delta, balance_after, reason, actor_id, note)
    values (p_product, p_combo, v_new - v_old, v_new, v_reason, auth.uid(), p_note);
  return v_new;
end $$;

-- Pack n combo boxes from loose stock (n > 0) or unpack boxes back into loose stock (n < 0).
create or replace function public.build_combo_boxes(p_combo uuid, p_boxes int, p_note text default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_combo combos%rowtype; ci record; v_bal int;
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_boxes = 0 then raise exception 'BAD_VALUE'; end if;
  select * into v_combo from combos where id = p_combo for update;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  if p_boxes < 0 and v_combo.boxed_stock < -p_boxes then raise exception 'NOT_ENOUGH_STOCK'; end if;

  perform 1 from inventory where product_id in (select product_id from combo_items where combo_id = p_combo)
    order by product_id for update;

  for ci in select * from combo_items where combo_id = p_combo order by product_id loop
    update inventory set stock_g = stock_g - ci.grams * p_boxes, updated_at = now()
      where product_id = ci.product_id and stock_g - ci.grams * p_boxes >= 0
      returning stock_g into v_bal;
    if not found then raise exception 'NOT_ENOUGH_STOCK'; end if;
    insert into stock_movements (product_id, delta, balance_after, reason, actor_id, note)
      values (ci.product_id, -ci.grams * p_boxes, v_bal,
              case when p_boxes > 0 then 'combo_build' else 'combo_unbox' end, auth.uid(),
              coalesce(p_note, v_combo.name_en));
  end loop;

  perform public._stock_fn_on();
  update combos set boxed_stock = boxed_stock + p_boxes where id = p_combo returning boxed_stock into v_bal;
  insert into stock_movements (combo_id, delta, balance_after, reason, actor_id, note)
    values (p_combo, p_boxes, v_bal, case when p_boxes > 0 then 'combo_build' else 'combo_unbox' end, auth.uid(), p_note);
  return v_bal;
end $$;

-- Opening/closing online orders is an everyday operation, so staff can do it too.
create or replace function public.set_orders_open(p_open boolean, p_message_en text default null, p_message_ta text default null)
returns public.settings
language plpgsql security definer set search_path = public as $$
declare v settings%rowtype;
begin
  if not public.is_staff() then raise exception 'staff only' using errcode = '42501'; end if;
  update settings set orders_open = p_open,
                      closed_message_en = coalesce(p_message_en, closed_message_en),
                      closed_message_ta = coalesce(p_message_ta, closed_message_ta),
                      updated_at = now()
    where id = 1 returning * into v;
  return v;
end $$;

create or replace function public.set_role(p_phone text, p_role public.user_role) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare v profiles%rowtype;
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  update profiles set role = p_role
    where right(regexp_replace(phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
    returning * into v;
  if not found then raise exception 'NO_SUCH_USER: ask them to log in once first'; end if;
  return v;
end $$;

-- Remaining capacity per slot for a date; customers can't read others' orders, so this is security definer.
create or replace function public.slot_availability(p_date date)
returns table (slot_id uuid, label text, start_time time, end_time time, applies_to text[], remaining int)
language sql stable security definer set search_path = public as $$
  select t.id, t.label, t.start_time, t.end_time, t.applies_to,
         (t.capacity - (select count(*) from orders o
                        where o.slot_id = t.id and o.slot_date = p_date and o.status <> 'cancelled'))::int
  from time_slots t
  where t.active and extract(dow from p_date)::int = any (t.days_of_week)
  order by t.sort, t.start_time;
$$;

-- ───────────────────────────── grants ─────────────────────────────

revoke execute on function public._cancel_order(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.expire_holds() from public, anon, authenticated;
revoke execute on function public.confirm_payment(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb) from public, anon;
revoke execute on function public.cancel_order(uuid, text) from public, anon;
revoke execute on function public.set_order_status(uuid, text, text, text, text, boolean) from public, anon;
revoke execute on function public.adjust_stock(uuid, uuid, text, int, text) from public, anon;
revoke execute on function public.build_combo_boxes(uuid, int, text) from public, anon;
revoke execute on function public.set_orders_open(boolean, text, text) from public, anon;
revoke execute on function public.set_role(text, public.user_role) from public, anon;
grant execute on function public.slot_availability(date) to anon, authenticated;

-- ───────────────────────────── realtime & cron ─────────────────────────────

alter publication supabase_realtime add table public.orders, public.inventory, public.combos, public.settings, public.stock_movements;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('iyer-expire-holds', '* * * * *', 'select public.expire_holds()');
  end if;
exception when others then
  -- holds are still released before every new order; enable pg_cron in the dashboard and re-run this block
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;

-- ───────────────────────────── product photos ─────────────────────────────

insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;
create policy "product photos: owner insert" on storage.objects for insert with check (bucket_id = 'products' and public.is_owner());
create policy "product photos: owner update" on storage.objects for update using (bucket_id = 'products' and public.is_owner());
create policy "product photos: owner delete" on storage.objects for delete using (bucket_id = 'products' and public.is_owner());

insert into public.settings (id) values (1) on conflict do nothing;
