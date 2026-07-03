-- 074_connect_sub_availability.sql
--
-- Sub blocks out dates they can't work (holidays, van in for MOT, staff
-- shortages). The FM sees these on the contractor profile so they don't
-- direct-assign work into a block, and the sub's own schedule-visit UI
-- warns when a chosen date falls inside a block.
--
-- Stored as inclusive date ranges. Overlapping ranges are allowed but
-- discouraged in the UI (usually one block per period).

create table if not exists public.connect_sub_availability (
  id            uuid primary key default gen_random_uuid(),
  sub_user_id   uuid not null references public.profiles(id) on delete cascade,
  start_date    date not null,
  end_date      date not null check (end_date >= start_date),
  reason        text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_sub_availability_sub_range
  on public.connect_sub_availability (sub_user_id, start_date, end_date);

alter table public.connect_sub_availability enable row level security;

-- Sub owns their own blocks
drop policy if exists sub_availability_sub_select on public.connect_sub_availability;
create policy sub_availability_sub_select on public.connect_sub_availability
  for select using (sub_user_id = auth.uid());

drop policy if exists sub_availability_sub_insert on public.connect_sub_availability;
create policy sub_availability_sub_insert on public.connect_sub_availability
  for insert with check (sub_user_id = auth.uid());

drop policy if exists sub_availability_sub_delete on public.connect_sub_availability;
create policy sub_availability_sub_delete on public.connect_sub_availability
  for delete using (sub_user_id = auth.uid());

-- FM read for subs connected to their org — same rules as connect_sub_docs:
-- direct unlock, job history, or active visit_spec assignment.
drop policy if exists sub_availability_fm_select on public.connect_sub_availability;
create policy sub_availability_fm_select on public.connect_sub_availability
  for select using (
    exists (
      select 1 from public.profiles caller
      where caller.id = auth.uid()
        and caller.fm_organisation_id is not null
        and (
          exists (select 1 from public.profiles sub
                  where sub.id = connect_sub_availability.sub_user_id
                    and sub.connect_unlocked_by_fm_id = caller.fm_organisation_id)
          or exists (select 1 from public.jobs j
                     where j.sub_user_id = connect_sub_availability.sub_user_id
                       and j.fm_organisation_id = caller.fm_organisation_id
                       and j.deleted_at is null)
          or exists (select 1 from public.visit_specs vs
                     where vs.assigned_sub_user_id = connect_sub_availability.sub_user_id
                       and vs.fm_organisation_id = caller.fm_organisation_id
                       and vs.deleted_at is null)
        )
    )
  );
