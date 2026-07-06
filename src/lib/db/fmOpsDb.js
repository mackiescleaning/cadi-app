import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

/**
 * Cadi Connect — FM-side data helpers.
 *
 * Counterpart to connectDb.js. Reads/writes scoped to the caller's
 * fm_organisation_id via RLS (set on tables in migrations 053 + 056).
 *
 * Edge functions are called via callFmFn() — raw fetch to dodge the
 * Supabase gateway preflight x-client-info issue. Same pattern as
 * connectDb.callConnectFn().
 */

// ── Raw-fetch edge-function caller (CORS workaround) ───────────────────────
async function callFmFn(name, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

// ── Current FM-org snapshot ────────────────────────────────────────────────
export async function getMyFmOrganisation() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('fm_organisation_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profErr || !prof?.fm_organisation_id) return null;

  const { data, error } = await supabase
    .from('fm_organisations')
    .select('id, name')
    .eq('id', prof.fm_organisation_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Contractors: invitations + claimed sub profiles ────────────────────────
// Returns a flat list of contractor records the FM sees in their network.
// Pending = invitation sent but sub hasn't claimed yet.
// Active  = sub has claimed; we surface their Connect profile fields too.
export async function listFmContractors() {
  const { data: invites, error: invErr } = await supabase
    .from('sub_invitations')
    .select(
      `
      id,
      company_name,
      contact_name,
      email,
      phone,
      region,
      trades,
      status,
      claimed_by_user_id,
      claimed_at,
      expires_at,
      created_at
    `
    )
    .order('created_at', { ascending: false });
  if (invErr) throw invErr;

  const claimedIds = (invites ?? []).map((r) => r.claimed_by_user_id).filter(Boolean);

  let profilesById = {};
  if (claimedIds.length > 0) {
    // Curated FM-facing projection via SECURITY DEFINER fn — NOT the raw profiles
    // table (which exposes the sub's HMRC/bank tokens, NINO, home postcode, etc).
    // See migrations 090/091.
    const { data: profs, error: profErr } = await supabase.rpc('connect_sub_profiles', {
      p_ids: claimedIds,
    });
    if (profErr) throw profErr;
    profilesById = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
  }

  return (invites ?? []).map((inv) => {
    const prof = inv.claimed_by_user_id ? profilesById[inv.claimed_by_user_id] : null;
    return {
      id: inv.id,
      claimedUserId: inv.claimed_by_user_id,
      companyName: prof?.business_name || inv.company_name || inv.contact_name || inv.email || '—',
      contactName: inv.contact_name,
      email: inv.email,
      phone: inv.phone,
      region: prof?.connect_region || inv.region || 'Unassigned',
      trades: prof?.connect_trades?.length ? prof.connect_trades : (inv.trades ?? []),
      score: prof?.connect_score ?? null,
      tier: prof?.connect_tier ?? null,
      capacity: prof?.connect_capacity ?? null,
      status: inv.status, // pending / claimed / declined / expired
      claimedAt: inv.claimed_at,
      invitedAt: inv.created_at,
      expiresAt: inv.expires_at,
    };
  });
}

// ── Region-bucket helper for the UI ────────────────────────────────────────
export function groupByRegion(contractors) {
  const buckets = new Map();
  for (const c of contractors) {
    const key = c.region || 'Unassigned';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  }
  return Array.from(buckets.entries())
    .map(([region, subs]) => ({ region, subs }))
    .sort((a, b) => {
      if (a.region === 'Unassigned') return 1;
      if (b.region === 'Unassigned') return -1;
      return a.region.localeCompare(b.region);
    });
}

// ── KPIs ───────────────────────────────────────────────────────────────────
export function summariseContractors(contractors) {
  const active = contractors.filter((c) => c.status === 'claimed');
  const pending = contractors.filter((c) => c.status === 'pending');
  const scored = active.filter((c) => typeof c.score === 'number');
  return {
    total: contractors.length,
    active: active.length,
    pending: pending.length,
    avgScore: scored.length
      ? Math.round(scored.reduce((a, c) => a + c.score, 0) / scored.length)
      : null,
  };
}

// ── Bulk import ────────────────────────────────────────────────────────────
export async function fmBulkImportSubs({ rows, sendEmail = true }) {
  return callFmFn('fm-bulk-import-subs', { rows, send_email: sendEmail });
}

// ── CSV parser ─────────────────────────────────────────────────────────────
// Minimal RFC4180-ish parser — handles quoted cells + escaped quotes.
// Returns { headers: string[], rows: Array<Record<string,string>> }.
export function parseCsv(text) {
  const lines = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (cur.length || lines.length) lines.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length) lines.push(cur);
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitRow = (line) => {
    const out = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = !q;
      } else if (ch === ',' && !q) {
        out.push(cell);
        cell = '';
      } else cell += ch;
    }
    out.push(cell);
    return out.map((s) => s.trim());
  };

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const rows = lines
    .slice(1)
    .filter((l) => l.trim().length)
    .map((line) => {
      const cells = splitRow(line);
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = cells[i] ?? '';
      });
      return obj;
    });
  return { headers, rows };
}

// Map a parsed CSV row → fm-bulk-import-subs row payload.
// Looks for common header aliases — company / name / email / phone / region / trades.
export function csvRowToInvite(row) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim().length) return String(v).trim();
    }
    return null;
  };
  const trades = pick('trades', 'trade', 'services')
    ? pick('trades', 'trade', 'services')
        .split(/[;,/]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return {
    company_name: pick('company', 'company_name', 'business', 'business_name', 'name'),
    contact_name: pick('contact', 'contact_name', 'first_name'),
    email: pick('email', 'email_address', 'e-mail')?.toLowerCase() ?? null,
    phone: pick('phone', 'mobile', 'telephone', 'tel'),
    region: pick('region', 'area', 'territory'),
    trades,
  };
}

