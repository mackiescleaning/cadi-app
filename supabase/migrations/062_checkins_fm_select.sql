-- 062_checkins_fm_select.sql
--
-- Bug: FM Ops Approval drawer showed "no record" for check-in / check-out
-- even when the sub had completed both. Cause — job_checkins had only two
-- SELECT policies:
--   • checkins_connect_sub_select  · sub sees own rows
--   • job_checkins_owner           · ALL for business-owner path
-- but no policy granted FM-org members visibility on their own contracts'
-- checkins. job_evidence already has this (job_evidence_fm_select);
-- mirror that pattern here.

drop policy if exists checkins_fm_select on public.job_checkins;
create policy checkins_fm_select on public.job_checkins
  for select using (
    job_id in (
      select j.id
      from public.jobs j
      join public.profiles p on p.fm_organisation_id = j.fm_organisation_id
      where p.id = auth.uid()
        and j.fm_organisation_id is not null
    )
  );
