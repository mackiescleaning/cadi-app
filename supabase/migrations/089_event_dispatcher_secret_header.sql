-- 089_event_dispatcher_secret_header.sql
-- Security audit (Tier 1.5 — AI agent authorization).
--
-- The event-dispatcher edge function is publicly callable with no auth and
-- writes agent_actions / fires review emails with the service role for whatever
-- business_id the caller supplies. The legitimate caller is this trigger, which
-- previously sent no secret. Add the shared x-event-dispatcher-secret header
-- (read from Vault, the same secret connect-recompute-scores already validates)
-- so the function can reject anything that isn't this trigger.
--
-- Reading Vault requires elevated rights, so the function becomes SECURITY
-- DEFINER (matching connect_trigger_recompute_scores). Triggers fire regardless
-- of EXECUTE grants, so direct EXECUTE is revoked as defence in depth.

create or replace function public.trigger_event_dispatcher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispatcher_url text := current_setting('app.event_dispatcher_url', true);
  secret text;
begin
  if dispatcher_url is null or dispatcher_url = '' then
    return new;  -- no dispatcher configured for this environment
  end if;

  select decrypted_secret into secret
    from vault.decrypted_secrets
   where name = 'event_dispatcher_secret'
   limit 1;

  perform net.http_post(
    url     := dispatcher_url,
    headers := jsonb_build_object(
      'Content-Type',              'application/json',
      'x-event-dispatcher-secret', coalesce(secret, '')
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'job_events',
      'record', row_to_json(new)
    )
  );
  return new;
end;
$$;

revoke execute on function public.trigger_event_dispatcher() from public, anon, authenticated;
