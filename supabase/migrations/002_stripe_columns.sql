-- 002_stripe_columns.sql
-- Adds Stripe subscription tracking columns to profiles.
-- The stripe-webhook function uses stripe_customer_id to find which profile
-- to update on subscription events, so that column needs a unique index.

alter table public.profiles
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_renews timestamptz;

-- No extra index on stripe_subscription_id — we don't look up by it.
-- (stripe_customer_id already indexed via the UNIQUE constraint.)
