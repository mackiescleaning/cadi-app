-- 050_customers_with_billing_view.sql
--
-- Adds billing-state context to the customers read path. Before this,
-- customer.lifetime_value tracked "revenue billed" (sum of completed-job
-- prices) but the Customer tab had no signal for "did they actually pay?"
--
-- The view exposes four derived fields:
--   • paid_lifetime_value  — sum of paid invoice line totals
--   • outstanding_balance  — sum of unpaid invoice line totals
--                            (status != draft|cancelled, paid_at IS NULL)
--   • unpaid_invoice_count
--   • oldest_unpaid_date   — earliest date of any unpaid invoice
--
-- The view writes nothing — upserts and updates continue to go through
-- the underlying customers table. listCustomers in customersDb.js is
-- being switched over to read from this view so the Customer tab sees
-- billing state on every render.
--
-- security_invoker = true: each user sees rows through their own RLS
-- permissions. Without this, the view would run as its creator and
-- bypass owner_id scoping.

create or replace view public.customers_with_billing
with (security_invoker = true) as
with invoice_agg as (
  -- Sum the per-line totals once per invoice. The lines jsonb shape is
  -- [{ total: number, ... }]. We use line.total ?? line.unit_price to
  -- match what invoiceDb.js audit code does for invoice totals — keeps
  -- the two sources of truth aligned.
  select
    i.customer_id,
    i.owner_id,
    i.status,
    i.paid_at,
    i.date,
    (
      select coalesce(sum(
        coalesce(
          (line->>'total')::numeric,
          (line->>'unit_price')::numeric,
          0
        )
      ), 0)
      from jsonb_array_elements(coalesce(i.lines, '[]'::jsonb)) as line
    ) as line_total
  from public.invoices i
  where i.customer_id is not null
),
per_customer as (
  select
    customer_id,
    coalesce(sum(line_total) filter (where paid_at is not null), 0) as paid_lifetime_value,
    coalesce(sum(line_total) filter (where paid_at is null and status not in ('draft','cancelled')), 0) as outstanding_balance,
    count(*) filter (where paid_at is null and status not in ('draft','cancelled')) as unpaid_invoice_count,
    min(date) filter (where paid_at is null and status not in ('draft','cancelled')) as oldest_unpaid_date
  from invoice_agg
  group by customer_id
)
select
  c.*,
  coalesce(p.paid_lifetime_value, 0)  as paid_lifetime_value,
  coalesce(p.outstanding_balance, 0)  as outstanding_balance,
  coalesce(p.unpaid_invoice_count, 0) as unpaid_invoice_count,
  p.oldest_unpaid_date                as oldest_unpaid_date
from public.customers c
left join per_customer p on p.customer_id = c.id;

comment on view public.customers_with_billing is
  'customers + per-customer billing aggregates (paid / outstanding / unpaid count). Read-only. Owner-scoped via underlying customers RLS.';

grant select on public.customers_with_billing to authenticated;
