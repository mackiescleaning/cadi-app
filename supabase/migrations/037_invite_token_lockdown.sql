-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: lock down account_members invite token lookup
--
-- BEFORE: policy "invite_token_lookup" was `using (true)` — any anon user could
-- SELECT every pending invite token and accept any of them, gaining accountant
-- access to any business.
--
-- AFTER: anon can no longer SELECT account_members at all. Invite lookup and
-- acceptance go through the `invite-lookup` and `invite-accept` edge functions
-- which use the service role and sanitise the response.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "invite_token_lookup" ON public.account_members;

-- Belt-and-braces: explicitly revoke from anon. (RLS already blocks but this
-- prevents future policies from accidentally exposing the table to anon.)
REVOKE SELECT ON public.account_members FROM anon;
