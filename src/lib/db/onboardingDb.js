// onboardingDb.js — CRUD for the customer-migration onboarding flow.
// Covers onboarding_sessions, customer_imports, and uploads to the
// private customer-imports bucket. parsed_customers writes happen
// server-side in the parse-customer-upload edge function.

import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';

const BUCKET = 'customer-imports';

async function businessId() {
  const { data, error } = await supabase.rpc('my_business_id');
  if (error) throw error;
  if (!data) throw new Error('No business_id — are you signed in?');
  return data;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

// Return the most recent in-progress session for this business, or null.
export async function loadActiveSession() {
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .neq('step', 'complete')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return rowToSession(data?.[0]);
}

export async function loadSessionById(id) {
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return rowToSession(data);
}

export async function createSession() {
  const bid = await businessId();
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .insert({ business_id: bid, step: 'divisions', divisions: [] })
    .select('*')
    .single();
  if (error) throw error;
  return rowToSession(data);
}

// Get-or-create — used by the page on first mount.
export async function ensureSession() {
  return (await loadActiveSession()) ?? (await createSession());
}

export async function updateStep(sessionId, step) {
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .update({ step })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function updateDivisions(sessionId, divisions) {
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .update({ divisions })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function completeSession(sessionId) {
  const { error } = await supabase
    .from('onboarding_sessions')
    .update({ step: 'complete', completed_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

// ─── Imports + uploads ──────────────────────────────────────────────────────

const MIME_TO_SOURCE = {
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'text/plain': 'csv', // best effort
};

export function sourceTypeForFile(file) {
  if (!file) return null;
  const fromMime = MIME_TO_SOURCE[file.type];
  if (fromMime) return fromMime;
  const ext = (file.name || '').toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return 'image';
  if (ext === 'txt') return 'csv';
  return null;
}

// Create a customer_imports row and upload the file under
//   <business_id>/<import_id>/<safe_filename>
// in one go. Returns the resulting customer_imports record.
export async function createFileImport({ sessionId, file }) {
  const sourceType = sourceTypeForFile(file);
  if (!sourceType) throw new Error(`Unsupported file type: ${file.name}`);

  const bid = await businessId();

  // 1. Reserve a row so we have an import_id for the path.
  const { data: imp, error: insertErr } = await supabase
    .from('customer_imports')
    .insert({
      business_id: bid,
      session_id: sessionId,
      source_type: sourceType,
      parse_status: 'pending',
    })
    .select('*')
    .single();
  if (insertErr) throw insertErr;

  // 2. Upload to bucket. Sanitise filename to avoid weird URLs.
  const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  const path = `${bid}/${imp.id}/${safeName}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) {
    // Roll back the row so we don't leave orphaned imports.
    await supabase.from('customer_imports').delete().eq('id', imp.id);
    throw upErr;
  }

  // 3. Update the row with the path.
  const { data: updated, error: pathErr } = await supabase
    .from('customer_imports')
    .update({ storage_path: path })
    .eq('id', imp.id)
    .select('*')
    .single();
  if (pathErr) throw pathErr;

  return updated;
}

// For the "Paste text" path — no file, just a string.
export async function createTextImport({ sessionId, text }) {
  const bid = await businessId();
  // We still store the text as a file in the bucket so the edge fn can
  // read it the same way it reads CSVs.
  const { data: imp, error: insertErr } = await supabase
    .from('customer_imports')
    .insert({
      business_id: bid,
      session_id: sessionId,
      source_type: 'pasted_text',
      parse_status: 'pending',
    })
    .select('*')
    .single();
  if (insertErr) throw insertErr;

  const path = `${bid}/${imp.id}/pasted.txt`;
  const blob = new Blob([text], { type: 'text/plain' });
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'text/plain', upsert: false });
  if (upErr) {
    await supabase.from('customer_imports').delete().eq('id', imp.id);
    throw upErr;
  }

  const { data: updated, error: pathErr } = await supabase
    .from('customer_imports')
    .update({ storage_path: path })
    .eq('id', imp.id)
    .select('*')
    .single();
  if (pathErr) throw pathErr;

  return updated;
}

// Fire the edge function. The function updates customer_imports.parse_status
// itself as it works; the client polls or subscribes for the change.
//
// CRITICAL: when invoke fails (CORS / JWT / function not deployed / network),
// the function never even reaches its own status-update code. So if we don't
// stamp the row 'failed' from the client here, the row sits at 'pending'
// forever and the UI waits silently. Always set the status one way or another.
export async function triggerParse(importId) {
  try {
    const { data, error } = await supabase.functions.invoke('parse-customer-upload', {
      body: { import_id: importId },
    });
    if (error) throw error;
    // Function returns {error: "..."} on internal failures with status 500
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (err) {
    const msg = err?.message ?? 'Could not start parsing — try again.';
    // Try to mark the row failed so the UI can react. Don't throw if THIS
    // fails — we still want to surface the original error.
    try {
      await supabase
        .from('customer_imports')
        .update({ parse_status: 'failed', parse_error: msg })
        .eq('id', importId);
    } catch {}
    throw err;
  }
}

// Watchdog — if a row stayed pending/parsing too long, mark it failed.
// Called by the StepUpload polling loop. Returns the count of rows it
// touched, so the UI can react.
export async function failStuckImports(sessionId, maxAgeSeconds = 180) {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from('customer_imports')
    .update({
      parse_status: 'failed',
      parse_error: 'Took too long — try a smaller file or a different format.',
    })
    .eq('session_id', sessionId)
    .in('parse_status', ['pending', 'parsing'])
    .lt('created_at', cutoff)
    .select('id');
  if (error) return 0;
  return data?.length ?? 0;
}

export async function listImportsForSession(sessionId) {
  const { data, error } = await supabase
    .from('customer_imports')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function deleteImport(importId, storagePath) {
  if (storagePath) {
    try {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    } catch {}
  }
  const { error } = await supabase.from('customer_imports').delete().eq('id', importId);
  if (error) throw error;
}

// ─── parsed_customers — review screen + commit ──────────────────────────────

export async function listParsedForSession(sessionId) {
  // Get every parsed row across all imports in this session, in import order.
  const { data: imps } = await supabase
    .from('customer_imports')
    .select('id')
    .eq('session_id', sessionId);
  const importIds = (imps ?? []).map((i) => i.id);
  if (!importIds.length) return [];
  const { data, error } = await supabase
    .from('parsed_customers')
    .select('*')
    .in('import_id', importIds)
    .eq('committed', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Inline-edit one field at a time. Recomputes bucket from rrule + anchor when
// either changes so the card moves between groups automatically.
export async function updateParsedCustomer(id, patches) {
  const next = { ...patches };
  if ('frequency_rrule' in next || 'anchor_date' in next) {
    // We need the current row to figure out the new bucket if patches don't
    // include both — defer the bucket recompute to the caller via a follow-up
    // fetch. For now, recompute simply when both are present in patches.
    const hasRrule = Boolean(next.frequency_rrule ?? null);
    const hasAnchor = Boolean(next.anchor_date ?? null);
    if ('frequency_rrule' in next && 'anchor_date' in next) {
      next.bucket = hasRrule && hasAnchor ? 'ready' : hasRrule ? 'nearly' : 'decision';
    }
  }
  const { data, error } = await supabase
    .from('parsed_customers')
    .update(next)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Bulk-apply a single service label to every parsed_customers row in the
// session that doesn't have one yet. Used by the review screen's "everyone
// gets X" shortcut — most cleaners run a single primary service, so a single
// tap should populate 150+ rows instead of forcing per-card editing.
// Also seeds service_labels[] so the multi-select chips stay in sync.
export async function bulkApplyServiceToMissing(sessionId, label) {
  const clean = String(label || '').trim();
  if (!clean) return 0;

  // parsed_customers links to the session via import_id → customer_imports
  // (no direct session_id). Fetch the import ids for this session first.
  const { data: imports, error: impErr } = await supabase
    .from('customer_imports')
    .select('id')
    .eq('session_id', sessionId);
  if (impErr) throw impErr;
  const importIds = (imports ?? []).map((i) => i.id);
  if (!importIds.length) return 0;

  const { data: all, error: selErr } = await supabase
    .from('parsed_customers')
    .select('id, service_label, service_labels')
    .in('import_id', importIds);
  if (selErr) throw selErr;

  const ids = (all ?? [])
    .filter(
      (r) =>
        !String(r.service_label ?? '').trim() &&
        !(Array.isArray(r.service_labels) && r.service_labels.length)
    )
    .map((r) => r.id);
  if (!ids.length) return 0;

  const { error: upErr } = await supabase
    .from('parsed_customers')
    .update({ service_label: clean, service_labels: [clean] })
    .in('id', ids);
  if (upErr) throw upErr;
  return ids.length;
}

// Bulk-apply a division to every parsed_customers row in the session that
// doesn't have one yet. Mirrors bulkApplyServiceToMissing for the same UX
// shortcut — one tap covers everything the auto-detector left null.
export async function bulkApplyDivisionToMissing(sessionId, division) {
  const clean = String(division || '')
    .trim()
    .toLowerCase();
  if (!['residential', 'commercial', 'exterior'].includes(clean)) return 0;

  const { data: imports, error: impErr } = await supabase
    .from('customer_imports')
    .select('id')
    .eq('session_id', sessionId);
  if (impErr) throw impErr;
  const importIds = (imports ?? []).map((i) => i.id);
  if (!importIds.length) return 0;

  const { data: all, error: selErr } = await supabase
    .from('parsed_customers')
    .select('id, category')
    .in('import_id', importIds);
  if (selErr) throw selErr;

  const ids = (all ?? []).filter((r) => !String(r.category ?? '').trim()).map((r) => r.id);
  if (!ids.length) return 0;

  const { error: upErr } = await supabase
    .from('parsed_customers')
    .update({ category: clean })
    .in('id', ids);
  if (upErr) throw upErr;
  return ids.length;
}

// Permanently drop a parsed_customers row. Used from the review screen when
// the owner doesn't want a customer brought into Cadi at all — different from
// keep=false which just excludes from THIS commit. Hard delete so the card
// disappears from the review screen and never re-surfaces.
export async function deleteParsedCustomer(id) {
  const { error } = await supabase.from('parsed_customers').delete().eq('id', id);
  if (error) throw error;
}

// Commit kept rows to live customers + recurring_jobs. No silent auto-commits —
// this is called from a user-explicit "Bring N in" button on the review screen.
// Returns { customersCreated, recurringCreated }.
export async function commitParsedToCustomers(sessionId, { limit = null, includeIds = null } = {}) {
  const parsed = await listParsedForSession(sessionId);
  let kept = parsed.filter((p) => p.keep && !p.committed);
  // Explicit selection wins over `limit` — the user hand-picked which parsed
  // rows to bring in (Lite "choose your 30"). Restrict to those before grouping.
  if (Array.isArray(includeIds)) {
    const idSet = new Set(includeIds);
    kept = kept.filter((p) => idSet.has(p.id));
  }
  if (!kept.length) return { customersCreated: 0, recurringCreated: 0, jobsImported: 0 };

  // ── 1. Group parsed rows by customer ─────────────────────────────────────
  // Each parsed row represents one JOB. Multiple jobs can belong to the same
  // customer (CleanerPlanner: Mrs Robinson with weekly clean + 6-monthly
  // gutters = 2 rows). Group by customer_ref, falling back to name+postcode.
  // Each group becomes ONE customer row + N recurring_jobs rows.
  const customerKey = (p) => {
    if (p.customer_ref && String(p.customer_ref).trim())
      return `ref:${String(p.customer_ref).trim()}`;
    const name = String(p.name ?? '')
      .trim()
      .toLowerCase();
    const pc = String(p.postcode ?? '')
      .replace(/\s/g, '')
      .toUpperCase();
    return `np:${name}::${pc}`;
  };

  const groups = new Map();
  kept.forEach((p, idx) => {
    const k = customerKey(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ ...p, _origIdx: idx });
  });

  // Lite cap — when `limit` is supplied, only commit the first `limit` distinct
  // customers. The rest stay as uncommitted parsed_customers so they can be
  // brought in later (e.g. after upgrading to Pro) — nothing is deleted. This
  // keeps the batch insert below the enforce_free_customer_limit trigger so it
  // can't 400 and roll the whole thing back.
  const allKeys = Array.from(groups.keys());
  const includedKeys = new Set(limit == null ? allKeys : allKeys.slice(0, Math.max(0, limit)));
  const includedKept = kept.filter((p) => includedKeys.has(customerKey(p)));

  // Server-side readiness gate — only the customers we're actually committing
  // need to be ready. The UI also checks this; this is the safety net so we
  // never silently commit half-baked customers.
  const notReady = includedKept.filter((p) => !customerReadiness(p).ready);
  if (notReady.length) {
    const names = notReady
      .slice(0, 3)
      .map((p) => p.name || 'one without a name')
      .join(', ');
    const more = notReady.length > 3 ? ` and ${notReady.length - 3} more` : '';
    throw new Error(
      `${notReady.length} customer${notReady.length === 1 ? ' isn’t' : 's aren’t'} ready yet — ${names}${more}.`
    );
  }

  // customers + recurring_jobs RLS gate on owner_id = auth.uid(). The
  // my_business_id() value can be different from auth.uid() (see the live
  // RLS-state memory). Use the auth uid directly.
  const ownerId = await getCurrentUserId();

  // Stamp a batch id so the existing Undo infrastructure (import_batch_id)
  // works on the onboarding flow too.
  const batchId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const primaryServices = (p) => {
    if (Array.isArray(p.service_labels) && p.service_labels.length) return p.service_labels;
    return p.service_label ? [p.service_label] : [];
  };

  // For each group: pick the row with the most contact info as the
  // "representative" + merge all service labels across the group.
  const customerRows = [];
  const customerGroupKeys = []; // parallel array for FK mapping below

  for (const [key, rows] of groups.entries()) {
    if (!includedKeys.has(key)) continue; // Lite cap — overflow stays uncommitted
    customerGroupKeys.push(key);
    const rep = rows.reduce((best, r) => {
      const score =
        (r.postcode ? 2 : 0) + (r.phone ? 1 : 0) + (r.email ? 1 : 0) + (r.address ? 1 : 0);
      const bestScore =
        (best.postcode ? 2 : 0) +
        (best.phone ? 1 : 0) +
        (best.email ? 1 : 0) +
        (best.address ? 1 : 0);
      return score > bestScore ? r : best;
    }, rows[0]);

    const allServices = new Set();
    rows.forEach((r) => primaryServices(r).forEach((s) => allServices.add(s)));

    // AR-balance guard (spec §6.1). Sum any outstanding_balance across the
    // group so the live customer shows the total they owe — but NEVER use
    // this as a price. Money tab only.
    const totalBalance = rows.reduce((sum, r) => {
      const v = Number(r.outstanding_balance);
      return Number.isFinite(v) ? sum + v : sum;
    }, 0);

    // Extract a clean round_name from the parsed Round (which may be in
    // the notes field as "Round: …") so the Customer card has its own
    // bookable field.
    const roundName = (rep.notes ?? '').match(/Round:\s*([^·\n]+)/i)?.[1]?.trim() || null;

    customerRows.push({
      owner_id: ownerId,
      name: rep.name || 'Unnamed customer',
      email: rep.email,
      phone: rep.phone,
      postcode: rep.postcode,
      address_line1: rep.address,
      notes: composeNotes(rep),
      category: rep.category,
      // status is the lifecycle flag (active/archived) — stays 'active' so
      // existing filters keep working. account_status is the operational
      // state — flip to 'pending_review' so the Customers tab can surface
      // imported rows for approval before scheduler / reports treat them as
      // live work. One tap to "Approve all" once the owner has eyeballed.
      status: 'active',
      source: 'onboarding',
      import_id: rep.import_id,
      import_batch_id: batchId,
      service_types: Array.from(allServices),
      customer_balance: totalBalance > 0 ? totalBalance : null,
      // Phase E follow-up: surface more of what we already parsed.
      customer_reference: rep.customer_ref || null,
      round_name: roundName,

      // First-job denormalised fields (the customers UI uses these for sort + display).
      // Roll past dates forward to the next future occurrence so customers
      // don't land with a 2-year-old "due date" that would push their first
      // Cadi-scheduled clean years out.
      price_per_visit: rep.price != null ? Number(rep.price) : null,
      schedule: rep.frequency_raw,
      frequency: rruleToHumanShort(rep.frequency_rrule) ?? rep.frequency_raw ?? null,
      due_date: rollAnchorForward(rep.anchor_date, rep.frequency_rrule),
      next_job_date: rollAnchorForward(rep.anchor_date, rep.frequency_rrule),
      account_status: 'pending_review',
    });
  }
  if (!customerRows.length) {
    return { customersCreated: 0, recurringCreated: 0, jobsImported: 0, batchId };
  }
  const { data: insertedCustomers, error: custErr } = await supabase
    .from('customers')
    .insert(customerRows)
    .select('id');
  if (custErr) throw custErr;

  // ── 2. recurring_jobs — one row per kept parsed row that has an rrule ──
  // Map each kept parsed row back to its customer's id via the group key.
  const customerIdByKey = new Map();
  customerGroupKeys.forEach((key, i) => {
    if (insertedCustomers?.[i]?.id) customerIdByKey.set(key, insertedCustomers[i].id);
  });

  const recurringRows = [];
  for (const p of kept) {
    if (!p.frequency_rrule) continue;
    const customerId = customerIdByKey.get(customerKey(p));
    if (!customerId) continue;
    const services =
      Array.isArray(p.service_labels) && p.service_labels.length
        ? p.service_labels
        : p.service_label
          ? [p.service_label]
          : [''];
    const primaryService = services[0] || '';
    recurringRows.push({
      owner_id: ownerId,
      customer_id: customerId,
      service: primaryService,
      type: mapCategoryToJobType(p.category),
      price: Number(p.price) || 0,
      duration_hrs: 1,
      assignees: [],
      assignee_ids: [],
      freq: rruleToFreq(p.frequency_rrule),
      freq_interval: rruleToInterval(p.frequency_rrule),
      anchor_date:
        rollAnchorForward(p.anchor_date, p.frequency_rrule) ||
        new Date().toISOString().slice(0, 10),
      preferred_hour: 9,
      status: 'active',
      notes: p.notes,
      source: 'onboarding',
      import_batch_id: batchId,
    });
  }
  if (recurringRows.length) {
    const { error: recErr } = await supabase.from('recurring_jobs').insert(recurringRows);
    if (recErr) throw recErr;
  }

  // ── 2b. customer_rounds — one row per kept parsed row with a price ──────
  // The existing CustomerDetail UI ("£X/visit total") reads from
  // customer_rounds, not customers.price_per_visit directly. Writing here
  // keeps imported customers visible in that surface without rewiring it.
  // customer_rounds.business_id is FK to businesses.id (NOT auth.uid()),
  // so we resolve it via the same RPC the legacy importer uses.
  let roundsBusinessId = null;
  try {
    const { data: bid } = await supabase.rpc('my_business_id');
    roundsBusinessId = bid ?? null;
  } catch {
    /* silent — we'll skip the rounds writeback below */
  }

  const roundRows = [];
  for (const p of kept) {
    if (Number(p.price) <= 0 && !p.frequency_raw) continue;
    const customerId = customerIdByKey.get(customerKey(p));
    if (!customerId) continue;
    roundRows.push({
      business_id: roundsBusinessId,
      customer_id: customerId,
      job_reference: null,
      round_name: p.frequency_raw || null,
      schedule: p.frequency_raw || null,
      price_per_visit: Number(p.price) > 0 ? Number(p.price) : null,
      due_date: rollAnchorForward(p.anchor_date, p.frequency_rrule),
      // Mirror the customers row — pending_review until the owner approves
      // the imported batch in the Customers tab.
      account_status: 'pending_review',
      notes: p.notes,
      import_batch_id: batchId,
    });
  }
  // Skip if we couldn't resolve a business_id — customer still lands with
  // their price_per_visit on the customers row + recurring_jobs entry; the
  // CustomerDetail UI will show £0 in the rounds card but everything else
  // still works. Non-critical compared to refusing the whole commit.
  if (roundRows.length && roundsBusinessId) {
    const { error: rrErr } = await supabase.from('customer_rounds').insert(roundRows);
    if (rrErr) throw rrErr;
  }

  // ── 3. mark parsed_customers committed ──────────────────────────────────
  // Only the rows we actually committed — Lite overflow stays uncommitted so it
  // can be brought in later after an upgrade.
  const keptIds = includedKept.map((p) => p.id);
  await supabase.from('parsed_customers').update({ committed: true }).in('id', keptIds);

  // ── 4. tick the wizard's "Bring your customers across" step ──────────────
  // Best-effort — never block the commit return on this.
  try {
    const { data: bs } = await supabase
      .from('business_settings')
      .select('setup_data')
      .eq('owner_id', ownerId)
      .maybeSingle();
    const existing = bs?.setup_data ?? {};
    const steps = Array.isArray(existing.wizard_completed_steps)
      ? existing.wizard_completed_steps
      : [];
    const nextSteps = steps.includes('customers') ? steps : [...steps, 'customers'];
    await supabase.from('business_settings').upsert(
      {
        owner_id: ownerId,
        setup_data: { ...existing, customers_imported: true, wizard_completed_steps: nextSteps },
      },
      { onConflict: 'owner_id' }
    );
  } catch {
    /* silent — wizard tick is non-critical */
  }

  return {
    customersCreated: insertedCustomers?.length ?? 0,
    recurringCreated: recurringRows.length,
    jobsImported: includedKept.length,
    batchId,
  };
}

// Count the caller's active (non-archived) customers. Used by the onboarding
// review screen to work out Lite headroom before committing an import.
export async function countActiveCustomers() {
  const { count, error } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'archived');
  if (error) throw error;
  return count ?? 0;
}

// ── Step 4 — Service menu ────────────────────────────────────────────────────
// Trigger Sonnet generation (or return cache) for the session's menu.
export async function generateMenuDraft(sessionId, { regenerate = false } = {}) {
  const { data, error } = await supabase.functions.invoke('generate-service-menu', {
    body: { session_id: sessionId, regenerate },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.menu ?? { sections: [] };
}

// Persist user edits to the draft so reloads keep them.
export async function saveMenuDraft(sessionId, menu) {
  const { error } = await supabase
    .from('onboarding_sessions')
    .update({ menu_draft: menu, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

// Commit the confirmed menu to the live `services` table. Upserts by
// case-insensitive name match within the business so re-running doesn't
// duplicate. Marks generated_from_import so we can tell these apart from
// hand-built rows later.
export async function commitMenuToServices(sessionId, menu) {
  const ownerId = await getCurrentUserId();
  // services.business_id FKs to businesses.id (NOT auth.uid()), so resolve
  // via the RPC like the rest of the catalogue surfaces do.
  const { data: businessId, error: bidErr } = await supabase.rpc('my_business_id');
  if (bidErr) throw bidErr;
  if (!businessId) throw new Error("Couldn't resolve your business id");

  const sections = Array.isArray(menu?.sections) ? menu.sections : [];

  // ── Group menu entries by canonical service name ────────────────────────
  // Sonnet emits one entry per TIER (e.g. "Window Cleaning — Terraced",
  // "Window Cleaning — Semi-detached", "Window Cleaning — Detached") with
  // tier_of="Window Cleaning". We collapse them back into ONE services row
  // with N service_tiers rows — never N separate services rows.
  const groups = [];
  for (const section of sections) {
    const division = String(section?.division ?? '').toLowerCase();
    // Cadi may have asked a section-level question and the owner answered it
    // in StepMenu. Carry the Q+A through so we can seed cadi_context on every
    // service in this section — Front Desk reads it later when quoting.
    const sectionContext =
      section?.question && section?.question_answer
        ? `Cadi asked: ${String(section.question).trim()}\nYou said: ${String(section.question_answer).trim()}`
        : null;
    const local = new Map();
    for (const entry of Array.isArray(section?.services) ? section.services : []) {
      const name = String(entry?.name ?? '').trim();
      if (!name) continue;
      const canonical = String(entry?.tier_of ?? '').trim() || name;
      const key = canonical.toLowerCase();
      if (!local.has(key)) {
        local.set(key, { canonical, division, entries: [], rep: entry, sectionContext });
      }
      local.get(key).entries.push(entry);
    }
    for (const g of local.values()) groups.push(g);
  }

  if (!groups.length) {
    await updateStep(sessionId, 'reveal');
    return { inserted: 0, updated: 0, tiers: 0 };
  }

  // ── Resolve which services already exist (case-insensitive match) ──────
  const { data: existing } = await supabase
    .from('services')
    .select('id, name')
    .eq('business_id', businessId);
  const existingByName = new Map(
    (existing ?? []).map((e) => [
      String(e.name ?? '')
        .toLowerCase()
        .trim(),
      e.id,
    ])
  );

  let inserted = 0,
    updated = 0,
    tiersWritten = 0;

  for (const group of groups) {
    const isTiered = group.entries.length > 1 || group.entries.some((e) => e?.tier_of);
    const repModel = group.rep?.pricing_model ?? 'flat';
    const pricing_model = isTiered ? 'tiered' : repModel;
    const booking_mode = group.rep?.booking_mode ?? 'enquiry';

    // pricing_config — model-specific. quotePrice reads from here.
    let pricing_config = null;
    if (pricing_model === 'flat' && group.rep?.suggested_price != null) {
      pricing_config = { price: Number(group.rep.suggested_price) };
    }

    // booking_ready — surfaces show "bookable" badge when true. Locked off
    // for enquiry-mode services per the floor invariant.
    const booking_ready =
      booking_mode !== 'enquiry' && (isTiered || group.rep?.suggested_price != null);

    // Phase D — template-locked services carry per-tier is_estimated flags.
    // We can't add columns, so we persist a { tier_key → bool } map on
    // services.inference_meta.tier_estimates. getCatalogue + the editors
    // read this to flag estimated tiers visually.
    const tierEstimates = {};
    if (isTiered) {
      for (const entry of group.entries) {
        if (entry?.tier_key && entry?.is_estimated) {
          tierEstimates[entry.tier_key] = true;
        }
      }
    }

    const serviceRow = {
      business_id: businessId,
      name: group.canonical,
      category: group.division || null,
      description_included: String(group.rep?.description ?? '').trim() || null,
      pricing_type: 'fixed',
      // For tiered services we don't put a single base price on the row —
      // quotePrice resolves per-tier.
      price_fixed_basic: isTiered ? null : (group.rep?.suggested_price ?? null),
      price_low: group.rep?.price_low ?? null,
      price_high: group.rep?.price_high ?? null,
      generated_from_import: true,
      is_active: true,
      booking_mode,
      pricing_model,
      pricing_config,
      default_duration_mins: group.rep?.default_duration_mins ?? null,
      status: 'live',
      booking_ready,
      inference_meta: {
        evidence: group.rep?.evidence ?? null,
        source_prices: group.rep?.source_prices ?? null,
        tier_estimates: Object.keys(tierEstimates).length ? tierEstimates : null,
        // Seed free-form Cadi context from the section question Cadi asked
        // during StepMenu. Owner edits this in the catalogue editor; Front
        // Desk reads it when quoting this service.
        cadi_context: group.sectionContext ?? null,
      },
    };

    // Upsert by name + clear children so the second commit cleanly replaces
    // the first.
    let serviceId;
    const existingId = existingByName.get(group.canonical.toLowerCase());
    if (existingId) {
      const { error } = await supabase.from('services').update(serviceRow).eq('id', existingId);
      if (error) throw error;
      serviceId = existingId;
      updated++;
      await supabase.from('service_tiers').delete().eq('service_id', serviceId);
      await supabase.from('service_units').delete().eq('service_id', serviceId);
      // service_modifiers preserved — owner may have added them by hand.
    } else {
      const { data, error } = await supabase
        .from('services')
        .insert(serviceRow)
        .select('id')
        .single();
      if (error) throw error;
      serviceId = data.id;
      inserted++;
    }

    // ── service_tiers rows for tiered services ──────────────────────────
    if (isTiered) {
      // Sort by suggested_price so tier_key indices reflect price order.
      const sortedEntries = [...group.entries].sort(
        (a, b) =>
          Number(a?.suggested_price ?? a?.price_low ?? 0) -
          Number(b?.suggested_price ?? b?.price_low ?? 0)
      );
      const tierRows = sortedEntries.map((entry, idx) => {
        // Template-locked entries already carry a canonical tier_key; use it
        // directly so the catalogue editor and Front Desk widget see stable
        // keys ("3bed", "2storey") rather than re-slugified labels.
        const after = String(entry.name ?? '')
          .split(/[—-]/)
          .slice(1)
          .join('-')
          .trim();
        const tierLabel = after || `Tier ${idx + 1}`;
        const tierKey = entry?.tier_key || slugifyForKey(tierLabel) || `tier${idx + 1}`;
        return {
          service_id: serviceId,
          tier_key: tierKey,
          label: tierLabel,
          price: Number(entry?.suggested_price ?? entry?.price_low ?? 0),
          customer_count: Number(entry?.customer_count) || 0,
          is_default: Boolean(entry?.is_default), // template tells us, else assigned below
          sort_order: idx,
        };
      });
      // Default tier — for template-locked services, the template already
      // tagged one. For ad-hoc tiers, fall back to most-customers heuristic.
      if (tierRows.length && !tierRows.some((r) => r.is_default)) {
        let maxIdx = 0;
        for (let i = 1; i < tierRows.length; i++) {
          if (tierRows[i].customer_count > tierRows[maxIdx].customer_count) maxIdx = i;
        }
        tierRows[maxIdx].is_default = true;
      }
      if (tierRows.length) {
        const { error } = await supabase.from('service_tiers').insert(tierRows);
        if (error) throw error;
        tiersWritten += tierRows.length;
      }
    }
  }

  // ── Snapshot the new catalogue ───────────────────────────────────────
  await snapshotCatalogue(businessId, ownerId);

  await updateStep(sessionId, 'reveal');

  // Tick the wizard's services step.
  try {
    const { data: bs } = await supabase
      .from('business_settings')
      .select('setup_data')
      .eq('owner_id', ownerId)
      .maybeSingle();
    const ex = bs?.setup_data ?? {};
    const steps = Array.isArray(ex.wizard_completed_steps) ? ex.wizard_completed_steps : [];
    const next = steps.includes('services') ? steps : [...steps, 'services'];
    await supabase.from('business_settings').upsert(
      {
        owner_id: ownerId,
        setup_data: { ...ex, menu_generated: true, wizard_completed_steps: next },
      },
      { onConflict: 'owner_id' }
    );
  } catch {
    /* silent */
  }

  return { inserted, updated, tiers: tiersWritten };
}

// "Semi-detached" → "semi_detached"; "From £46" → "from_46". Used as a
// stable identifier the booking surfaces pass back to quotePrice.
function slugifyForKey(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Materialise the new catalogue object and drop it into catalogue_versions.
// Best-effort — never blocks the commit because the live data already landed.
async function snapshotCatalogue(businessId, ownerId) {
  try {
    const { getCatalogue } = await import('../catalogue/index.js');
    const catalogue = await getCatalogue();
    const { data: lastVer } = await supabase
      .from('catalogue_versions')
      .select('version')
      .eq('business_id', businessId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (lastVer?.version ?? 0) + 1;
    await supabase.from('catalogue_versions').insert({
      business_id: businessId,
      version: nextVersion,
      snapshot: catalogue,
      created_by: ownerId,
    });
  } catch (e) {
    console.warn('catalogue snapshot failed:', e?.message ?? e);
  }
}

// ── Readiness check ──────────────────────────────────────────────────────────
// A customer "lands properly" with: name, a way to reach/find them, at least
// one service. Schedule info (frequency + next-due) is required for Ready
// and Nearly buckets — but the Decision bucket is "keep on file, no schedule"
// per the migration spec, so those rows commit without schedule info and
// just live in Customers without a recurring job.
export function customerReadiness(p, { noScheduleOk = null } = {}) {
  const missing = [];

  // Name
  if (!String(p.name ?? '').trim()) missing.push('name');

  // Contact / location — a cleaner can find a customer with EITHER a real
  // contact channel (postcode, phone, email) OR a usable street address.
  const hasIdent = Boolean(
    String(p.postcode ?? '').trim() ||
    String(p.phone ?? '').trim() ||
    String(p.email ?? '').trim() ||
    String(p.address ?? '').trim().length >= 4
  );
  if (!hasIdent) missing.push('address or contact');

  // Service
  const hasService =
    (Array.isArray(p.service_labels) && p.service_labels.length) ||
    Boolean(String(p.service_label ?? '').trim());
  if (!hasService) missing.push('service');

  // Schedule fields are only required for Ready / Nearly. Decision bucket
  // means "kept on file, no schedule" — perfectly valid to commit.
  // Caller can still force the check off via noScheduleOk=true.
  const schedRequired = noScheduleOk === null ? p.bucket !== 'decision' : !noScheduleOk;
  if (schedRequired) {
    if (!String(p.frequency_rrule ?? '').trim() && !String(p.frequency_raw ?? '').trim()) {
      missing.push('frequency');
    }
    if (!String(p.anchor_date ?? '').trim()) {
      missing.push('next due');
    }
  }

  return { ready: missing.length === 0, missing };
}

// Stitch parser-side day_preference and frequency_raw into the customer notes
// so nothing's lost when we promote the row.
function composeNotes(p) {
  const bits = [];
  if (p.notes) bits.push(String(p.notes).trim());
  if (p.day_preference) bits.push(`Day: ${p.day_preference}`);
  if (p.frequency_raw && !p.frequency_rrule) bits.push(`Frequency note: "${p.frequency_raw}"`);
  return bits.length ? bits.join('\n') : null;
}

// Roll a past anchor_date forward using the rrule until it lands on or
// after today. CleanerPlanner Jobs exports carry the "next_due" date AS OF
// EXPORT TIME — but those exports get stale and dates fall into the past.
// We never want to commit a customer with a 2-year-old "next due" date and
// then schedule them years in the future. So at commit (and on the review
// screen for visibility) we compute the actual next future occurrence.
//
// Returns YYYY-MM-DD string, or the original anchorDate if we can't roll
// (e.g. no rrule, malformed date).
export function rollAnchorForward(anchorDate, rrule, fromDate = new Date()) {
  if (!anchorDate || !rrule) return anchorDate;
  // Parse as a LOCAL date so we never round through UTC — `new Date('2026-06-05')`
  // is UTC midnight, which becomes the day before in BST when stringified again.
  const [ay, am, ad] = anchorDate.split('-').map(Number);
  const anchor = new Date(ay, (am || 1) - 1, ad || 1);
  if (Number.isNaN(anchor.getTime())) return anchorDate;
  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);
  if (anchor >= today) return anchorDate;

  // The CSV "Due" column is the date of the clean. If it's in the past that
  // clean has been and gone — project forward by the customer's frequency to
  // get the next real clean. (Originally we tried to snap overdue customers
  // to today, but that "punishes" them by burying a visit; the right move is
  // to recognise the cycle and roll one or more full intervals forward.)
  const interval = parseInt((rrule.match(/INTERVAL=(\d+)/) || [null, '1'])[1], 10) || 1;

  if (/FREQ=WEEKLY/.test(rrule)) {
    const stepMs = 7 * interval * 86400000;
    const cycles = Math.ceil((today - anchor) / stepMs);
    const next = new Date(anchor.getTime() + cycles * stepMs);
    return toLocalISODate(next);
  }
  if (/FREQ=DAILY/.test(rrule)) {
    const stepMs = interval * 86400000;
    const cycles = Math.ceil((today - anchor) / stepMs);
    const next = new Date(anchor.getTime() + cycles * stepMs);
    return toLocalISODate(next);
  }
  if (/FREQ=MONTHLY/.test(rrule)) {
    const next = new Date(anchor);
    while (next < today) next.setMonth(next.getMonth() + interval);
    return toLocalISODate(next);
  }
  return anchorDate;
}

// Format a Date as YYYY-MM-DD using its LOCAL components (not UTC). Avoids
// the BST/UTC off-by-one that `.toISOString().slice(0,10)` produces.
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Short canonical form: "weekly", "fortnightly", "4-weekly", "monthly"…
function rruleToHumanShort(rrule) {
  if (!rrule) return null;
  const i = parseInt((rrule.match(/INTERVAL=(\d+)/) || [])[1] ?? '1', 10);
  if (/FREQ=WEEKLY/.test(rrule)) {
    if (i === 1) return 'weekly';
    if (i === 2) return 'fortnightly';
    if (i === 4) return '4-weekly';
    return `every ${i} weeks`;
  }
  if (/FREQ=MONTHLY/.test(rrule)) return i === 1 ? 'monthly' : `every ${i} months`;
  if (/FREQ=DAILY/.test(rrule)) return i === 1 ? 'daily' : `every ${i} days`;
  return rrule;
}

// ── small rrule helpers (full RRULE.js is overkill for the subset we emit) ──
function rruleToFreq(rrule) {
  if (!rrule) return 'one-off';
  if (/FREQ=WEEKLY/.test(rrule)) return 'weekly';
  if (/FREQ=MONTHLY/.test(rrule)) return 'monthly';
  if (/FREQ=DAILY/.test(rrule)) return 'daily';
  return 'one-off';
}
function rruleToInterval(rrule) {
  const m = rrule?.match(/INTERVAL=(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}
function mapCategoryToJobType(cat) {
  if (cat === 'exterior') return 'exterior';
  if (cat === 'commercial') return 'commercial';
  return 'residential';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToSession(r) {
  if (!r) return null;
  return {
    id: r.id,
    businessId: r.business_id,
    step: r.step,
    divisions: r.divisions ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  };
}
