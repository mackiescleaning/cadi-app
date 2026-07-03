-- 066_fm_accounts_settings.sql
--
-- Per-FM accounting integration settings + per-supplier code mappings.
-- Lets the connect-export-accounts function render the right CSV shape
-- for whichever accounting platform the FM uses (Sage 50, Xero, etc).
--
-- Designed for scale: adding a new platform = one preset entry in the
-- export function + a dropdown option here. No per-FM code paths.

-- ── FM accounts settings ────────────────────────────────────────────────────
alter table public.fm_organisations
  add column if not exists accounts_platform        text not null default 'generic',
  add column if not exists default_nominal_code     text,
  add column if not exists default_vat_code         text,
  add column if not exists default_payment_terms_days integer not null default 30,
  add column if not exists accounts_email           text;

-- Allowed platforms. 'generic' = a full-field CSV with no opinion (works for
-- anything that can map columns). The named presets target specific
-- accounting packages' import formats.
alter table public.fm_organisations
  drop constraint if exists fm_organisations_accounts_platform_check;
alter table public.fm_organisations
  add constraint fm_organisations_accounts_platform_check
  check (accounts_platform in ('generic','sage_50','sage_cloud','xero','quickbooks','freeagent'));

-- ── Per-FM-per-sub supplier codes ───────────────────────────────────────────
-- One row per (FM org, sub) pair. Auto-created on first export if missing.
-- Sequence is unique per FM, not globally — Britannia's MAC001 is unrelated
-- to another FM's MAC001.
create table if not exists public.fm_supplier_codes (
  id                   uuid primary key default gen_random_uuid(),
  fm_organisation_id   uuid not null references public.fm_organisations(id) on delete cascade,
  sub_user_id          uuid not null references public.profiles(id)           on delete cascade,
  supplier_code        text not null,
  nominal_code_override text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (fm_organisation_id, sub_user_id),
  unique (fm_organisation_id, supplier_code)
);

create index if not exists idx_fm_supplier_codes_org on public.fm_supplier_codes (fm_organisation_id);
create index if not exists idx_fm_supplier_codes_sub on public.fm_supplier_codes (sub_user_id);

alter table public.fm_supplier_codes enable row level security;

-- FM org members can RW their own org's rows
drop policy if exists fm_supplier_codes_select on public.fm_supplier_codes;
create policy fm_supplier_codes_select on public.fm_supplier_codes
  for select using (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists fm_supplier_codes_insert on public.fm_supplier_codes;
create policy fm_supplier_codes_insert on public.fm_supplier_codes
  for insert with check (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists fm_supplier_codes_update on public.fm_supplier_codes;
create policy fm_supplier_codes_update on public.fm_supplier_codes
  for update using (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

-- Service role bypasses RLS, which is what the edge function uses for the
-- lazy auto-create path. The policies above only need to cover the UI.
