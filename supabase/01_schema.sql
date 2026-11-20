-- Ahorro en pareja · esquema para Supabase (Postgres)
-- Ejecutar entero en: Supabase > SQL Editor > New query > Run.
--
-- Modelo de acceso (lo impone la base de datos, no la pantalla):
--   · Solo los usuarios que están en "profiles" (vosotros dos) pueden leer o escribir algo.
--   · Cada cuenta/tarjeta personal solo la ve su dueño.
--   · La cuenta y la tarjeta conjuntas las ven y editan los dos.
--   · Categorías y reglas son compartidas.

create extension if not exists pgcrypto;

-- Personas autorizadas (se rellena con 02_seed.sql)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
);

-- Cuentas y tarjetas. owner_id nulo = conjunta.
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('personal', 'conjunta')),
  type text not null check (type in ('cuenta', 'tarjeta')),
  owner_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((scope = 'personal' and owner_id is not null) or (scope = 'conjunta' and owner_id is null))
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('gasto', 'ingreso', 'aportacion', 'transferencia')),
  color text not null default '#5B6560',
  budget numeric(12, 2)
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  priority int not null default 100
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  tx_date date not null,
  concept text not null,
  amount numeric(12, 2) not null,
  balance numeric(12, 2),
  category_id uuid references public.categories (id) on delete set null,
  category_manual boolean not null default false,
  hash text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- anti-duplicados: el mismo movimiento no puede entrar dos veces en la misma cuenta
  unique (account_id, hash)
);

create index if not exists transactions_account_date_idx on public.transactions (account_id, tx_date);
create index if not exists transactions_category_idx on public.transactions (category_id);

-- ---------- funciones de apoyo para las políticas ----------

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.can_access_account(acc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member()
     and exists (
       select 1 from public.accounts a
       where a.id = acc and (a.owner_id is null or a.owner_id = auth.uid())
     );
$$;

-- ---------- seguridad a nivel de fila (RLS) ----------

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.rules enable row level security;
alter table public.transactions enable row level security;

-- profiles: los dos veis los nombres; cada uno edita el suyo
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (public.is_member());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- accounts: solo lectura desde la app (se crean con 02_seed.sql)
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select
  using (public.is_member() and (owner_id is null or owner_id = auth.uid()));

-- categories y rules: compartidas
drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories for all
  using (public.is_member()) with check (public.is_member());
drop policy if exists rules_all on public.rules;
create policy rules_all on public.rules for all
  using (public.is_member()) with check (public.is_member());

-- transactions: según la cuenta
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select
  using (public.can_access_account(account_id));
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert
  with check (public.can_access_account(account_id) and uploaded_by = auth.uid());
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions for update
  using (public.can_access_account(account_id))
  with check (public.can_access_account(account_id));
drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions for delete
  using (public.can_access_account(account_id));

-- Sin acceso para usuarios anónimos
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
