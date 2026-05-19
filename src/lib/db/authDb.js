import { supabase } from '../supabase';

export async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error('Not authenticated');
  return id;
}
