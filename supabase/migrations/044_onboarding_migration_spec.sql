-- 044_onboarding_migration_spec.sql
-- Foundation for the guided customer-migration onboarding flow.
-- Spec: cadi-onboarding-migration-spec.md
--
-- Adds: customers.import_id + category; services.generated_from_import +
-- price_low/high; recurring_jobs.rrule + preferred_day + category.
-- Creates: onboarding_sessions, customer_imports, parsed_customers.
--
-- Conventions:
--   • business_id scoping via my_business_id() — matches services / job_events.
--   • Text columns with CHECK constraints, not Postgres enums — extending
--     enums needs ALTER TYPE; CHECK constraints can be rewritten in a follow-up.
--   • All new tables: RLS on, business-scoped policy.

-- ────────────────────────────────────────────────────────────────────────
-- 1. Extend existing tables
-- ────────────────────────────────────────────────────────────────────────

-- customers: link back to the import that created the row + division ("category")
alter table public.customers
  add column if not exists import_id uuid,
  add column if not exists category  text;

-- services: provenance + observed price spread from imported customer base
alter table public.services
  add column if not exists generated_from_import boolean not null default false,
  add column if not exists price_low             numeric,
  add column if not exists price_high            numeric;

-- recurring_jobs: RRULE + day preference + division for richer scheduling
alter table public.recurring_jobs
  add column if not exists rrule          text,
  add column if not exists preferred_day  text,
  add column if not exists category       text;

-- ────────────────────────────────────────────────────────────────────────
-- 2. onboarding_sessions — resumable state across the flow
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.onboarding_sessions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null,
  step          text not null default 'divisions'
                  check (step in (
                    'divisions','upload','parsing','review',
                    'menu_review','schedule_review','reveal','complete'
                  )),
  divisions     text[] not null default '{}'::text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists onboarding_sessions_business
  on public.onboarding_sessions (business_id, created_at desc);

alter table public.onboarding_sessions enable row level security;
drop policy if exists "onboarding_sessions_business_all" on public.onboarding_sessions;
create policy "onboarding_sessions_business_all" on public.onboarding_sessions
  for all using (business_id = public.my_business_id())
  with check (business_id = public.my_business_id());

-- ────────────────────────────────────────────────────────────────────────
-- 3. customer_imports — one row per uploaded file / paste
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.customer_imports (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null,
  session_id      uuid references public.onboarding_sessions(id) on delete cascade,
  source_type     text not null
                    check (source_type in ('csv','xlsx','image','pdf','pasted_text','contacts')),
  storage_path    text,
  parse_status    text not null default 'pending'
                    check (parse_status in ('pending','parsing','parsed','failed')),
  parse_error     text,
  raw_row_count   integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists customer_imports_business
  on public.customer_imports (business_id, created_at desc);
create index if not exists customer_imports_session
  on public.customer_imports (session_id)
  where session_id is not null;

alter table public.customer_imports enable row level security;
drop policy if exists "customer_imports_business_all" on public.customer_imports;
create policy "customer_imports_business_all" on public.customer_imports
  for all using (business_id = public.my_business_id())
  with check (business_id = public.my_business_id());

-- FK from customers.import_id once customer_imports exists
alter table public.customers
  add constraint if not exists customers_import_id_fk
  foreign key (import_id) references public.customer_imports(id) on delete set null;

create index if not exists customers_import_id
  on public.customers (import_id) where import_id is not null;

-- ────────────────────────────────────────────────────────────────────────
-- 4. parsed_customers — staging table, nothing here is live
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.parsed_customers (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null,
  import_id         uuid not null references public.customer_imports(id) on delete cascade,

  -- Contact + location
  name              text,
  address           text,
  postcode          text,
  phone             text,
  email             text,

  -- Division / service
  category          text
                      check (category is null or category in ('residential','commercial','exterior')),
  service_label     text,                              -- raw as written ("fortnight clean")
  price             numeric,
  price_unit        text
                      check (price_unit is null or price_unit in ('per_visit','per_hour','per_month')),

  -- Recurrence
  frequency_raw     text,                              -- raw as found
  frequency_rrule   text,                              -- normalised RRULE string
  anchor_date       date,
  anchor_type       text
                      check (anchor_type is null or anchor_type in ('last_done','next_due','start_date')),
  day_preference    text,                              -- free text ("Tuesdays", "after 3pm")
  notes             text,

  -- Parser metadata
  confidence        jsonb not null default '{}'::jsonb,
  bucket            text not null default 'decision'
                      check (bucket in ('ready','nearly','decision')),
  is_duplicate_of   uuid references public.parsed_customers(id) on delete set null,

  -- Review state
  keep              boolean not null default true,
  committed         boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists parsed_customers_business
  on public.parsed_customers (business_id, created_at desc);
create index if not exists parsed_customers_import
  on public.parsed_customers (import_id);
create index if not exists parsed_customers_bucket
  on public.parsed_customers (business_id, bucket)
  where committed = false;
create index if not exists parsed_customers_duplicate
  on public.parsed_customers (is_duplicate_of)
  where is_duplicate_of is not null;

alter table public.parsed_customers enable row level security;
drop policy if exists "parsed_customers_business_all" on public.parsed_customers;
create policy "parsed_customers_business_all" on public.parsed_customers
  for all using (business_id = public.my_business_id())
  with check (business_id = public.my_business_id());

-- ────────────────────────────────────────────────────────────────────────
-- 5. updated_at triggers (touch on UPDATE)
-- ────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists onboarding_sessions_touch_updated_at on public.onboarding_sessions;
create trigger onboarding_sessions_touch_updated_at
  before update on public.onboarding_sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists customer_imports_touch_updated_at on public.customer_imports;
create trigger customer_imports_touch_updated_at
  before update on public.customer_imports
  for each row execute function public.touch_updated_at();

drop trigger if exists parsed_customers_touch_updated_at on public.parsed_customers;
create trigger parsed_customers_touch_updated_at
  before update on public.parsed_customers
  for each row execute function public.touch_updated_at();
