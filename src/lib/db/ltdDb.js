// src/lib/db/ltdDb.js
// Cadi — Limited-company dashboard helpers (dividends, director's loan, CT accrual).
// Tables created in migration 052_limited_company_dashboard.sql.

import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';
import { calculateCT } from '../taxCalc';

// ── Dividends ────────────────────────────────────────────────────────────────
export async function listDividends({ taxYear } = {}) {
  const ownerId = await getCurrentUserId();
  let q = supabase
    .from('ltd_dividends')
    .select('*')
    .eq('owner_id', ownerId)
    .order('declared_on', { ascending: false });
  if (taxYear) q = q.eq('tax_year', taxYear);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function addDividend(row) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('ltd_dividends')
    .insert({ ...row, owner_id: ownerId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDividend(id) {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('ltd_dividends')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

// ── Director's loan account ──────────────────────────────────────────────────
export async function listDirectorLoanEntries() {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('ltd_director_loan_entries')
    .select('*')
    .eq('owner_id', ownerId)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addDirectorLoanEntry(row) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('ltd_director_loan_entries')
    .insert({ ...row, owner_id: ownerId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDirectorLoanEntry(id) {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('ltd_director_loan_entries')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

export function dlaBalance(entries) {
  return (entries || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
}

// Benefit-in-kind warning threshold (HMRC s.455 + ITEPA Pt.3 Ch.7).
export const DLA_BIK_THRESHOLD = 10000;

// ── Corporation Tax accrual ──────────────────────────────────────────────────
function addMonths(d, m) {
  const x = new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
  return x.toISOString().slice(0, 10);
}
function addDays(d, days) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return x.toISOString().slice(0, 10);
}

export function deriveCtDeadlines(periodEndIso) {
  const end = new Date(periodEndIso);
  return {
    payment_due_on:   addDays(new Date(addMonths(end, 9)), 1),
    return_due_on:    addMonths(end, 12),
    ch_filing_due_on: addMonths(end, 9),
  };
}

export async function listCtAccruals() {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('ltd_ct_accrual')
    .select('*')
    .eq('owner_id', ownerId)
    .order('period_end', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertCtAccrual({ period_start, period_end, estimated_profit, ct_paid = 0, status = 'open', notes = null }) {
  const ownerId = await getCurrentUserId();
  const ct_due = calculateCT(estimated_profit);
  const deadlines = deriveCtDeadlines(period_end);
  const { data, error } = await supabase
    .from('ltd_ct_accrual')
    .upsert(
      { owner_id: ownerId, period_start, period_end, estimated_profit, ct_due, ct_paid, status, notes, ...deadlines },
      { onConflict: 'owner_id,period_start,period_end' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCtAccrual(id) {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('ltd_ct_accrual')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}
