-- 051_jobs_status_align_with_app.sql
--
-- The jobs.status CHECK constraint was rejecting 'complete' (the value the
-- whole app writes) because the constraint expected 'completed' (with the
-- trailing 'd'). Every "Done" tap from the Scheduler errored with 400.
-- The constraint also didn't include 'unassigned', which NewJobModal sets
-- when a job is created without an assignee.
--
-- Fix: widen the CHECK to accept both spellings of complete + the values
-- the app actually uses. We keep 'completed' in the allowed set so any
-- legacy rows that happen to be in that state remain valid.

alter table public.jobs drop constraint if exists jobs_status_check;

alter table public.jobs add constraint jobs_status_check
  check (status = any (array[
    'scheduled'::text,
    'in_progress'::text,
    'complete'::text,
    'completed'::text,
    'cancelled'::text,
    'unassigned'::text,
    'pending_confirmation'::text,
    'no_show'::text,
    'rescheduled'::text
  ]));
