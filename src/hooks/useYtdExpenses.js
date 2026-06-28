// src/hooks/useYtdExpenses.js
// Cadi — unified YTD expense loader
// Pulls from both `transactions` (Yapily bank-imported, is_business=true, amount<0)
// and `money_entries` (manual entries, kind='expense').
// Returns total, quarterly breakdown (UK tax quarters), and category breakdown.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { currentTaxYear } from '../lib/taxYear';

// Resolve current user's business_id once per hook invocation.
// Explicit client-side filter belts the RLS suspenders — if RLS ever
// regresses, queries still scope to this business and never leak others.
async function resolveBusinessId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('businesses').select('id')
    .eq('owner_user_id', user.id).maybeSingle();
  return data?.id ?? null;
}

// UK tax year quarter bounds for a given starting tax year
// e.g. taxYear=2026 → 2026/27 quarters Apr 2026 → Apr 2027
function getQuarterBounds(taxYear) {
  return {
    Q1: { start: `${taxYear}-04-06`,     end: `${taxYear}-07-05` },
    Q2: { start: `${taxYear}-07-06`,     end: `${taxYear}-10-05` },
    Q3: { start: `${taxYear}-10-06`,     end: `${taxYear + 1}-01-05` },
    Q4: { start: `${taxYear + 1}-01-06`, end: `${taxYear + 1}-04-05` },
  };
}

// Map our internal category IDs to SA103 box keys + display labels
export const CATEGORY_TO_SA103 = {
  fuel:              { box: 'Box 17', label: 'Motor & travel costs',     hmrcField: 'travelCosts' },
  vehicle:           { box: 'Box 17', label: 'Motor & travel costs',     hmrcField: 'travelCosts' },
  supplies:          { box: 'Box 16', label: 'Cost of goods / materials', hmrcField: 'costOfGoods' },
  equipment:         { box: 'Box 16', label: 'Cost of goods / materials', hmrcField: 'costOfGoods' },
  insurance:         { box: 'Box 20', label: 'Premises running costs',    hmrcField: 'premisesRunningCosts' },
  premises:          { box: 'Box 20', label: 'Premises running costs',    hmrcField: 'premisesRunningCosts' },
  phone_internet:    { box: 'Box 21', label: 'Phone, software & admin',   hmrcField: 'adminCosts' },
  marketing:         { box: 'Box 22', label: 'Advertising & marketing',   hmrcField: 'advertisingCosts' },
  bank_charges:      { box: 'Box 23', label: 'Finance charges',           hmrcField: 'interest' },
  professional:      { box: 'Box 24', label: 'Legal & professional',      hmrcField: 'professionalFees' },
  professional_services: { box: 'Box 24', label: 'Legal & professional', hmrcField: 'professionalFees' },
  staff:             { box: 'Box 25', label: 'Staff costs',               hmrcField: 'staffCosts' },
  tax_payment:       { box: 'Box 27', label: 'Other allowable',           hmrcField: 'other' },
  other:             { box: 'Box 27', label: 'Other allowable',           hmrcField: 'other' },
  uncategorised:     { box: 'Box 27', label: 'Other allowable',           hmrcField: 'other' },
};

export function useYtdExpenses(taxYear = currentTaxYear()) {
  const [data, setData] = useState({
    ytdTotal: 0,
    byQuarter: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
    byCategory: {},
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
          // Bank-imported business expenses (negative amounts only)
          supabase
            .from('transactions')
            .select('id,transaction_date,amount,category')
            .eq('business_id', businessId)         // explicit — belts the RLS suspenders
            .gte('transaction_date', ytdStart)
            .lte('transaction_date', ytdEnd)
            .eq('is_business', true)
            .eq('is_hidden', false)
            .lt('amount', 0),
          // Manual expenses entered via Money tab + expense modal
          supabase
            .from('money_entries')
            .select('id,date,amount,category')
            .eq('kind', 'expense')
            .gte('date', ytdStart)
            .lte('date', ytdEnd),
        ]);

        if (!mounted) return;

        const rows = [
          ...((bankRes.data ?? []).map(r => ({
            id:       r.id,
            date:     r.transaction_date,
            amount:   Math.abs(Number(r.amount) || 0),
            category: r.category || 'uncategorised',
            source:   'bank',                       // → transactions table
          }))),
          ...((manualRes.data ?? []).map(r => ({
            id:       r.id,
            date:     r.date,
            amount:   Math.abs(Number(r.amount) || 0),
            category: r.category || 'other',
            source:   'manual',                     // → money_entries table
          }))),
        ];

        const byQuarter  = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
        const byCategory = {};
        let ytdTotal = 0;

        for (const row of rows) {
          ytdTotal += row.amount;
          byCategory[row.category] = (byCategory[row.category] || 0) + row.amount;

          for (const [qKey, { start, end }] of Object.entries(quarters)) {
            if (row.date >= start && row.date <= end) {
              byQuarter[qKey] += row.amount;
              break;
            }
          }
        }

        setData({ ytdTotal, byQuarter, byCategory, rows, loading: false });
      } catch (e) {
        console.error('useYtdExpenses error:', e);
        if (mounted) setData(d => ({ ...d, loading: false }));
      }
    })();
    return () => { mounted = false; };
  }, [taxYear]);

  return data;
}
