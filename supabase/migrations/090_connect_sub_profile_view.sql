-- 090_connect_sub_profile_view.sql
-- P0 fix (FM/Connect audit 2026-07-04): stop FMs reading contractors' FULL
-- profile row. The policy `profiles_fm_can_read_connect_subs` granted an FM
-- SELECT on the entire profiles row of every unlocked sub — which includes
-- hmrc_access_token/refresh/nino(+_enc), gc_access_token, gc_webhook_secret,
-- tl_access_token/refresh, stripe_*, home_postcode, phone, is_cadi_admin.
--
-- Replacement: a curated view exposing ONLY the columns the FM Ops UI needs,
-- scoped by a SECURITY DEFINER relationship helper, and DROP the raw-row policy.

-- 1. Relationship helper. SECURITY DEFINER so it does NOT depend on the FM being
--    able to SELECT the sub's profile row (which we remove below). Self-authorises
--    via current_user_fm_org() -> auth.uid(), so it only ever answers for the
--    caller's own org. Mirrors the relationship the sub_docs/availability
--    FM-select policies already used (unlocked OR shared job OR shared visit).
create or replace function public.fm_can_see_sub(p_sub uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_fm_org() is not null
     and (
       exists (select 1 from public.profiles s
                where s.id = p_sub
                  and s.connect_unlocked_by_fm_id = public.current_user_fm_org())
       or exists (select 1 from public.jobs j
                   where j.sub_user_id = p_sub
                     and j.fm_organisation_id = public.current_user_fm_org()
                     and j.deleted_at is null)
       or exists (select 1 from public.visit_specs vs
                   where vs.assigned_sub_user_id = p_sub
                     and vs.fm_organisation_id = public.current_user_fm_org()
                     and vs.deleted_at is null)
     );
$$;
revoke execute on function public.fm_can_see_sub(uuid) from public, anon;
grant execute on function public.fm_can_see_sub(uuid) to authenticated;

-- 2. Curated, FM-facing view of a contractor's public profile. Only the fields
--    the FM Ops UI actually reads (fmOpsDb.listFmContractors / listFmActiveSubs).
--    NO tokens, NINO, home_postcode, phone, stripe/*, is_cadi_admin, etc.
--    security_invoker = false: the view runs as owner so it can read profiles,
--    and the WHERE clause (fm_can_see_sub) is the tenancy boundary. (This trips
--    the "security definer view" advisor lint — accepted: columns are curated and
--    the WHERE enforces per-caller scoping.)
create or replace view public.connect_sub_public_profile
with (security_invoker = false)
as
select
  p.id,
  p.business_name,
  p.first_name,
  p.last_name,
  p.connect_score,
  p.connect_tier,
  p.connect_trades,
  p.connect_region,
  p.connect_capacity
from public.profiles p
where public.fm_can_see_sub(p.id);

revoke all on public.connect_sub_public_profile from anon;
grant select on public.connect_sub_public_profile to authenticated;

-- 3. Re-point the two policies that inline-read the sub's profile row so they no
--    longer depend on the FM's raw profiles SELECT (dropped in step 4). Same
--    relationship, now via the helper. Other policies on these tables are untouched.
drop policy if exists sub_docs_fm_select on public.connect_sub_docs;
create policy sub_docs_fm_select on public.connect_sub_docs
  for select using (public.fm_can_see_sub(sub_user_id));

drop policy if exists sub_availability_fm_select on public.connect_sub_availability;
create policy sub_availability_fm_select on public.connect_sub_availability
  for select using (public.fm_can_see_sub(sub_user_id));

-- 4. Remove the over-broad policy. FMs can no longer read raw sub profile rows;
--    their own profile (profiles_select_own) and edge functions (service_role)
--    are unaffected.
drop policy if exists profiles_fm_can_read_connect_subs on public.profiles;
