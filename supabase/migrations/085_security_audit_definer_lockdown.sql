-- 085_security_audit_definer_lockdown.sql
-- Security audit (Tier 0, item 0.4 — SECURITY DEFINER functions).
--
-- Three low-severity hardening fixes found while auditing definer functions.
-- No data-leak holes existed; these close abuse/escalation surface and undo a
-- regression that migration 083 accidentally introduced.
--
-- NOTE ON REVOKES: these functions carried the blanket PUBLIC EXECUTE grant in
-- addition to explicit anon/authenticated grants. Postgres privileges are
-- additive, so revoking from anon alone leaves PUBLIC granting EXECUTE to every
-- role. Each revoke therefore targets PUBLIC, anon and authenticated, and keeps
-- service_role (edge functions) and the owner.

-- ── 1) connect_trigger_recompute_scores ──────────────────────────────────────
-- Reads a Vault secret and fires an authenticated http_post to an internal edge
-- function. Invoked only by the pg_cron job from migration 069 (runs as the job
-- owner, not via these grants). Exposing it to anon/authenticated let any caller
-- trigger the privileged dispatch directly (abuse / edge-function cost). Lock to
-- server-side callers only.
revoke execute on function public.connect_trigger_recompute_scores()
  from public, anon, authenticated;

-- ── 2) cleanup_expired_oauth_states ──────────────────────────────────────────
-- Maintenance function that deletes expired oauth_states rows. No client caller
-- exists; it runs server-side. Remove the client-reachable grants.
revoke execute on function public.cleanup_expired_oauth_states()
  from public, anon, authenticated;

-- ── 3) initialise_phase3_plan — restore migration 034 hardening ──────────────
-- Migration 034 pinned search_path and revoked the authenticated grant ("No
-- client or edge-function callers exist"). Migration 083 reworked the body to
-- two steps but used CREATE OR REPLACE without SET search_path and re-added the
-- authenticated grant — regressing both. Re-pin the search_path here. Body is
-- kept exactly as migration 083 left it (fully schema-qualified, so an empty
-- search_path is safe). The unnecessary authenticated grant is handled by the
-- separate revoke below.
create or replace function public.initialise_phase3_plan(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.onboarding_steps (business_id, phase, step_key, status)
  values
    (p_business_id, 3, 'hire_sales_manager', 'available'),
    (p_business_id, 3, 'install_widget',     'available')
  on conflict (business_id, phase, step_key) do nothing;
end;
$$;

-- Undo the authenticated grant that migration 083 re-added. Without an ownership
-- check, EXECUTE-as-authenticated lets any logged-in user seed onboarding steps
-- into an arbitrary business_id. Migration 034 already established there are no
-- client/edge callers (invoked server-side during onboarding), so revoking is
-- safe and restores the documented posture.
revoke execute on function public.initialise_phase3_plan(uuid)
  from public, anon, authenticated;
