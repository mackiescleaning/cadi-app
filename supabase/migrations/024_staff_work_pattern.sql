-- Add per-cleaner recurring work pattern
-- Keys are JS day-of-week integers (0=Sun, 1=Mon, ..., 6=Sat)
-- Value: {"start":"HH:MM","end":"HH:MM"} for working days, absent/null key for days off
alter table team_members
  add column if not exists work_pattern jsonb default null;
