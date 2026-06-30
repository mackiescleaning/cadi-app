-- 067_job_checkins_action_extend_for_connect.sql
--
-- job_checkins.action check constraint originally allowed only
-- 'arrived' / 'left' / 'note' (residential / staff-PIN flow).
-- Connect uses 'checkin' / 'checkout' — both were blocked, so the
-- connect-checkin and connect-checkout edge functions returned
-- generic 500s on the insert. Pattern matches the same residential-
-- vs-Connect schema gap as 065 (jobs.source) and 066 (business_id NOT NULL).

alter table public.job_checkins drop constraint if exists job_checkins_action_check;
alter table public.job_checkins add constraint job_checkins_action_check
  check (action = any (array['arrived','left','note','checkin','checkout']));
