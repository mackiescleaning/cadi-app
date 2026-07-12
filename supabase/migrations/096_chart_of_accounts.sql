-- 096_chart_of_accounts.sql
-- Accounts foundation (P1) — categories as per-business data (the chart of accounts),
-- the editable bank-category mapping, and the one VAT future-proofer on transactions.
-- transactions.category (text slug) is the join key -> chart_of_accounts.key. No FK, no
-- backfill: keys are immutable, only labels are editable. See ACCOUNTS_FOUNDATION_SPEC.md.

-- ── Chart of accounts ─────────────────────────────────────────────────────────
create table if not exists public.chart_of_accounts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  key           text not null,              -- stable slug; == transactions.category
  label         text not null,              -- display; accountant may rename
  emoji         text,
  color         text,
  lane          text not null,              -- 'income' | 'expense' | 'personal' | 'transfer'
  is_allowable  boolean,                    -- allowable for tax? (expense lane; null otherwise)
  vat_treatment text,                       -- 'standard'|'reduced'|'zero'|'exempt'|'outside_scope'|null
  sa103_box     text,                       -- filing-engine slots (null until built)
  ct600_ref     text,
  vat_box       text,
  sort_order    int     not null default 100,
  is_system     boolean not null default false,   -- seeded default: key immutable, not deletable
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, key),
  constraint coa_lane_chk check (lane in ('income','expense','personal','transfer'))
);
create index if not exists chart_business_lane_idx on public.chart_of_accounts (business_id, lane);

alter table public.chart_of_accounts enable row level security;
drop policy if exists coa_owner on public.chart_of_accounts;
create policy coa_owner on public.chart_of_accounts for all
  using (business_id = public.my_business_id())
  with check (business_id = public.my_business_id());

drop trigger if exists chart_of_accounts_updated_at on public.chart_of_accounts;
create trigger chart_of_accounts_updated_at
  before update on public.chart_of_accounts
  for each row execute function public.set_updated_at();

-- ── Bank-category mapping (Starling "Spending Category" -> chart) ──────────────
create table if not exists public.bank_category_rules (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  source        text not null,              -- 'starling' | 'monzo' | 'ofx' | ...
  bank_category text not null,              -- e.g. 'FOOD_AND_DRINK'
  chart_key     text not null,              -- -> chart_of_accounts.key
  created_at    timestamptz not null default now(),
  unique (business_id, source, bank_category)
);
create index if not exists bank_cat_rules_lookup_idx on public.bank_category_rules (business_id, source);

alter table public.bank_category_rules enable row level security;
drop policy if exists bank_cat_owner on public.bank_category_rules;
create policy bank_cat_owner on public.bank_category_rules for all
  using (business_id = public.my_business_id())
  with check (business_id = public.my_business_id());

-- ── VAT future-proofer: snapshot the chart's VAT treatment at import time ──────
-- Net/VAT amounts stay DERIVED until the VAT engine exists; this column is only so
-- history can be re-derived deterministically without re-touching rows.
alter table public.transactions add column if not exists vat_treatment text;
