-- 041_recurring_jobs.sql
-- Add a real recurrence-rule table so future visits stop being a stack of
-- pseudo-jobs hard-coded to 11 (Scheduler.jsx:1776-1788) or 4 months of
-- materialised rows (CustomerImport.jsx:1342). The rule is canonical;
-- materialised jobs link back to it via jobs.series_id.

create table if not exists public.recurring_jobs (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete cascade,

  -- Visit shape (copied onto each materialised job at generate time)
  service         text not null default '',
  type            text not null default 'residential',
  price           numeric not null default 0,
  duration_hrs    numeric not null default 1,
  assignees       jsonb   not null default '[]'::jsonb,
  assignee_ids    uuid[]  not null default '{}'::uuid[],

  -- Recurrence (subset of RRULE — enough for cleaning rounds, not over-engineered)
  freq            text not null default 'weekly'
                    check (freq in ('one-off','daily','weekly','monthly')),
  freq_interval   integer not null default 1 check (freq_interval >= 1),
  anchor_date     date not null,                          -- DTSTART
  preferred_hour  numeric not null default 9,
  end_date        date,                                   -- null = open-ended
  status          text not null default 'active'
                    check (status in ('active','paused','cancelled')),
  notes           text,

  -- Provenance (so migration imports can be rolled back as a batch)
  source          text not null default 'manual',         -- 'manual'|'import:cp'|'import:jobber'|...
  import_batch_id uuid,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists recurring_jobs_owner_active
  on public.recurring_jobs (owner_id, status, anchor_date);

create index if not exists recurring_jobs_customer
  on public.recurring_jobs (customer_id);

create index if not exists recurring_jobs_import_batch
  on public.recurring_jobs (import_batch_id)
  where import_batch_id is not null;

alter table public.recurring_jobs enable row level security;

drop policy if exists "recurring_jobs_owner_all" on public.recurring_jobs;
create policy "recurring_jobs_owner_all" on public.recurring_jobs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Link materialised visits back to their rule
alter table public.jobs
  add column if not exists series_id uuid references public.recurring_jobs(id) on delete set null;

create index if not exists jobs_series_id_date
  on public.jobs (series_id, date)
  where series_id is not null;

-- Touch updated_at on any change
create or replace function public.touch_recurring_jobs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists recurring_jobs_touch_updated_at on public.recurring_jobs;
create trigger recurring_jobs_touch_updated_at
  before update on public.recurring_jobs
  for each row execute function public.touch_recurring_jobs_updated_at();
