-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: atomic Yapily callback + one-active-per-business enforcement
--
-- BEFORE: yapily-auth callback did deactivate-old + insert-new across multiple
-- non-transactional statements. Two parallel callbacks (e.g. user opens two
-- tabs after the OAuth redirect) could leave two `is_active=true` rows for the
-- same business, breaking the "one connection at a time" assumption everywhere
-- downstream.
--
-- AFTER:
--   1. One-shot cleanup of any existing duplicate active rows (keeps the
--      newest connected_at row per business, marks the rest is_active=false).
--   2. Partial unique index enforces one active row per business going forward.
--   3. swap_active_bank_connection() RPC does the deactivate+insert atomically
--      under a row lock, returning the list of old consent_ids the edge
--      function should revoke at Yapily.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Defensive cleanup of any duplicate active rows ───────────────────────
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY connected_at DESC, id DESC) AS rn
  FROM   public.bank_connections
  WHERE  is_active = true
)
UPDATE public.bank_connections
   SET is_active       = false,
       disconnected_at = now()
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── 2. Partial unique index — one active connection per business ─────────────
CREATE UNIQUE INDEX IF NOT EXISTS bank_connections_one_active_per_business
  ON public.bank_connections (business_id)
  WHERE is_active = true;

-- ── 3. Atomic swap RPC ──────────────────────────────────────────────────────
-- Returns array of yapily_consent_ids that the caller should revoke at Yapily
-- (the DB write is atomic; revoking the old consents at Yapily is fire-and-
-- forget after the RPC succeeds).

CREATE OR REPLACE FUNCTION public.swap_active_bank_connection(
  p_business_id        uuid,
  p_new_connection     jsonb
) RETURNS TABLE(new_connection_id uuid, old_consent_ids text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_old    text[];
BEGIN
  -- Lock the business row (or any deterministic per-business marker) so two
  -- concurrent callbacks for the same business serialise here.
  PERFORM 1
    FROM businesses
   WHERE id = p_business_id
   FOR UPDATE;

  -- Collect old consent ids before deactivating them.
  SELECT COALESCE(array_agg(yapily_consent_id) FILTER (WHERE yapily_consent_id IS NOT NULL), ARRAY[]::text[])
    INTO v_old
    FROM bank_connections
   WHERE business_id = p_business_id
     AND is_active   = true;

  -- Deactivate previous active rows.
  UPDATE bank_connections
     SET is_active       = false,
         disconnected_at = now(),
         access_token    = NULL
   WHERE business_id = p_business_id
     AND is_active   = true;

  -- Insert the new active row from the jsonb payload.
  INSERT INTO bank_connections (
    business_id, provider, truelayer_account_id, bank_name, account_name,
    account_last_4, access_token, refresh_token, token_expires_at,
    yapily_consent_id, consent_expires_at, needs_reauth, sync_error,
    sync_error_code, is_active, connected_at
  ) VALUES (
    p_business_id,
    'yapily',
    p_new_connection->>'truelayer_account_id',
    p_new_connection->>'bank_name',
    p_new_connection->>'account_name',
    p_new_connection->>'account_last_4',
    p_new_connection->>'access_token',
    NULL,
    NULL,
    p_new_connection->>'yapily_consent_id',
    (p_new_connection->>'consent_expires_at')::timestamptz,
    false,
    NULL,
    NULL,
    true,
    now()
  )
  RETURNING id INTO v_new_id;

  new_connection_id := v_new_id;
  old_consent_ids   := v_old;
  RETURN NEXT;
END $$;

REVOKE EXECUTE ON FUNCTION public.swap_active_bank_connection(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.swap_active_bank_connection(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.swap_active_bank_connection(uuid, jsonb) IS
  'Atomically deactivates existing active bank_connections for a business and inserts a new active row. Returns the new id and the old consent_ids the caller should revoke at Yapily.';
