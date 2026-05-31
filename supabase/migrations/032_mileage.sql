-- Mileage tracking
create table if not exists mileage_logs (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references auth.users not null,
  period_start    date not null,
  period_end      date not null,
  miles           numeric(8,1) not null,
  allowance_pence numeric(10,2) not null, -- HMRC allowance in £
  notes           text,
  created_at      timestamptz default now()
);

alter table mileage_logs enable row level security;
create policy "owner_all" on mileage_logs
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- business_settings additions
alter table business_settings
  add column if not exists mileage_setup_done    boolean not null default false,
  add column if not exists ytd_miles_at_setup    numeric(8,1) not null default 0,
  add column if not exists typical_weekly_miles  numeric(6,1);
