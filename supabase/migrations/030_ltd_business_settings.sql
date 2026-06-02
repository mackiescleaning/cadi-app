-- Ltd company fields for business_settings
-- These are already written by AccountsTab.jsx but were never formally migrated.
-- Using "add column if not exists" so existing data is preserved.

alter table business_settings
  add column if not exists entity_type              text    not null default 'sole_trader',
  add column if not exists accounting_year_end_month integer not null default 3,
  add column if not exists director_salary_annual   numeric(10,2) not null default 9100,
  add column if not exists companies_house_number   text,
  add column if not exists corporation_tax_utr      text;
