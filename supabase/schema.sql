-- Core schema for Cleaning Blueprints
-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  business_name text,
  plan text default 'free',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid,
  type text not null,
  job_label text,
  price numeric not null default 0,
  hrs numeric not null default 0,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  client text,
  amount numeric not null default 0,
  date date not null,
  method text,
  notes text,
  kind text not null check (kind in ('income', 'expense')),
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  postcode text,
  frequency text,
  status text default 'active',
  tags text[] not null default '{}',
  notes text,
  source text,
  last_job_date date,
  next_job_date date,
  lifetime_value numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  hourly_rate numeric not null default 20,
  currency text not null default 'GBP',
  vat_registered boolean not null default false,
  frs_rate numeric not null default 12,
  tax_rate numeric not null default 0.20,
  annual_target numeric not null default 65000,
  notifications jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  pin_hash text,
  role text,
  hourly_rate numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.money_entries enable row level security;
alter table public.customers enable row level security;
alter table public.business_settings enable row level security;
alter table public.staff_members enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

-- Owner scoped policies
drop policy if exists "quotes_owner_all" on public.quotes;
create policy "quotes_owner_all" on public.quotes
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "money_owner_all" on public.money_entries;
create policy "money_owner_all" on public.money_entries
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "customers_owner_all" on public.customers;
create policy "customers_owner_all" on public.customers
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "settings_owner_all" on public.business_settings;
create policy "settings_owner_all" on public.business_settings
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "staff_owner_all" on public.staff_members;
create policy "staff_owner_all" on public.staff_members
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Auto-create profile row from signup metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, business_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'business_name', '')
  )
  on conflict (id) do nothing;

  insert into public.business_settings (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
