-- 054_connect_sub_invitations_expiry_cron.sql
--
-- Daily cron flips sub_invitations from `pending` to `expired` once
-- expires_at has passed. Inline SQL — no need to hop through an edge
-- function with stored secrets. The expire-sub-invitations edge
-- function still exists for ad-hoc manual runs.

select cron.unschedule('connect_expire_invites_daily')
  where exists (select 1 from cron.job where jobname = 'connect_expire_invites_daily');

select cron.schedule(
  'connect_expire_invites_daily',
  '30 3 * * *',
  $$
    update public.sub_invitations
    set status = 'expired'
    where status = 'pending'
      and expires_at < now();
  $$
);
