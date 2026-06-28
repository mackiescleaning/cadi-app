import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';
import { logAudit } from './auditDb';

async function getBusinessId() {
  const { data, error } = await supabase.rpc('my_business_id');
  if (error) throw error;
  return data;
}

export async function listRoundsForCustomer(customerId) {
  const { data, error } = await supabase
    .from('customer_rounds')
    .select('*')
    .eq('customer_id', customerId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAllRounds() {
  const { data, error } = await supabase
    .from('customer_rounds')
    .select('*, customers(id, name, postcode, address_line1, address_line2, town, county)')
    .order('round_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function bulkInsertRounds(rounds) {
  if (!rounds.length) return [];
  const businessId = await getBusinessId();
  const rows = rounds.map(r => ({
    business_id:     businessId,
    customer_id:     r.customerId,
    job_reference:   r.jobReference   || null,
    round_name:      r.roundName      || null,
    schedule:        r.schedule       || null,
    price_per_visit: r.pricePerVisit  != null ? Number(r.pricePerVisit) : null,
    due_date:        r.dueDate        || null,
    account_status:  r.accountStatus  || 'active',
    notes:           r.notes          || null,
    import_batch_id: r.importBatchId  || null,
  }));
  const { data, error } = await supabase
    .from('customer_rounds')
    .insert(rows)
    .select('id');
  if (error) throw error;
  return data ?? [];
}

export async function deleteRoundsForCustomer(customerId) {
  const { error } = await supabase
    .from('customer_rounds')
    .delete()
    .eq('customer_id', customerId);
  if (error) throw error;
}

// Patches a single round membership. Only sends columns present in `updates`
// so callers don't accidentally clobber unrelated fields with `undefined`.
export async function updateRound(id, updates) {
  const patch = { updated_at: new Date().toISOString() };
  if ('roundName'      in updates) patch.round_name      = updates.roundName;
  if ('schedule'       in updates) patch.schedule        = updates.schedule;
  if ('pricePerVisit'  in updates) patch.price_per_visit = updates.pricePerVisit;
  if ('dueDate'        in updates) patch.due_date        = updates.dueDate;
  if ('accountStatus'  in updates) patch.account_status  = updates.accountStatus;
  if ('notes'          in updates) patch.notes           = updates.notes;
  if ('displayOrder'   in updates) patch.display_order   = updates.displayOrder;

  const { data, error } = await supabase
    .from('customer_rounds')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Persist a re-ordering after a drag. Each item: { id, displayOrder, roundName? }.
// Used for both in-round reorder and drag-between-rounds (the latter just
// includes the new roundName on the moved item).
export async function setRoundOrder(items) {
  if (!items.length) return;
  await Promise.all(items.map(({ id, displayOrder, roundName }) => {
    const patch = { display_order: displayOrder, updated_at: new Date().toISOString() };
    if (roundName !== undefined) patch.round_name = roundName;
    return supabase.from('customer_rounds').update(patch).eq('id', id);
  }));
}

// Bulk-reassign customer_rounds rows to new round names. Used by the
// "Rebuild rounds" action when the import created rounds from the wrong
// column (e.g. CleanerPlanner schedule instead of area). Each update is
// { id, roundName }. Resets display_order so the new round starts at 0…N.
export async function bulkAssignRound(updates) {
  if (!updates.length) return 0;
  // Re-index display_order within each destination round so the visit
  // sequence stays contiguous after the move.
  const indexByRound = new Map();
  await Promise.all(updates.map(({ id, roundName }) => {
    const next = (indexByRound.get(roundName) ?? 0);
    indexByRound.set(roundName, next + 1);
    return supabase.from('customer_rounds').update({
      round_name:    roundName,
      display_order: next,
      updated_at:    new Date().toISOString(),
    }).eq('id', id);
  }));

  // Audit the rebuild — capture which rounds were affected + how many rows
  // touched so the controller can spot bulk-data events at a glance.
  await logAudit({
    action:   'round.bulk_reassigned',
    category: 'round',
    detail: {
      total_rows: updates.length,
      to_rounds:  Array.from(indexByRound.entries()).map(([name, count]) => ({ name, count })),
    },
  });

  return updates.length;
}

// Bulk-shift every active customer in a round by N days. Used for "rain day"
// reschedules. Skips cancelled/suspended customers and anything with no due
// date. Auto-bumps Sunday landings to Monday. Returns the count of rows
// actually shifted.
export async function shiftRound(roundName, dayOffset) {
  const { data, error } = await supabase
    .from('customer_rounds')
    .select('id, due_date, account_status')
    .eq('round_name', roundName);
  if (error) throw error;
  const updates = (data ?? [])
    .filter(r => r.account_status === 'active' && r.due_date)
    .map(r => {
      const d = new Date(r.due_date + 'T00:00:00');
      d.setDate(d.getDate() + dayOffset);
      if (d.getDay() === 0) d.setDate(d.getDate() + 1);
      return { id: r.id, due_date: d.toISOString().slice(0, 10) };
    });
  await Promise.all(updates.map(u =>
    supabase.from('customer_rounds').update({ due_date: u.due_date, updated_at: new Date().toISOString() }).eq('id', u.id)
  ));

  await logAudit({
    action:   'round.shifted',
    category: 'round',
    detail: {
      round_name:  roundName,
      day_offset:  dayOffset,
      rows_shifted: updates.length,
    },
  });

  return updates.length;
}
