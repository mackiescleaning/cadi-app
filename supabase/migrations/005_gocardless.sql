-- 005_gocardless.sql
-- GoCardless Partner integration columns

-- ── Profiles: GoCardless OAuth tokens ────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gc_access_token      text,
  ADD COLUMN IF NOT EXISTS gc_organisation_id   text,
  ADD COLUMN IF NOT EXISTS gc_connected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS gc_oauth_state       text,
  ADD COLUMN IF NOT EXISTS gc_webhook_secret    text;

-- ── Customers: GoCardless customer + mandate IDs ──────────────────────────────
-- Assumes a "customers" table exists (created in earlier migrations)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS gc_customer_id    text,
  ADD COLUMN IF NOT EXISTS gc_mandate_id     text,
  ADD COLUMN IF NOT EXISTS gc_mandate_status text; -- pending_customer_approval | active | cancelled | expired | failed

-- ── Money entries: track GoCardless payment IDs ───────────────────────────────
ALTER TABLE money_entries
  ADD COLUMN IF NOT EXISTS gc_payment_id     text,
  ADD COLUMN IF NOT EXISTS gc_payment_status text; -- pending_submission | submitted | confirmed | paid_out | failed | cancelled
