-- 034_security_definer_lockdown.sql
-- Remediates P1/P2 Supabase security advisor findings (audit run 2026-06-03):
--   P1: SECURITY DEFINER functions over-exposed to anon/authenticated
--   P2: Mutable search_path on 8 functions

-- ── P1a: lock context/membership helpers to authenticated only ───────────────
-- These are required by RLS policies (authenticated keeps access), but anon
-- must not call them. Revoking from `anon` alone is insufficient when a
-- PUBLIC grant exists (PostgreSQL default) — must revoke PUBLIC then re-grant.

revoke execute on function public.my_business_id() from public;
grant  execute on function public.my_business_id() to authenticated;

revoke execute on function public.is_active_member(uuid) from public;
grant  execute on function public.is_active_member(uuid) to authenticated;

revoke execute on function public.is_full_access_member(uuid) from public;
grant  execute on function public.is_full_access_member(uuid) to authenticated;

-- ── P1b: revoke anon + authenticated from server-only functions ───────────────

-- check_and_consume_fd_limit: called only from the receive-site-visit edge
-- function via the service-role client. A signed-in user calling this directly
-- can supply p_limit = 999999 and bypass the Lite conversation cap entirely.
revoke execute on function public.check_and_consume_fd_limit(uuid, date, integer)
  from anon, authenticated;

-- initialise_phase1_plan: invoked only by the on_business_created_init_plan
-- trigger (Postgres internal context). No client or edge-function callers.
revoke execute on function public.initialise_phase1_plan(uuid)
  from anon, authenticated;

-- initialise_phase3_plan: migration 014 granted authenticated unnecessarily.
-- No client or edge-function callers exist.
revoke execute on function public.initialise_phase3_plan(uuid)
  from anon, authenticated;

-- ── P1c: harden initialise_phase2_plan (keep authenticated access) ────────────
-- Called from thirtyDayPlanDb.js. SECURITY DEFINER bypasses RLS, so without an
-- ownership check a user could seed onboarding steps for another business.
-- Fix: verify p_business_id matches the caller's own business before writing.

create or replace function public.initialise_phase2_plan(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_business_id is distinct from public.my_business_id() then
    raise exception 'not authorised';
  end if;

  insert into public.onboarding_steps (business_id, phase, step_key, status)
  values
    (p_business_id, 2, 'connect_open_banking',  'available'),
    (p_business_id, 2, 'financial_walkthrough',  'available'),
    (p_business_id, 2, 'first_weekly_report',    'available')
  on conflict (business_id, phase, step_key) do nothing;
end;
$$;

-- ── P2: pin search_path on SECURITY DEFINER functions ────────────────────────

create or replace function public.is_active_member(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_members
    where owner_id       = p_owner_id
      and member_user_id = auth.uid()
      and status         = 'active'
      and access_level   = 'full'
  );
$$;

create or replace function public.check_and_consume_fd_limit(
  p_business_id uuid,
  p_month       date,
  p_limit       integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.front_desk_monthly_usage (business_id, month, action_count)
  values (p_business_id, p_month, 0)
  on conflict (business_id) do update set
    month        = case when public.front_desk_monthly_usage.month < p_month
                        then p_month
                        else public.front_desk_monthly_usage.month end,
    action_count = case when public.front_desk_monthly_usage.month < p_month
                        then 0
                        else public.front_desk_monthly_usage.action_count end;

  update public.front_desk_monthly_usage
  set action_count = action_count + 1
  where business_id = p_business_id
    and month       = p_month
    and action_count < p_limit
  returning action_count into v_count;

  return v_count is not null;
end;
$$;

create or replace function public.initialise_phase3_plan(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.onboarding_steps (business_id, phase, step_key, status)
  values
    (p_business_id, 3, 'hire_sales_manager',       'available'),
    (p_business_id, 3, 'hire_review_agent',         'available'),
    (p_business_id, 3, 'hire_operations_manager',   'available')
  on conflict (business_id, phase, step_key) do nothing;
end;
$$;

-- ── P2: pin search_path on trigger functions (not SECURITY DEFINER) ───────────
-- Not directly callable by clients, but flagged by the advisor for mutable path.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_widget_configs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.trigger_event_dispatcher()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform net.http_post(
    url     := 'https://cufgozpwbinjhjnkimmn.supabase.co/functions/v1/event-dispatcher',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'job_events',
      'record', row_to_json(new)
    )
  );
  return new;
end;
$$;