// ── Contracts list (with site + sub roll-ups) ──────────────────────────────
export async function listContracts() {
  const { data, error } = await supabase
    .from('contracts')
    .select(
      `
      id, name, work_type, starts_on, billing_terms, status, created_at,
      end_client:end_clients ( id, name ),
      visit_specs ( id, frequency, price_per_visit, status, assigned_sub_user_id, site_id )
    `
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((c) => {
    const specs = c.visit_specs ?? [];
    const siteIds = new Set(specs.map((s) => s.site_id).filter(Boolean));
    const subIds = new Set(specs.map((s) => s.assigned_sub_user_id).filter(Boolean));
    const freqs = Array.from(new Set(specs.map((s) => s.frequency))).filter(Boolean);
    const prices = specs.map((s) => Number(s.price_per_visit) || 0);
    const sumPrice = prices.reduce((a, b) => a + b, 0);
    const avgPrice = prices.length ? sumPrice / prices.length : 0;
    return {
      id: c.id,
      name: c.name,
      endClient: c.end_client?.name ?? null,
      workType: c.work_type,
      startsOn: c.starts_on,
      billingTerms: c.billing_terms,
      status: c.status,
      createdAt: c.created_at,
      siteCount: siteIds.size,
      visitSpecCount: specs.length,
      frequencies: freqs,
      perVisitAvg: Math.round(avgPrice),
      subCount: subIds.size,
    };
  });
}

// ── Single contract detail ─────────────────────────────────────────────────
export async function getContract(contractId) {
  const { data: contract, error: cErr } = await supabase
    .from('contracts')
    .select(
      `
      id, name, work_type, starts_on, billing_terms, status, created_at,
      end_client:end_clients ( id, name )
    `
    )
    .eq('id', contractId)
    .is('deleted_at', null)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!contract) return null;

  const { data: specs, error: sErr } = await supabase
    .from('visit_specs')
    .select(
      `
      id, frequency, scope, access_notes, duration_minutes, price_per_visit,
      assigned_sub_user_id, status, created_at,
      site:sites ( id, name, postcode, address, lat, lng, notes ),
      assigned_sub:profiles!visit_specs_assigned_sub_user_id_fkey (
        id, business_name, first_name, last_name, connect_region
      )
    `
    )
    .eq('contract_id', contractId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (sErr) throw sErr;

  return { ...contract, visitSpecs: specs ?? [] };
}

// ── Active subs in this FM's network (for the allocation picker) ───────────
// Returns claimed sub-invitation rows joined with their Connect profile.
export async function listFmActiveSubs() {
  const { data: invites, error: iErr } = await supabase
    .from('sub_invitations')
    .select('id, claimed_by_user_id')
    .eq('status', 'claimed')
    .not('claimed_by_user_id', 'is', null);
  if (iErr) throw iErr;

  const ids = (invites ?? []).map((r) => r.claimed_by_user_id);
  if (ids.length === 0) return [];

  // Curated FM-facing projection via SECURITY DEFINER fn. See migrations 090/091.
  const { data: profs, error: pErr } = await supabase.rpc('connect_sub_profiles', { p_ids: ids });
  if (pErr) throw pErr;

  return (profs ?? []).map((p) => ({
    id: p.id,
    name: p.business_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '—',
    region: p.connect_region || 'Unassigned',
    score: p.connect_score ?? null,
    tier: p.connect_tier ?? null,
    capacity: p.connect_capacity ?? null,
    trades: p.connect_trades ?? [],
  }));
}

// ── End-client helpers ─────────────────────────────────────────────────────
// Reuse a same-name end_client for this org if it exists; otherwise insert.
export async function ensureEndClient({ fmOrganisationId, name }) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) throw new Error('End-client name is required');

  const { data: existing, error: lookupErr } = await supabase
    .from('end_clients')
    .select('id, name')
    .eq('fm_organisation_id', fmOrganisationId)
    .ilike('name', trimmed)
    .is('deleted_at', null)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (existing) return existing.id;

  const { data: row, error: insErr } = await supabase
    .from('end_clients')
    .insert({ fm_organisation_id: fmOrganisationId, name: trimmed })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return row.id;
}

