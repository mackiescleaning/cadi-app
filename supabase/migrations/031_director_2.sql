-- Support for two directors on Ltd companies
alter table business_settings
  add column if not exists director_1_name          text,
  add column if not exists director_2_name          text,
  add column if not exists director_2_salary_annual numeric(10,2);
