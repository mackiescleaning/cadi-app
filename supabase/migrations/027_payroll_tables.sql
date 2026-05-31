-- Payroll tables for HMRC RTI FPS submission
-- payroll_settings: PAYE registration details per business
-- pay_runs:         one row per payroll period
-- payslips:         one row per employee per pay run

-- ── payroll_settings ──────────────────────────────────────────────────────────
create table payroll_settings (
  id                    uuid    primary key default gen_random_uuid(),
  business_id           uuid    not null unique,
  tax_office_no         text    not null,          -- e.g. "123"
  paye_ref              text    not null,           -- e.g. "A45678"
  ao_ref                text    not null,           -- accounts office ref e.g. "123PA00012345"
  gateway_user_id       text,                       -- 12-digit Government Gateway User ID
  gateway_password_enc  text,                       -- password (application-layer encrypted)
  contact_fore          text,
  contact_sur           text,
  contact_email         text,
  payment_frequency     text    not null default 'M1'
    check (payment_frequency in ('W1','W2','W4','M1','M3','M6','MA','IO','IR')),
  employment_allowance  boolean not null default false,
  sandbox_mode          boolean not null default true,  -- flip to false after HMRC recognition
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table payroll_settings enable row level security;
create policy "owner_all" on payroll_settings
  for all using  (business_id = auth.uid())
  with check     (business_id = auth.uid());

-- ── pay_runs ──────────────────────────────────────────────────────────────────
create table pay_runs (
  id                uuid    primary key default gen_random_uuid(),
  business_id       uuid    not null,
  tax_year          text    not null,               -- "2025-26"
  period_no         integer not null,               -- 1-12 monthly / 1-52 weekly
  payment_date      date    not null,
  period_start      date    not null,
  period_end        date    not null,
  status            text    not null default 'draft'
    check (status in ('draft','calculating','calculated','submitting','submitted','accepted','rejected')),
  fps_correlation_id text,
  fps_submitted_at   timestamptz,
  fps_xml            text,                          -- stored for audit/debug
  fps_response       text,                          -- raw HMRC response XML
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique(business_id, tax_year, period_no)
);

alter table pay_runs enable row level security;
create policy "owner_all" on pay_runs
  for all using  (business_id = auth.uid())
  with check     (business_id = auth.uid());

-- ── payslips ──────────────────────────────────────────────────────────────────
create table payslips (
  id                    uuid    primary key default gen_random_uuid(),
  pay_run_id            uuid    not null references pay_runs(id) on delete cascade,
  business_id           uuid    not null,
  staff_id              uuid    not null references team_members(id),

  -- Period figures
  hours_worked          numeric(8,2)  not null default 0,
  gross_pay             numeric(10,2) not null default 0,
  tax_period            numeric(10,2) not null default 0,
  ni_employee_period    numeric(10,2) not null default 0,
  ni_employer_period    numeric(10,2) not null default 0,
  net_pay               numeric(10,2) not null default 0,

  -- YTD cumulative (sent verbatim in FPS XML)
  gross_pay_ytd         numeric(10,2) not null default 0,
  tax_ytd               numeric(10,2) not null default 0,
  ni_employee_ytd       numeric(10,2) not null default 0,
  ni_employer_ytd       numeric(10,2) not null default 0,

  -- Snapshot of employee payroll settings at time of calculation
  tax_code              text    not null default '1257L',
  ni_category           text    not null default 'A',

  status                text    not null default 'draft'
    check (status in ('draft','calculated','submitted')),

  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique(pay_run_id, staff_id)
);

alter table payslips enable row level security;
create policy "owner_all" on payslips
  for all using  (business_id = auth.uid())
  with check     (business_id = auth.uid());