// ── Create a contract end-to-end from the New Contract flow ────────────────
// Atomic-ish: contract → sites bulk insert → visit_specs bulk insert.
// On failure of a later step, contract is soft-deleted to avoid orphans.
//
// payload:
//   {
//     contract: { name, work_type, starts_on, billing_terms, end_client_name },
//     rows: [{ site: {name, address, postcode, notes},
//              specs: [{frequency, scope, access_notes, duration_minutes, price_per_visit}] }]
//   }
export async function createContract({ fmOrganisationId, contract, rows }) {
  if (!fmOrganisationId) throw new Error('FM organisation required');
  if (!contract?.name?.trim()) throw new Error('Contract name is required');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('At least one site is required');

  // 1. End-client
  const endClientId = contract.end_client_name
    ? await ensureEndClient({ fmOrganisationId, name: contract.end_client_name })
    : null;

  // 2. Contract
  const { data: createdContract, error: cErr } = await supabase
    .from('contracts')
    .insert({
      fm_organisation_id: fmOrganisationId,
      end_client_id: endClientId,
      name: contract.name.trim(),
      work_type: contract.work_type ?? null,
      starts_on: contract.starts_on ?? null,
      billing_terms: contract.billing_terms ?? null,
      status: 'mobilising',
    })
    .select('id')
    .single();
  if (cErr) throw cErr;

  const contractId = createdContract.id;
  const rollback = async (reason) => {
    await supabase
      .from('contracts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', contractId);
    throw new Error(reason);
  };

  // 3. Sites (one per row). Per-row end_client_id required for RLS.
  const sitePayload = rows.map((r) => ({
    end_client_id: endClientId,
    name: (r.site?.name ?? '').trim() || 'Untitled site',
    address: r.site?.address ?? null,
    postcode: r.site?.postcode ?? null,
    notes: r.site?.notes ?? null,
  }));
  if (!endClientId) {
    await rollback('End-client is required for sites — set a client name');
  }
  const { data: createdSites, error: sErr } = await supabase
    .from('sites')
    .insert(sitePayload)
    .select('id, name');
  if (sErr) await rollback(`Could not create sites: ${sErr.message}`);

  // 4. Visit specs (one per spec on each row)
  const specPayload = [];
  rows.forEach((row, idx) => {
    const siteId = createdSites[idx]?.id;
    if (!siteId) return;
    (row.specs ?? []).forEach((spec) => {
      if (!spec.frequency || !spec.scope || spec.price_per_visit == null) return;
      specPayload.push({
        contract_id: contractId,
        site_id: siteId,
        fm_organisation_id: fmOrganisationId,
        frequency: spec.frequency,
        scope: spec.scope,
        access_notes: spec.access_notes ?? null,
        duration_minutes: spec.duration_minutes ?? null,
        price_per_visit: Number(spec.price_per_visit) || 0,
        status: 'unassigned',
      });
    });
  });

  if (specPayload.length === 0) {
    await rollback('At least one valid visit spec required across all sites');
  }

  const { error: vErr } = await supabase.from('visit_specs').insert(specPayload);
  if (vErr) await rollback(`Could not create visit specs: ${vErr.message}`);

  return { contractId, siteCount: createdSites.length, specCount: specPayload.length };
}

// ── Allocation ─────────────────────────────────────────────────────────────
// Assigning to a sub OR sending to marketplace is a single visit_spec update.
// Listings are written separately by publishListings() so unassigned specs
// don't accidentally pick up a listing.
export async function assignVisitSpec({ visitSpecId, subUserId }) {
  const { error } = await supabase
    .from('visit_specs')
    .update({
      assigned_sub_user_id: subUserId,
      status: subUserId ? 'assigned' : 'unassigned',
    })
    .eq('id', visitSpecId);
  if (error) throw error;
}

export async function sendVisitSpecsToMarketplace(visitSpecIds) {
  if (!visitSpecIds?.length) return;
  const { error } = await supabase
    .from('visit_specs')
    .update({ assigned_sub_user_id: null, status: 'marketplace' })
    .in('id', visitSpecIds);
  if (error) throw error;
}

// ── Publish listings ───────────────────────────────────────────────────────
// One marketplace_listings row per visit_spec_id.
// Defaults match the wireframe — Visibility/format/bid window/award rule
// can be overridden per-spec via opts.perSpec[id].
export async function publishListings({
  fmOrganisationId,
  visitSpecs,
  defaults = {},
  perSpec = {},
}) {
  if (!fmOrganisationId) throw new Error('FM organisation required');
  if (!visitSpecs?.length) return [];

  const payload = visitSpecs.map((vs) => {
    const o = perSpec[vs.id] ?? {};
    const target = Number(o.target_price ?? vs.price_per_visit) || 0;
    const floor = o.floor_price != null ? Number(o.floor_price) : Math.round(target * 0.8);
    const ceil = o.ceiling_price != null ? Number(o.ceiling_price) : Math.round(target * 1.1);
    return {
      visit_spec_id: vs.id,
      fm_organisation_id: fmOrganisationId,
      visibility: o.visibility ?? defaults.visibility ?? 'open',
      format: o.format ?? defaults.format ?? 'auction',
      score_floor: o.score_floor ?? defaults.score_floor ?? 70,
      target_price: target,
      floor_price: floor,
      ceiling_price: ceil,
      bid_window_hours: o.bid_window_hours ?? defaults.bid_window_hours ?? 72,
      award_rule: o.award_rule ?? defaults.award_rule ?? 'best_fit',
      status: 'open',
    };
  });

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert(payload)
    .select('id, visit_spec_id, target_price');
  if (error) throw error;
  return data ?? [];
}

// ── Tier label/colour passthroughs (re-export from connectDb for consistency)
export const TIER_LABEL = {
  elite: 'Elite',
  verified: 'Verified',
  eligible: 'Eligible',
};
export const TIER_COLOR = {
  elite: '#a78bfa',
  verified: '#16a34a',
  eligible: '#fbbf24',
};

export const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_off', label: 'One-off' },
];

export const WORK_TYPE_OPTIONS = [
  { value: 'exterior', label: 'Exterior' },
  { value: 'interior', label: 'Interior' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'mixed', label: 'Mixed' },
];

export const CONTRACT_STATUS = {
  mobilising: { label: 'Mobilising', color: '#a16207' },
  active: { label: 'Active', color: '#16a34a' },
  paused: { label: 'Paused', color: '#6b7280' },
  closed: { label: 'Closed', color: '#94a3b8' },
};

export const LISTING_STATUS = {
  draft: { label: 'Draft', color: '#6b7280' },
  open: { label: 'Open', color: '#3b82f6' },
  bidding: { label: 'Bidding', color: '#C2410C' },
  awarded: { label: 'Awarded', color: '#16a34a' },
  closed: { label: 'Closed', color: '#94a3b8' },
  cancelled: { label: 'Cancelled', color: '#94a3b8' },
};

