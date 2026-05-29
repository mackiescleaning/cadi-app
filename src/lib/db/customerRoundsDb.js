import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

async function getBusinessId() {
  const { data, error } = await supabase.rpc('my_business_id');
  if (error) throw error;
  return data;
}

export async function listRoundsForCustomer(customerId) {
  const { data, error } = await supabase
    .from('customer_rounds')
    .select('*')
    .eq('customer_id', customerId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAllRounds() {
  const { data, error } = await supabase
    .from('customer_rounds')
    .select('*, customers(name, postcode, address_line1)')
    .order('round_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function bulkInsertRounds(rounds) {
  if (!rounds.length) return [];
  const businessId = await getBusinessId();
  const rows = rounds.map(r => ({
    business_id:     businessId,
    customer_id:     r.customerId,
    job_reference:   r.jobReference   || null,
    round_name:      r.roundName      || null,
    schedule:        r.schedule       || null,
    price_per_visit: r.pricePerVisit  != null ? Number(r.pricePerVisit) : null,
    due_date:        r.dueDate        || null,
    account_status:  r.accountStatus  || 'active',
    notes:           r.notes          || null,
  }));
  const { data, error } = await supabase
    .from('customer_rounds')
    .insert(rows)
    .select('id');
  if (error) throw error;
  return data ?? [];
}

export async function deleteRoundsForCustomer(customerId) {
  const { error } = await supabase
    .from('customer_rounds')
    .delete()
    .eq('customer_id', customerId);
  if (error) throw error;
}

export async function updateRound(id, updates) {
  const { data, error } = await supabase
    .from('customer_rounds')
    .update({
      round_name:      updates.roundName,
      schedule:        updates.schedule,
      price_per_visit: updates.pricePerVisit,
      due_date:        updates.dueDate,
      account_status:  updates.accountStatus,
      notes:           updates.notes,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
