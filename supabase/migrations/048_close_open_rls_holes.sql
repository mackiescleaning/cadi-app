-- 048_close_open_rls_holes.sql
--
-- Closes three RLS policies that used `USING (true)` (or equivalently
-- permissive predicates) and therefore made every row in three sensitive
-- tables readable by ANY authenticated user — not just the owning
-- business. Audit findings 2026-06-23.
--
-- Tables affected:
--   • reviews                 — customer reviews + ratings
--   • customer_portal_tokens  — auth tokens for the customer portal
--   • job_checkins            — staff arrival/checkout records
--
-- Each table keeps its owner-scoped policy (`*_business_all`,
-- `job_checkins_owner`) which restricts owners to their own rows.
--
-- Public-token access (e.g. a customer following a /review/<token> link
-- without signing in) is intentionally NOT preserved by an RLS policy.
-- The correct pattern when we need it is a `SECURITY DEFINER` RPC that
-- accepts the token, looks up the row server-side, and returns it only
-- on match — never a `USING (true)` blanket SELECT. None of the current
-- client code uses these as public reads, and all edge functions run
-- with the service-role key (which bypasses RLS), so this drop is safe.

drop policy if exists reviews_public_token_select         on public.reviews;
drop policy if exists portal_tokens_public_token_select   on public.customer_portal_tokens;
drop policy if exists job_checkins_public_token_read      on public.job_checkins;
