-- 068_jobs_completion_method_extend_for_connect.sql
--
-- jobs.completion_method only listed residential values. connect-checkout
-- writes 'geo_fence' to indicate GPS-verified on-site completion. The
-- existing check constraint rejected it, the insert errored, and the
-- function returned 500.
--
-- Same residential-vs-Connect schema-extension pattern as 065 / 067.

alter table public.jobs drop constraint if exists jobs_completion_method_check;
alter table public.jobs add constraint jobs_completion_method_check
  check (completion_method = any (array[
    'staff_checkin','payment_matched','recurring_renewal','review_received',
    'no_exceptions','manual','auto_timeout',
    'geo_fence'
  ]));
