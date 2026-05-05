import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

// ─── Saved Routes ────────────────────────────────────────────────────────────

export async function listRoutes(optionsOrLimit = {}) {
  const ownerId = await getCurrentUserId();

  const opts = typeof optionsOrLimit === 'number'
    ? { pageSize: optionsOrLimit, page: 0 }
    : optionsOrLimit;

  const { page = 0, pageSize = 100 } = opts;

  const { data, error } = await supabase
    .from('saved_routes')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return data ?? [];
}

export async function createRoute(route) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('saved_routes')
    .insert({
      owner_id: ownerId,
      name: route.name || '',
      type: route.type || 'residential',
      stops: route.stops || [],
      frequency: route.frequency || 'one-off',
      total_miles: Number(route.totalMiles) || 0,
      last_run: route.lastRun || new Date().toISOString().split('T')[0],
      notes: route.notes || '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateRoute(id, updates) {
  const dbUpdates = { updated_at: new Date().toISOString() };
  if ('name' in updates) dbUpdates.name = updates.name;
  if ('stops' in updates) dbUpdates.stops = updates.stops;
  if ('frequency' in updates) dbUpdates.frequency = updates.frequency;
  if ('totalMiles' in updates) dbUpdates.total_miles = updates.totalMiles;
  if ('total_miles' in updates) dbUpdates.total_miles = updates.total_miles;
  if ('lastRun' in updates) dbUpdates.last_run = updates.lastRun;
  if ('last_run' in updates) dbUpdates.last_run = updates.last_run;
  if ('notes' in updates) dbUpdates.notes = updates.notes;

  const { data, error } = await supabase
    .from('saved_routes')
    .update(dbUpdates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRoute(id) {
  const { error } = await supabase.from('saved_routes').delete().eq('id', id);
  if (error) throw error;
}

// ─── Mileage Logs ────────────────────────────────────────────────────────────

// options: { page, pageSize, from (ISO date), to (ISO date) }
export async function listMileageLogs(optionsOrLimit = {}) {
  const ownerId = await getCurrentUserId();

  const opts = typeof optionsOrLimit === 'number'
    ? { pageSize: optionsOrLimit, page: 0 }
    : optionsOrLimit;

  const { page = 0, pageSize = 200, from, to } = opts;

  let q = supabase
    .from('mileage_logs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createMileageLog(entry) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mileage_logs')
    .insert({
      owner_id: ownerId,
      route_id: entry.routeId || null,
      date: entry.date || new Date().toISOString().split('T')[0],
      route_name: entry.routeName || entry.route || '',
      miles: Number(entry.miles) || 0,
      claim_value: Number(entry.claimValue) || Number(entry.claim) || 0,
      notes: entry.notes || '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMileageLog(id) {
  const { error } = await supabase.from('mileage_logs').delete().eq('id', id);
  if (error) throw error;
}
