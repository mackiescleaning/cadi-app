-- 078_customers_archived_at.sql
-- Track WHEN a customer was archived so the Annual Review §3 Customer
-- Story can measure period churn (customers lost during the year).
--
-- Prior to this migration archive was a one-way status flag with no
-- timestamp. Existing archived rows are backfilled from updated_at as a
-- best-effort — new archive/un-archive transitions get an accurate stamp
-- via the trigger below.

alter table customers
  add column if not exists archived_at timestamptz;

-- Backfill: any existing archived rows use updated_at as their archive
-- stamp. This is approximate but the best signal we have.
update customers
   set archived_at = updated_at
 where status = 'archived' and archived_at is null;

-- Stamp / clear archived_at automatically on status changes. Un-archive
-- clears it so future re-archives get a fresh stamp.
create or replace function customers_track_archive()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'archived' and (old.status is null or old.status <> 'archived') then
    new.archived_at := now();
  elsif new.status <> 'archived' and old.status = 'archived' then
    new.archived_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_track_archive_trg on customers;
create trigger customers_track_archive_trg
  before update on customers
  for each row execute function customers_track_archive();

comment on column customers.archived_at is
  'Set automatically when status flips to archived; cleared on un-archive.';
