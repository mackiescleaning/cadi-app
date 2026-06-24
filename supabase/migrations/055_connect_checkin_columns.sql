-- 055_connect_checkin_columns.sql
--
-- Connect — GPS check-in / check-out plumbing.
--
-- Reuses the existing jobs + job_checkins tables instead of adding new ones.
-- Two new columns on each:
--   • jobs.visit_spec_id     · links a scheduled job back to its visit_spec
--   • jobs.sub_user_id       · denormalised for Connect-side RLS speed (joined
--                              path through visit_specs would also work but
--                              every check-in would re-join)
--   • job_checkins.sub_user_id      · the Connect sub who tapped check-in/out
--   • job_checkins.inside_geo_fence · validated against site lat/lng + radius
--   • job_checkins.distance_from_site_m · metres from site GPS at stamp
--
-- RLS additions:
--   • jobs:        Connect subs see + update their own (sub_user_id = me)
--   • job_checkins: Connect subs insert + select their own

alter table public.jobs
  add column if not exists visit_spec_id uuid references public.visit_specs(id) on delete set null,
  add column if not exists sub_user_id   uuid references public.profiles(id)   on delete set null;

create index if not exists idx_jobs_visit_spec on public.jobs (visit_spec_id) where visit_spec_id is not null;
create index if not exists idx_jobs_sub_user   on public.jobs (sub_user_id)   where sub_user_id   is not null;

alter table public.job_checkins
  add column if not exists sub_user_id           uuid references public.profiles(id) on delete set null,
  add column if not exists inside_geo_fence      boolean,
  add column if not exists distance_from_site_m  numeric;

create index if not exists idx_checkins_sub on public.job_checkins (sub_user_id) where sub_user_id is not null;

-- ── RLS on jobs ──────────────────────────────────────────────────────────────
-- Existing policies cover the business-owner / team-member paths. Add Connect
-- sub access alongside them.

drop policy if exists jobs_connect_sub_select on public.jobs;
create policy jobs_connect_sub_select on public.jobs
  for select using (sub_user_id = auth.uid());

drop policy if exists jobs_connect_sub_update on public.jobs;
create policy jobs_connect_sub_update on public.jobs
  for update using (sub_user_id = auth.uid()) with check (sub_user_id = auth.uid());

-- ── RLS on job_checkins ─────────────────────────────────────────────────────
drop policy if exists checkins_connect_sub_insert on public.job_checkins;
create policy checkins_connect_sub_insert on public.job_checkins
  for insert with check (
    sub_user_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_checkins.job_id
        and j.sub_user_id = auth.uid()
    )
  );

drop policy if exists checkins_connect_sub_select on public.job_checkins;
create policy checkins_connect_sub_select on public.job_checkins
  for select using (sub_user_id = auth.uid());
