import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';
import { bustCleanProDataCache } from '../dashboardCache';

export async function createMoneyEntry(entry) {
  const ownerId = await getCurrentUserId();

  const payload = {
    owner_id: ownerId,
    quote_id: entry.quoteId || null,
    // Set when this entry mirrors an invoice payment — read paths that count
    // invoices directly (useYtdIncome, VAT turnover) exclude linked entries
    // so income is never double-counted.
    invoice_id: entry.invoiceId || null,
    customer_id: entry.customerId || null,
    client: entry.client || null,
    amount: Number(entry.amount) || 0,
    date: entry.date,
    method: entry.method || null,
    notes: entry.notes || null,
    kind: entry.kind || 'income',
    category: entry.category || null,
  };

  const { data, error } = await supabase
    .from('money_entries')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  bustCleanProDataCache(); // dashboard money cache is now stale
  return data;
}

// options: { page, pageSize, from (ISO date), to (ISO date) }
// Legacy: pass a number as first arg for a plain limit (backward compat).
export async function listMoneyEntries(optionsOrLimit = {}) {
  const ownerId = await getCurrentUserId();

  const opts = typeof optionsOrLimit === 'number'
    ? { pageSize: optionsOrLimit, page: 0 }
    : optionsOrLimit;

  const { page = 0, pageSize = 200, from, to } = opts;

  let q = supabase
    .from('money_entries')
    .select('*')
    .eq('owner_id', ownerId)
    .order('date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function updateMoneyEntry(id, updates) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('money_entries')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select('*')
    .single();

  if (error) throw error;
  bustCleanProDataCache();
  return data;
}

export async function deleteMoneyEntry(id) {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('money_entries')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);

  if (error) throw error;
  bustCleanProDataCache();
}