export const FORMAT_LABEL = {
  auction: 'Auction · best fit',
  rate_card: 'Rate card direct',
  cluster: 'Cluster bid',
};

// ── Marketplace ────────────────────────────────────────────────────────────
// FM-side listings list with visit_spec / site / bids count joined in.
export async function listFmListings() {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      `
      id, visibility, format, score_floor,
      target_price, floor_price, ceiling_price,
      bid_window_hours, award_rule, status,
      cadi_pick_user_id, awarded_to_user_id, awarded_at,
      created_at,
      visit_spec:visit_specs (
        id, frequency, scope, access_notes, duration_minutes, price_per_visit,
        site:sites ( id, name, postcode, address ),
        contract:contracts ( id, name )
      ),
      bids:marketplace_bids ( id, status )
    `
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((l) => {
    const bids = l.bids ?? [];
    return {
      ...l,
      bidCount: bids.length,
      submittedCount: bids.filter((b) => b.status === 'submitted').length,
    };
  });
}

// ── Single listing with ranked bids ────────────────────────────────────────
export async function getListingWithBids(listingId) {
  const { data: listing, error: lErr } = await supabase
    .from('marketplace_listings')
    .select(
      `
      id, visibility, format, score_floor,
      target_price, floor_price, ceiling_price,
      bid_window_hours, award_rule, status,
      cadi_pick_user_id, awarded_to_user_id, awarded_at, created_at,
      visit_spec:visit_specs (
        id, frequency, scope, access_notes, duration_minutes, price_per_visit,
        site:sites ( id, name, postcode, address ),
        contract:contracts ( id, name )
      )
    `
    )
    .eq('id', listingId)
    .is('deleted_at', null)
    .maybeSingle();
  if (lErr) throw lErr;
  if (!listing) return null;

  const { data: bidsRaw, error: bErr } = await supabase
    .from('marketplace_bids')
    .select(
      `
      id, listing_id, sub_user_id, bid_price, fit_score, match_breakdown,
      status, note, created_at,
      sub:profiles!marketplace_bids_sub_user_id_fkey (
        id, business_name, first_name, last_name,
        connect_score, connect_tier, connect_region, connect_capacity
      )
    `
    )
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });
  if (bErr) throw bErr;

  // FM-side ranking — mirrors connectDb.computeFitScore weights so the
  // FM sees the same number the sub does.
  const floor = Number(listing.floor_price ?? 0);
  const target = Number(listing.target_price ?? 0);

  const ranked = (bidsRaw ?? []).map((b) => {
    const subScore = Number(b.sub?.connect_score ?? 0);
    const capFree = Number(b.sub?.connect_capacity ?? 0);
    const price = Number(b.bid_price ?? 0);
    const priceComp =
      floor && target && target > floor
        ? Math.max(60, 100 - Math.round(((price - floor) / (target - floor)) * 50))
        : 90;
    const scoreComp = Math.max(0, Math.min(100, subScore));
    const distanceComp = 80; // TODO: postcode → distance
    const capacityComp = Math.min(100, capFree * 10);
    const computedFit = Math.round(
      priceComp * 0.4 + scoreComp * 0.35 + distanceComp * 0.15 + capacityComp * 0.1
    );
    return {
      ...b,
      subName:
        b.sub?.business_name ||
        [b.sub?.first_name, b.sub?.last_name].filter(Boolean).join(' ') ||
        '—',
      subScore,
      subTier: b.sub?.connect_tier ?? null,
      subRegion: b.sub?.connect_region ?? null,
      subCapacity: capFree,
      fit: b.fit_score ?? computedFit,
    };
  });

  // Sort by fit desc when listing is auction/best_fit, by price asc when lowest_price
  if (listing.award_rule === 'lowest_price') {
    ranked.sort((a, b) => Number(a.bid_price) - Number(b.bid_price));
  } else {
    ranked.sort((a, b) => b.fit - a.fit);
  }

  return { ...listing, bids: ranked };
}

