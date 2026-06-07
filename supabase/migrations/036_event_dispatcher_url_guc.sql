-- 036_event_dispatcher_url_guc.sql
-- Cadi — make event-dispatcher URL configurable per environment.
--
-- The hardcoded production URL in 034.trigger_event_dispatcher would
-- send every job_events insert from a staging or restored-to-new-project
-- database back to the live event-dispatcher. Switch to a per-project GUC.
--
-- Set the value once per project with (substitute the real URL):
--   alter database postgres set app.event_dispatcher_url =
--     'https://<project-ref>.supabase.co/functions/v1/event-dispatcher';
-- The function reads it at call time via current_setting() and no-ops if unset.

create or replace function public.trigger_event_dispatcher()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  dispatcher_url text := current_setting('app.event_dispatcher_url', true);
begin
  if dispatcher_url is null or dispatcher_url = '' then
    return new;  -- no dispatcher configured for this environment
  end if;

  perform net.http_post(
    url     := dispatcher_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'job_events',
      'record', row_to_json(new)
    )
  );
  return new;
end;
$$;
