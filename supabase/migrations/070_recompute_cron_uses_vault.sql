-- 070_recompute_cron_uses_vault.sql
--
-- Follow-up to 069. The GUC-based setup needed ALTER DATABASE rights,
-- which the Supabase MCP service role doesn't have. Switch to Vault
-- (Supabase's first-class secret store) which is writable by the same
-- role we already use for migrations.
--
-- One-time setup (already done):
--   select vault.create_secret(
--     '<random-secret>', 'event_dispatcher_secret',
--     'Shared secret matching EVENT_DISPATCHER_SECRET on edge functions'
--   );
-- and on the function side:
--   supabase secrets set EVENT_DISPATCHER_SECRET=<same-random-secret>
--
-- URL is hardcoded — it's project-specific but not secret. Staging /
-- restored projects would need their own copy of this function with
-- their URL.

create or replace function public.connect_trigger_recompute_scores()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url constant text := 'https://cufgozpwbinjhjnkimmn.supabase.co/functions/v1/connect-recompute-scores';
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'event_dispatcher_secret'
  limit 1;

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