// ── Unassigned visit_specs the FM can publish ─────────────────────────────
// Used by the "New listing" panel — only `unassigned` specs are eligible
// (assigned specs are already with a sub; marketplace specs already have a listing).
export async function listVisitSpecsForListing() {
  const { data, error } = await supabase
    .from('visit_specs')
    .select(
      `
      id, frequency, scope, price_per_visit, status,
      site:sites ( id, name, postcode ),
      contract:contracts ( id, name )
    `
    )
    .eq('status', 'unassigned')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Publish a single listing from an unassigned visit_spec ────────────────
export async function publishSingleListing({ fmOrganisationId, visitSpec, listingFields }) {
  // visit_spec status flips to marketplace.
  const { error: vErr } = await supabase
    .from('visit_specs')
    .update({ status: 'marketplace', assigned_sub_user_id: null })
    .eq('id', visitSpec.id);
  if (vErr) throw vErr;

  const target = Number(listingFields.target_price ?? visitSpec.price_per_visit) || 0;
  const floor =
    listingFields.floor_price != null
      ? Number(listingFields.floor_price)
      : Math.round(target * 0.8);
  const ceil =
    listingFields.ceiling_price != null
      ? Number(listingFields.ceiling_price)
      : Math.round(target * 1.1);

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      visit_spec_id: visitSpec.id,
      fm_organisation_id: fmOrganisationId,
      visibility: listingFields.visibility ?? 'open',
      format: listingFields.format ?? 'auction',
      score_floor: listingFields.score_floor ?? 70,
      target_price: target,
      floor_price: floor,
      ceiling_price: ceil,
      bid_window_hours: listingFields.bid_window_hours ?? 72,
      award_rule: listingFields.award_rule ?? 'best_fit',
      status: 'open',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

// ── Award + close ─────────────────────────────────────────────────────────
export async function awardListing({ listingId, bidId, scheduledDate, startHour, durationHrs }) {
  return callFmFn('award-listing', {
    listing_id: listingId,
    bid_id: bidId,
    scheduled_date: scheduledDate,
    start_hour: startHour,
    duration_hrs: durationHrs,
  });
}

export async function closeListing(listingId) {
  const { error } = await supabase
    .from('marketplace_listings')
    .update({ status: 'closed' })
    .eq('id', listingId);
  if (error) throw error;
}

// ── Work Approval ──────────────────────────────────────────────────────────
// FM-side. Jobs that have been completed and need a sign-off.
//
// Buckets via approval_status. Joins site/sub/visit_spec + counts checkins
// + evidence (lazy-loads photos on drawer open via getJobApprovalDetail).
export async function listJobsForApproval({ filter = 'pending' } = {}) {
  let q = supabase
    .from('jobs')
    .select(
      `
      id, status, approval_status, date, start_hour, duration_hrs,
      service, price, completion_method, completion_marked_at,
      actual_duration_minutes, query_note, rejection_note,
      approved_at, approved_by_user_id,
      site:sites ( id, name, postcode, address ),
      visit_spec:visit_specs ( id, frequency, scope ),
      contract:contracts ( id, name ),
      sub:profiles!jobs_sub_user_id_fkey (
        id, business_name, first_name, last_name, connect_score, connect_tier
      )
    `
    )
    .eq('status', 'complete')
    .is('deleted_at', null)
    .not('sub_user_id', 'is', null)
    .order('completion_marked_at', { ascending: false });
  if (filter !== 'all') q = q.eq('approval_status', filter);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((j) => ({
    ...j,
    subName:
      j.sub?.business_name ||
      [j.sub?.first_name, j.sub?.last_name].filter(Boolean).join(' ') ||
      '—',
  }));
}

export async function getJobApprovalDetail(jobId) {
  const { data: job, error: jErr } = await supabase
    .from('jobs')
    .select(
      `
      id, status, approval_status, date, start_hour, duration_hrs,
      service, price, completion_method, completion_marked_at,
      actual_duration_minutes, query_note, rejection_note,
      approved_at, approved_by_user_id, sub_user_id,
      site:sites ( id, name, postcode, address, lat, lng, geo_fence_radius_m ),
      visit_spec:visit_specs ( id, frequency, scope, access_notes, duration_minutes, price_per_visit ),
      contract:contracts ( id, name ),
      sub:profiles!jobs_sub_user_id_fkey (
        id, business_name, first_name, last_name, connect_score, connect_tier, connect_region
      )
    `
    )
    .eq('id', jobId)
    .maybeSingle();
  if (jErr) throw jErr;
  if (!job) return null;

  const [{ data: checkins }, { data: evidence }, { data: messages }] = await Promise.all([
    supabase
      .from('job_checkins')
      .select(
        'id, action, lat, lng, inside_geo_fence, distance_from_site_m, checked_in_at, note, photo_url, customer_on_site, customer_name'
      )
      .eq('job_id', jobId)
      .order('checked_in_at', { ascending: true }),
    supabase
      .from('job_evidence')
      .select('id, type, data, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_messages')
      .select('id, author_id, author_role, body, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
  ]);
  return {
    ...job,
    subName:
      job.sub?.business_name ||
      [job.sub?.first_name, job.sub?.last_name].filter(Boolean).join(' ') ||
      '—',
    checkins: checkins ?? [],
    evidence: evidence ?? [],
    messages: messages ?? [],
  };
}

export async function approveJob({ jobId, decision, note, ratingStars, ratingComment }) {
  return callFmFn('connect-approve-job', {
    job_id: jobId,
    decision,
    note,
    rating_stars: ratingStars ?? null,
    rating_comment: ratingComment ?? null,
  });
}

export async function postJobMessage({ jobId, body }) {
  return callFmFn('connect-job-message', { job_id: jobId, body });
}

// ── Marketplace listing Q&A (FM side) ──────────────────────────────────────
// FM sees full sub identities (not anonymised like the sub-side view) so
// they know who's engaged. Uses the shared connect-listing-question fn.
export async function listListingQuestionsFm(listingId) {
  const { data, error } = await supabase
    .from('marketplace_listing_qa')
    .select(
      `
      id, listing_id, author_id, author_role, body, parent_id, created_at,
      author:profiles!marketplace_listing_qa_author_id_fkey (
        id, business_name, first_name, last_name
      )
    `
    )
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    authorName:
      r.author?.business_name ||
      [r.author?.first_name, r.author?.last_name].filter(Boolean).join(' ') ||
      (r.author_role === 'fm' ? 'You / your team' : 'Contractor'),
  }));
}

export async function postListingAnswer({ listingId, body, parentId }) {
  return callFmFn('connect-listing-question', {
    listing_id: listingId,
    body,
    parent_id: parentId ?? null,
  });
}

