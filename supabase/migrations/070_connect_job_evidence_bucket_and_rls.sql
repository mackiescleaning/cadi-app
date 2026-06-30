-- 070_connect_job_evidence_bucket_and_rls.sql
--
-- Storage bucket + RLS so Connect subs can upload check-out evidence
-- (photos + notes) against jobs they're assigned to, and FM-org members
-- can read evidence for jobs done in their org.
--
-- Path convention: {job_id}/{timestamp}-{filename}
-- Bucket is private; objects fetched via signed URLs.
--
-- Mirrors the same residential-vs-Connect pattern we keep hitting: the
-- residential job_evidence table existed with policies for owner_id and
-- FM-org SELECT, but no policies for Connect subs to INSERT, and no
-- storage bucket for the photos themselves.

-- 1. Private storage bucket (10 MB per-object cap)
insert into storage.buckets (id, name, public, file_size_limit)
values ('connect-job-evidence', 'connect-job-evidence', false, 10485760)
on conflict (id) do nothing;

-- 2. Storage RLS — sub can upload to {job_id}/ for jobs they own
drop policy if exists connect_evidence_sub_upload on storage.objects;
create policy connect_evidence_sub_upload on storage.objects
  for insert with check (
    bucket_id = 'connect-job-evidence'
    and exists (
      select 1 from public.jobs j
      where j.id::text = split_part(name, '/', 1)
        and j.sub_user_id = auth.uid()
    )
  );

-- 3. Storage RLS — sub can read their own
drop policy if exists connect_evidence_sub_read on storage.objects;
create policy connect_evidence_sub_read on storage.objects
  for select using (
    bucket_id = 'connect-job-evidence'
    and exists (
      select 1 from public.jobs j
      where j.id::text = split_part(name, '/', 1)
        and j.sub_user_id = auth.uid()
    )
  );

-- 4. Storage RLS — FM-org members can read evidence on jobs in their org
drop policy if exists connect_evidence_fm_read on storage.objects;
create policy connect_evidence_fm_read on storage.objects
  for select using (
    bucket_id = 'connect-job-evidence'
    and exists (
      select 1 from public.jobs j
      where j.id::text = split_part(name, '/', 1)
        and j.fm_organisation_id = public.current_user_fm_org()
    )
  );

-- 5. job_evidence RLS — sub can INSERT for their own jobs (and SELECT)
drop policy if exists job_evidence_connect_sub_insert on public.job_evidence;
create policy job_evidence_connect_sub_insert on public.job_evidence
  for insert with check (
    exists (
      select 1 from public.jobs j
      where j.id = job_evidence.job_id
        and j.sub_user_id = auth.uid()
    )
  );

drop policy if exists job_evidence_connect_sub_select on public.job_evidence;
create policy job_evidence_connect_sub_select on public.job_evidence
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = job_evidence.job_id
        and j.sub_user_id = auth.uid()
    )
  );
