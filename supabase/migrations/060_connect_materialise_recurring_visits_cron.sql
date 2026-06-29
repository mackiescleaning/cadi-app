-- 060_connect_materialise_recurring_visits_cron.sql
--
-- Daily cron materialises the next jobs row for each ACTIVE recurring
-- visit_spec that has an assigned sub. Lookahead window is 30 days, so:
--   • weekly      → next visit always visible
--   • fortnightly → next visit always visible
--   • monthly     → materialised the day the previous visit completes
--   • quarterly   → materialised ~60 days into the cycle
--   • annual      → materialised ~335 days into the cycle
--
-- When the cron has been missed for several days (or there is no prior
-- jobs row at all for the spec), the next_date is clamped to today so
-- nothing falls into the past silently.
--
-- one_off is excluded — award-listing already creates the single jobs
-- row, and there is no "next" to materialise.
--
-- Idempotency: the NOT EXISTS guard prevents the same (visit_spec_id,
-- date) row being inserted twice. Safe to re-run.

select cron.unschedule('connect_materialise_recurring_visits_daily')
  where exists (select 1 from cron.job where jobname = 'connect_materialise_recurring_visits_daily');

select cron.schedule(
  'connect_materialise_recurring_visits_daily',
  '15 4 * * *',
  $$
    with last_per_spec as (
      select vs.id as spec_id,
             vs.frequency,
             coalesce(
               (select max(j.date) from public.jobs j
                  where j.visit_spec_id = vs.id and j.deleted_at is null),
               (current_date - interval '1 day')::date
             ) as last_date
      from public.visit_specs vs
      where vs.status = 'active'
        and vs.deleted_at is null
        and vs.frequency in ('weekly','fortnightly','monthly','quarterly','annual')
        and vs.assigned_sub_user_id is not null
    ),
    spec_next as (
      select lps.spec_id,
             greatest(
               (lps.last_date + case lps.frequency
                  when 'weekly'      then interval '7 days'
                  when 'fortnightly' then interval '14 days'
                  when 'monthly'     then interval '1 month'
                  when 'quarterly'   then interval '3 months'
                  when 'annual'      then interval '1 year'
                end)::date,
               current_date
             ) as next_date
      from last_per_spec lps
    )
    insert into public.jobs (
      owner_id, fm_organisation_id, site_id, contract_id, visit_spec_id, sub_user_id,
      customer, postcode, date, start_hour, duration_hrs, type, service, price, status, source
    )
    select
      vs.assigned_sub_user_id,
      vs.fm_organisation_id,
      vs.site_id,
      vs.contract_id,
      vs.id,
      vs.assigned_sub_user_id,
      '',
      '',
      sn.next_date,
      9,
      coalesce(vs.duration_minutes / 60.0, 3),
      'commercial',
      vs.scope,
      vs.price_per_visit,
      'scheduled',
      'connect_recurring'
    from spec_next sn
    join public.visit_specs vs on vs.id = sn.spec_id
    where sn.next_date <= (current_date + interval '30 days')::date
      and not exists (
        select 1 from public.jobs j
        where j.visit_spec_id = sn.spec_id
          and j.date = sn.next_date
          and j.deleted_at is null
      );
  $$
);
