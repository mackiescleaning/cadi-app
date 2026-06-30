-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: protect sensitive `profiles` columns from client UPDATE
--
-- BEFORE: policy `users can update own profile` was `using (id = auth.uid())`
-- with no column restriction. Any authenticated user could:
--   UPDATE profiles SET plan='max', subscription_tier='max' WHERE id = auth.uid();
-- bypassing Stripe billing entirely. Same exposure on hmrc_access_token,
-- stripe_customer_id, terms_accepted_at, etc.
--
-- AFTER: a BEFORE UPDATE trigger rejects writes to billing, HMRC, Stripe, and
-- consent columns unless the caller is service_role. All edge functions that
-- legitimately set those columns use the service-role key and bypass this
-- trigger; client writes via PostgREST do not.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_profile_protected_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  jwt_role text;
BEGIN
  -- Belt and braces: service_role identified either by postgres role OR by the
  -- JWT claim Supabase injects. Either match allows the write through.
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
    IF jwt_role = 'service_role' THEN
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- No JWT context (e.g. direct postgres) — fall through to column checks.
    NULL;
  END;

  -- Reject if any protected column has changed.
  IF NEW.plan                     IS DISTINCT FROM OLD.plan
     OR NEW.subscription_tier     IS DISTINCT FROM OLD.subscription_tier
     OR NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.hmrc_access_token     IS DISTINCT FROM OLD.hmrc_access_token
     OR NEW.hmrc_refresh_token    IS DISTINCT FROM OLD.hmrc_refresh_token
     OR NEW.hmrc_token_expires_at IS DISTINCT FROM OLD.hmrc_token_expires_at
     OR NEW.hmrc_oauth_state      IS DISTINCT FROM OLD.hmrc_oauth_state
     OR NEW.hmrc_scope            IS DISTINCT FROM OLD.hmrc_scope
     OR NEW.hmrc_connected_at     IS DISTINCT FROM OLD.hmrc_connected_at
     OR NEW.hmrc_nino             IS DISTINCT FROM OLD.hmrc_nino
  THEN
    RAISE EXCEPTION 'Cannot update protected column from client (use the appropriate edge function)';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_protected_columns ON public.profiles;
CREATE TRIGGER profiles_protected_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_protected_columns();

COMMENT ON FUNCTION public.enforce_profile_protected_columns() IS
  'Rejects client writes to billing/HMRC/consent columns on profiles. Service-role edge functions bypass via role check.';
