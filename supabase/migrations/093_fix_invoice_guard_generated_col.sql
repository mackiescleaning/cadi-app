-- 093_fix_invoice_guard_generated_col.sql
-- Fix for 092: guard_connect_invoice_sub_write compared new.total_value against
-- old.total_value, but total_value is a GENERATED column — in a BEFORE UPDATE
-- trigger its NEW value isn't computed yet (reads NULL), so the comparison was
-- always "changed" and blocked EVERY sub update, including the legitimate
-- draft->submitted / note edit. total_value is derived from net_value + vat_value
-- (both already checked), so we simply drop it from the comparison.
create or replace function public.guard_connect_invoice_sub_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and auth.uid() is not null
     and auth.uid() = old.sub_user_id then
    if new.status is distinct from old.status
       and not (old.status = 'draft' and new.status in ('draft','submitted')) then
      raise exception 'Contractors cannot set invoice status to "%"', new.status
        using errcode = '42501';
    end if;
    if new.net_value             is distinct from old.net_value
       or new.vat_value          is distinct from old.vat_value
       or new.paid_at            is distinct from old.paid_at
       or new.paid_marked_by_user_id is distinct from old.paid_marked_by_user_id
       or new.exported_at        is distinct from old.exported_at
       or new.exported_in_export_id is distinct from old.exported_in_export_id
       or new.fm_organisation_id is distinct from old.fm_organisation_id
       or new.sub_user_id        is distinct from old.sub_user_id
       or new.job_id             is distinct from old.job_id then
      raise exception 'Contractors cannot change monetary, payment or ownership fields on an invoice'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
