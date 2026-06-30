-- 042_import_batch_id.sql
-- Stamp every row created by the migration wizard with the same UUID so a
-- mis-imported batch can be rolled back in one click. recurring_jobs already
-- has its own import_batch_id (added in 041).

alter table public.customers
  add column if not exists import_batch_id uuid;

alter table public.customer_rounds
  add column if not exists import_batch_id uuid;

alter table public.jobs
  add column if not exists import_batch_id uuid;

create index if not exists customers_import_batch
  on public.customers (import_batch_id) where import_batch_id is not null;
create index if not exists customer_rounds_import_batch
  on public.customer_rounds (import_batch_id) where import_batch_id is not null;
create index if not exists jobs_import_batch
  on public.jobs (import_batch_id) where import_batch_id is not null;
