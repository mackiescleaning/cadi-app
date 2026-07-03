-- 067_fm_accounts_settings_table.sql
--
-- Bugfix follow-up to 066. Putting accounts_platform etc. on
-- fm_organisations was wrong because only Cadi admins have UPDATE rights
-- on that table (intentional — protects org identity). FM members were
-- locked out of editing their own accounting settings.
--
-- Split into a new fm_accounts_settings table (1-row-per-org) that the FM
-- org members own outright. Backfill from the columns we just added, then
-- drop them from fm_organisations.

create table if not exists public.fm_accounts_settings (
  fm_organisation_id          uuid primary key references public.fm_organisations(id) on delete cascade,
  accounts_platform           text not null default 'generic',
  default_nominal_code        text,
  default_vat_code            text,
  default_payment_terms_days  integer not null default 30,
  accounts_email              text,
  updated_at                  timestamptz not null default now(),

  constraint fm_accounts_settings_platform_check
    check (accounts_platform in ('generic','sage_50','sage_cloud','xero','quickbooks','freeagent'))
);

alter table public.fm_accounts_settings enable row level security;

-- FM members own RW their own org's settings row
drop policy if exists fm_accounts_settings_select on public.fm_accounts_settings;
create policy fm_accounts_settings_select on public.fm_accounts_settings
  for select using (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists fm_accounts_settings_insert on public.fm_accounts_settings;
create policy fm_accounts_settings_insert on public.fm_accounts_settings
  for insert with check (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists fm_accounts_settings_update on public.fm_accounts_settings;
create policy fm_accounts_settings_update on public.fm_accounts_settings
  for update using (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

-- Backfill any rows already created on fm_organisations (only Britannia's row
-- exists at the moment; safe even if multiple).
insert into public.fm_accounts_settings (
  fm_organisation_id, accounts_platform, default_nominal_code, default_vat_code,
  default_payment_terms_days, accounts_email
)
select
  id,
  coalesce(accounts_platform, 'generic'),
  default_nominal_code,
  default_vat_code,
  coalesce(default_payment_terms_days, 30),
  accounts_email
from public.fm_organisations
where not exists (
  select 1 from public.fm_accounts_settings s where s.fm_organisation_id = fm_organisations.id
);

-- Drop the now-redundant columns from fm_organisations
alter table public.fm_organisations
  drop constraint if exists fm_organisations_accounts_platform_check;

alter table public.fm_organisations
  drop column if exists accounts_platform,
  drop column if exists default_nominal_code,
  drop column if exists default_vat_code,
  drop column if exists default_payment_terms_days,
  drop column if exists accounts_email;
