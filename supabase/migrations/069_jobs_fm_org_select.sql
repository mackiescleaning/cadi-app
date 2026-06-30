-- 069_jobs_fm_org_select.sql
--
-- jobs RLS originally only had policies for the original sides:
--   • jobs_owner_all          — owner_id = auth.uid() (residential)
--   • jobs_connect_sub_select — sub_user_id = auth.uid() (Connect sub)
--
-- Nothing let FM-org members read jobs done in their org. So
-- /fm-ops/approval, /fm-ops/schedule, /fm-ops/overview all silently
-- returned 0 rows after Chris's check-out — even though the job is
-- sitting there with approval_status='pending'.
--
-- Add a SELECT policy scoped via the SECURITY DEFINER helper from
-- migration 063 (current_user_fm_org), which bypasses RLS for the
-- caller's-org lookup and avoids the recursion trap we hit in 062.

create policy jobs_fm_org_select on public.jobs
  for select
  using (
    fm_organisation_id = public.current_user_fm_org()
  );
