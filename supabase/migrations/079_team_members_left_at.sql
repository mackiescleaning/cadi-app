-- 079_team_members_left_at.sql
-- Track WHEN a team member left so the Annual Review §7 Team & Workforce
-- section can measure period churn (leavers / avg headcount = turnover).
--
-- Prior to this migration is_active was a one-way boolean. Existing
-- inactive rows are backfilled from updated_at as a best-effort; new
-- transitions get an accurate stamp via the trigger below.

alter table team_members
  add column if not exists left_at timestamptz;

-- Backfill: any existing inactive rows use updated_at as their leave
-- stamp. Approximate but the best signal we have.
update team_members
   set left_at = updated_at
 where is_active = false and left_at is null;

-- Stamp / clear left_at automatically on is_active changes. Reactivating
-- a rehired employee clears the stamp so future churn transitions get a
-- fresh timestamp.
create or replace function team_members_track_leave()
returns trigger
language plpgsql
as $$
begin
  if new.is_active = false and (old.is_active is null or old.is_active = true) then
    new.left_at := now();
  elsif new.is_active = true and old.is_active = false then
    new.left_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists team_members_track_leave_trg on team_members;
create trigger team_members_track_leave_trg
  before update on team_members
  for each row execute function team_members_track_leave();

comment on column team_members.left_at is
  'Set automatically when is_active flips to false; cleared on reactivation.';
