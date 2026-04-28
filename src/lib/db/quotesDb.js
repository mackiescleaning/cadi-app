import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function createQuote(quote) {
  const ownerId = await getCurrentUserId();

  const payload = {
    owner_id: ownerId,
    customer_id: quote.customerId || null,
    type: quote.type,
    job_label: quote.jobLabel || quote.customer || 'Quote',
    price: Number(quote.price) || 0,
    hrs: Number(quote.hrs) || 0,
    notes: quote.notes || null,
    payload: quote.payload || quote,
    status: quote.status || 'draft',
  };

  const { data, error } = await supabase
    .from('quotes')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// options: { page, pageSize } — default loads first 100.
// Legacy: pass a number as first arg for a plain limit (backward compat).
export async function listQuotes(optionsOrLimit = {}) {
  const ownerId = await getCurrentUserId();

  const opts = typeof optionsOrLimit === 'number'
    ? { pageSize: optionsOrLimit, page: 0 }
    : optionsOrLimit;

  const { page = 0, pageSize = 100 } = opts;

  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return data ?? [];
}

export async function deleteQuote(id) {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

export async function updateQuoteStatus(id, status) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
