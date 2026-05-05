import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function listLeaderboard(limit = 100) {
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('owner_id, business_name, sector, score, prev_score, score_snapped_at, region, updated_at')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function upsertMyEntry({ business_name, sector, score, region }) {
  const ownerId = await getCurrentUserId();

  // Fetch existing row to handle weekly score rotation
  const { data: existing } = await supabase
    .from('leaderboard_entries')
    .select('score, score_snapped_at')
    .eq('owner_id', ownerId)
    .single();

  const now = new Date();
  const snappedAt = existing?.score_snapped_at ? new Date(existing.score_snapped_at) : null;
  const weekOld = snappedAt ? (now - snappedAt) >= 7 * 24 * 60 * 60 * 1000 : true;

  // Rotate current score → prev_score once per week
  const prevScore = weekOld ? (existing?.score ?? 0) : undefined;
  const snappedAtValue = weekOld ? now.toISOString() : undefined;

  const payload = {
    owner_id: ownerId,
    business_name: business_name || 'Unnamed business',
    sector: sector || 'residential',
    score: Math.round(score ?? 0),
    region: region || null,
    updated_at: now.toISOString(),
    ...(prevScore !== undefined && { prev_score: prevScore }),
    ...(snappedAtValue !== undefined && { score_snapped_at: snappedAtValue }),
  };

  const { error } = await supabase
    .from('leaderboard_entries')
    .upsert(payload, { onConflict: 'owner_id' });

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
