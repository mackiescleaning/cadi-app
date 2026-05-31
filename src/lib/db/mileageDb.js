import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

// HMRC mileage allowance: 45p/mile up to 10,000; 25p after
export function calcMileageAllowance(newMiles, ytdMilesBefore) {
  const threshold = 10000;
  const before = Math.min(ytdMilesBefore, threshold);
  const remaining = Math.max(threshold - before, 0);
  const atHighRate = Math.min(newMiles, remaining);
  const atLowRate  = Math.max(newMiles - remaining, 0);
  return Math.round((atHighRate * 0.45 + atLowRate * 0.25) * 100) / 100;
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
