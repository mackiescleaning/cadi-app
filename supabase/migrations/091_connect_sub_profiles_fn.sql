-- 091_connect_sub_profiles_fn.sql
-- Follow-up to 090: replace the `connect_sub_public_profile` SECURITY DEFINER
-- *view* with a SECURITY DEFINER *function*. A security-definer view trips the
-- `security_definer_view` advisor (ERROR) because it bypasses the caller's RLS;
-- the recommended pattern for "read a curated projection of another tenant's row
-- with a server-side authz check" is a SECURITY DEFINER function. Same curated
-- column set, same fm_can_see_sub() tenancy boundary.

drop view if exists public.connect_sub_public_profile;

create or replace function public.connect_sub_profiles(p_ids uuid[])
returns table (
  id               uuid,
  business_name    text,
  first_name       text,
  last_name        text,
  connect_score    numeric,
  connect_tier     text,
  connect_trades   text[],
  connect_region   text,
  connect_capacity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.business_name, p.first_name, p.last_name,
         p.connect_score, p.connect_tier, p.connect_trades, p.connect_region, p.connect_capacity
  from public.profiles p
  where p.id = any(p_ids)
    and public.fm_can_see_sub(p.id)
$$;

revoke execute on function public.connect_sub_profiles(uuid[]) from public, anon;
grant execute on function public.connect_sub_profiles(uuid[]) to authenticated;
