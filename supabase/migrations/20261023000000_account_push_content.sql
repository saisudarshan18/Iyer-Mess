-- Customer profile preferences, saved addresses, web push, contact messages, editable site content.

-- ───────────── profile preferences ─────────────

alter table public.profiles
  add column preferred_payment text check (preferred_payment in ('cash', 'upi_on_delivery', 'upi_online')),
  add column push_enabled boolean not null default false;

-- customers may edit their own name/email/preferences, but never their role or phone
create or replace function public.protect_profile() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.phone is distinct from old.phone and not public.is_service() then
    raise exception 'phone can only change through login' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_protect_phone before update on public.profiles
  for each row execute function public.protect_profile();

-- ───────────── saved addresses: Home / Work / Other ─────────────

update public.addresses set label = 'other' where label is null or label not in ('home', 'work', 'other');
alter table public.addresses
  alter column label set default 'other',
  alter column label set not null,
  add constraint addresses_label_check check (label in ('home', 'work', 'other')),
  add column is_default boolean not null default false;
-- one Home and one Work per customer; any number of Other
create unique index addresses_one_home_work on public.addresses (user_id, label) where label in ('home', 'work');
create unique index addresses_one_default on public.addresses (user_id) where is_default;

-- ───────────── web push subscriptions ─────────────

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push: own read" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push: own delete" on public.push_subscriptions for delete using (user_id = auth.uid());
-- inserts go through /api/push (service role), which ties the row to the session's user

-- ───────────── contact form ─────────────

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  name text not null,
  phone text,
  email text,
  topic text not null check (topic in ('order', 'bulk', 'feedback', 'other')),
  order_code text,
  message text not null check (length(message) between 5 and 2000),
  status text not null default 'new' check (status in ('new', 'replied', 'closed')),
  created_at timestamptz not null default now()
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;
create policy "contact: staff read" on public.contact_messages for select using (public.is_staff());
create policy "contact: staff update" on public.contact_messages for update using (public.is_staff());
alter publication supabase_realtime add table public.contact_messages;

-- ───────────── editable site content (owner, via Admin → Settings → Content) ─────────────

alter table public.settings
  add column whatsapp_number text,
  add column support_email text,
  add column support_hours text,
  add column socials jsonb not null default '{}',       -- {instagram, facebook, youtube, google, x}
  add column legal jsonb not null default '{}',         -- {legal_name, fssai, grievance_name, grievance_email, refund_policy, jurisdiction}
  add column process_media jsonb not null default '{}'; -- {"1": {"type": "image"|"video", "url": "..."}, ...}

update public.settings set whatsapp_number = shop_phone where id = 1 and whatsapp_number is null;

-- photos and short videos for the "How a box is made" steps
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;
create policy "media: owner insert" on storage.objects for insert with check (bucket_id = 'media' and public.is_owner());
create policy "media: owner update" on storage.objects for update using (bucket_id = 'media' and public.is_owner());
create policy "media: owner delete" on storage.objects for delete using (bucket_id = 'media' and public.is_owner());
