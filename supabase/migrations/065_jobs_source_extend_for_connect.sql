-- 065_jobs_source_extend_for_connect.sql
--
-- The jobs.source check constraint was originally written for the
-- residential side and only allowed 'direct' / 'fm_dispatched' / 'import'.
-- The Connect work added two new sources that were never reflected in
-- the constraint:
--
--   • 'marketplace' — set by the award-listing edge function when an
--     FM awards a bid (Phase 6, never fired in prod yet because no
--     listing has been awarded).
--   • 'connect_recurring' — set by the daily materialisation cron
--     introduced in migration 060 (would have failed silently on first
--     fire — the cron's UPDATE returned zero rows because the INSERT
--     errored on the constraint, but pg_cron swallowed it).
--
-- Both code paths would have errored the first time they ran. Adding
-- the missing values, plus 'connect_seed' for manual seeding during
-- testing (e.g. inserting a job for an assigned spec without waiting
-- for the cron).

alter table public.jobs drop constraint if exists jobs_source_check;
alter table public.jobs add constraint jobs_source_check
  check (source = any (array[
    'direct', 'fm_dispatched', 'import',
    'marketplace', 'connect_recurring', 'connect_seed'
  ]));
