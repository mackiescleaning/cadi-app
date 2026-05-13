-- 008_phase1_services_onboarding.sql
-- Phase 1: Services Menu + 30 Day Plan + pending customers
-- services replaces pricing_rules as Front Desk's source of truth for quoting context.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: services — the menu Front Desk reads from
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.services (
  id                          uuid primary key default gen_random_uuid(),
  business_id                 uuid not null references public.businesses(id) on delete cascade,

  -- Categorisation
  category                    text not null check (category in ('residential', 'exterior', 'commercial')),
  display_order               integer not null default 0,

  -- What the service is
  name                        text not null,
  description_included        text,
  description_excluded        text,

  -- How it's priced
  pricing_type                text not null default 'custom'
    check (pricing_type in ('hourly', 'fixed', 'per_sqm', 'per_room', 'custom')),
  price_hourly_rate           numeric,
  price_hourly_minimum_hours  numeric,
  price_fixed_basic           numeric,
  price_fixed_standard        numeric,
  price_fixed_premium         numeric,
  price_per_sqm               numeric,
  price_per_sqm_minimum       numeric,
  price_per_room              numeric,
  price_per_bathroom          numeric,
  pricing_notes               text,

  -- How long it takes
  duration_value              numeric,
  duration_unit               text not null default 'hours'
    check (duration_unit in ('minutes', 'hours', 'days')),

  -- Booking cadence
  frequency_one_off           boolean not null default true,
  frequency_weekly            boolean not null default false,
  frequency_fortnightly       boolean not null default false,
  frequency_monthly           boolean not null default false,
  frequency_quarterly         boolean not null default false,
  frequency_annually          boolean not null default false,

  -- Where it's offered
  service_area_uses_default   boolean not null default true,
  service_area_custom         text[],

  -- Logistics
  materials_equipment_notes   text,

  -- State
  is_active                   boolean not null default true,
  private_notes               text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table public.services enable row level security;

drop policy if exists "services_business_all" on public.services;
create policy "services_business_all" on public.services
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create index if not exists services_business_active on public.services(business_id, is_active, display_order);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at
  before update on public.services
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: onboarding_progress — tracks the 4-phase journey per business
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.onboarding_progress (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null unique references public.businesses(id) on delete cascade,
  current_phase         integer not null default 1,
  phase_1_started_at    timestamptz,
  phase_1_completed_at  timestamptz,
  phase_2_started_at    timestamptz,
  phase_2_completed_at  timestamptz,
  phase_3_started_at    timestamptz,
  phase_3_completed_at  timestamptz,
  phase_4_started_at    timestamptz,
  phase_4_completed_at  timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.onboarding_progress enable row level security;

drop policy if exists "onboarding_progress_business_all" on public.onboarding_progress;
create policy "onboarding_progress_business_all" on public.onboarding_progress
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

drop trigger if exists onboarding_progress_updated_at on public.onboarding_progress;
create trigger onboarding_progress_updated_at
  before update on public.onboarding_progress
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: onboarding_steps — individual step status per phase
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.onboarding_steps (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  phase        integer not null,
  step_key     text not null,
  status       text not null default 'available'
    check (status in ('locked', 'available', 'in_progress', 'completed')),
  completed_at timestamptz,
  metadata     jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, phase, step_key)
);

alter table public.onboarding_steps enable row level security;

drop policy if exists "onboarding_steps_business_all" on public.onboarding_steps;
create policy "onboarding_steps_business_all" on public.onboarding_steps
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create index if not exists onboarding_steps_business_phase on public.onboarding_steps(business_id, phase);

drop trigger if exists onboarding_steps_updated_at on public.onboarding_steps;
create trigger onboarding_steps_updated_at
  before update on public.onboarding_steps
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: pending_customers — overflow from 50-customer cap
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pending_customers (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  customer_data   jsonb not null,
  created_at      timestamptz not null default now()
);

alter table public.pending_customers enable row level security;

drop policy if exists "pending_customers_business_all" on public.pending_customers;
create policy "pending_customers_business_all" on public.pending_customers
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create index if not exists pending_customers_business on public.pending_customers(business_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5: auto-initialise Phase 1 progress + steps on business creation
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.initialise_phase1_plan(p_business_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.onboarding_progress (business_id, current_phase, phase_1_started_at)
  values (p_business_id, 1, now())
  on conflict (business_id) do nothing;

  insert into public.onboarding_steps (business_id, phase, step_key, status)
  values
    (p_business_id, 1, 'services_menu',       'available'),
    (p_business_id, 1, 'add_customers',        'available'),
    (p_business_id, 1, 'activate_front_desk',  'available'),
    (p_business_id, 1, 'first_job',            'available')
  on conflict (business_id, phase, step_key) do nothing;
end;
$$;

-- Backfill for existing businesses
do $$
declare
  biz record;
begin
  for biz in select id from public.businesses loop
    perform public.initialise_phase1_plan(biz.id);
  end loop;
end;
$$;

-- Hook: run initialise when a new business row is created
create or replace function public.handle_new_business_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.initialise_phase1_plan(new.id);
  return new;
end;
$$;

drop trigger if exists on_business_created_init_plan on public.businesses;
create trigger on_business_created_init_plan
  after insert on public.businesses
  for each row execute procedure public.handle_new_business_plan();
