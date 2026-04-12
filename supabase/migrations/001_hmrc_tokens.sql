-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: HMRC MTD ITSA token storage
-- Run in Supabase Dashboard → SQL Editor
--
-- Adds HMRC OAuth token columns to the existing `profiles` table
-- and creates the `hmrc_submissions` audit table.
--
-- Safe to run multiple times (all changes use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add HMRC columns to profiles ──────────────────────────────────────────
-- These are deliberately NOT exposed through normal SELECT * — store them
-- in the profiles table so the service-role Edge Function owns them exclusively.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hmrc_access_token     text,
  ADD COLUMN IF NOT EXISTS hmrc_refresh_token    text,
  ADD COLUMN IF NOT EXISTS hmrc_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS hmrc_scope            text,
  ADD COLUMN IF NOT EXISTS hmrc_connected_at     timestamptz,
  ADD COLUMN IF NOT EXISTS hmrc_oauth_state      text,   -- ephemeral CSRF state
  ADD COLUMN IF NOT EXISTS hmrc_nino             text;   -- National Insurance Number

-- ── 2. RLS: hide HMRC token columns from anon / authenticated roles ───────────
-- The tokens are written/read exclusively via the hmrc-auth Edge Function using
-- the SERVICE_ROLE key — which bypasses RLS entirely. The policies below ensure
-- that even a logged-in user cannot SELECT their own raw tokens through the
-- PostgREST API or the client SDK.

-- Revoke column-level access on the sensitive columns so they are never returned
-- in a normal `select *` from the client.  (Belt-and-braces on top of RLS.)
REVOKE SELECT (
  hmrc_access_token,
  hmrc_refresh_token,
  hmrc_token_expires_at,
  hmrc_oauth_state
) ON public.profiles FROM authenticated, anon;

-- Users can still read their own non-sensitive HMRC status columns:
GRANT SELECT (
  hmrc_scope,
  hmrc_connected_at,
  hmrc_nino
) ON public.profiles TO authenticated;

-- ── 3. hmrc_submissions audit table ──────────────────────────────────────────
-- Every successful quarter submission is logged here. This gives the user a
-- full audit trail and lets the app show "submitted on …" badges without
-- hitting the HMRC API again.

CREATE TABLE IF NOT EXISTS public.hmrc_submissions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Period this submission covers (HMRC quarterly period dates)
  period_start  date        NOT NULL,
  period_end    date        NOT NULL,

  -- Summary figures (pence stored as numeric for precision)
  income        numeric     NOT NULL DEFAULT 0,
  expenses      numeric     NOT NULL DEFAULT 0,

  -- Raw HMRC response (periodId, links, etc.)
  hmrc_response jsonb,

  submitted_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for "show me all submissions for this user, newest first"
CREATE INDEX IF NOT EXISTS hmrc_submissions_owner_id_idx
  ON public.hmrc_submissions (owner_id, submitted_at DESC);

-- RLS on hmrc_submissions
ALTER TABLE public.hmrc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner can read own submissions" ON public.hmrc_submissions;
CREATE POLICY "owner can read own submissions"
  ON public.hmrc_submissions
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- No INSERT/UPDATE/DELETE for authenticated — only the service-role Edge Function
-- can write submissions.

-- ── 4. RLS on profiles: ensure existing policies still hold ──────────────────
-- (Profiles RLS should already be enabled from schema.sql — this just makes sure)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile row (non-sensitive columns work fine)
DROP POLICY IF EXISTS "users can read own profile" ON public.profiles;
CREATE POLICY "users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow users to update their own profile (non-token fields)
DROP POLICY IF EXISTS "users can update own profile" ON public.profiles;
CREATE POLICY "users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- ── 5. Helper view: HMRC connection status (safe to expose) ──────────────────
CREATE OR REPLACE VIEW public.hmrc_status AS
  SELECT
    id,
    hmrc_connected_at  IS NOT NULL                     AS connected,
    hmrc_connected_at,
    hmrc_scope,
    hmrc_nino          IS NOT NULL                     AS has_nino,
    hmrc_nino,
    hmrc_token_expires_at < now()                      AS token_expired,
    hmrc_token_expires_at
  FROM public.profiles;

-- Grant the authenticated role read access to this view
GRANT SELECT ON public.hmrc_status TO authenticated;

-- Attach RLS via the underlying table (the view respects the profiles policies)
