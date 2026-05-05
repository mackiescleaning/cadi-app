-- 003_missing_tables.sql
-- Creates the 8 tables referenced in application code but absent from the schema,
-- adds RLS policies matching the owner-scoped pattern used throughout the app,
-- and adds indexes on the columns most commonly used in WHERE / ORDER BY clauses.

-- ─── 1. invoices ─────────────────────────────────────────────────────────────

create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  invoice_num    text not null default 'INV-0001',
  customer_id    uuid references public.customers(id) on delete set null,
  customer       jsonb not null default '{}'::jsonb,
  lines          jsonb not null default '[]'::jsonb,
  date           date not null default current_date,
  due_date       date,
  type           text not null default 'residential',
  status         text not null default 'draft',
  notes          text,
  payment_terms  integer not null default 14,
  sent_at        timestamptz,
  viewed_at      timestamptz,
  paid_at        timestamptz,
  payment_method text,
  reminders      jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.invoices enable row level security;

drop policy if exists "invoices_owner_all" on public.invoices;
create policy "invoices_owner_all" on public.invoices
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── 2. invoice_sends ────────────────────────────────────────────────────────

create table if not exists public.invoice_sends (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  recipient_email text not null,
  status          text not null default 'sent',
  provider        text not null default 'resend',
  sent_at         timestamptz not null default now()
);

alter table public.invoice_sends enable row level security;

drop policy if exists "invoice_sends_owner_all" on public.invoice_sends;
create policy "invoice_sends_owner_all" on public.invoice_sends
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── 3. jobs ─────────────────────────────────────────────────────────────────

create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  customer     text not null default '',
  postcode     text not null default '',
  date         date not null,
  start_hour   numeric not null default 9,
  duration_hrs numeric not null default 2,
  type         text not null default 'residential',
  service      text not null default '',
  price        numeric not null default 0,
  status       text not null default 'scheduled',
  assignee     text,
  assignees    jsonb not null default '[]'::jsonb,
  recurrence   text not null default 'one-off',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.jobs enable row level security;

drop policy if exists "jobs_owner_all" on public.jobs;
create policy "jobs_owner_all" on public.jobs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── 4. products ─────────────────────────────────────────────────────────────

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null default '',
  category     text not null default 'general',
  type         text not null default 'residential',
  unit_cost    numeric not null default 0,
  qty          numeric not null default 0,
  min_qty      numeric not null default 2,
  unit         text not null default 'bottle',
  supplier     text,
  supplier_url text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all" on public.products
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── 5. inventory_orders ─────────────────────────────────────────────────────

create table if not exists public.inventory_orders (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null default '',
  qty          numeric not null default 1,
  unit_cost    numeric not null default 0,
  total_cost   numeric not null default 0,
  supplier     text,
  date         date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.inventory_orders enable row level security;

drop policy if exists "inventory_orders_owner_all" on public.inventory_orders;
create policy "inventory_orders_owner_all" on public.inventory_orders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── 6. saved_routes ─────────────────────────────────────────────────────────

create table if not exists public.saved_routes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null default '',
  type        text not null default 'residential',
  stops       jsonb not null default '[]'::jsonb,
  frequency   text not null default 'one-off',
  total_miles numeric not null default 0,
  last_run    date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.saved_routes enable row level security;

drop policy if exists "saved_routes_owner_all" on public.saved_routes;
create policy "saved_routes_owner_all" on public.saved_routes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── 7. mileage_logs ─────────────────────────────────────────────────────────

create table if not exists public.mileage_logs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  route_id    uuid references public.saved_routes(id) on delete set null,
  date        date not null default current_date,
  route_name  text not null default '',
  miles       numeric not null default 0,
  claim_value numeric not null default 0,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table public.mileage_logs enable row level security;

drop policy if exists "mileage_logs_owner_all" on public.mileage_logs;
create policy "mileage_logs_owner_all" on public.mileage_logs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── 8. leaderboard_entries ──────────────────────────────────────────────────
-- One row per user — owner_id is both PK and FK so upsert is safe.

create table if not exists public.leaderboard_entries (
  owner_id      uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Unnamed business',
  sector        text not null default 'residential',
  score         integer not null default 0,
  region        text,
  updated_at    timestamptz not null default now()
);

alter table public.leaderboard_entries enable row level security;

-- Anyone can read the leaderboard; only the owner can write their own row.
drop policy if exists "leaderboard_select_all" on public.leaderboard_entries;
create policy "leaderboard_select_all" on public.leaderboard_entries
  for select using (true);

drop policy if exists "leaderboard_owner_write" on public.leaderboard_entries;
create policy "leaderboard_owner_write" on public.leaderboard_entries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─── Free-tier customer limit enforcement ────────────────────────────────────
-- Prevent free-plan users from inserting more than 50 active customers.
-- (Pro users and the service role are unrestricted.)
-- The limit is set low enough to be safe but high enough to cover the UI limit
-- of 20 residential / 50 exterior — we use 50 as the combined cap.
create or replace function public.enforce_free_customer_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  active_count int;
begin
  -- Only enforce for inserts of active/at-risk customers (not archived)
  if NEW.status = 'archived' then
    return NEW;
  end if;

  select plan into user_plan from public.profiles where id = NEW.owner_id;

  if user_plan is distinct from 'pro' then
    select count(*) into active_count
    from public.customers
    where owner_id = NEW.owner_id
      and status != 'archived';

    if active_count >= 50 then
      raise exception 'Free plan is limited to 50 active customers. Upgrade to Pro to add more.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists check_free_customer_limit on public.customers;
create trigger check_free_customer_limit
  before insert on public.customers
  for each row execute procedure public.enforce_free_customer_limit();

-- ─── money_entries: add category column (used by expense sorter) ─────────────
alter table public.money_entries
  add column if not exists category text;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- All cover the most common query patterns: owner scoping + sorting/filtering.

-- existing tables
create index if not exists customers_owner_status_idx   on public.customers   (owner_id, status);
create index if not exists customers_owner_created_idx  on public.customers   (owner_id, created_at desc);
create index if not exists money_entries_owner_date_idx on public.money_entries(owner_id, date desc);
create index if not exists money_entries_owner_kind_idx on public.money_entries(owner_id, kind);
create index if not exists quotes_owner_status_idx      on public.quotes      (owner_id, status);
create index if not exists quotes_owner_created_idx     on public.quotes      (owner_id, created_at desc);

-- new tables
create index if not exists invoices_owner_status_idx    on public.invoices    (owner_id, status);
create index if not exists invoices_owner_created_idx   on public.invoices    (owner_id, created_at desc);
create index if not exists invoice_sends_invoice_idx    on public.invoice_sends(invoice_id);
create index if not exists jobs_owner_date_idx          on public.jobs        (owner_id, date);
create index if not exists jobs_owner_status_idx        on public.jobs        (owner_id, status);
create index if not exists products_owner_idx           on public.products    (owner_id);
create index if not exists inventory_orders_owner_date_idx on public.inventory_orders(owner_id, date desc);
create index if not exists mileage_logs_owner_date_idx  on public.mileage_logs(owner_id, date desc);
create index if not exists saved_routes_owner_idx       on public.saved_routes(owner_id);
create index if not exists leaderboard_score_idx        on public.leaderboard_entries(score desc);
