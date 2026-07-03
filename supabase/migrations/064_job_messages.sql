-- 064_job_messages.sql
--
-- Connect — back-and-forth thread on a queried job so the FM and the sub
-- can exchange notes without spawning emails-only or losing context.
--
-- One row per message. author_role denormalises whether the writer is the
-- assigned sub or someone from the FM org, which lets the renderer style
-- bubbles without re-joining profiles every time.
--
-- RLS mirrors job_evidence:
--   • sub  — RW on rows for jobs where they're sub_user_id
--   • FM   — RW on rows for jobs in their fm_organisation_id

create table if not exists public.job_messages (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id)     on delete cascade,
  author_id    uuid not null references auth.users(id)      on delete cascade,
  author_role  text not null check (author_role in ('sub','fm')),
  body         text not null check (length(body) between 1 and 4000),
  created_at   timestamptz not null default now()
);

create index if not exists idx_job_messages_job_created
  on public.job_messages (job_id, created_at);

alter table public.job_messages enable row level security;

-- Sub — read
drop policy if exists job_messages_sub_select on public.job_messages;
create policy job_messages_sub_select on public.job_messages
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = job_messages.job_id
        and j.sub_user_id = auth.uid()
    )
  );

-- Sub — insert (only as their own row + author_role='sub' + on their own jobs)
drop policy if exists job_messages_sub_insert on public.job_messages;
create policy job_messages_sub_insert on public.job_messages
  for insert with check (
    author_id = auth.uid()
    and author_role = 'sub'
    and exists (
      select 1 from public.jobs j
      where j.id = job_messages.job_id
        and j.sub_user_id = auth.uid()
    )
  );

-- FM — read
drop policy if exists job_messages_fm_select on public.job_messages;
create policy job_messages_fm_select on public.job_messages
  for select using (
    job_id in (
      select j.id
      from public.jobs j
      join public.profiles p on p.fm_organisation_id = j.fm_organisation_id
      where p.id = auth.uid()
        and j.fm_organisation_id is not null
    )
  );

-- FM — insert (only as their own row + author_role='fm' + on their org's jobs)
drop policy if exists job_messages_fm_insert on public.job_messages;
create policy job_messages_fm_insert on public.job_messages
  for insert with check (
    author_id = auth.uid()
    and author_role = 'fm'
    and job_id in (
      select j.id
      from public.jobs j
      join public.profiles p on p.fm_organisation_id = j.fm_organisation_id
      where p.id = auth.uid()
        and j.fm_organisation_id is not null
    )
  );
