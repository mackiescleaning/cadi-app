// src/hooks/useYtdIncome.js
// Cadi — unified YTD income loader
// Combines:
//   - Paid invoices (useInvoices context)
//   - Bank credits from Yapily (transactions where amount > 0, is_business = true)
//   - Manual income entries (money_entries kind='income')
//
// Bank credits matched to an invoice (via matched_invoice_id) are deduped against
// that invoice — we show the invoice only, marked as "Bank-confirmed".

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { currentTaxYear } from '../lib/taxYear';

async function resolveBusinessId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('businesses').select('id')
    .eq('owner_user_id', user.id).maybeSingle();
  return data?.id ?? null;
}

function getQuarterBounds(taxYear) {
  return {
    Q1: { start: `${taxYear}-04-06`,     end: `${taxYear}-07-05` },
    Q2: { start: `${taxYear}-07-06`,     end: `${taxYear}-10-05` },
    Q3: { start: `${taxYear}-10-06`,     end: `${taxYear + 1}-01-05` },
    Q4: { start: `${taxYear + 1}-01-06`, end: `${taxYear + 1}-04-05` },
  };
}

// Detect income source from merchant_name / description text patterns.
// Catches the major processors so users see "GoCardless · £450" not "GC PAYMENT 8FK2"
function detectSource(merchant, description) {
  const text = `${merchant ?? ''} ${description ?? ''}`.toLowerCase();
  if (/gocardless|gc\s*payment|direct\s*debit/.test(text)) return 'gocardless';
  if (/stripe|str\s*payment/.test(text))                   return 'stripe';
  if (/paypal/.test(text))                                  return 'paypal';
  if (/sumup|square|zettle|izettle|worldpay/.test(text))    return 'card_terminal';
  return 'bank';
}

export const SOURCE_DISPLAY = {
  invoice:       { label: 'Invoice',        icon: '🧾', color: '#1f48ff' },
  gocardless:    { label: 'GoCardless',     icon: '🏦', color: '#10b981' },
  stripe:        { label: 'Stripe',         icon: '💳', color: '#7c3aed' },
  paypal:        { label: 'PayPal',         icon: '💸', color: '#3b82f6' },
  card_terminal: { label: 'Card terminal',  icon: '📱', color: '#f59e0b' },
  bank:          { label: 'Bank deposit',   icon: '💰', color: '#06b6d4' },
  manual:        { label: 'Cash / manual',  icon: '💵', color: '#f43f5e' },
};

// Helper for caller: invoice → IncomeRow
function invoiceToRow(inv, total) {
  const paidDate = (inv.paidAt ?? inv.date ?? '').slice(0, 10);
  return {
    id:         `inv-${inv.id}`,
    date:       paidDate,
    amount:     total,
    source:     'invoice',
    label:      inv.customer?.name || inv.customer?.first_name || 'Customer',
    sublabel:   inv.num || '',
    invoiceId:  inv.id,
    confirmed:  false, // set true if matched bank credit exists
  };
}

export function useYtdIncome(taxYear = currentTaxYear(), paidInvoiceRows = []) {
  const [data, setData] = useState({
    ytdTotal: 0,
    byQuarter: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
    bySource: {},
    rows: [],
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const quarters = getQuarterBounds(taxYear);
        const ytdStart = quarters.Q1.start;
        const ytdEnd   = quarters.Q4.end;
        const businessId = await resolveBusinessId();
        if (!mounted) return;
        if (!businessId) { setData(d => ({ ...d, loading: false })); return; }

        const [bankRes, manualRes] = await Promise.all([
          // Bank credits — positive amounts, business-flagged
          supabase
            .from('transactions')
            .select('id,transaction_date,amount,description,merchant_name,matched_invoice_id,matched_customer_id')
            .eq('business_id', businessId)         // explicit — belts the RLS suspenders
            .gte('transaction_date', ytdStart)
            .lte('transaction_date', ytdEnd)
            .eq('is_business', true)
            .eq('is_hidden', false)
            .gt('amount', 0),
          // Manual income entries
          supabase
            .from('money_entries')
            .select('id,date,amount,client,category,notes')
            .eq('kind', 'income')
            .gte('date', ytdStart)
            .lte('date', ytdEnd),
        ]);

        if (!mounted) return;

        const bankRows = bankRes.data ?? [];
        const matchedInvoiceIds = new Set(bankRows.filter(b => b.matched_invoice_id).map(b => b.matched_invoice_id));

        // Build invoice rows — mark confirmed if a bank credit matched
        const invoiceRows = (paidInvoiceRows ?? [])
          .filter(inv => {
            const d = (inv.paidAt ?? '').slice(0, 10);
            return d >= ytdStart && d <= ytdEnd;
          })
          .map(inv => {
            const row = invoiceToRow(inv, inv._total ?? 0);
            row.confirmed = matchedInvoiceIds.has(inv.id);
            return row;
          });

        // Bank credit rows — skip matched ones (already counted as invoice income)
        const unmatchedBankRows = bankRows
          .filter(b => !b.matched_invoice_id)
          .map(b => {
            const source = detectSource(b.merchant_name, b.description);
            return {
              id:       `bk-${b.id}`,
              date:     b.transaction_date,
              amount:   Number(b.amount) || 0,
              source,
              label:    b.merchant_name || b.description || 'Bank deposit',
              sublabel: '',
            };
          });

        // Manual rows
        const manualRows = (manualRes.data ?? []).map(m => ({
          id:       `ma-${m.id}`,
          date:     m.date,
          amount:   Math.abs(Number(m.amount)) || 0,
          source:   'manual',
          label:    m.client || m.notes || 'Cash payment',
          sublabel: m.category || '',
        }));

        const rows = [...invoiceRows, ...unmatchedBankRows, ...manualRows]
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        // Aggregates
        const byQuarter = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
        const bySource  = {};
        let ytdTotal    = 0;
        for (const r of rows) {
          ytdTotal += r.amount;
          bySource[r.source] = (bySource[r.source] || 0) + r.amount;
          for (const [qKey, { start, end }] of Object.entries(quarters)) {
            if (r.date >= start && r.date <= end) { byQuarter[qKey] += r.amount; break; }
          }
        }

        setData({ ytdTotal, byQuarter, bySource, rows, loading: false });
      } catch (e) {
        console.error('useYtdIncome error:', e);
        if (mounted) setData(d => ({ ...d, loading: false }));
      }
    })();
    return () => { mounted = false; };
  }, [taxYear, paidInvoiceRows]);

  return data;
}
