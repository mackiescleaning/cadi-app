-- 086_security_audit_advisor_cleanup.sql
-- Security audit (Tier 0, item 0.5 — Supabase Security Advisor triage).
-- Advisor returned 0 errors, 22 warnings. This migration fixes the actionable
-- ones; the rest are consciously accepted (see the audit doc / commit message):
-- the "authenticated can execute" lints on RLS helpers (my_business_id,
-- is_active_member, is_full_access_member, current_user_fm_org) and internally
-- authorised RPCs (vault_read/write, initialise_phase2_plan,
-- upsert_my_leaderboard_entry) are by design. Leaked-password protection is an
-- Auth dashboard setting handled under item 0.9.

-- ── 1) Pin search_path on 7 SECURITY INVOKER trigger functions ────────────────
-- All verified safe for an empty search_path: they use only pg_catalog builtins
-- (now(), current_setting, casts) or already schema-qualify extension calls
-- (hash_team_member_pin uses extensions.crypt / extensions.gen_salt). Clears the
-- function_search_path_mutable warnings and hardens the two security-relevant
-- triggers (enforce_profile_protected_columns, hash_team_member_pin).
alter function public._tg_set_updated_at()                set search_path = '';
alter function public.touch_recurring_jobs_updated_at()   set search_path = '';
alter function public.customers_track_archive()           set search_path = '';
alter function public.team_members_track_leave()          set search_path = '';
alter function public.annual_reviews_lock_snapshot()      set search_path = '';
alter function public.enforce_profile_protected_columns() set search_path = '';
alter function public.hash_team_member_pin()              set search_path = '';

-- ── 2) Revoke anon EXECUTE on the customer-vault RPCs ─────────────────────────
-- vault_read/vault_write already reject anon internally (auth.uid() null check),
-- but anon has no business reaching these endpoints. Revoke PUBLIC + anon, then
-- re-assert the authenticated grant (the legitimate caller) so it is retained
-- regardless of how EXECUTE was previously granted.
revoke execute on function public.vault_read(uuid) from public, anon;
grant  execute on function public.vault_read(uuid) to authenticated;

revoke execute on function public.vault_write(uuid, text, text, text, text) from public, anon;
grant  execute on function public.vault_write(uuid, text, text, text, text) to authenticated;

-- ── 3) Revoke direct grants on a pure trigger function ────────────────────────
-- customers_default_business_id is only ever invoked as a BEFORE INSERT trigger,
-- which fires independently of the caller's EXECUTE privilege. No role needs to
-- call it directly.
revoke execute on function public.customers_default_business_id() from public, anon, authenticated;
