-- Migration 020: Staff compliance fields on team_members
--
-- Adds Right to Work, DBS, contract, emergency contact, and notes columns.
-- These replace the "Setup needed" compliance placeholder in the Staff → People tab.
-- All columns are nullable so existing rows are unaffected.
-- Safe to re-run (all ADD COLUMN IF NOT EXISTS).

begin;

alter table public.team_members
  -- Right to Work (legally mandatory in UK before employment starts)
  add column if not exists rtw_check_date     date,
  add column if not exists rtw_expiry_date    date,
  add column if not exists rtw_doc_type       text,

  -- DBS check (required for some cleaning roles: schools, healthcare, care homes)
  add column if not exists dbs_type           text
    check (dbs_type in ('basic','standard','enhanced')),
  add column if not exists dbs_check_date     date,
  add column if not exists dbs_expiry_date    date,

  -- Contract / employment
  add column if not exists contract_type      text default 'employed'
    check (contract_type in ('employed','worker','zero_hours','self_employed')),
  add column if not exists contract_start_date date,

  -- Emergency contact
  add column if not exists emergency_contact_name  text,
  add column if not exists emergency_contact_phone text,

  -- Free-text notes
  add column if not exists notes text;

commit;
