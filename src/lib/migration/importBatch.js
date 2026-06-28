// importBatch.js — group every row created by the import wizard under one
// import_batch_id so a mis-import can be rolled back in one click.

import { supabase } from '../supabase';
import { getCurrentUserId } from '../db/authDb';

export function newImportBatchId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Counts of what would be rolled back. Safe to call any time.
export async function previewBatch(batchId) {
  const ownerId = await getCurrentUserId();
  // customer_rounds is owner-scoped via business_id (which stores the owner's
  // auth.uid in the current single-tenant model — see project_rls_live_state).
  const counts = await Promise.all([
    countIn('customers',       ownerId, batchId),
    countIn('customer_rounds', ownerId, batchId, 'business_id'),
    countIn('jobs',            ownerId, batchId),
    countIn('recurring_jobs',  ownerId, batchId),
  ]);
  return {
    customers:      counts[0],
    rounds:         counts[1],
    jobs:           counts[2],
    recurringJobs:  counts[3],
  };
}

// Rolls back an import. Deletes in reverse dependency order:
//   jobs → recurring_jobs → customer_rounds → customers.
// Each delete is owner-scoped (RLS enforces this anyway, but explicit for safety).
export async function rollbackBatch(batchId) {
  const ownerId = await getCurrentUserId();
  const summary = { jobs: 0, recurringJobs: 0, rounds: 0, customers: 0 };

  summary.jobs          = await deleteIn('jobs',            ownerId, batchId);
  summary.recurringJobs = await deleteIn('recurring_jobs',  ownerId, batchId);
  summary.rounds        = await deleteIn('customer_rounds', ownerId, batchId, 'business_id');
  summary.customers     = await deleteIn('customers',       ownerId, batchId);

  return summary;
}

async function countIn(table, ownerId, batchId, ownerCol = 'owner_id') {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(ownerCol, ownerId)
    .eq('import_batch_id', batchId);
  if (error) throw error;
  return count ?? 0;
}

async function deleteIn(table, ownerId, batchId, ownerCol = 'owner_id') {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq(ownerCol, ownerId)
    .eq('import_batch_id', batchId)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
