-- 063_fix_profiles_rls_recursion.sql
--
-- Migration 062 added profiles_fm_can_read_connect_subs with a subquery
-- against profiles itself. That subquery re-triggered RLS evaluation on
-- profiles, which re-evaluated profiles_fm_can_read_connect_subs, ad
-- infinitum. Postgres correctly errored:
--   42P17: infinite recursion detected in policy for relation "profiles"
--
-- supabase-js .maybeSingle() returns { data: null, error: <recursion> },
-- and most callsites only check `data`, so the failure surfaced as
-- "profile not found" — breaking sign-in guards, profile reads, the lot.
--
-- Fix: extract the subquery into a SECURITY DEFINER function. It runs as
-- the function owner (postgres) with RLS bypassed, returns the caller's
-- fm_organisation_id, and the policy uses the function result directly
-- without ever re-entering the policy chain.

create or replace function public.current_user_fm_org()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select fm_organisation_id
  from public.profiles
  where id = auth.uid()
$$;

revoke all on function public.current_user_fm_org() from public;
grant execute on function public.current_user_fm_org() to authenticated;

drop policy if exists profiles_fm_can_read_connect_subs on public.profiles;

create policy profiles_fm_can_read_connect_subs on public.profiles
  for select
  using (
    connect_unlocked_by_fm_id = public.current_user_fm_org()
  );
