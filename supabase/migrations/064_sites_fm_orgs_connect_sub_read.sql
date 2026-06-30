-- 064_sites_fm_orgs_connect_sub_read.sql
--
-- Problem: Connect subs (cleaners) load their assigned visit_specs via
-- listMyAssignedVisitSpecs(), which joins sites + fm_organisations. Both
-- of those tables only have SELECT policies for FM-org members, so the
-- joined relations come back null for subs — site name renders as "Site",
-- FM name as "—", and the job-card drawer can't generate a directions URL
-- because the postcode is missing.
--
-- Fix: add SELECT policies that let a sub read sites / FM orgs they have
-- an active relationship with:
--
-- - sites: a sub can read any site that has a visit_spec assigned to them
-- - fm_organisations: a sub can read any FM org that either has a
--   visit_spec assigned to them OR has Connect-unlocked them (the FM that
--   issued their invitation)
--
-- Scoped carefully — sub can ONLY see sites/FMs they're connected to, not
-- the whole FM directory.

create policy sites_connect_sub_select on public.sites
  for select using (
    exists (
      select 1 from public.visit_specs vs
      where vs.site_id = sites.id
        and vs.assigned_sub_user_id = auth.uid()
        and vs.deleted_at is null
    )
  );

create policy fm_orgs_connect_sub_select on public.fm_organisations
  for select using (
    -- Sub assigned to a visit_spec under this org
    exists (
      select 1 from public.visit_specs vs
      where vs.fm_organisation_id = fm_organisations.id
        and vs.assigned_sub_user_id = auth.uid()
        and vs.deleted_at is null
    )
    OR
    -- Or this is the FM that Connect-unlocked the sub
    id = (
      select connect_unlocked_by_fm_id
      from public.profiles
      where id = auth.uid()
    )
  );
