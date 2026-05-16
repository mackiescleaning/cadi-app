-- ── Accountant / Team Access ─────────────────────────────────────────────────

create table if not exists public.account_members (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  member_email     text not null,
  member_user_id   uuid references auth.users(id) on delete set null,
  role             text not null default 'accountant',   -- 'accountant' | 'bookkeeper'
  access_level     text not null default 'read_only',    -- 'read_only' | 'full'
  status           text not null default 'pending',      -- 'pending' | 'active' | 'revoked'
  invite_token     uuid not null default gen_random_uuid(),
  invited_by       uuid references auth.users(id) on delete set null,
  invited_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  expires_at       timestamptz,
  constraint account_members_owner_email unique (owner_id, member_email)
);

alter table public.account_members enable row level security;

-- Owner can see and manage their own members
create policy "owner_select" on public.account_members
  for select using (owner_id = auth.uid());

create policy "owner_insert" on public.account_members
  for insert with check (owner_id = auth.uid());

create policy "owner_update" on public.account_members
  for update using (owner_id = auth.uid());

create policy "owner_delete" on public.account_members
  for delete using (owner_id = auth.uid());

-- Accountant can see their own rows (to accept invite, view clients)
create policy "member_select" on public.account_members
  for select using (member_user_id = auth.uid());

-- Accountant can update their own row (accept invite)
create policy "member_accept" on public.account_members
  for update using (member_user_id = auth.uid());

-- Anyone can look up an invite by token (for the accept page)
create policy "invite_token_lookup" on public.account_members
  for select using (true);  -- filtered by invite_token in app query

-- ── Audit log ────────────────────────────────────────────────────────────────

create table if not exists public.account_member_audit (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid references public.account_members(id) on delete cascade,
  owner_id    uuid not null,
  actor_id    uuid not null,   -- who did the action
  action      text not null,   -- 'login' | 'viewed_invoices' | 'submitted_quarter' | 'invited' | 'revoked' | 'access_changed'
  detail      jsonb,
  created_at  timestamptz not null default now()
);

alter table public.account_member_audit enable row level security;

create policy "owner_audit_select" on public.account_member_audit
  for select using (owner_id = auth.uid());

create policy "member_audit_select" on public.account_member_audit
  for select using (actor_id = auth.uid());

create policy "audit_insert" on public.account_member_audit
  for insert with check (actor_id = auth.uid());

-- ── Helper function: is current user an active member for a given owner? ─────

create or replace function public.is_active_member(p_owner_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.account_members
    where owner_id       = p_owner_id
      and member_user_id = auth.uid()
      and status         = 'active'
  );
$$;

create or replace function public.is_full_access_member(p_owner_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.account_members
    where owner_id       = p_owner_id
      and member_user_id = auth.uid()
      and status         = 'active'
      and access_level   = 'full'
  );
$$;
