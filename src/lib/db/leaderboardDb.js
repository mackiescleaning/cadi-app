import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function listLeaderboard(limit = 100) {
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('owner_id, business_name, sector, score, prev_score, score_snapped_at, region, updated_at')
    .order('score',      { ascending: false })
    .order('updated_at', { ascending: true })
    .order('owner_id',   { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function upsertMyEntry({ business_name, sector, region }) {
  // The score is NO LONGER trusted from the client — it's computed server-side
  // inside upsert_my_leaderboard_entry(). The dashboard still shows a
  // client-side score for instant rendering, but the leaderboard's number is
  // canonical: anyone devtools-ing their way past the calc gets ignored.
  // Weekly prev_score rotation lives in the RPC too, so the FE doesn't need
  // to peek at the existing row first.
  const { data, error } = await supabase.rpc('upsert_my_leaderboard_entry', {
    p_business_name: business_name || 'Unnamed business',
    p_sector:        sector        || 'residential',
    p_region:        region        || null,
  });

  if (error) throw error;
  // Server-computed score is returned so the caller can show it if useful.
  const row = Array.isArray(data) ? data[0] : data;
  return { score: row?.score ?? null };
}

export async function deleteMyEntry() {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('leaderboard_entries')
    .delete()
    .eq('owner_id', ownerId);

  if (error) throw error;
}
