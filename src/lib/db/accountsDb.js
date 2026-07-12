// src/lib/db/accountsDb.js
// Cadi — Accounts foundation (P2) client reader for the per-business chart of
// accounts + tax profile.
//
// P1 (migrations 095–097) moved categories out of the hardcoded client list and
// into DB tables: `chart_of_accounts` (per-business, key == transactions.category),
// `business_tax_profile` (entity/VAT config), `bank_category_rules`. This module is
// the client-side read path the Money-confidence redesign sits on.
//
// Server mirror: supabase/functions/statement-import/index.ts resolves the same
// chart to derive lane → is_business / is_hidden + VAT. Keep the lane semantics here
// in sync with that function and the seed in 097_seed_business_accounts.sql.

import { supabase } from '../supabase';

// The four lanes every transaction sorts into. `is_hidden` drops transfers from the
// Money tab already; the lane is the tax-meaningful bucket the digest groups by.
export const LANES = ['income', 'expense', 'personal', 'transfer'];

// Static lane presentation. `label` for personal is overridden per entity structure
// via personalNoun() — sole traders draw "drawings", a Ltd runs a "director's loan".
export const LANE_META = {
  income: {
    key: 'income',
    label: 'Money in',
    blurb: 'Customer payments and other income',
    dot: '#34d399',
    text: 'text-emerald-300',
    ring: 'border-emerald-500/25',
    fill: 'bg-emerald-500/15',
    sign: '+',
  },
  expense: {
    key: 'expense',
    label: 'Business costs',
    blurb: 'Money spent running the business',
    dot: '#f59e0b',
    text: 'text-amber-300',
    ring: 'border-amber-500/25',
    fill: 'bg-amber-500/15',
    sign: '−',
  },
  personal: {
    key: 'personal',
    label: 'Personal',
    blurb: 'Money you took out for yourself',
    dot: '#f6b23c',
    text: 'text-orange-300',
    ring: 'border-orange-500/25',
    fill: 'bg-orange-500/15',
    sign: '−',
  },
  transfer: {
    key: 'transfer',
    label: 'Transfers',
    blurb: 'Moving money between your own accounts — not income or a cost',
    dot: '#8695b4',
    text: 'text-slate-300',
    ring: 'border-slate-500/25',
    fill: 'bg-slate-500/15',
    sign: '',
  },
};

// Personal-lane noun depends on the entity structure (business_tax_profile.structure).
// Sole traders / partnerships "draw" money (drawings); a limited company records money
// the director takes as a director's loan.
export function personalNoun(structure) {
  return structure === 'ltd' ? "Director's loan" : 'Drawings';
}

// Who put each transaction in its category — drives the trust bar in the digest.
export const SOURCE_META = {
  user: { label: 'You confirmed', dot: '#34d399', trust: 'high' },
  bank: { label: "Bank's label", dot: '#38bdf8', trust: 'med' },
  cadi_ai: { label: 'Cadi guessed', dot: '#a855f7', trust: 'low' },
};

// Explicit client-side business_id resolve — belts the RLS suspenders (queries scope
// to this business even if RLS ever regresses). Same pattern as useYtdIncome.
export async function resolveBusinessId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle();
  return data?.id ?? null;
}

// The per-business chart, ordered for display. Rows: { key, label, emoji, color,
// lane, is_allowable, vat_treatment, sort_order, is_system, archived }.
export async function getChart(businessId) {
  const bid = businessId ?? (await resolveBusinessId());
  if (!bid) return [];
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('key,label,emoji,color,lane,is_allowable,vat_treatment,sort_order,is_system,archived')
    .eq('business_id', bid)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// The business tax/entity profile (1:1). Returns null if not seeded yet — callers
// should fall back to sole-trader defaults so the UI never blanks out.
export async function getTaxProfile(businessId) {
  const bid = businessId ?? (await resolveBusinessId());
  if (!bid) return null;
  const { data, error } = await supabase
    .from('business_tax_profile')
    .select(
      'business_id,structure,vat_registered,vat_number,vat_scheme,vat_flat_rate,vat_registered_from,accounting_basis,fy_start_month,fy_start_day'
    )
    .eq('business_id', bid)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Chart + tax profile in one round-trip, shaped for the money-confidence read paths.
// chartByKey is a plain object (key -> row) for O(1) lane/label lookups off
// transactions.category. laneOf falls back to 'expense' for unknown keys — matches
// the server's laneOf default in statement-import.
export async function getAccountsContext(businessId) {
  const bid = businessId ?? (await resolveBusinessId());
  if (!bid) return { businessId: null, chart: [], chartByKey: {}, taxProfile: null };

  const [chart, taxProfile] = await Promise.all([getChart(bid), getTaxProfile(bid)]);

  const chartByKey = {};
  for (const row of chart) chartByKey[row.key] = row;

  return { businessId: bid, chart, chartByKey, taxProfile };
}

// Pure helper: which lane a transaction's category key belongs to.
export function laneForKey(chartByKey, key) {
  return chartByKey?.[key]?.lane ?? 'expense';
}
