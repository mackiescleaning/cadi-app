-- 059_connect_marketplace_listing_expiry_cron.sql
--
-- Daily cron flips marketplace_listings from 'open' or 'bidding' to
-- 'closed' once (created_at + bid_window_hours) has passed. The matching
-- visit_spec is reset from 'marketplace' to 'unassigned' so the FM can
-- re-list or assign it manually.
--
-- Bid rows are intentionally left untouched: marketplace_bids has no
-- 'expired' status, and a listing in 'closed' status without an
-- awarded_to_user_id already communicates "no award happened".

select cron.unschedule('connect_expire_listings_daily')
  where exists (select 1 from cron.job where jobname = 'connect_expire_listings_daily');

select cron.schedule(
  'connect_expire_listings_daily',
  '45 3 * * *',
  $$
    with expired as (
      update public.marketplace_listings
      set status = 'closed',
          updated_at = now()
      where status in ('open','bidding')
        and deleted_at is null
        and created_at + (bid_window_hours * interval '1 hour') < now()
      returning id, visit_spec_id
    )
    update public.visit_specs vs
    set status = 'unassigned',
        updated_at = now()
    from expired e
    where vs.id = e.visit_spec_id
      and vs.status = 'marketplace'
      and vs.deleted_at is null;
  $$
);
