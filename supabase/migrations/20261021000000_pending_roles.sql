-- Roles granted to a phone number before that person has logged in.
-- On first login handle_new_user() picks the role up and removes the row.

create table public.pending_roles (
  phone10 text primary key check (phone10 ~ '^\d{10}$'), -- last 10 digits
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
  delete from pending_roles where phone10 = right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10)
    returning role into v_role;
  insert into profiles (id, phone, email, role) values (new.id, new.phone, new.email, coalesce(v_role, 'customer'))
  on conflict (id) do nothing;
  return new;
end $$;

-- set_role: update an existing user, or queue the role until they first log in.
create or replace function public.set_role(p_phone text, p_role public.user_role) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v profiles%rowtype;
  v_phone10 text := right(regexp_replace(p_phone, '\D', '', 'g'), 10);
begin
  if not public.is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  if length(v_phone10) <> 10 then raise exception 'BAD_PHONE'; end if;
  update profiles set role = p_role
    where right(regexp_replace(phone, '\D', '', 'g'), 10) = v_phone10
    returning * into v;
  if not found then
    if p_role = 'customer' then
      delete from pending_roles where phone10 = v_phone10;
    else
      insert into pending_roles (phone10, role) values (v_phone10, p_role)
      on conflict (phone10) do update set role = excluded.role;
    end if;
    v.phone := v_phone10;
    v.role := p_role;
  end if;
  return v;
end $$;

revoke execute on function public.set_role(text, public.user_role) from public, anon;

-- the first owner of this shop
insert into public.pending_roles (phone10, role) values ('7540050606', 'owner') on conflict (phone10) do update set role = 'owner';
