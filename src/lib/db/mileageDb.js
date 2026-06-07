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

export async function logMileage({ periodStart, periodEnd, miles, allowancePence, notes }) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mileage_logs')
    .insert({ owner_id: ownerId, period_start: periodStart, period_end: periodEnd, miles, allowance_pence: allowancePence, notes: notes || null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listMileageLogs({ taxYearStart } = {}) {
  const ownerId = await getCurrentUserId();
  let q = supabase
    .from('mileage_logs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('period_start', { ascending: false });
  if (taxYearStart) q = q.gte('period_start', taxYearStart);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
