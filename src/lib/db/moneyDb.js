import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function createMoneyEntry(entry) {
  const ownerId = await getCurrentUserId();

  const payload = {
    owner_id: ownerId,
    quote_id: entry.quoteId || null,
    customer_id: entry.customerId || null,
    client: entry.client || null,
    amount: Number(entry.amount) || 0,
    date: entry.date,
    method: entry.method || null,
    notes: entry.notes || null,
    kind: entry.kind || 'income',
  };

  const { data, error } = await supabase
    .from('money_entries')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function listMoneyEntries(limit = 500) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('money_entries')
    .select('*')
    .eq('owner_id', ownerId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
