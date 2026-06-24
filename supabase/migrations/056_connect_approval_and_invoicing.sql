-- 056_connect_approval_and_invoicing.sql
--
-- Connect — FM approval flow + sub-side invoicing + FM accounts export.
--
-- Adds:
--   • jobs.approval_status (pending / approved / queried / rejected)
--     + approved_by_user_id / approved_at / query_note / rejection_note
--   • connect_invoices — auto-drafted on FM approve, sub submits, FM
--     accounts marks paid via export
--   • accounts_exports + accounts_export_rows — CSV downloads + per-row
--     payment state
--   • RLS policies for FM-org scoped + sub-scoped access
--
-- Deferred:
--   • fm_sub_reviews + sub_fm_reviews — Phase 3.5 (not on the critical path)

-- ── jobs · approval state ────────────────────────────────────────────────────
alter table public.jobs
  add column if not exists approval_status      text default 'pending'
    check (approval_status in ('pending','approved','queried','rejected')),
  add column if not exists approved_by_user_id  uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at          timestamptz,
  add column if not exists query_note           text,
  add column if not exists rejection_note       text;

create index if not exists idx_jobs_approval_status
  on public.jobs (approval_status)
  where deleted_at is null;

-- ── connect_invoices · sub bills FM through Cadi ────────────────────────────
create table if not exists public.connect_invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sub_user_id uuid not null references public.profiles(id) on delete cascade,
  fm_organisation_id uuid not null references public.fm_organisations(id) on delete cascade,
  reference text,
  service_date date,
  net_value numeric not null check (net_value >= 0),
  vat_value numeric not null default 0 check (vat_value >= 0),
  total_value numeric generated always as (net_value + vat_value) stored,
  status text not null default 'draft'
    check (status in ('draft','submitted','exported','paid','disputed','void')),
  submitted_at timestamptz,
  exported_at  timestamptz,
  exported_in_export_id uuid, -- backref to accounts_exports.id (set below after table exists)
  paid_at timestamptz,
  paid_marked_by_user_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_connect_invoices_one_per_job
  on public.connect_invoices (job_id);
create index if not exists idx_connect_invoices_sub on public.connect_invoices (sub_user_id);
create index if not exists idx_connect_invoices_fm  on public.connect_invoices (fm_organisation_id);
create index if not exists idx_connect_invoices_status on public.connect_invoices (status);

alter table public.connect_invoices enable row level security;

-- Sub owns their invoices end-to-end (read + update on draft → submitted)
create policy connect_invoices_sub_select on public.connect_invoices
  for select using (sub_user_id = auth.uid());

create policy connect_invoices_sub_update on public.connect_invoices
  for update using (sub_user_id = auth.uid() and status = 'draft')
              with check (sub_user_id = auth.uid());

-- FM-org members see + modify invoices on their org (approve / mark paid / export)
create policy connect_invoices_fm_select on public.connect_invoices
  for select using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

create policy connect_invoices_fm_update on public.connect_invoices
  for update using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  ) with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

-- Inserts are done by edge functions running with the service role —
-- no client-side insert policy needed (RLS denies by default).

-- ── accounts_exports · per-download record (FM accounts handoff) ────────────
create table if not exists public.accounts_exports (
  id uuid primary key default gen_random_uuid(),
  fm_organisation_id uuid not null references public.fm_organisations(id) on delete cascade,
  exported_by_user_id uuid references public.profiles(id) on delete set null,
  period_label text,
  period_from date,
  period_to   date,
  row_count int not null default 0,
  total_value numeric not null default 0,
  file_format text not null default 'csv' check (file_format in ('csv','excel','pdf')),
  file_url text,
  created_at timestamptz default now()
);

create index if not exists idx_accounts_exports_fm on public.accounts_exports (fm_organisation_id);
create index if not exists idx_accounts_exports_created on public.accounts_exports (created_at desc);

alter table public.accounts_exports enable row level security;

create policy accounts_exports_fm_all on public.accounts_exports
  for all using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  ) with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

-- Now that accounts_exports exists, add the FK on connect_invoices
do $$
begin
  if not exists (
    select 1 from information_schema.referential_constraints
    where constraint_name = 'connect_invoices_exported_in_export_id_fkey'
  ) then
    alter table public.connect_invoices
      add constraint connect_invoices_exported_in_export_id_fkey
      foreign key (exported_in_export_id)
      references public.accounts_exports(id)
      on delete set null;
  end if;
end$$;

-- ── updated_at triggers ─────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'connect_invoices_set_updated_at') then
    create trigger connect_invoices_set_updated_at before update on public.connect_invoices
      for each row execute function public._tg_set_updated_at();
  end if;
end$$;
