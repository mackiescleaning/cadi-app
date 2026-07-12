-- 095_business_tax_profile.sql
-- Accounts foundation (P1) — per-business tax/entity configuration, 1:1 with businesses.
-- This is what re-frames the same transactions per entity type: personal spend becomes
-- drawings (sole trader) or a director's loan (ltd); income is measured against the VAT
-- threshold; VAT treatment is applied only when registered. See ACCOUNTS_FOUNDATION_SPEC.md.

create table if not exists public.business_tax_profile (
  business_id         uuid primary key references public.businesses(id) on delete cascade,
  structure           text        not null default 'sole_trader',
  vat_registered      boolean     not null default false,
  vat_number          text,
  vat_scheme          text,               -- 'standard' | 'flat_rate' | 'cash' | null
  vat_flat_rate       numeric,            -- % when flat_rate
  vat_registered_from date,               -- periods before this are non-VAT
  accounting_basis    text        not null default 'cash',   -- 'cash' | 'accrual'
  fy_start_month      smallint    not null default 4,         -- sole trader = 6 April
  fy_start_day        smallint    not null default 6,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint business_tax_structure_chk check (structure in ('sole_trader','ltd','partnership')),
  constraint business_tax_basis_chk     check (accounting_basis in ('cash','accrual')),
  constraint business_tax_vatscheme_chk check (vat_scheme is null or vat_scheme in ('standard','flat_rate','cash'))
);

alter table public.business_tax_profile enable row level security;

-- Owner-only for P1. Member/accountant access is a later phase (adds a SECURITY DEFINER
-- owner-lookup helper so it doesn't trip businesses RLS).
drop policy if exists business_tax_owner on public.business_tax_profile;
create policy business_tax_owner on public.business_tax_profile for all
  using (business_id = public.my_business_id())
  with check (business_id = public.my_business_id());

drop trigger if exists business_tax_profile_updated_at on public.business_tax_profile;
create trigger business_tax_profile_updated_at
  before update on public.business_tax_profile
  for each row execute function public.set_updated_at();
