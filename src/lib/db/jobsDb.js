import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';
import { logAudit } from './auditDb';

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
    assignee_ids: job.assignee_ids || [],
    recurrence: job.recurrence || 'one-off',
    notes: job.notes || '',
    series_id: job.seriesId || null,
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function bulkCreateJobs(jobs) {
  if (!jobs.length) return [];
  const ownerId = await getCurrentUserId();
  const rows = jobs.map(j => ({
    owner_id:     ownerId,
    customer_id:  j.customerId  || null,
    customer:     j.customer    || '',
    address_line1: j.addressLine1 || null,
    address_line2: j.addressLine2 || null,
    town:         j.town        || null,
    county:       j.county      || null,
    postcode:     j.postcode    || '',
    date:         j.date,
    start_hour:   j.startHour  ?? 9,
    duration_hrs: j.durationHrs ?? 1,
    type:         j.type        || 'exterior',
    service:      j.service     || '',
    price:        Number(j.price) || 0,
    status:       'scheduled',
    recurrence:   j.recurrence  || 'one-off',
    is_recurring: j.isRecurring ?? false,
    notes:        j.notes       || '',
    source:       j.source      || 'import',
    series_id:    j.seriesId    || null,
    import_batch_id: j.importBatchId || null,
    assignees:    [],
    assignee_ids: [],
  }));
  const { data, error } = await supabase.from('jobs').insert(rows).select('id');
  if (error) throw error;
  return data ?? [];
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
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJob(id) {
  const ownerId = await getCurrentUserId();
  // Fetch a tiny snapshot before the delete so the audit row can identify
  // what was removed (customer id + date) without storing the full payload.
  const { data: snap } = await supabase
    .from('jobs')
    .select('customer_id, date, price')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();

  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);

  if (error) throw error;

  await logAudit({
    action:   'job.deleted',
    category: 'job',
    detail: {
      job_id:      id,
      customer_id: snap?.customer_id ?? null,
      date:        snap?.date ?? null,
      price:       snap?.price ?? null,
    },
  });
}
