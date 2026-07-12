/**
 * src/lib/db/statementsDb.js
 * Cadi — client wrapper for the `statement-import` edge function.
 *
 * The heavy lifting (categorisation, invoice matching, dedup) happens server-side.
 * This just ships normalised rows up and returns the summary.
 *
 * Uses a raw fetch() rather than supabase.functions.invoke() to dodge the
 * Supabase gateway's x-client-info preflight bug (invoke() always sends that
 * header, which the gateway strips on OPTIONS → the POST fails with
 * "Failed to send a request to the Edge Function"). Same workaround as
 * fmOpsDb.callFmFn() / connectDb.callConnectFn().
 */

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

async function callImport(rows, { dryRun } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in first.');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/statement-import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: 'import', rows, dryRun: !!dryRun }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const err = new Error(data?.error ?? `Import failed (${res.status})`);
    if (data?.upgrade_required) err.upgradeRequired = true;
    throw err;
  }
  return data;
}

/** Dry run: categorise + dedupe-check without writing. Returns { summary, preview }. */
export function previewStatement(rows) {
  return callImport(rows, { dryRun: true });
}

/** Commit: insert fresh rows + auto-flip high-confidence matches. Returns { imported, autoMatched, summary }. */
export function importStatement(rows) {
  return callImport(rows, { dryRun: false });
}
