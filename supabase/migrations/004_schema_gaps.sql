-- 004_schema_gaps.sql
-- Fills every column gap found in the pre-beta audit.
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS / safe upserts).

-- ─── 1. profiles: onboarding tracking + extra business fields ────────────────
-- (The standalone onboarding_migration.sql was never numbered; this absorbs it.)

alter table public.profiles
  add column if not exists last_name           text,
  add column if not exists postcode            text,
  add column if not exists cleaner_type        text,
  add column if not exists biz_structure       text,
  add column if not exists team_structure      text,
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists onboarding_step     int     not null default 1;

-- Mark pre-existing users (created before this migration) as already onboarded
-- so they are not forced through the wizard on next login.
update public.profiles
set    onboarding_complete = true
where  onboarding_complete = false
  and  created_at < now() - interval '5 minutes';

-- ─── 2. business_settings: flexible JSONB bag for onboarding data ─────────────
-- Stores non-normalised fields: services offered, compliance flags, goals, etc.

alter table public.business_settings
  add column if not exists setup_data jsonb not null default '{}'::jsonb;

-- ─── 3. customers: rating + service_types ────────────────────────────────────
-- Both written by customersDb.upsertCustomer but absent from the base schema.

alter table public.customers
  add column if not exists rating        integer  not null default 0,
  add column if not exists service_types text[]   not null default '{}';

-- ─── 4. money_entries: customer_id FK ────────────────────────────────────────
-- moneyDb.createMoneyEntry already sends this field; wire it to the FK properly.

alter table public.money_entries
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists money_entries_customer_idx on public.money_entries(customer_id)
  where customer_id is not null;
