-- 061_checkout_customer_presence.sql
--
-- Connect — capture site-contact / customer presence at check-out.
--
-- GPS check-in already proves the sub was on-site, and the existing
-- job_evidence table holds the photo evidence captured in the checkout
-- modal. The one thing neither covers is whether a customer or site
-- contact was actually present to witness the work. That's what these
-- two columns capture, on the checkout row of job_checkins.
--
-- Both columns are nullable so historical rows (and check-in rows,
-- which never capture this) remain valid.

alter table public.job_checkins
  add column if not exists customer_on_site boolean,
  add column if not exists customer_name    text;
