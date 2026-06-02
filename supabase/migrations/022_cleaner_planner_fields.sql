-- 022_cleaner_planner_fields.sql
-- Adds CleanerPlanner / Squeegee import columns to the customers table.
-- New fields: due_date, job_reference, customer_reference, schedule,
--             customer_balance, price_per_visit, round_name, account_status

alter table public.customers
  add column if not exists due_date           date,
  add column if not exists job_reference      text,
  add column if not exists customer_reference text,
  add column if not exists schedule           text,
  add column if not exists customer_balance   numeric(10,2) default 0,
  add column if not exists price_per_visit    numeric(10,2),
  add column if not exists round_name         text,
  add column if not exists account_status     text not null default 'active'
    check (account_status in ('active', 'suspended', 'cancelled'));

-- Index to make Rounds view fast (group/filter by round name)
create index if not exists customers_round_name_idx
  on public.customers (round_name)
  where round_name is not null;
