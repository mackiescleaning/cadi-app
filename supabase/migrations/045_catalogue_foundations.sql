-- 045_catalogue_foundations.sql
-- Phase 1 of the Cadi Master Build Plan — Customer Migration & Service
-- Catalogue Pipeline.
--
-- This adds the schema that backs the operational service catalogue: a
-- single structured object every surface (Front Desk widget, booking
-- portal, scheduler, photo-quoter, monthly reports, Cadi Score) will read
-- through the `getCatalogue` + `quotePrice` seam (Phase 2).
--
-- Reuse-not-duplicate decisions made against the live schema:
--   • customers.customer_balance is the existing AR field — spec's
--     `outstanding_balance` reads/writes the same column.
--   • customers.customer_reference is the spec's `external_ref`.
--   • customers.category is the spec's `division`.
--   • services.is_active stays; the new `status` enum supersedes it for
--     three-state lifecycle (draft / live / archived). is_active mirrors
--     `status = 'live'` going forward.
--
-- Conventions:
--   • Text columns + CHECK constraints (no Postgres enums — easier to
--     evolve than ALTER TYPE)
--   • RLS via my_business_id() to match 044
--   • All new tables: RLS on, business-scoped policy

-- ────────────────────────────────────────────────────────────────────────
-- 1. Extend existing tables
-- ────────────────────────────────────────────────────────────────────────

-- customers: pre-built routing from operational imports (Cleaner Planner
-- "Round" + "Order") that project-schedule prefers over postcode clustering.
alter table public.customers
  add column if not exists route_cluster text,
  add column if not exists route_order   int;

-- services: the catalogue object. Adds inference-driven booking/pricing
-- semantics on top of the existing presentational fields.
alter table public.services
  add column if not exists booking_mode    text,            -- instant | quick_quote | enquiry
  add column if not exists pricing_model   text,            -- flat | tiered | by_unit | by_frequency | quote_only
  add column if not exists pricing_config  jsonb,           -- model-specific config (e.g. flat {price}, by_frequency {base,rates})
  add column if not exists default_duration_mins int,       -- editable seed for scheduler slot sizing
  add column if not exists status          text default 'draft',  -- draft | live | archived
  add column if not exists version         int  default 1,
  add column if not exists booking_ready   boolean default false, -- derived: catalogue completeness flag
  add column if not exists inference_meta  jsonb;           -- per-service inference trace (model, confidence, questions+answers)

-- Constrain the enum-ish columns. Drop-first-then-add so re-running the
-- migration after a constraint name collision is safe.
alter table public.services
  drop constraint if exists services_booking_mode_check;
alter table public.services
  add  constraint services_booking_mode_check
  check (booking_mode is null or booking_mode in ('instant','quick_quote','enquiry'));

alter table public.services
  drop constraint if exists services_pricing_model_check;
alter table public.services
  add  constraint services_pricing_model_check
  check (pricing_model is null or pricing_model in ('flat','tiered','by_unit','by_frequency','quote_only'));

alter table public.services
  drop constraint if exists services_status_check;
alter table public.services
  add  constraint services_status_check
  check (status in ('draft','live','archived'));

create index if not exists services_business_status_idx
  on public.services (business_id, status)
  where status = 'live';

-- recurring_jobs: link to the catalogue + ingested route metadata.
alter table public.recurring_jobs
  add column if not exists service_id    uuid,
  add column if not exists route_cluster text,
  add column if not exists route_order   int;

-- FK service_id → services(id). On delete set null so killing a service
-- never silently nukes the customer's recurring booking — we leave the
-- text `service` column in place as a fallback label.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'recurring_jobs_service_id_fkey'
  ) then
    alter table public.recurring_jobs
      add constraint recurring_jobs_service_id_fkey
      foreign key (service_id) references public.services(id)
      on delete set null;
  end if;
end $$;

create index if not exists recurring_jobs_service_id_idx
  on public.recurring_jobs (service_id);

