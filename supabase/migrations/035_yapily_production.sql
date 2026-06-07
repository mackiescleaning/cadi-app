-- 035_yapily_production.sql
-- Cadi — Yapily production-readiness hardening.
-- Supports: OAuth state nonce (CSRF), per-consent tracking, expiry/re-consent,
-- multi-account banks, structured sync errors, per-business tx uniqueness.

-- ─── 1. oauth_states ─────────────────────────────────────────────────────────
-- Short-lived CSRF nonces, one per OAuth-init call. Verified + deleted at callback.
create table if not exists public.oauth_states (
  state         text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null default 'yapily',
  institution_id text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists idx_oauth_states_user_id on public.oauth_states(user_id);
create index if not exists idx_oauth_states_expires_at on public.oauth_states(expires_at);

alter table public.oauth_states enable row level security;

-- No client access — only edge functions (service role) read/write this table
revoke all on public.oauth_states from anon, authenticated;

-- Janitor: drop stale rows older than 1 hour. Safe to call from a cron.
create or replace function public.cleanup_expired_oauth_states()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.oauth_states where expires_at < now();
$$;

-- ─── 2. bank_connections — new columns ───────────────────────────────────────
alter table public.bank_connections
  add column if not exists yapily_consent_id    text,
  add column if not exists consent_expires_at   timestamptz,
  add column if not exists sync_error_code      text,
  add column if not exists needs_reauth         boolean not null default false,
  add column if not exists last_sync_error_at   timestamptz;

create index if not exists idx_bank_connections_needs_reauth
  on public.bank_connections(needs_reauth)
  where needs_reauth = true;

-- ─── 3. bank_accounts — multi-account per connection ─────────────────────────
-- Many UK SME logins (Starling current+tax-pot, Tide main+expense) expose
-- multiple accounts under one consent. Each gets its own row + sync state.
create table if not exists public.bank_accounts (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  bank_connection_id  uuid not null references public.bank_connections(id) on delete cascade,
  yapily_account_id   text not null,
  account_name        text,
  account_type        text,
  account_last_4      text,
  currency            text default 'GBP',
  is_included         boolean not null default true,  -- user can hide non-business accounts
  last_sync_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique (bank_connection_id, yapily_account_id)
);

create index if not exists idx_bank_accounts_business_id on public.bank_accounts(business_id);
create index if not exists idx_bank_accounts_connection_id on public.bank_accounts(bank_connection_id);

alter table public.bank_accounts enable row level security;

-- Owners can read their own accounts; mutations are edge-function only
drop policy if exists "bank_accounts_owner_select" on public.bank_accounts;
create policy "bank_accounts_owner_select" on public.bank_accounts
  for select using (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  );

-- Allow owner to toggle is_included (whitelist exact columns the client may patch)
drop policy if exists "bank_accounts_owner_update_include" on public.bank_accounts;
create policy "bank_accounts_owner_update_include" on public.bank_accounts
  for update using (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  );

-- ─── 4. transactions — per-business uniqueness ───────────────────────────────
-- The legacy global UNIQUE on truelayer_transaction_id is a latent cross-tenant
-- corruption risk. Drop it, add per-business composite, point upsert at it.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_truelayer_transaction_id_key'
  ) then
    alter table public.transactions
      drop constraint transactions_truelayer_transaction_id_key;
  end if;
end$$;

create unique index if not exists transactions_business_yapily_tx_unique
  on public.transactions (business_id, truelayer_transaction_id);

-- Optional: link transactions back to a bank_account row when one exists
alter table public.transactions
  add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete set null;

create index if not exists idx_transactions_bank_account_id
  on public.transactions(bank_account_id);
