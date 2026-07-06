// auditDb.js — UK-DPA §32 / GDPR Article 30 accountability log.
//
// Centralised writer for every sensitive data-mutation in Cadi so we can
// later prove who did what, when, to which row. Schema lives in the
// `audit_log` table (owner_id, actor_id, action, category, detail jsonb,
// ip, user_agent, created_at).
//
// Design notes:
//   • All writes are best-effort — a failure here must never block the
//     underlying operation. The data subject's right of access doesn't
//     trump the controller's right to actually run their business if the
//     audit table is briefly unreachable.
//   • `detail` should never re-store PII we've already redacted elsewhere
//     (e.g. don't put the customer's full name in the detail when we're
//     logging an erasure). Counts and initials are fine; full PII is not.
//   • Categories the call sites use today: 'gdpr', 'customer', 'job',
//     'round', 'security'. Keep the set small so it's filterable.

import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

export async function logAudit({ action, category = 'general', detail = {} }) {
  if (!action) return;
  try {
    const ownerId = await getCurrentUserId();
    await supabase.from('audit_log').insert({
      owner_id: ownerId,
      actor_id: ownerId,
      action,
      category,
      detail,
    });
  } catch (err) {
    console.warn(`audit_log write failed (${action})`, err?.message ?? err);
  }
}

// Read recent entries — surfaced in a future Settings → Activity panel.
// Default limit 100 keeps the payload small.
export async function listRecentAudit({ limit = 100, category } = {}) {
  const ownerId = await getCurrentUserId();
  let q = supabase
    .from('audit_log')
    .select('id, action, category, detail, created_at, actor_id')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
