import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

// HMRC AMAP rates for cars & vans: 45p/mile up to 10,000; 25p after
// https://www.gov.uk/expenses-if-youre-self-employed/travel
export const MILEAGE_RATE_HIGH = 0.45;
export const MILEAGE_RATE_LOW  = 0.25;
export const MILEAGE_THRESHOLD = 10000;

export function calcMileageAllowance(newMiles, ytdMilesBefore) {
  const before = Math.min(ytdMilesBefore, MILEAGE_THRESHOLD);
  const remaining = Math.max(MILEAGE_THRESHOLD - before, 0);
  const atHighRate = Math.min(newMiles, remaining);
  const atLowRate  = Math.max(newMiles - remaining, 0);
  return Math.round((atHighRate * MILEAGE_RATE_HIGH + atLowRate * MILEAGE_RATE_LOW) * 100) / 100;
}

// NOTE on schema: the live `mileage_logs` table (migration 003) is date-shaped —
// columns date / route_name / miles / claim_value / notes. Migration 032 tried to
// recreate it with period_start / period_end / allowance_pence, but `create table
// if not exists` was a no-op because 003 had already created it, so those columns
// never existed. Querying them threw 42703 and broke the Money + Accounting tabs.
// We therefore read/write the real columns and expose the legacy period_start /
// period_end / allowance_pence names as aliases so existing callers (MoneyTracker,
// annualReviewDb) keep working without changes. This also means the Money tab now
// sees route-logged mileage too (same table), which is correct for tax totals.

function withLegacyAliases(row) {
  if (!row) return row;
  return {
    ...row,
    period_start: row.date,
    period_end: row.date,
    allowance_pence: row.claim_value, // stored/handled in £ throughout
  };
}

export async function logMileage({ periodStart, periodEnd, miles, allowancePence, notes }) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mileage_logs')
    .insert({
      owner_id: ownerId,
      date: periodStart || periodEnd || new Date().toISOString().split('T')[0],
      route_name: 'Mileage claim',
      miles,
      claim_value: allowancePence,
      notes: notes || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return withLegacyAliases(data);
}

export async function listMileageLogs({ taxYearStart } = {}) {
  const ownerId = await getCurrentUserId();
  let q = supabase
    .from('mileage_logs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('date', { ascending: false });
  if (taxYearStart) q = q.gte('date', taxYearStart);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(withLegacyAliases);
}
