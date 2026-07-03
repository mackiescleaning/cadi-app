-- 065_connect_invoice_lines.sql
--
-- Multi-job invoicing on the Connect sub side. Each invoice can now
-- contain many line items — typically one per cleaned site/visit, so a
-- contractor working across 5 Britannia sites in a week sends ONE
-- invoice with 5 lines rather than 5 separate invoices.
--
-- Schema:
--   • new connect_invoice_lines (invoice → many job lines)
--   • connect_invoices.job_id becomes nullable (a merged invoice has no
--     single job; the lines carry the job_ids instead)
--   • backfill: each existing connect_invoices row gets one line copied
--     from its current job_id / net_value / vat_value
--
-- RLS:
--   • sub: RW on lines where the parent invoice belongs to them
--   • FM:  R   on lines where the parent invoice's org matches them

create table if not exists public.connect_invoice_lines (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.connect_invoices(id) on delete cascade,
  job_id          uuid references public.jobs(id) on delete set null,
  description     text not null,
  service_date    date,
  net_value       numeric not null default 0,
  vat_value       numeric not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_invoice_lines_invoice
  on public.connect_invoice_lines (invoice_id);
create index if not exists idx_invoice_lines_job
  on public.connect_invoice_lines (job_id) where job_id is not null;

alter table public.connect_invoice_lines enable row level security;

-- Sub RW — parent invoice belongs to them. We further restrict update/delete
-- to draft parents only so submitted/exported invoices freeze their lines.
drop policy if exists invoice_lines_sub_select on public.connect_invoice_lines;
create policy invoice_lines_sub_select on public.connect_invoice_lines
  for select using (
    exists (
      select 1 from public.connect_invoices ci
      where ci.id = connect_invoice_lines.invoice_id
        and ci.sub_user_id = auth.uid()
    )
  );

drop policy if exists invoice_lines_sub_insert on public.connect_invoice_lines;
create policy invoice_lines_sub_insert on public.connect_invoice_lines
  for insert with check (
    exists (
      select 1 from public.connect_invoices ci
      where ci.id = connect_invoice_lines.invoice_id
        and ci.sub_user_id = auth.uid()
        and ci.status = 'draft'
    )
  );

drop policy if exists invoice_lines_sub_update on public.connect_invoice_lines;
create policy invoice_lines_sub_update on public.connect_invoice_lines
  for update using (
    exists (
      select 1 from public.connect_invoices ci
      where ci.id = connect_invoice_lines.invoice_id
        and ci.sub_user_id = auth.uid()
        and ci.status = 'draft'
    )
  );

drop policy if exists invoice_lines_sub_delete on public.connect_invoice_lines;
create policy invoice_lines_sub_delete on public.connect_invoice_lines
  for delete using (
    exists (
      select 1 from public.connect_invoices ci
      where ci.id = connect_invoice_lines.invoice_id
        and ci.sub_user_id = auth.uid()
        and ci.status = 'draft'
    )
  );

-- FM read-only on lines from invoices in their org
drop policy if exists invoice_lines_fm_select on public.connect_invoice_lines;
create policy invoice_lines_fm_select on public.connect_invoice_lines
  for select using (
    exists (
      select 1 from public.connect_invoices ci
      join public.profiles p on p.fm_organisation_id = ci.fm_organisation_id
      where ci.id = connect_invoice_lines.invoice_id
        and p.id = auth.uid()
    )
  );

-- Loosen job_id on parent — merged invoices have no single source job
alter table public.connect_invoices
  alter column job_id drop not null;

-- Backfill: one line per existing invoice. Description = "{site name} · {date}",
-- net/vat copied straight from the parent.
insert into public.connect_invoice_lines (invoice_id, job_id, description, service_date, net_value, vat_value, created_at)
select
  ci.id,
  ci.job_id,
  coalesce(s.name, 'Cleaning service') ||
    case when ci.service_date is not null
         then ' · ' || to_char(ci.service_date, 'DD Mon YYYY')
         else '' end,
  ci.service_date,
  ci.net_value,
  ci.vat_value,
  ci.created_at
from public.connect_invoices ci
left join public.jobs j  on j.id = ci.job_id
left join public.sites s on s.id = j.site_id
where not exists (
  select 1 from public.connect_invoice_lines il
  where il.invoice_id = ci.id
);

-- Add a 'void' status as a valid value if check constraint exists
-- (used by merge to retire source invoices). Permissive: if the check
-- already includes 'void' or there's no constraint, this is a no-op.
do $$
declare
  consrc text;
begin
  select pg_get_constraintdef(c.oid) into consrc
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'connect_invoices' and c.conname = 'connect_invoices_status_check';
  if consrc is not null and consrc not like '%void%' then
    alter table public.connect_invoices drop constraint connect_invoices_status_check;
    alter table public.connect_invoices add constraint connect_invoices_status_check
      check (status = any (array['draft','submitted','exported','paid','disputed','void']));
  end if;
end$$;