// ── Site-level history (FM Ops → Sites drawer) ─────────────────────────────
// All jobs at a site the FM's org owns, plus per-job photo counts + sub
// name. Used to give the FM a "what's happened at this address" view
// without leaving the Sites tab. Photos loaded as thumbnail URLs when
// available. Ordered most-recent first.
// ── Sub compliance docs (FM view) ──────────────────────────────────────────
// RLS on connect_sub_docs already gates this to subs connected to the FM's
// org (via jobs history / visit_specs / connect_unlock). The FM just sees a
// summary; storage signed URLs come from the FM helper below.
export async function listSubDocsForFm(subUserId) {
  const { data, error } = await supabase
    .from('connect_sub_docs')
    .select(
      'id, doc_type, file_path, file_name, mime_type, issued_date, expiry_date, provider, policy_number, verified_by_cadi, verified_at, updated_at'
    )
    .eq('sub_user_id', subUserId);
  if (error) throw error;
  return data ?? [];
}

export async function signSubDocUrlForFm(filePath, ttlSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from('connect-sub-docs')
    .createSignedUrl(filePath, ttlSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// ── Sub availability (FM view) ─────────────────────────────────────────────
// RLS on connect_sub_availability already gates to subs connected to the
// caller's FM org. Returns future-only blocks so the FM's contractor
// drawer isn't cluttered with past holidays.
export async function listSubAvailabilityForFm(subUserId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('connect_sub_availability')
    .select('id, start_date, end_date, reason, created_at')
    .eq('sub_user_id', subUserId)
    .gte('end_date', today)
    .order('start_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getSiteJobHistory(siteId, { limit = 100 } = {}) {
  const { data: jobs, error: jErr } = await supabase
    .from('jobs')
    .select(
      `
      id, status, approval_status, date, start_hour, duration_hrs, price,
      completion_marked_at, actual_duration_minutes, service,
      sub:profiles!jobs_sub_user_id_fkey ( id, business_name, first_name, last_name )
    `
    )
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(limit);
  if (jErr) throw jErr;

  const jobIds = (jobs ?? []).map((j) => j.id);
  if (jobIds.length === 0) return [];

  const { data: evidence, error: eErr } = await supabase
    .from('job_evidence')
    .select('id, job_id, type, data')
    .in('job_id', jobIds)
    .in('type', ['before_photo', 'after_photo', 'photo']);
  if (eErr) throw eErr;

  const photosByJob = new Map();
  for (const e of evidence ?? []) {
    const arr = photosByJob.get(e.job_id) ?? [];
    const url = e.data?.url ?? e.data?.photo_url ?? null;
    if (url) arr.push(url);
    photosByJob.set(e.job_id, arr);
  }

  return (jobs ?? []).map((j) => ({
    ...j,
    subName:
      j.sub?.business_name ||
      [j.sub?.first_name, j.sub?.last_name].filter(Boolean).join(' ') ||
      '—',
    photoUrls: (photosByJob.get(j.id) ?? []).slice(0, 5),
    photoCount: (photosByJob.get(j.id) ?? []).length,
  }));
}

// ── Accounts inbox ─────────────────────────────────────────────────────────
export async function listFmInvoices({ status = null } = {}) {
  let q = supabase
    .from('connect_invoices')
    .select(
      `
      id, reference, service_date, net_value, vat_value, total_value, status,
      submitted_at, exported_at, paid_at, note, created_at, exported_in_export_id,
      sub:profiles!connect_invoices_sub_user_id_fkey ( id, business_name, first_name, last_name ),
      job:jobs ( id, site:sites ( id, name, postcode ) )
    `
    )
    .order('service_date', { ascending: false });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((inv) => ({
    ...inv,
    subName:
      inv.sub?.business_name ||
      [inv.sub?.first_name, inv.sub?.last_name].filter(Boolean).join(' ') ||
      '—',
    siteName: inv.job?.site?.name ?? null,
    sitePostcode: inv.job?.site?.postcode ?? null,
  }));
}

export async function previewAccountsExport({ periodFrom, periodTo }) {
  return callFmFn('connect-export-accounts', {
    op: 'preview',
    period_from: periodFrom,
    period_to: periodTo,
  });
}

export async function runAccountsExport({ periodFrom, periodTo, periodLabel, fileFormat = 'csv' }) {
  return callFmFn('connect-export-accounts', {
    op: 'export',
    period_from: periodFrom,
    period_to: periodTo,
    period_label: periodLabel,
    file_format: fileFormat,
  });
}

export async function markInvoicesPaid(invoiceIds) {
  return callFmFn('connect-export-accounts', {
    op: 'mark_paid',
    invoice_ids: invoiceIds,
  });
}

// ── FM accounting settings (per FM org) ─────────────────────────────────────
// Stored in the dedicated fm_accounts_settings table (1 row per org). FM
// members own RW on their own org's row. Returns null when no row exists
// yet — the upsert below creates it lazily on first save.
export async function getFmAccountsSettings() {
  const org = await getMyFmOrganisation();
  if (!org?.id) return null;
  const { data, error } = await supabase
    .from('fm_accounts_settings')
    .select(
      `
      fm_organisation_id, accounts_platform, default_nominal_code, default_vat_code,
      default_payment_terms_days, accounts_email
    `
    )
    .eq('fm_organisation_id', org.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertFmAccountsSettings(updates) {
  const org = await getMyFmOrganisation();
  if (!org?.id) throw new Error('No FM organisation');
  const { data, error } = await supabase
    .from('fm_accounts_settings')
    .upsert(
      {
        fm_organisation_id: org.id,
        accounts_platform: updates.accounts_platform ?? 'generic',
        default_nominal_code: updates.default_nominal_code ?? null,
        default_vat_code: updates.default_vat_code ?? null,
        default_payment_terms_days: updates.default_payment_terms_days ?? 30,
        accounts_email: updates.accounts_email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fm_organisation_id' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export const ACCOUNTS_PLATFORMS = [
  {
    value: 'sage_50',
    label: 'Sage 50 Accounts',
    hint: 'CSV import via "Easy Import" → Purchase Invoices',
  },
  {
    value: 'sage_cloud',
    label: 'Sage Business Cloud',
    hint: 'CSV import via Suppliers → Purchase Invoices',
  },
  { value: 'xero', label: 'Xero', hint: 'CSV import via Business → Bills → Import' },
  {
    value: 'quickbooks',
    label: 'QuickBooks Online',
    hint: 'CSV import via Expenses → New transaction → Bill',
  },
  { value: 'freeagent', label: 'FreeAgent', hint: 'CSV import via Files → Bills' },
  {
    value: 'generic',
    label: 'Other / manual',
    hint: 'Generic CSV with all fields — map columns yourself',
  },
];

// ── FM supplier codes (per FM × per sub) ────────────────────────────────────
// Auto-created by the export function on first export. UI exposes for override.
export async function listFmSupplierCodes() {
  const org = await getMyFmOrganisation();
  if (!org?.id) return [];
  const { data, error } = await supabase
    .from('fm_supplier_codes')
    .select(
      `
      id, sub_user_id, supplier_code, nominal_code_override, notes, updated_at,
      sub:profiles!fm_supplier_codes_sub_user_id_fkey ( id, business_name, first_name, last_name )
    `
    )
    .eq('fm_organisation_id', org.id)
    .order('supplier_code', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    subName:
      r.sub?.business_name ||
      [r.sub?.first_name, r.sub?.last_name].filter(Boolean).join(' ') ||
      '—',
  }));
}

export async function upsertFmSupplierCode({
  subUserId,
  supplierCode,
  nominalCodeOverride,
  notes,
}) {
  const org = await getMyFmOrganisation();
  if (!org?.id) throw new Error('No FM organisation');
  const { data, error } = await supabase
    .from('fm_supplier_codes')
    .upsert(
      {
        fm_organisation_id: org.id,
        sub_user_id: subUserId,
        supplier_code: supplierCode,
        nominal_code_override: nominalCodeOverride ?? null,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fm_organisation_id,sub_user_id' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ── Single-invoice detail (FM-side) ─────────────────────────────────────────
// Loads the invoice + its line items + the sub's surface profile (name only —
// RLS hides the sub's business_settings). Used by the FM accounts drawer.
export async function getFmInvoiceDetail(invoiceId) {
  const { data: invoice, error: invErr } = await supabase
    .from('connect_invoices')
    .select(
      `
      id, reference, service_date, net_value, vat_value, total_value, status,
      submitted_at, exported_at, paid_at, note, created_at,
      fm_organisation:fm_organisations ( id, name ),
      sub:profiles!connect_invoices_sub_user_id_fkey (
        id, business_name, first_name, last_name, phone, postcode
      ),
      job:jobs ( id, site:sites ( id, name, postcode ) )
    `
    )
    .eq('id', invoiceId)
    .maybeSingle();
  if (invErr) throw invErr;
  if (!invoice) return null;

  const { data: lines, error: linesErr } = await supabase
    .from('connect_invoice_lines')
    .select(
      `
      id, job_id, description, service_date, net_value, vat_value, created_at,
      job:jobs ( id, site:sites ( id, name, postcode ) )
    `
    )
    .eq('invoice_id', invoiceId)
    .order('service_date', { ascending: true });
  if (linesErr) throw linesErr;

  return {
    ...invoice,
    lines: lines ?? [],
    subName:
      invoice.sub?.business_name ||
      [invoice.sub?.first_name, invoice.sub?.last_name].filter(Boolean).join(' ') ||
      '—',
  };
}

// Single-invoice state changes. FM has direct UPDATE rights on
// connect_invoices for their own org so we don't need to round-trip an
// edge function — direct supabase update keeps the drawer snappy.
export async function markInvoicePaid(invoiceId) {
  const { data, error } = await supabase
    .from('connect_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select('id, status, paid_at')
    .single();
  return { ok: !error, data, error };
}

export async function markInvoiceExported(invoiceId) {
  const { data, error } = await supabase
    .from('connect_invoices')
    .update({ status: 'exported', exported_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select('id, status, exported_at')
    .single();
  return { ok: !error, data, error };
}

export const INVOICE_STATUS = {
  draft: { label: 'Draft (sub-side)', color: '#94a3b8' },
  submitted: { label: 'With FM', color: '#3b82f6' },
  exported: { label: 'Exported', color: '#7c3aed' },
  paid: { label: 'Paid', color: '#16a34a' },
};

// ── Sites / Job Cards ──────────────────────────────────────────────────────
// Read-only master list of every site this FM org can see, with visit-spec
// + last/next job rolled up.
export async function listFmSites() {
  const { data: sites, error: sErr } = await supabase
    .from('sites')
    .select(
      `
      id, name, address, postcode, lat, lng, notes, geo_fence_radius_m, created_at,
      end_client:end_clients ( id, name, fm_organisation_id )
    `
    )
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (sErr) throw sErr;

  const ids = (sites ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const [{ data: specs }, { data: jobs }] = await Promise.all([
    supabase
      .from('visit_specs')
      .select(
        `
        id, site_id, frequency, scope, price_per_visit, status, assigned_sub_user_id,
        contract:contracts ( id, name )
      `
      )
      .in('site_id', ids)
      .is('deleted_at', null),
    supabase
      .from('jobs')
      .select('id, site_id, date, status, approval_status, sub_user_id, price')
      .in('site_id', ids)
      .is('deleted_at', null)
      .order('date', { ascending: false }),
  ]);

  const specsBySite = new Map();
  (specs ?? []).forEach((s) => {
    if (!specsBySite.has(s.site_id)) specsBySite.set(s.site_id, []);
    specsBySite.get(s.site_id).push(s);
  });
  const jobsBySite = new Map();
  (jobs ?? []).forEach((j) => {
    if (!jobsBySite.has(j.site_id)) jobsBySite.set(j.site_id, []);
    jobsBySite.get(j.site_id).push(j);
  });

  const todayIso = new Date().toISOString().slice(0, 10);

  return (sites ?? []).map((site) => {
    const siteSpecs = specsBySite.get(site.id) ?? [];
    const siteJobs = jobsBySite.get(site.id) ?? [];
    const past = siteJobs.filter((j) => j.date && j.date <= todayIso);
    const future = siteJobs.filter((j) => j.date && j.date > todayIso);
    const lastVisit = past[0]?.date ?? null;
    const nextVisit = future[future.length - 1]?.date ?? null;
    const status =
      siteSpecs.length === 0
        ? 'no-specs'
        : siteSpecs.some((s) => s.status === 'active')
          ? 'active'
          : siteSpecs.some((s) => s.status === 'marketplace')
            ? 'marketplace'
            : siteSpecs.some((s) => s.status === 'assigned')
              ? 'assigned'
              : 'unassigned';
    return {
      ...site,
      endClientName: site.end_client?.name ?? null,
      specs: siteSpecs,
      contract: siteSpecs[0]?.contract ?? null,
      lastVisit,
      nextVisit,
      jobCount: siteJobs.length,
      pendingJobs: siteJobs.filter(
        (j) => j.status === 'complete' && j.approval_status === 'pending'
      ).length,
      perVisit: siteSpecs.reduce((a, s) => a + (Number(s.price_per_visit) || 0), 0),
      status,
    };
  });
}

export const SITE_STATUS = {
  active: { label: 'Active', color: '#16a34a' },
  assigned: { label: 'Assigned', color: '#16a34a' },
  marketplace: { label: 'On marketplace', color: '#C2410C' },
  unassigned: { label: 'Unassigned', color: '#a16207' },
  'no-specs': { label: 'No specs', color: '#94a3b8' },
};

// ── Schedule (jobs in a date window) ──────────────────────────────────────
export async function listFmJobs({ from, to } = {}) {
  let q = supabase
    .from('jobs')
    .select(
      `
      id, date, start_hour, duration_hrs, status, approval_status, price,
      service, source,
      site:sites ( id, name, postcode ),
      contract:contracts ( id, name ),
      sub:profiles!jobs_sub_user_id_fkey ( id, business_name, first_name, last_name )
    `
    )
    .is('deleted_at', null)
    .not('fm_organisation_id', 'is', null)
    .order('date', { ascending: true });
  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((j) => ({
    ...j,
    subName:
      j.sub?.business_name ||
      [j.sub?.first_name, j.sub?.last_name].filter(Boolean).join(' ') ||
      null,
  }));
}

export const JOB_STATUS = {
  scheduled: { label: 'Scheduled', color: '#3b82f6' },
  in_progress: { label: 'In progress', color: '#C2410C' },
  complete: { label: 'Complete', color: '#16a34a' },
  unassigned: { label: 'Unassigned', color: '#a16207' },
  pending_confirmation: { label: 'Pending', color: '#a16207' },
  cancelled: { label: 'Cancelled', color: '#94a3b8' },
};

// ── Overview KPIs ─────────────────────────────────────────────────────────
export async function getFmOverview() {
  // Single shot — multiple parallel reads, count-only where possible.
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    contracts,
    sites,
    jobsThisWeek,
    pendingApprovals,
    submittedInvoices,
    activeSubs,
    listings,
  ] = await Promise.all([
    supabase.from('contracts').select('id, status', { count: 'exact' }).is('deleted_at', null),
    supabase.from('sites').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('jobs')
      .select('id, status, price', { count: 'exact' })
      .is('deleted_at', null)
      .gte('date', todayIso)
      .lte('date', weekAhead)
      .not('fm_organisation_id', 'is', null),
    supabase
      .from('jobs')
      .select('id, sub_user_id, price', { count: 'exact' })
      .is('deleted_at', null)
      .eq('status', 'complete')
      .eq('approval_status', 'pending'),
    supabase
      .from('connect_invoices')
      .select('id, total_value, status, sub_user_id', { count: 'exact' })
      .in('status', ['submitted', 'exported']),
    supabase
      .from('sub_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'claimed'),
    supabase
      .from('marketplace_listings')
      .select('id, status', { count: 'exact' })
      .is('deleted_at', null)
      .in('status', ['open', 'bidding']),
  ]);

  const sumPrice = (rows) => (rows.data ?? []).reduce((a, r) => a + (Number(r.price) || 0), 0);
  const sumInvoice = (rows) =>
    (rows.data ?? []).reduce((a, r) => a + (Number(r.total_value) || 0), 0);

  return {
    activeContracts: (contracts.data ?? []).filter((c) => c.status === 'active').length,
    mobilisingContracts: (contracts.data ?? []).filter((c) => c.status === 'mobilising').length,
    totalContracts: contracts.count ?? 0,
    siteCount: sites.count ?? 0,
    jobsThisWeek: jobsThisWeek.count ?? 0,
    jobsThisWeekValue: sumPrice(jobsThisWeek),
    pendingApprovals: pendingApprovals.count ?? 0,
    pendingApprovalsValue: sumPrice(pendingApprovals),
    invoicesDueCount: submittedInvoices.count ?? 0,
    invoicesDueValue: sumInvoice(submittedInvoices),
    activeSubs: activeSubs.count ?? 0,
    liveListings: listings.count ?? 0,
  };
}
