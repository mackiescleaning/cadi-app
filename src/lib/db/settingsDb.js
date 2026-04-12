import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function getBusinessSettings() {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertBusinessSettings(updates) {
  const ownerId = await getCurrentUserId();
  const payload = {
    owner_id: ownerId,
    ...updates,
  };

  const { data, error } = await supabase
    .from('business_settings')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
