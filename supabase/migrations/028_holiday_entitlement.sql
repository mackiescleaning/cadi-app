-- Holiday entitlement policy (business-wide) + hours tracking
-- hr_settings:    one row per business — policy weeks, bank holiday handling
-- team_members:   add contracted_hours_per_week (used for auto-calculation)
-- staff_absences: add hours_taken (deducted from balance when holiday logged)

-- ── hr_settings ───────────────────────────────────────────────────────────────
create table hr_settings (
  id                     uuid    primary key default gen_random_uuid(),
  business_id            uuid    not null unique,
  holiday_policy_weeks   numeric(4,2) not null default 5.6,
  bank_holidays_on_top   boolean not null default false,
  bank_holidays_per_year integer not null default 8,
  holiday_year_start     text    not null default 'jan'
    check (holiday_year_start in ('jan','apr')),
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

alter table hr_settings enable row level security;
create policy "owner_all" on hr_settings
  for all using  (business_id = auth.uid())
  with check     (business_id = auth.uid());

-- ── team_members additions ────────────────────────────────────────────────────
-- contracted_hours may already exist; if not, add it
-- holiday_entitlement_days kept for legacy display (staff without contracted hrs)
alter table team_members
  add column if not exists contracted_hours       numeric(5,2) default null,
  add column if not exists holiday_entitlement_days integer default null;

-- ── staff_absences ─────────────────────────────────────────────────────────────
alter table staff_absences
  add column if not exists hours_taken numeric(6,2) default null;
