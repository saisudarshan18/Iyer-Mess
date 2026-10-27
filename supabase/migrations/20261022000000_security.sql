-- Security hardening: rate limiting, upload limits, pinned search_path.

-- ───────────── rate limiting (fixed window, shared by every server instance) ─────────────

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);
alter table public.rate_limits enable row level security; -- no policies: server only

-- true when the caller is still within p_max hits per p_window_seconds for p_key
create or replace function public.rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into rate_limits as r (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end $$;

revoke execute on function public.rate_limit(text, int, int) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('iyer-rate-limit-cleanup', '17 3 * * *', $c$delete from public.rate_limits where window_start < now() - interval '1 day'$c$);
  end if;
exception when others then
  raise notice 'rate limit cleanup not scheduled: %', sqlerrm;
end $$;

-- ───────────── product photo uploads: images only, 5 MB max ─────────────

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
 where id = 'products';

-- ───────────── pin search_path on every helper (Supabase security advisor) ─────────────

alter function public.is_service() set search_path = public;
alter function public.protect_role() set search_path = public;
alter function public.guard_boxed_stock() set search_path = public;
alter function public._stock_fn_on() set search_path = public;

-- the migration bookkeeping table is server-only
alter table if exists public.schema_migrations enable row level security;
