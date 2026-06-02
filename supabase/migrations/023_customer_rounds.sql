-- 023_customer_rounds.sql
-- Per-customer recurring rounds/services, imported from CleanerPlanner / Squeegee.
-- Each row = one recurring job: a customer can have many rounds (different buildings,
-- different schedules, different prices).

create table if not exists public.customer_rounds (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  customer_id         uuid not null references public.customers(id) on delete cascade,
  job_reference       text,
  round_name          text,
  schedule            text,
  price_per_visit     numeric(10,2),
  due_date            date,
  account_status      text not null default 'active'
    check (account_status in ('active', 'suspended', 'cancelled')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.customer_rounds enable row level security;

create policy "customer_rounds_business_all" on public.customer_rounds
  for all using (business_id = my_business_id())
  with check (business_id = my_business_id());

create index if not exists customer_rounds_customer_id_idx on public.customer_rounds (customer_id);
create index if not exists customer_rounds_round_name_idx  on public.customer_rounds (round_name) where round_name is not null;
create index if not exists customer_rounds_due_date_idx    on public.customer_rounds (due_date)   where due_date is not null;
