-- 046_customer_lifecycle.sql
-- Adds birthday + customer_since to power the Customer Pulse panel and
-- monthly milestone reporting. Both nullable — historic + imported rows
-- backfill customer_since from created_at via the BACKFILL block below.

alter table public.customers
  add column if not exists birthday        date,
  add column if not exists customer_since  date;

-- Backfill customer_since from created_at so existing rows immediately
-- show an anniversary in the Pulse panel without user intervention.
update public.customers
   set customer_since = created_at::date
 where customer_since is null
   and created_at is not null;

-- Indexes for the monthly-report query that scans for upcoming
-- birthdays / anniversaries by month-of-year. Using expression indexes
-- on extract(month ...) keeps the scheduled report cheap even at scale.
create index if not exists customers_birthday_month_idx
  on public.customers (owner_id, (extract(month from birthday)))
  where birthday is not null;

create index if not exists customers_customer_since_month_idx
  on public.customers (owner_id, (extract(month from customer_since)))
  where customer_since is not null;

comment on column public.customers.birthday is
  'Customer date of birth (nullable). Used for birthday outreach and Pulse milestones.';
comment on column public.customers.customer_since is
  'Date customer joined the business. Defaults to created_at on backfill; editable by owner.';
