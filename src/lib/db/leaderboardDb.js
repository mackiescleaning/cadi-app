import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function listLeaderboard(limit = 50) {
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('owner_id, business_name, sector, score, region, updated_at')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function upsertMyEntry({ business_name, sector, score, region }) {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('leaderboard_entries')
    .upsert({
      owner_id: ownerId,
      business_name: business_name || 'Unnamed business',
      sector: sector || 'residential',
      score: Math.round(score ?? 0),
      region: region || null,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function deleteMyEntry() {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('leaderboard_entries')
    .delete()
    .eq('owner_id', ownerId);

  if (error) throw error;
}
