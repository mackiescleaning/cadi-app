import { supabase } from '../supabase';

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('Not authenticated');
  return data.user.id;
}
