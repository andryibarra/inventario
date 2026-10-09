-- Fase 1 — Fundaciones: negocios, membresías, perfiles y suscripción de prueba.
--
-- Regla del proyecto: "se lee con RLS, se escribe con RPC".
--   * anon y authenticated NO tienen INSERT/UPDATE/DELETE sobre tablas de public.
--   * Toda escritura pasa por funciones SECURITY DEFINER que validan membresía,
--     rol y estado de la suscripción (private.assert_can_write).
--   * El esquema private no está expuesto por la API.

-- ---------------------------------------------------------------------------
-- Esquema privado y privilegios por defecto
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
-- Las políticas RLS se evalúan con el rol de quien consulta, por eso
-- authenticated necesita USAGE para invocar private.is_member().
grant usage on schema private to authenticated;

-- Tablas y funciones futuras en public nacen cerradas; cada migración concede
-- explícitamente lo que necesita.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'admin', 'staff');
create type public.member_status as enum ('active', 'revoked');
create type public.business_status as enum ('active', 'suspended');
create type public.subscription_status as enum
  ('trialing', 'active', 'past_due', 'expired', 'cancelled');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 120),
  business_type text check (length(business_type) <= 60),
  currency      char(3) not null default 'COP',
  timezone      text not null default 'America/Bogota',
  status        public.business_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (length(display_name) <= 80),
  created_at   timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null,
  status      public.member_status not null default 'active',
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_id_idx on public.business_members (user_id);

create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null unique references public.businesses (id) on delete cascade,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  plan_code                text not null default 'pilot',
  status                   public.subscription_status not null default 'trialing',
  trial_ends_at            timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  grace_days               int not null default 7 check (grace_days between 0 and 60),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 80));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Autorización
-- ---------------------------------------------------------------------------

create function private.is_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function private.has_role(p_business_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

-- La suscripción permite escribir: prueba vigente, o periodo pagado/vencido
-- todavía dentro de los días de gracia. El negocio no debe estar suspendido.
create function private.can_write(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    join public.subscriptions s on s.business_id = b.id
    where b.id = p_business_id
      and b.status = 'active'
      and (
        (s.status = 'trialing' and s.trial_ends_at > now())
        or (
          s.status in ('active', 'past_due')
          and s.current_period_end + make_interval(days => s.grace_days) > now()
        )
      )
  );
$$;

-- Toda función de escritura empieza llamando a esta.
create function private.assert_can_write(
  p_business_id uuid,
  p_roles public.member_role[] default array['owner', 'admin', 'staff']::public.member_role[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.has_role(p_business_id, p_roles) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.can_write(p_business_id) then
    raise exception 'subscription_inactive' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.is_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: lectura
-- ---------------------------------------------------------------------------

alter table public.businesses       enable row level security;
alter table public.profiles         enable row level security;
alter table public.business_members enable row level security;
alter table public.subscriptions    enable row level security;

revoke all on public.businesses, public.profiles, public.business_members, public.subscriptions
  from anon, authenticated;
grant select on public.businesses, public.profiles, public.business_members, public.subscriptions
  to authenticated;

create policy businesses_select on public.businesses
  for select to authenticated
  using ((select private.is_member(id)));

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy business_members_select on public.business_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_member(business_id)));

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using ((select private.is_member(business_id)));

-- ---------------------------------------------------------------------------
-- RPC: escritura
-- ---------------------------------------------------------------------------

-- Crea negocio + membresía de dueño + prueba de 7 días, en una transacción.
create function public.create_business(p_name text, p_business_type text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_type text := nullif(btrim(p_business_type), '');
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) not between 1 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if length(v_type) > 60 then
    raise exception 'invalid_business_type' using errcode = '22023';
  end if;

  -- Serializa por usuario para que el límite no se salte con peticiones paralelas.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if (select count(*) from public.business_members
      where user_id = v_uid and role = 'owner') >= 3 then
    raise exception 'business_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.businesses (name, business_type)
  values (v_name, v_type)
  returning id into v_id;

  insert into public.business_members (business_id, user_id, role)
  values (v_id, v_uid, 'owner');

  insert into public.subscriptions (business_id, status, trial_ends_at)
  values (v_id, 'trialing', now() + interval '7 days');

  return v_id;
end;
$$;

create function public.update_business(
  p_business_id   uuid,
  p_name          text,
  p_business_type text default null,
  p_timezone      text default 'America/Bogota'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_type text := nullif(btrim(p_business_type), '');
begin
  perform private.assert_can_write(p_business_id, array['owner', 'admin']::public.member_role[]);

  if v_name is null or length(v_name) not between 1 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if length(v_type) > 60 then
    raise exception 'invalid_business_type' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  update public.businesses
  set name = v_name, business_type = v_type, timezone = p_timezone
  where id = p_business_id;
end;
$$;

create function public.update_my_profile(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text := nullif(btrim(p_display_name), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if length(v_name) > 80 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  update public.profiles set display_name = v_name where id = v_uid;
end;
$$;

revoke execute on function public.create_business(text, text) from public, anon;
revoke execute on function public.update_business(uuid, text, text, text) from public, anon;
revoke execute on function public.update_my_profile(text) from public, anon;
grant execute on function public.create_business(text, text) to authenticated;
grant execute on function public.update_business(uuid, text, text, text) to authenticated;
grant execute on function public.update_my_profile(text) to authenticated;
