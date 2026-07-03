import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

/**
 * Cadi Connect — sub-side data helpers.
 *
 * Reads against the Phase 1 schema (migration 053):
 *   marketplace_listings · visit_specs · marketplace_bids ·
 *   sub_invitations · profiles (connect_* columns)
 *
 * RLS does the access control. These helpers just shape the joined rows
 * so the React pages don't have to know SQL.
 */

// ─── Current sub's Connect profile snapshot ─────────────────────────────────
export async function getMyConnectProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      business_name,
      first_name,
      last_name,
      connect_unlocked_by_fm_id,
      connect_score,
      connect_tier,
      connect_score_status,
      score_breakdown,
      score_recomputed_at,
      connect_trades,
      connect_region,
      connect_capacity,
      connect_consent_gps,
      home_postcode,
      postcode
    `)
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Open marketplace listings the sub can see ──────────────────────────────
// RLS gates by tier (score_floor) + by Connect-unlocked / assigned status.
// Joined with visit_spec → site → fm_organisations so the UI gets one shaped row.
export async function listOpenMarketplaceListings() {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(`
      id,
      visibility,
      format,
      score_floor,
      target_price,
      floor_price,
      ceiling_price,
      bid_window_hours,
      award_rule,
      status,
      cadi_pick_user_id,
      first_refusal_expires_at,
      created_at,
      fm_organisation:fm_organisations ( id, name ),
      visit_spec:visit_specs (
        id,
        frequency,
        scope,
        access_notes,
        duration_minutes,
        price_per_visit,
        site:sites ( id, name, address, postcode, lat, lng )
      )
    `)
    .in('status', ['open', 'bidding'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Bids I've placed ───────────────────────────────────────────────────────
export async function listMyBids() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('marketplace_bids')
    .select('id, listing_id, bid_price, fit_score, status, note, created_at')
    .eq('sub_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Place a bid on a listing ───────────────────────────────────────────────
// RLS allows the sub to insert their own bid. fit_score + match_breakdown can
// be set; the FM-side ranking algorithm recomputes anyway, so keep optional.
export async function placeBid({ listingId, price, note }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in first');

  const { data, error } = await supabase
    .from('marketplace_bids')
    .insert({
      listing_id:  listingId,
      sub_user_id: user.id,
      bid_price:   price,
      note:        note || null,
      status:      'submitted',
    })
    .select()
    .single();

  if (error) throw error;

  // Best-effort: tell the FM org their listing got a bid. We don't await on
  // the response — notification failure must not surface as a placeBid error.
  callConnectFn('connect-notify-bid', { listing_id: listingId, bid_id: data.id })
    .catch(() => { /* swallow */ });

  return data;
}

// ─── Withdraw a bid ─────────────────────────────────────────────────────────
export async function withdrawBid(bidId) {
  const { error } = await supabase
    .from('marketplace_bids')
    .update({ status: 'withdrawn' })
    .eq('id', bidId);
  if (error) throw error;
}

// ─── My visit_specs (assigned recurring work) ───────────────────────────────
export async function listMyAssignedVisitSpecs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('visit_specs')
    .select(`
      id,
      frequency,
      scope,
      access_notes,
      duration_minutes,
      price_per_visit,
      status,
      created_at,
      contract:contracts ( id, name, fm_organisation_id ),
      site:sites ( id, name, postcode, address, lat, lng, geo_fence_radius_m ),
      fm_organisation:fm_organisations ( id, name )
    `)
    .eq('assigned_sub_user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Per-sub fit-score helper (client-side) ─────────────────────────────────
// Mirrors the FM-side ranking. Returns 0-100. Distance is in miles.
export function computeFitScore({ price, listingTarget, listingFloor, score, distanceMi, capacityFree }) {
  const priceComp =
    listingFloor && listingTarget && listingTarget > listingFloor
      ? Math.max(60, 100 - Math.round(((price - listingFloor) / (listingTarget - listingFloor)) * 50))
      : 90;
  const scoreComp    = Math.max(0, Math.min(100, score ?? 0));
  const distanceComp = Math.max(40, 100 - Math.round((distanceMi ?? 0) * 2));
  const capacityComp = Math.min(100, (capacityFree ?? 1) * 10);

  // FM-side weights — mirror exactly so subs see what the FM sees
  return Math.round(priceComp * 0.4 + scoreComp * 0.35 + distanceComp * 0.15 + capacityComp * 0.1);
}

// ─── Upcoming + in-progress jobs assigned to me ─────────────────────────────
export async function listMyConnectJobs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      status,
      approval_status,
      query_note,
      rejection_note,
      date,
      start_hour,
      duration_hrs,
      completion_marked_at,
      actual_duration_minutes,
      visit_spec_id,
      site:sites ( id, name, postcode, address, lat, lng, geo_fence_radius_m ),
      fm_organisation:fm_organisations ( id, name )
    `)
    .eq('sub_user_id', user.id)
    .is('deleted_at', null)
    .in('status', ['scheduled', 'in_progress', 'complete', 'unassigned', 'pending_confirmation'])
    .order('date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Geo-fenced check-in / out via edge functions ───────────────────────────
// Uses raw fetch (not supabase.functions.invoke) to dodge the gateway
// preflight x-client-info issue. See InviteAccept.jsx for the same pattern.
async function callConnectFn(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      'apikey':        SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

export async function connectCheckIn({ jobId, lat, lng, accuracyM }) {
  return callConnectFn('connect-checkin', { job_id: jobId, lat, lng, accuracy_m: accuracyM });
}

export async function connectCheckOut({ jobId, lat, lng, note, customerOnSite, customerName }) {
  return callConnectFn('connect-checkout', {
    job_id: jobId, lat, lng, note,
    customer_on_site: customerOnSite,
    customer_name:    customerName,
  });
}

/**
 * Upload an array of File objects to the connect-job-evidence bucket
 * under {jobId}/ and insert one job_evidence row per file. Returns the
 * inserted evidence rows so the caller can show success state. Best-
 * effort: any per-file failure is logged but doesn't abort the rest.
 *
 * Storage path: {jobId}/{epoch}-{safeFilename}
 * Evidence type: 'photo' (currently the only kind the modal supports)
 */
export async function uploadCheckoutEvidence({ jobId, files, note }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in first');

  const inserted = [];

  // Note-only evidence row (so the FM can see the note in the approval
  // drawer even when no photos were uploaded).
  if (note && note.trim()) {
    const { data: noteRow, error: noteErr } = await supabase
      .from('job_evidence')
      .insert({
        job_id:   jobId,
        owner_id: user.id,
        type:     'note',
        data:     { text: note.trim(), source: 'checkout' },
      })
      .select('id, type, data, created_at')
      .single();
    if (noteErr) console.error('uploadCheckoutEvidence note error:', noteErr);
    else inserted.push(noteRow);
  }

  for (const file of files || []) {
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `${jobId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from('connect-job-evidence')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        console.error('uploadCheckoutEvidence upload error:', upErr);
        continue;
      }

      // Signed URL with 30-day expiry — re-signable when the approval
      // drawer fetches it. Stored as plain `url` on data so the
      // existing FM approval renderer (e.data.url) picks it up.
      const { data: signed, error: signErr } = await supabase.storage
        .from('connect-job-evidence')
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      if (signErr) console.error('uploadCheckoutEvidence sign error:', signErr);

      const { data: evRow, error: evErr } = await supabase
        .from('job_evidence')
        .insert({
          job_id:   jobId,
          owner_id: user.id,
          // 'after_photo' is the type the job_evidence_type_check constraint
          // accepts for post-work photos. Using 'photo' silently fails the
          // CHECK (allowed: before_photo | after_photo | signature | note |
          // timestamp). Checkout-modal photos are by definition after-work.
          type:     'after_photo',
          data:     {
            url:       signed?.signedUrl ?? null,
            path,
            mime:      file.type,
            size_b:    file.size,
            source:    'checkout',
          },
        })
        .select('id, type, data, created_at')
        .single();
      if (evErr) {
        console.error('uploadCheckoutEvidence row error:', evErr);
        continue;
      }
      inserted.push(evRow);
    } catch (err) {
      console.error('uploadCheckoutEvidence unexpected error:', err);
    }
  }

  return inserted;
}

/** Browser geolocation as a Promise. */
export function getCurrentPosition({ timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not available on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
      }),
      err => reject(new Error(err.message || 'Could not read your location.')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

// ─── Connect invoices (sub side) ────────────────────────────────────────────
// Now multi-line. Each invoice has 1+ rows in connect_invoice_lines (one per
// approved job, typically). Merged invoices have many lines from many jobs.
export async function listMyConnectInvoices() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('connect_invoices')
    .select(`
      id, reference, service_date, net_value, vat_value, total_value, status,
      submitted_at, exported_at, paid_at, note, created_at,
      job:jobs ( id, site:sites ( id, name, postcode ) ),
      fm_organisation:fm_organisations ( id, name ),
      lines:connect_invoice_lines (
        id, job_id, description, service_date, net_value, vat_value, created_at
      )
    `)
    .eq('sub_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function mergeConnectInvoices({ sourceInvoiceIds, reference }) {
  return callConnectFn('connect-merge-invoices', {
    source_invoice_ids: sourceInvoiceIds,
    reference,
  });
}

export async function submitConnectInvoice({ invoiceId, netValue, vatValue, note }) {
  return callConnectFn('connect-submit-invoice', {
    invoice_id: invoiceId,
    net_value:  netValue,
    vat_value:  vatValue,
    note,
  });
}

// ─── Query thread (job_messages) ────────────────────────────────────────────
// Used while a job is approval_status='queried'. RLS lets the sub read
// every message on their own jobs (sub + fm authored).
export async function listJobMessages(jobId) {
  const { data, error } = await supabase
    .from('job_messages')
    .select('id, author_id, author_role, body, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function postJobMessage({ jobId, body }) {
  return callConnectFn('connect-job-message', { job_id: jobId, body });
}

export async function resubmitConnectJob(jobId) {
  return callConnectFn('connect-resubmit-job', { job_id: jobId });
}

// ─── Sub-schedules-own-visits ──────────────────────────────────────────────
// Sub picks a date for one of their assigned recurring visit_specs. The FM's
// Schedule view auto-picks up the created jobs row — no confirmation loop.
export async function scheduleConnectVisit({ visitSpecId, date, startHour }) {
  return callConnectFn('connect-schedule-visit', {
    visit_spec_id: visitSpecId,
    date,
    start_hour:    typeof startHour === 'number' ? startHour : undefined,
  });
}

// ─── Availability blocks (sub side) ────────────────────────────────────────
// Sub carves out holidays / downtime. FMs see them on the contractor
// profile so they don't schedule work into a blocked window. The sub's
// own schedule-visit modal warns on conflicts (never hard-blocks — the
// sub can override if they change their mind).
export async function listMyAvailability() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('connect_sub_availability')
    .select('id, start_date, end_date, reason, created_at')
    .eq('sub_user_id', user.id)
    .gte('end_date', today)          // only relevant / upcoming blocks
    .order('start_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addAvailabilityBlock({ startDate, endDate, reason }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in first');
  if (!startDate || !endDate) throw new Error('Start and end dates required');
  if (endDate < startDate) throw new Error('End date must be on or after start date');
  const { data, error } = await supabase
    .from('connect_sub_availability')
    .insert({
      sub_user_id: user.id,
      start_date:  startDate,
      end_date:    endDate,
      reason:      reason?.trim() || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAvailabilityBlock(id) {
  const { error } = await supabase.from('connect_sub_availability').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// Pure helper — does the given ISO date land inside any block?
export function isDateInBlocks(dateIso, blocks) {
  if (!dateIso || !Array.isArray(blocks)) return null;
  for (const b of blocks) {
    if (dateIso >= b.start_date && dateIso <= b.end_date) return b;
  }
  return null;
}

// ─── Compliance documents (sub side) ───────────────────────────────────────
// Central catalogue of the doc types we support. Order = display order on
// the profile page.
export const SUB_DOC_TYPES = [
  { key: 'public_liability',    label: 'Public Liability insurance',    hint: 'Certificate — required by nearly every FM' },
  { key: 'employers_liability', label: 'Employers Liability insurance', hint: 'Required if you employ any staff' },
  { key: 'dbs_basic',           label: 'DBS Basic check',               hint: 'Required for many commercial + public sector sites' },
  { key: 'dbs_enhanced',        label: 'DBS Enhanced check',            hint: 'Schools, care homes, government sites' },
  { key: 'company_reg',         label: 'Companies House certificate',   hint: 'Ltd companies only' },
  { key: 'vat_reg',             label: 'VAT registration certificate',  hint: 'If VAT registered' },
  { key: 'ico_reg',             label: 'ICO registration',              hint: 'Data protection (if handling personal data)' },
  { key: 'hs_policy',           label: 'Health & Safety policy',        hint: 'PDF or Word doc of your H&S procedures' },
  { key: 'method_statement',    label: 'Method statements / RAMS',      hint: 'Risk assessments / method statements' },
  { key: 'other',               label: 'Other',                          hint: 'Anything else the FM asks for' },
];

export async function listMySubDocs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('connect_sub_docs')
    .select('*')
    .eq('sub_user_id', user.id);
  if (error) throw error;
  return data ?? [];
}

// Sign a URL for viewing a stored doc. Default 1 hour TTL — enough for a
// tab, short enough not to be sharable indefinitely.
export async function signSubDocUrl(filePath, ttlSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from('connect-sub-docs')
    .createSignedUrl(filePath, ttlSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadSubDoc({ docType, file, issuedDate, expiryDate, provider, policyNumber, notes }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in first');
  if (!docType || !file) throw new Error('docType + file required');

  // If a doc of this type already exists, delete the old storage object
  // first so we don't leak files. The DB row will be replaced via upsert.
  const { data: existing } = await supabase
    .from('connect_sub_docs')
    .select('file_path')
    .eq('sub_user_id', user.id)
    .eq('doc_type', docType)
    .maybeSingle();
  if (existing?.file_path) {
    await supabase.storage.from('connect-sub-docs').remove([existing.file_path]).catch(() => {});
  }

  const extension = (file.name || '').split('.').pop()?.toLowerCase() || 'bin';
  const path = `${user.id}/${docType}-${Date.now()}.${extension}`;
  const { error: upErr } = await supabase.storage
    .from('connect-sub-docs')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;

  const payload = {
    sub_user_id:   user.id,
    doc_type:      docType,
    file_path:     path,
    file_name:     file.name ?? null,
    mime_type:     file.type ?? null,
    size_bytes:    file.size ?? null,
    issued_date:   issuedDate  || null,
    expiry_date:   expiryDate  || null,
    provider:      provider    || null,
    policy_number: policyNumber|| null,
    notes:         notes       || null,
    updated_at:    new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('connect_sub_docs')
    .upsert(payload, { onConflict: 'sub_user_id,doc_type' })
    .select('*')
    .single();
  if (error) {
    // Roll back the just-uploaded file if the row insert failed
    await supabase.storage.from('connect-sub-docs').remove([path]).catch(() => {});
    throw error;
  }
  return data;
}

export async function deleteSubDoc(docId) {
  const { data: row } = await supabase
    .from('connect_sub_docs')
    .select('file_path')
    .eq('id', docId)
    .maybeSingle();
  if (row?.file_path) {
    await supabase.storage.from('connect-sub-docs').remove([row.file_path]).catch(() => {});
  }
  const { error } = await supabase.from('connect_sub_docs').delete().eq('id', docId);
  if (error) throw error;
  return true;
}

// ─── FM ratings I've received ──────────────────────────────────────────────
// One row per rated job. Pulls the FM name + site name so the sub's profile
// can render "5★ · Britannia · Vauxhall Bedford" without extra joins.
export async function listMyFmRatings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('job_ratings')
    .select(`
      job_id, stars, comment, created_at,
      fm_organisation:fm_organisations ( id, name ),
      job:jobs ( id, date, site:sites ( id, name ) )
    `)
    .eq('sub_user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({
    ...r,
    fmName:       r.fm_organisation?.name ?? 'FM',
    siteName:     r.job?.site?.name ?? '—',
    serviceDate:  r.job?.date ?? null,
  }));
}

// Latest job + upcoming-scheduled job per visit_spec for the current sub.
// Powers the "last visit / next-due / already scheduled" state on the
// Pipeline tab so the sub knows what to book next without leaving the row.
export async function getMyVisitSpecJobHistory() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from('jobs')
    .select('id, visit_spec_id, date, status, approval_status, completion_marked_at')
    .eq('sub_user_id', user.id)
    .is('deleted_at', null)
    .not('visit_spec_id', 'is', null)
    .order('date', { ascending: true });
  if (error) throw error;

  const now = new Date().toISOString().slice(0, 10);
  const bySpec = {};
  for (const j of data ?? []) {
    const cur = bySpec[j.visit_spec_id] ?? { last: null, nextScheduled: null, jobs: [] };
    cur.jobs.push(j);
    // Track the most-recent completed job (for "last visit was …")
    if (j.completion_marked_at && (!cur.last || j.date > cur.last.date)) {
      cur.last = j;
    }
    // Track the soonest upcoming scheduled job (for "next visit on …")
    if (j.date >= now && (j.status === 'scheduled' || j.status === 'in_progress')) {
      if (!cur.nextScheduled || j.date < cur.nextScheduled.date) {
        cur.nextScheduled = j;
      }
    }
    bySpec[j.visit_spec_id] = cur;
  }
  return bySpec;
}

// Compute the next-due date for a recurring visit spec based on its
// frequency and the last completed visit date. Pure fn — easy to reason
// about, no DB call.
export function nextDueDate(frequency, lastDateIso) {
  if (frequency === 'one_off') return null;
  const base = lastDateIso ? new Date(lastDateIso) : new Date();
  const d = new Date(base);
  switch (frequency) {
    case 'weekly':      d.setDate(d.getDate() + 7); break;
    case 'fortnightly': d.setDate(d.getDate() + 14); break;
    case 'monthly':     d.setMonth(d.getMonth() + 1); break;
    case 'quarterly':   d.setMonth(d.getMonth() + 3); break;
    case 'annual':      d.setFullYear(d.getFullYear() + 1); break;
    default:            return null;
  }
  return d.toISOString().slice(0, 10);
}

// ─── Marketplace listing Q&A ────────────────────────────────────────────────
// Public thread per listing — questions from sub bidders + FM answers, both
// visible to every other bidder. Subs render anonymously to peers on the UI
// side; the API returns author_id so the current viewer can highlight
// their own posts as "You asked…".
export async function listListingQuestions(listingId) {
  const { data, error } = await supabase
    .from('marketplace_listing_qa')
    .select('id, listing_id, author_id, author_role, body, parent_id, created_at')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function postListingQuestion({ listingId, body, parentId }) {
  return callConnectFn('connect-listing-question', {
    listing_id: listingId,
    body,
    parent_id:  parentId ?? null,
  });
}

// ─── Tier label helper ──────────────────────────────────────────────────────
export const TIER_LABEL = {
  elite:    'Elite tier · ≥93',
  verified: 'Verified · ≥80',
  eligible: 'Eligible · ≥70',
};

export const TIER_COLOR = {
  elite:    '#a78bfa',
  verified: '#16a34a',
  eligible: '#fbbf24',
};
