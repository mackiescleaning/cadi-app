-- 081_customers_business_id_backfill.sql
-- Every customers row had business_id NULL: the app's upsertCustomer only
-- sets owner_id, and unlike jobs (migration 016) customers were never
-- backfilled. RLS on customers is owner_id-based so nothing noticed — until
-- crm-sales-plan (migration 080) needed customer.business_id to stamp the
-- CRM rows it creates.
--
-- 1. Backfill from businesses (1:1 with owners via owner_user_id).
-- 2. Trigger keeps it filled for every future insert/update, whatever the
--    write path (app upsert, CSV import, edge function).

update customers c
set business_id = b.id
from businesses b
where b.owner_user_id = c.owner_id
  and c.business_id is null;

create or replace function customers_default_business_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.business_id is null and new.owner_id is not null then
    select id into new.business_id
    from businesses
    where owner_user_id = new.owner_id;
  end if;
  return new;
end;
$$;

-- SECURITY DEFINER because account members (accountants/staff) can insert
-- customers without SELECT rights on the owner's businesses row. Lock it
-- down the same way as the other definer helpers (migration 034).
revoke all on function customers_default_business_id() from public;

drop trigger if exists customers_default_business_id_trg on customers;
create trigger customers_default_business_id_trg
  before insert or update of owner_id, business_id on customers
  for each row execute function customers_default_business_id();
