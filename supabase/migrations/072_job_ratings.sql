-- 072_job_ratings.sql
--
-- FM's per-job rating of the sub. One row per job (approval attaches it),
-- 1-5 stars + optional comment. Feeds two consumers:
--   • Sub-side "FM reviews" list on their profile
--   • Cadi Score recompute — new "FM rating" metric worth 15 pts
--
-- Ratings can be edited by the FM later (e.g. "actually 4 stars once we
-- saw the follow-up"), so no immutable created_at gate. updated_at tracks
-- edits for audit.

create table if not exists public.job_ratings (
  job_id              uuid primary key references public.jobs(id) on delete cascade,
  sub_user_id         uuid not null references public.profiles(id) on delete cascade,
  fm_organisation_id  uuid not null references public.fm_organisations(id) on delete cascade,
  rated_by_user_id    uuid not null references public.profiles(id) on delete set null,
  stars               smallint not null check (stars between 1 and 5),
  comment             text check (comment is null or length(comment) <= 2000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_job_ratings_sub
  on public.job_ratings (sub_user_id, created_at desc);
create index if not exists idx_job_ratings_fm
  on public.job_ratings (fm_organisation_id, created_at desc);

alter table public.job_ratings enable row level security;

-- Sub can read ratings about themselves
drop policy if exists job_ratings_sub_select on public.job_ratings;
create policy job_ratings_sub_select on public.job_ratings
  for select using (sub_user_id = auth.uid());

-- FM org can read + write ratings on their own org's jobs
drop policy if exists job_ratings_fm_select on public.job_ratings;
create policy job_ratings_fm_select on public.job_ratings
  for select using (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists job_ratings_fm_insert on public.job_ratings;
create policy job_ratings_fm_insert on public.job_ratings
  for insert with check (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
    and rated_by_user_id = auth.uid()
  );

drop policy if exists job_ratings_fm_update on public.job_ratings;
create policy job_ratings_fm_update on public.job_ratings
  for update using (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );
