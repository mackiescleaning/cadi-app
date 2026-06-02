-- Migration 019: Staff Unification + Absences
--
-- Purpose
--   Make team_members the canonical staff table; link jobs to staff by UUID;
--   add absence tracking. Foundation for the Staff tab (rota, payroll, Connect).
--
-- Safe to re-run. Does NOT drop staff_members yet — the staff-auth and
-- staff-jobs edge functions still read it. Drop happens in migration 020
-- after those functions ship using assignee_ids + team_members.
--
-- Britannia FM demo is untouched: demos use hardcoded JSON, never the db.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend team_members with the fields staff_members had
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.team_members
  add column if not exists pin_hash    text,
  add column if not exists hourly_rate numeric;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill team_members from staff_members (preserving UUIDs so any
--    existing PIN-based staff sessions keep working after the edge functions
--    move over to team_members)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'staff_members'
  ) then
    insert into public.team_members (
      id, business_id, first_name, last_name,
      pin_hash, hourly_rate, role, is_active, created_at
    )
    select
      sm.id,
      sm.owner_id as business_id,
      -- split full name into first / last on first space
      coalesce(
        nullif(
          case when position(' ' in sm.name) > 0
               then substring(sm.name from 1 for position(' ' in sm.name) - 1)
               else sm.name end,
          ''),
        'Unknown'
      ) as first_name,
      case when position(' ' in sm.name) > 0
           then nullif(trim(substring(sm.name from position(' ' in sm.name) + 1)), '')
           else null end as last_name,
      sm.pin_hash,
      sm.hourly_rate,
      case when sm.role in ('cleaner','supervisor','manager')
           then sm.role else 'cleaner' end as role,
      coalesce(sm.active, true) as is_active,
      coalesce(sm.created_at, now())
    from public.staff_members sm
    where not exists (
      select 1 from public.team_members tm where tm.id = sm.id
    );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add jobs.assignee_ids — the canonical staff-link field
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.jobs
  add column if not exists assignee_ids uuid[] not null default '{}'::uuid[];

create index if not exists jobs_assignee_ids_idx
  on public.jobs using gin (assignee_ids);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill assignee_ids by matching the existing assignees name array
--    against team_members for the same business.
--    Best-effort: unmatched names leave assignee_ids empty — assignees
--    name array is preserved as a display fallback.
-- ─────────────────────────────────────────────────────────────────────────────

with job_names as (
  select
    j.id as job_id,
    j.owner_id,
    trim(elem) as name
  from public.jobs j
  cross join lateral unnest(
    case when j.assignees is not null and array_length(j.assignees, 1) > 0
         then j.assignees::text[]
         else '{}'::text[] end
  ) as elem
  where j.assignee_ids = '{}'::uuid[]
    and j.assignees is not null
    and array_length(j.assignees, 1) > 0
),
matched as (
  select
    jn.job_id,
    array_agg(distinct tm.id) filter (where tm.id is not null) as ids
  from job_names jn
  left join public.team_members tm
    on tm.business_id = jn.owner_id
    and trim(both ' ' from (tm.first_name || ' ' || coalesce(tm.last_name, ''))) = jn.name
  group by jn.job_id
)
update public.jobs j
set assignee_ids = coalesce(m.ids, '{}'::uuid[])
from matched m
where j.id = m.job_id
  and j.assignee_ids = '{}'::uuid[]
  and m.ids is not null
  and array_length(m.ids, 1) > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. staff_absences — holiday / sick / training blocks
--    Owner_id references auth.users to align with jobs.owner_id RLS pattern.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.staff_absences (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  staff_id   uuid not null references public.team_members(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  type       text not null
             check (type in ('holiday','sick','training','unpaid','other')),
  status     text not null default 'approved'
             check (status in ('pending','approved','declined')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.staff_absences enable row level security;

drop policy if exists "staff_absences_owner_all" on public.staff_absences;
create policy "staff_absences_owner_all" on public.staff_absences
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index if not exists staff_absences_staff_date_idx
  on public.staff_absences (staff_id, start_date, end_date);

create index if not exists staff_absences_owner_idx
  on public.staff_absences (owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Deprecation marker on staff_members
--    Drop in migration 020 once edge functions are using team_members.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'staff_members'
  ) then
    execute $cmt$
      comment on table public.staff_members is
        'DEPRECATED 2026-05-29 (migration 019): data migrated to team_members. '
        'Drop in migration 020 after staff-auth and staff-jobs edge functions '
        'are switched to team_members + assignee_ids.'
    $cmt$;
  end if;
end $$;

commit;
