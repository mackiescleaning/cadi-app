-- 047_billing_mode_bacs_cash.sql
-- Widens the customers.billing_mode CHECK constraint to include 'bacs'
-- (UK bank transfer — manual, owner marks paid when it lands) and 'cash'
-- (paid on the day — receipt drafted for records). Pairs with the new
-- options in src/lib/billing.js BILLING_MODES.

alter table public.customers
  drop constraint if exists customers_billing_mode_check;

alter table public.customers
  add constraint customers_billing_mode_check
  check (billing_mode = any (array[
    'invoice_per_job'::text,
    'invoice_monthly'::text,
    'gocardless'::text,
    'stripe'::text,
    'bacs'::text,
    'cash'::text
  ]));
