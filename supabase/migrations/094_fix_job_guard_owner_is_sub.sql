-- 094_fix_job_guard_owner_is_sub.sql
-- Fix for 092's guard_job_sub_write. Two problems:
--   1. It excluded rows where owner_id = auth.uid() — but on a Connect job the
--      subcontractor IS the owner (owner_id = sub_user_id), so the guard skipped
--      exactly the jobs it was meant to protect: a sub could self-approve.
--   2. Blocking ALL of the sub's updates is wrong anyway — that same person edits
--      the job as the cleaner-owner in their normal scheduler (date, notes, etc.).
-- Fix: make it column-level like the invoice guard. On a Connect job (fm_org set)
-- the sub/owner may edit benign fields, but never approval, pricing or assignment
-- columns (those are driven by the FM via the connect-* edge functions). jobs has
-- no generated columns, so direct NEW/OLD comparison is safe here.
create or replace function public.guard_job_sub_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and auth.uid() is not null
     and auth.uid() = old.sub_user_id
     and old.fm_organisation_id is not null then
    if new.approval_status        is distinct from old.approval_status
       or new.approved_by_user_id is distinct from old.approved_by_user_id
       or new.approved_at         is distinct from old.approved_at
       or new.rejection_note      is distinct from old.rejection_note
       or new.query_note          is distinct from old.query_note
       or new.price               is distinct from old.price
       or new.margin              is distinct from old.margin
       or new.labour_cost         is distinct from old.labour_cost
       or new.deposit_paid        is distinct from old.deposit_paid
       or new.deposit_paid_at     is distinct from old.deposit_paid_at
       or new.pricing_rule_id     is distinct from old.pricing_rule_id
       or new.pricing_rule_version is distinct from old.pricing_rule_version
       or new.pricing_breakdown   is distinct from old.pricing_breakdown
       or new.pricing_confidence  is distinct from old.pricing_confidence
       or new.fm_organisation_id  is distinct from old.fm_organisation_id
       or new.sub_user_id         is distinct from old.sub_user_id
       or new.contract_id         is distinct from old.contract_id
       or new.listing_id          is distinct from old.listing_id
       or new.visit_spec_id       is distinct from old.visit_spec_id then
      raise exception 'Contractors cannot change approval, pricing or assignment fields on a Connect job'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
