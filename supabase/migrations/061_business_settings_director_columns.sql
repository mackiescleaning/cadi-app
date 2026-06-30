-- 061_business_settings_director_columns.sql
--
-- Three director columns were referenced by Settings, MoneyTracker, and
-- AccountsTab as if they existed on business_settings, but only
-- director_salary_annual was ever added. Saving from Settings would 400
-- with "Could not find the 'director_1_name' column".
--
-- Add the missing columns so the existing read + write code paths line up.

alter table public.business_settings
  add column if not exists director_1_name          text,
  add column if not exists director_2_name          text,
  add column if not exists director_2_salary_annual numeric;