create index if not exists recurring_jobs_route_cluster_idx
  on public.recurring_jobs (owner_id, route_cluster);

-- ────────────────────────────────────────────────────────────────────────
-- 2. service_tiers — for pricing_model = 'tiered'
-- ────────────────────────────────────────────────────────────────────────
-- Up to 4 tiers per service. Sparse long tail folds into the highest tier
-- as a "from £X" — that's a UI concern, the data stays clean.

create table if not exists public.service_tiers (
  id              uuid primary key default gen_random_uuid(),
  service_id      uuid not null references public.services(id) on delete cascade,
  tier_key        text not null,                              -- terraced | semi | detached | commercial | small | medium | large | custom...
  label           text not null,                              -- "Terraced", "Semi-detached" — owner-editable display name
  price           numeric not null,
  customer_count  int default 0,                              -- evidence: how many committed customers in this tier
  is_default      boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists service_tiers_service_idx on public.service_tiers (service_id, sort_order);
create unique index if not exists service_tiers_default_per_service
  on public.service_tiers (service_id)
  where is_default;

alter table public.service_tiers enable row level security;

drop policy if exists service_tiers_owner_all on public.service_tiers;
create policy service_tiers_owner_all on public.service_tiers
  for all to authenticated
  using (
    exists (
      select 1 from public.services s
      where s.id = service_tiers.service_id
        and s.business_id = public.my_business_id()
    )
  )
  with check (
    exists (
      select 1 from public.services s
      where s.id = service_tiers.service_id
        and s.business_id = public.my_business_id()
    )
  );

-- ────────────────────────────────────────────────────────────────────────
-- 3. service_units — for pricing_model = 'by_unit'
-- ────────────────────────────────────────────────────────────────────────
-- Windows-by-window, sqm-cleaning, per-metre soft-wash. Each service
-- typically has one unit row but the table is normalised to allow
-- multi-unit pricing later (e.g. fascia & soffit priced by metre +
-- conservatory by panel).

create table if not exists public.service_units (
  id              uuid primary key default gen_random_uuid(),
  service_id      uuid not null references public.services(id) on delete cascade,
  unit_type       text not null,                              -- window | hour | sqm | room | panel | metre
  price_per_unit  numeric not null,
  min_units       numeric,
  min_charge      numeric,                                    -- minimum job total regardless of unit count
  created_at      timestamptz not null default now()
);

alter table public.service_units
  drop constraint if exists service_units_unit_type_check;
alter table public.service_units
  add  constraint service_units_unit_type_check
  check (unit_type in ('window','hour','sqm','room','panel','metre'));

create index if not exists service_units_service_idx on public.service_units (service_id);

alter table public.service_units enable row level security;

drop policy if exists service_units_owner_all on public.service_units;
create policy service_units_owner_all on public.service_units
  for all to authenticated
  using (
    exists (
      select 1 from public.services s
      where s.id = service_units.service_id
        and s.business_id = public.my_business_id()
    )
  )
  with check (
    exists (
      select 1 from public.services s
      where s.id = service_units.service_id
        and s.business_id = public.my_business_id()
    )
  );

-- ────────────────────────────────────────────────────────────────────────
-- 4. service_modifiers — add-ons / surcharges / discounts
-- ────────────────────────────────────────────────────────────────────────
-- First-clean surcharge, conservatory add-on, fortnight surcharge,
-- multi-service discount. Applied AFTER the base price by quotePrice.

create table if not exists public.service_modifiers (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references public.services(id) on delete cascade,
  label        text not null,
  type         text not null,                                 -- addon_fixed | addon_percent | surcharge | discount
  value        numeric not null,                              -- £ for fixed/surcharge/discount, % (e.g. 10 for 10%) for addon_percent
  default_on   boolean not null default false,                -- auto-applied unless customer opts out
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.service_modifiers
  drop constraint if exists service_modifiers_type_check;
alter table public.service_modifiers
  add  constraint service_modifiers_type_check
  check (type in ('addon_fixed','addon_percent','surcharge','discount'));

create index if not exists service_modifiers_service_idx on public.service_modifiers (service_id, sort_order);

alter table public.service_modifiers enable row level security;

drop policy if exists service_modifiers_owner_all on public.service_modifiers;
create policy service_modifiers_owner_all on public.service_modifiers
  for all to authenticated
  using (
    exists (
      select 1 from public.services s
      where s.id = service_modifiers.service_id
        and s.business_id = public.my_business_id()
    )
  )
  with check (
    exists (
      select 1 from public.services s
      where s.id = service_modifiers.service_id
        and s.business_id = public.my_business_id()
    )
  );

-- ────────────────────────────────────────────────────────────────────────
-- 5. catalogue_versions — snapshot every commit so we can diff + roll back
-- ────────────────────────────────────────────────────────────────────────
-- Every time the user "Locks in" a catalogue edit, the full materialised
-- catalogue object (services + tiers + units + modifiers) gets dropped
-- here as JSONB. Surfaces always read the latest status='live' catalogue
-- via getCatalogue; this table lets us answer "what did my menu look
-- like 30 days ago?" and supports future audit trails.

create table if not exists public.catalogue_versions (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  version      int  not null,
  snapshot     jsonb not null,                                -- full materialised catalogue
  created_at   timestamptz not null default now(),
  created_by   uuid                                            -- auth.uid() of the person who locked in
);

create unique index if not exists catalogue_versions_business_version_idx
  on public.catalogue_versions (business_id, version);

alter table public.catalogue_versions enable row level security;

drop policy if exists catalogue_versions_owner_all on public.catalogue_versions;
create policy catalogue_versions_owner_all on public.catalogue_versions
  for all to authenticated
  using (business_id = public.my_business_id())
  with check (business_id = public.my_business_id());

-- ────────────────────────────────────────────────────────────────────────
-- 6. Backfill / defaults for existing services
-- ────────────────────────────────────────────────────────────────────────
-- Any services rows that already exist (manually added by the user
-- pre-catalogue) need sensible defaults so quotePrice can still resolve
-- them. We mark them as 'live' (they were active before), pricing_model
-- 'flat', booking_mode 'enquiry' (the floor — safe). The owner can
-- refine via the catalogue UI later.

update public.services
   set status         = 'live'
 where status is null
    or status = 'draft' and is_active = true;

update public.services
   set booking_mode   = 'enquiry'
 where booking_mode is null;

update public.services
   set pricing_model  = case
                          when pricing_type = 'hourly' then 'by_unit'
                          when pricing_type = 'fixed'  then 'flat'
                          else 'flat'
                        end
 where pricing_model is null;

-- Comment the columns so future devs/AI don't re-add duplicates.
comment on column public.customers.customer_balance is
  'AR / outstanding balance. NEVER use as per-job price. See spec §6.1 AR-balance guard.';
comment on column public.customers.customer_reference is
  'external_ref — the customer ID from the source system (CleanerPlanner Cust Ref, QuickBooks ID, etc.)';
comment on column public.customers.category is
  'Division — residential | commercial | exterior. The Cadi onboarding "lens".';

comment on column public.services.booking_mode  is 'instant | quick_quote | enquiry. enquiry is the inference floor.';
comment on column public.services.pricing_model is 'flat | tiered | by_unit | by_frequency | quote_only. Deterministic inference.';
comment on column public.services.pricing_config is 'Model-specific JSON. flat={price}, by_frequency={base,rates:{weekly,fortnightly,…}}, etc.';
comment on column public.services.status is 'draft | live | archived. Surfaces read where status=live.';
comment on column public.services.inference_meta is 'Trace of how the inference engine built this row: model picked, confidence, clarification q+a.';

comment on column public.recurring_jobs.route_cluster is
  'Pre-built routing label ingested from CleanerPlanner/Squeegee Round column. project-schedule prefers this over postcode clustering.';
comment on column public.recurring_jobs.route_order is
  'Run order within route_cluster — preserves the cleaner''s drive order from their old software.';
