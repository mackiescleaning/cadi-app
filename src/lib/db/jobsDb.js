import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function createJob(job) {
  const ownerId = await getCurrentUserId();
  const payload = {
    owner_id: ownerId,
    customer_id: job.customerId || null,
    customer: job.customer || '',
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

export async function listJobs(limit = 500) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('date', { ascending: true })
    .order('start_hour', { ascending: true })
    .limit(limit);

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
