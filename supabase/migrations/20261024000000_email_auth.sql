-- Email-code / Google login. Mobile numbers are collected after sign-up (unverified),
-- so nothing may grant access by phone any more: roles are pre-approved by email.

-- ───────────── one account per mobile number ─────────────

create unique index profiles_phone10_unique on public.profiles (right(regexp_replace(phone, '\D', '', 'g'), 10))
  where phone is not null;

-- ───────────── codes for changing the mobile number (emailed to the account) ─────────────

create table public.phone_change_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  new_phone text not null check (new_phone ~ '^91[6-9]\d{9}$'),
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index phone_change_codes_user_idx on public.phone_change_codes (user_id, created_at desc);
alter table public.phone_change_codes enable row level security; -- no policies: server only

-- ───────────── pre-approved roles by email instead of phone ─────────────

drop table public.pending_roles;
create table public.pending_roles (
  email text primary key check (email = lower(email) and email like '%@%'),
  role public.user_role not null,
  created_at timestamptz not null default now()
);
alter table public.pending_roles enable row level security;
create policy "pending_roles: owner" on public.pending_roles for all using (public.is_owner()) with check (public.is_owner());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role;
begin
  delete from pending_roles where email = lower(coalesce(new.email, '')) returning role into v_role;
  insert into profiles (id, email, name, role)
  values (new.id, lower(new.email), nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''), coalesce(v_role, 'customer'))
  on conflict (id) do nothing;
  return new;
end $$;

-- keep profiles.email in step when an account's email changes
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.sync_profile_email();

drop function if exists public.set_role(text, public.user_role);
create or replace function public.set_role(p_email text, p_role public.user_role) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v profiles%rowtype;
  v_email text := lower(trim(p_email));
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_EMAIL'; end if;
  update profiles set role = p_role where lower(email) = v_email returning * into v;
  if not found then
    if p_role = 'customer' then
      delete from pending_roles where email = v_email;
    else
      insert into pending_roles (email, role) values (v_email, p_role)
      on conflict (email) do update set role = excluded.role;
    end if;
    v.email := v_email;
    v.role := p_role;
  end if;
  return v;
end $$;
revoke execute on function public.set_role(text, public.user_role) from public, anon;

-- the login email belongs to Supabase Auth; customers can't rewrite it on their profile
create or replace function public.protect_profile() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.phone is distinct from old.phone and not public.is_service() then
    raise exception 'phone can only change through the verified flow' using errcode = '42501';
  end if;
  -- current_user is the caller's role here (this trigger isn't security definer)
  if new.email is distinct from old.email and current_user in ('authenticated', 'anon') then
    raise exception 'email can only change through login' using errcode = '42501';
  end if;
  return new;
end $$;
