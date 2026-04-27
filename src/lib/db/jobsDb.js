import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function createJob(job) {
  const ownerId = await getCurrentUserId();
  const payload = {
    owner_id: ownerId,
    customer_id: job.customerId || null,
    customer: job.customer || '',
    address_line1: job.addressLine1 || null,
    address_line2: job.addressLine2 || null,
    town: job.town || null,
    county: job.county || null,
    postcode: job.postcode || '',
    date: job.date,
    start_hour: job.startHour ?? 9,
    duration_hrs: job.durationHrs ?? 2,
    type: job.type || 'residential',
    service: job.service || '',
    price: Number(job.price) || 0,
    status: job.status || 'scheduled',
    assignee: job.assignee || null,
    assignees: job.assignees || [],
    recurrence: job.recurrence || 'one-off',
    notes: job.notes || '',
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// options: { page, pageSize, from (ISO date), to (ISO date) }
// Legacy: pass a number as first arg for a plain limit (backward compat).
export async function listJobs(optionsOrLimit = {}) {
  const ownerId = await getCurrentUserId();

  const opts = typeof optionsOrLimit === 'number'
    ? { pageSize: optionsOrLimit, page: 0 }
    : optionsOrLimit;

  const { page = 0, pageSize = 200, from, to } = opts;

  let q = supabase
    .from('jobs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('date', { ascending: true })
    .order('start_hour', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function updateJob(id, updates) {
  const { data, error } = await supabase
    .from('jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJob(id) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
