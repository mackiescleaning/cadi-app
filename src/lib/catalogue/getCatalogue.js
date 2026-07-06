// getCatalogue — load the live catalogue object from Supabase. The single
// read path. Every surface that needs to know about services/prices/duration
// must read through this — never query services / service_tiers / etc.
// directly. Changes to schema, joining or shape go here; surfaces don't move.
//
// Spec §7 returned shape:
//   { business: { id, name, divisions[], branding },
//     services: [{ id, name, description, division, booking_mode,
//                  pricing_model, display_price:{from,amount}, duration_mins,
//                  tiers?, units?, frequency_rates?, modifiers,
//                  booking_ready, evidence }],
//     version, updated_at }

import { supabase } from '../supabase';

export async function getCatalogue() {
  // Resolve the business via the existing RPC. RLS handles tenancy on every
  // table below — no extra business_id filter needed in the queries.
  const { data: businessId, error: bidErr } = await supabase.rpc('my_business_id');
  if (bidErr) throw bidErr;
  if (!businessId) return emptyCatalogue();

  const [
    { data: services, error: sErr },
    { data: tiers, error: tErr },
    { data: units, error: uErr },
    { data: mods, error: mErr },
  ] = await Promise.all([
    supabase
      .from('services')
      .select(
        'id, name, description_included, category, booking_mode, pricing_model, pricing_config, default_duration_mins, status, version, booking_ready, inference_meta, price_low, price_high, price_fixed_basic, updated_at'
      )
      .eq('business_id', businessId)
      .eq('status', 'live')
      .order('display_order', { ascending: true }),
    supabase.from('service_tiers').select('*').order('sort_order', { ascending: true }),
    supabase.from('service_units').select('*'),
    supabase.from('service_modifiers').select('*').order('sort_order', { ascending: true }),
  ]);
  if (sErr) throw sErr;
  if (tErr) throw tErr;
  if (uErr) throw uErr;
  if (mErr) throw mErr;

  // Index child rows by service_id so we can stitch in O(N).
  const tiersByService = bucketBy(tiers, 'service_id');
  const unitsByService = bucketBy(units, 'service_id');
  const modifiersByService = bucketBy(mods, 'service_id');

  const built = (services ?? []).map((row) =>
    shapeService(row, {
      tiers: tiersByService.get(row.id) ?? [],
      units: unitsByService.get(row.id) ?? [],
      modifiers: modifiersByService.get(row.id) ?? [],
    })
  );

  return {
    business: {
      id: businessId,
      name: null, // populated by branding pull elsewhere
      divisions: distinctDivisions(built),
      branding: null,
    },
    services: built,
    version: latestVersion(services ?? []),
    updated_at: latestUpdatedAt(services ?? []),
  };
}

// Shape one services row + its child rows into the spec contract.
export function shapeService(row, { tiers, units, modifiers }) {
  const pm = row.pricing_model ?? 'flat';
  const mode = row.booking_mode ?? 'enquiry';
  const meta = row.inference_meta ?? {};

  // display_price: { from: bool, amount: number|null }
  // For tiered: lowest-tier price; "from" if the highest tier was a
  // tail-fold ("From £X" affordance in the menu).
  // For flat: pricing_config.price.
  // For by_unit / by_frequency: null (need selections to quote).
  let displayPrice = { from: false, amount: null };
  if (pm === 'flat') {
    const v = Number(row?.pricing_config?.price ?? row.price_fixed_basic);
    if (Number.isFinite(v)) displayPrice = { from: false, amount: v };
  } else if (pm === 'tiered' && tiers.length) {
    const lowest = tiers.reduce(
      (min, t) => (Number(t.price) < Number(min.price) ? t : min),
      tiers[0]
    );
    // "from" is true whenever the top tier was a tail-fold OR there's just
    // a price range to show.
    displayPrice = {
      from: Boolean(meta?.from_price) || tiers.length > 1,
      amount: Number(lowest.price),
    };
  } else if (pm === 'flat' || pm === 'tiered') {
    // Fallback to price_low / price_fixed_basic if the model says flat/tiered
    // but no detailed data exists yet.
    const v = Number(row.price_low ?? row.price_fixed_basic);
    if (Number.isFinite(v)) displayPrice = { from: false, amount: v };
  }

  // Spec-shaped tiers — owner-facing fields only. inference_meta.tier_estimates
  // is a { tier_key → true } map written by commitMenuToServices for slots
  // the template filled by progression rather than observation. Editors flag
  // these visually so the owner knows to confirm before sharing the menu.
  const tierEstimates = meta?.tier_estimates ?? {};
  const shapedTiers = tiers.map((t) => ({
    key: t.tier_key,
    label: t.label,
    price: Number(t.price),
    is_default: Boolean(t.is_default),
    is_estimated: Boolean(tierEstimates[t.tier_key]),
  }));

  const shapedUnits = units.map((u) => ({
    unit_type: u.unit_type,
    price_per_unit: Number(u.price_per_unit),
    min_units: u.min_units != null ? Number(u.min_units) : null,
    min_charge: u.min_charge != null ? Number(u.min_charge) : null,
  }));

  const shapedMods = modifiers.map((m) => ({
    key: m.id,
    label: m.label,
    type: m.type,
    value: Number(m.value),
    default_on: Boolean(m.default_on),
    sort_order: Number(m.sort_order ?? 0),
  }));

  // frequency_rates — only for by_frequency, lifted from pricing_config.
  const frequency_rates = pm === 'by_frequency' ? (row?.pricing_config?.rates ?? null) : null;

  return {
    id: row.id,
    name: row.name,
    description: row.description_included ?? null,
    division: row.category ?? null,
    booking_mode: mode,
    pricing_model: pm,
    pricing_config: row.pricing_config ?? null,
    display_price: displayPrice,
    duration_mins: row.default_duration_mins ?? null,
    tiers: shapedTiers.length ? shapedTiers : undefined,
    units: shapedUnits.length ? shapedUnits : undefined,
    frequency_rates: frequency_rates ?? undefined,
    modifiers: shapedMods,
    booking_ready: Boolean(row.booking_ready),
    // Free-form owner-supplied context Front Desk reads when quoting.
    // Seeded from Cadi's onboarding Q&A; owner edits in catalogue editor.
    cadi_context: meta?.cadi_context ?? null,
    evidence: {
      customer_count: Number(meta?.evidence?.customer_count ?? 0),
      observed_low: Number(row.price_low ?? meta?.evidence?.observed_low ?? 0) || null,
      observed_high: Number(row.price_high ?? meta?.evidence?.observed_high ?? 0) || null,
    },
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function bucketBy(rows, key) {
  const m = new Map();
  for (const r of rows ?? []) {
    const k = r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

function distinctDivisions(services) {
  const set = new Set();
  for (const s of services) if (s.division) set.add(s.division);
  return Array.from(set);
}

function latestVersion(services) {
  let v = 0;
  for (const s of services) if (Number(s.version) > v) v = Number(s.version);
  return v || 1;
}

function latestUpdatedAt(services) {
  let max = null;
  for (const s of services) {
    if (!s.updated_at) continue;
    if (!max || s.updated_at > max) max = s.updated_at;
  }
  return max;
}

function emptyCatalogue() {
  return {
    business: { id: null, name: null, divisions: [], branding: null },
    services: [],
    version: 0,
    updated_at: null,
  };
}
