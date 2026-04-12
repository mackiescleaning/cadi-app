import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function listCustomers(limit = 500) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function upsertCustomer(customer) {
  const ownerId = await getCurrentUserId();
  const payload = {
    id: customer.id,
    owner_id: ownerId,
    name: customer.name,
    email: customer.email || null,
    phone: customer.phone || null,
    postcode: customer.postcode || null,
    frequency: customer.frequency || null,
    status: customer.status || 'active',
    tags: customer.tags || [],
    notes: customer.notes || null,
    source: customer.source || null,
    rating: customer.rating || 0,
    service_types: customer.serviceTypes || [],
    last_job_date: customer.lastJobDate || null,
    next_job_date: customer.nextJobDate || null,
    lifetime_value: Number(customer.lifetimeValue) || 0,
  };

  const { data, error } = await supabase
    .from('customers')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
