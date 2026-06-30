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
      connect_trades,
      connect_region,
      connect_capacity,
      connect_consent_gps
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
        site:sites ( id, name, postcode, lat, lng )
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

export async function connectCheckOut({ jobId, lat, lng, note }) {
  return callConnectFn('connect-checkout', { job_id: jobId, lat, lng, note });
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
          type:     'photo',
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
export async function listMyConnectInvoices() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('connect_invoices')
    .select(`
      id, reference, service_date, net_value, vat_value, total_value, status,
      submitted_at, exported_at, paid_at, note, created_at,
      job:jobs ( id, site:sites ( id, name, postcode ) ),
      fm_organisation:fm_organisations ( id, name )
    `)
    .eq('sub_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function submitConnectInvoice({ invoiceId, netValue, vatValue, note }) {
  return callConnectFn('connect-submit-invoice', {
    invoice_id: invoiceId,
    net_value:  netValue,
    vat_value:  vatValue,
    note,
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
