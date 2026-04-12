import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function createQuote(quote) {
  const ownerId = await getCurrentUserId();

  const payload = {
    owner_id: ownerId,
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

export async function listQuotes(limit = 100) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
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
