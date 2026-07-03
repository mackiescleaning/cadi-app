-- 082: Link money_entries to the invoice that created them.
--
-- Marking an invoice paid writes a mirror income row into money_entries
-- (InvoiceGenerator handleUpdate; MoneyTracker log-payment stuffs the invoice
-- id into quote_id). Aggregations that count BOTH paid invoices and money
-- entries (useYtdIncome, SA pack, VAT rolling turnover) were double-counting
-- income. This column lets read paths exclude invoice-linked entries wherever
-- invoices are already counted. Dashboard/MoneyTracker views that read ONLY
-- money_entries keep counting them — there the mirror IS the invoice income.

alter table public.money_entries
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create index if not exists money_entries_invoice_id_idx
  on public.money_entries (invoice_id) where invoice_id is not null;

-- Backfill pass 1: MoneyTracker's log-payment flow stored the invoice id in
-- quote_id. Where that id matches a real invoice of the same owner, adopt it.
update public.money_entries m
set    invoice_id = m.quote_id
where  m.invoice_id is null
  and  m.quote_id is not null
  and  exists (select 1 from public.invoices i where i.id = m.quote_id and i.owner_id = m.owner_id);

-- Backfill pass 2: heuristic pairing for mirrors written without any link —
-- same owner, income entry, amount equal to the invoice line total, dated
-- within a day of paid_at. Rank both sides within (owner, amount) by date and
-- pair rank-to-rank, so two same-amount invoices paid the same day each claim
-- exactly one mirror entry (1:1, never 1:N).
with paid as (
  select i.id, i.owner_id, i.paid_at::date as paid_date,
         (select coalesce(sum((coalesce((l->>'qty')::numeric, 1)) * coalesce((l->>'rate')::numeric, 0)), 0)
            from jsonb_array_elements(i.lines) l) as total
  from public.invoices i
  where i.status = 'paid' and i.paid_at is not null
),
inv_ranked as (
  select p.id, p.owner_id, p.total, p.paid_date,
         row_number() over (partition by p.owner_id, p.total order by p.paid_date, p.id) as rk
  from paid p
),
ent_ranked as (
  select m.id, m.owner_id, m.amount, m.date,
         row_number() over (partition by m.owner_id, m.amount order by m.date, m.id) as rk
  from public.money_entries m
  where m.kind = 'income' and m.invoice_id is null
)
update public.money_entries m
set    invoice_id = i.id
from   ent_ranked e
join   inv_ranked i
  on   i.owner_id = e.owner_id
 and   i.total    = e.amount
 and   i.rk       = e.rk
 and   e.date between i.paid_date - 1 and i.paid_date + 1
where  m.id = e.id and m.invoice_id is null;
