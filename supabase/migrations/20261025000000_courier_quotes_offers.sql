-- Courier beyond the local radius is priced by hand: the customer asks for a quote, the shop
-- weighs the parcel and enters the courier company's charge, the customer approves and pays,
-- and only then is the order placed (stock is taken at that point, not at the request).
-- Also: combos can be marked as an offer, and the first offer box is seeded.

-- ───────────── offers ─────────────

alter table public.combos
  add column offer_label text,
  add column offer_label_ta text;

insert into public.combos (id, slug, name_en, name_ta, price, packing_charge, low_stock_boxes, sort, offer_label, offer_label_ta) values
  ('00000000-0000-4000-8000-000000000204', 'offer-sweets-mixture', 'Assorted Sweets + Special Mixture', 'அசார்ட்டட் ஸ்வீட்ஸ் + ஸ்பெஷல் மிக்சர்',
   250, 0, 5, 0, 'Special offer', 'சிறப்பு சலுகை')
on conflict (id) do nothing;

insert into public.combo_items (combo_id, product_id, grams) values
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000108', 50),  -- Bombay Kaju
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000109', 50),  -- Ghee Mysore Pak
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000101', 50),  -- Laddu
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000104', 50),  -- Badhusha
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000102', 50),  -- Jangiri
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000117', 250)  -- Special Mixture
on conflict do nothing;

-- ───────────── courier quote requests ─────────────

create sequence public.courier_code_seq start 101;

create table public.courier_requests (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique default ('CQ' || nextval('public.courier_code_seq')),
  user_id uuid not null references auth.users on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  -- same shape as place_order()'s items, replayed when the customer pays
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  address jsonb not null,
  distance_km numeric(8, 1),
  weight_g int not null check (weight_g > 0),
  -- item prices when asked; the order is re-priced from the tables when placed
  subtotal numeric(10, 2) not null,
  packing numeric(10, 2) not null default 0,
  notes text,
  status text not null default 'requested' check (status in ('requested', 'quoted', 'accepted', 'declined', 'rejected')),
  courier_fee numeric(10, 2) check (courier_fee >= 0),
  courier_name text,
  shop_note text,
  quoted_at timestamptz,
  order_id uuid references public.orders on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courier_requests_user_idx on public.courier_requests (user_id, created_at desc);
create index courier_requests_open_idx on public.courier_requests (status) where status in ('requested', 'quoted');

alter table public.courier_requests enable row level security;
-- writes go through the website server (service role) only
create policy "courier_requests: own or staff read" on public.courier_requests for select
  using (user_id = auth.uid() or public.is_staff());

alter publication supabase_realtime add table public.courier_requests;
