-- 069_connect_recompute_scores_cron.sql
--
-- Daily cron at 03:30 UTC posts to the connect-recompute-scores edge
-- function. The function pulls 90 days of jobs / checkins / evidence /
-- messages per active sub and writes the new connect_score + breakdown.
--
-- Auth: function checks the x-event-dispatcher-secret header. Set both
-- sides to the same random string (once per project, then leave alone):
--
--   1. Function env (so the function can validate):
--        supabase secrets set EVENT_DISPATCHER_SECRET=<random>
--
--   2. Database GUC (so this cron can send it):
--        alter database postgres set app.event_dispatcher_secret = '<random>';
--
--   3. Function URL GUC (per environment — prod / staging differ):
--        alter database postgres set app.connect_recompute_url =
--          'https://<project-ref>.supabase.co/functions/v1/connect-recompute-scores';
--
-- The cron no-ops if either GUC is unset.

create or replace function public.connect_trigger_recompute_scores()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text := current_setting('app.connect_recompute_url',  true);
  secret text := current_setting('app.event_dispatcher_secret', true);
begin
  if fn_url is null or fn_url = '' then return; end if;
  if secret is null or secret = '' then return; end if;

  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
      'Content-Type',              'application/json',
      'x-event-dispatcher-secret', secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

select cron.unschedule('connect_recompute_scores_daily')
  where exists (select 1 from cron.job where jobname = 'connect_recompute_scores_daily');

select cron.schedule(
  'connect_recompute_scores_daily',
  '30 3 * * *',
  $$select public.connect_trigger_recompute_scores();$$
);
