-- 092_connect_sub_write_guards.sql
-- P1 fix (FM/Connect audit): a subcontractor can bypass the Connect edge functions
-- and hit PostgREST directly to self-approve / over-bill, because the sub-UPDATE
-- RLS policies on connect_invoices and jobs have WITH CHECK clauses that only
-- verify `sub_user_id = auth.uid()`, not WHICH columns change. RLS can't do
-- column-level rules, so we add BEFORE UPDATE triggers.
--
-- The guards ONLY fire for an authenticated end-user (current_user = 'authenticated')
-- who is the row's own sub. Every legitimate sub action goes through an edge
-- function using the service_role key (current_user = 'service_role'), so those —
-- and FM / owner / migration writes — are unaffected.

-- ── connect_invoices ─────────────────────────────────────────────────────────
-- A sub may move their own invoice draft -> submitted and edit benign fields
-- (note / reference / service_date), but never approve/pay/export it or touch the
-- monetary, payment or ownership columns (those are set by the edge functions).
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
       or new.total_value        is distinct from old.total_value
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

drop trigger if exists guard_connect_invoice_sub_write on public.connect_invoices;
create trigger guard_connect_invoice_sub_write
  before update on public.connect_invoices
  for each row execute function public.guard_connect_invoice_sub_write();

-- ── jobs ─────────────────────────────────────────────────────────────────────
-- A contractor's job actions (check-in/out, resubmit) all run through the Connect
-- edge functions (service_role). A direct PostgREST update by the sub would bypass
-- approval/completion/pricing validation, so block it outright. The guard targets
-- the sub specifically; the owner (owner_id) and FM paths are unaffected.
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
     and (old.owner_id is null or old.owner_id <> auth.uid()) then
    raise exception 'Contractors update jobs through Cadi Connect actions, not directly'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_job_sub_write on public.jobs;
create trigger guard_job_sub_write
  before update on public.jobs
  for each row execute function public.guard_job_sub_write();
