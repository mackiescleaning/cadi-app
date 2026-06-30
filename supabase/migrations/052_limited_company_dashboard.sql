-- 052_limited_company_dashboard.sql
--
-- Limited-company money tools: dividend register, director's loan account,
-- corporation-tax accrual. Three small per-owner tables — RLS scoped to the
-- owning auth user, no service-role bypass needed by the UI.
--
-- Tables follow the same pattern as money_entries/business_settings: owner_id
-- is auth.uid(), an updated_at trigger keeps the row fresh, and SELECT/INSERT/
-- UPDATE/DELETE are all gated to the owner. Edge functions that run with the
-- service role can still write (service role bypasses RLS), which is how the
-- accrual recalculation will happen if we move it server-side later.

create extension if not exists pgcrypto;

-- ── Dividends ────────────────────────────────────────────────────────────────
create table if not exists public.ltd_dividends (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         uuid        not null references auth.users(id) on delete cascade,
  declared_on      date        not null,
  paid_on          date,
  amount           numeric(12,2) not null check (amount > 0),
  shareholder      text        not null default 'Director',
  meeting_minutes  text,
  voucher_ref      text,
  tax_year         text        not null,                  -- e.g. "2026/27"
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists ltd_dividends_owner_idx
  on public.ltd_dividends (owner_id, declared_on desc);

-- ── Director's loan account ──────────────────────────────────────────────────
-- A simple ledger: positive = director owes company, negative = company owes
-- director. We don't try to detect benefit-in-kind (>£10k threshold) here —
-- the UI surfaces the running balance and warns above £10k.
create table if not exists public.ltd_director_loan_entries (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      uuid        not null references auth.users(id) on delete cascade,
  entry_date    date        not null,
  description   text        not null,
  amount        numeric(12,2) not null,                   -- signed (+ = drawn, − = repaid)
  category      text        not null default 'other',     -- drawn | repaid | expenses | other
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ltd_dla_owner_idx
  on public.ltd_director_loan_entries (owner_id, entry_date desc);

-- ── Corporation tax accrual snapshots ────────────────────────────────────────
-- One row per accounting period: estimated profit, CT due, paid, status.
create table if not exists public.ltd_ct_accrual (
  id                 uuid        primary key default gen_random_uuid(),
  owner_id           uuid        not null references auth.users(id) on delete cascade,
  period_start       date        not null,
  period_end         date        not null,
  estimated_profit   numeric(12,2) not null default 0,
  ct_due             numeric(12,2) not null default 0,
  ct_paid            numeric(12,2) not null default 0,
  payment_due_on     date,                                -- 9 months + 1 day after period_end
  return_due_on      date,                                -- 12 months after period_end (CT600)
  ch_filing_due_on   date,                                -- 9 months after period_end
  status             text        not null default 'open', -- open | filed | paid | closed
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (owner_id, period_start, period_end)
);

create index if not exists ltd_ct_owner_idx
  on public.ltd_ct_accrual (owner_id, period_end desc);

-- ── Touch updated_at on every UPDATE ─────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ltd_dividends_touch          on public.ltd_dividends;
drop trigger if exists ltd_dla_touch                on public.ltd_director_loan_entries;
drop trigger if exists ltd_ct_touch                 on public.ltd_ct_accrual;

create trigger ltd_dividends_touch
  before update on public.ltd_dividends
  for each row execute function public.touch_updated_at();

create trigger ltd_dla_touch
  before update on public.ltd_director_loan_entries
  for each row execute function public.touch_updated_at();

create trigger ltd_ct_touch
  before update on public.ltd_ct_accrual
  for each row execute function public.touch_updated_at();

-- ── RLS — owner-scoped only ──────────────────────────────────────────────────
alter table public.ltd_dividends                enable row level security;
alter table public.ltd_director_loan_entries    enable row level security;
alter table public.ltd_ct_accrual               enable row level security;

drop policy if exists ltd_dividends_owner_all       on public.ltd_dividends;
drop policy if exists ltd_dla_owner_all             on public.ltd_director_loan_entries;
drop policy if exists ltd_ct_owner_all              on public.ltd_ct_accrual;

create policy ltd_dividends_owner_all on public.ltd_dividends
  for all to authenticated
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy ltd_dla_owner_all on public.ltd_director_loan_entries
  for all to authenticated
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy ltd_ct_owner_all on public.ltd_ct_accrual
  for all to authenticated
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Service-role bypasses RLS by default; no policy needed for edge functions.
