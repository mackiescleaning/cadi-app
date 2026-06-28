// catalogueDb.js — CRUD for the catalogue editor.
// Talks directly to services / service_tiers / service_units / service_modifiers.
// Surfaces (Scheduler AddJob, Front Desk widget, etc.) read via getCatalogue
// — this module is the WRITE side.

import { supabase } from '../supabase';

// ── Business id resolver ────────────────────────────────────────────────────
async function myBusinessId() {
  const { data, error } = await supabase.rpc('my_business_id');
  if (error) throw error;
  return data;
}

// ── Services ────────────────────────────────────────────────────────────────

export async function createService({
  name, division, description, booking_mode = 'enquiry', pricing_model = 'flat',
  flat_price = null, duration_mins = null,
}) {
  const business_id = await myBusinessId();
  if (!business_id) throw new Error("Couldn't resolve business");

  const pricing_config = pricing_model === 'flat' && flat_price != null
    ? { price: Number(flat_price) }
    : null;

  const { data, error } = await supabase.from('services').insert({
    business_id,
    name: String(name ?? '').trim(),
    category: division || null,
    description_included: String(description ?? '').trim() || null,
    pricing_type: 'fixed',
    price_fixed_basic: pricing_model === 'flat' ? flat_price : null,
    booking_mode,
    pricing_model,
    pricing_config,
    default_duration_mins: duration_mins,
    status: 'live',
    is_active: true,
    generated_from_import: false,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateServiceCore(serviceId, patch) {
  // Whitelist of editable fields so we never accidentally fan out into PII.
  const allowed = [
    'name', 'category', 'description_included',
    'booking_mode', 'pricing_model', 'pricing_config',
    'default_duration_mins', 'status', 'is_active', 'price_fixed_basic',
  ];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  const { data, error } = await supabase
    .from('services')
    .update(clean)
    .eq('id', serviceId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteService(serviceId) {
  // Children cascade via FK on delete cascade.
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) throw error;
}

// ── Service tiers ───────────────────────────────────────────────────────────

export async function replaceTiers(serviceId, tiers) {
  // Wipe + reinsert so the editor is the source of truth. Idempotent.
  await supabase.from('service_tiers').delete().eq('service_id', serviceId);
  if (!Array.isArray(tiers) || !tiers.length) {
    // Clear any stale tier_estimates map too.
    await mergeInferenceMeta(serviceId, { tier_estimates: null });
    return [];
  }
  const rows = tiers.map((t, idx) => ({
    service_id:     serviceId,
    tier_key:       String(t.tier_key ?? slugify(t.label ?? `tier${idx + 1}`)),
    label:          String(t.label ?? `Tier ${idx + 1}`),
    price:          Number(t.price) || 0,
    customer_count: t.customer_count ?? 0,
    is_default:     Boolean(t.is_default),
    sort_order:     idx,
  }));
  // Guarantee only one default per service.
  if (!rows.some(r => r.is_default) && rows.length) rows[0].is_default = true;
  const defaults = rows.filter(r => r.is_default);
  if (defaults.length > 1) {
    let seen = false;
    for (const r of rows) {
      if (r.is_default) { if (seen) r.is_default = false; else seen = true; }
    }
  }
  const { data, error } = await supabase.from('service_tiers').insert(rows).select('*');
  if (error) throw error;

  // Persist the per-tier is_estimated map on the parent's inference_meta so
  // future loads of the catalogue surface the amber flag until the owner
  // overrides each tier price. Editing a tier in the editor clears its flag.
  const estimates = {};
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const key = rows[i].tier_key;
    if (t?.is_estimated) estimates[key] = true;
  }
  await mergeInferenceMeta(serviceId, {
    tier_estimates: Object.keys(estimates).length ? estimates : null,
  });

  return data;
}

// Merge a patch into services.inference_meta. Null-valued keys are removed.
async function mergeInferenceMeta(serviceId, patch) {
  const { data: row } = await supabase
    .from('services').select('inference_meta').eq('id', serviceId).maybeSingle();
  const next = { ...(row?.inference_meta ?? {}) };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v == null) delete next[k]; else next[k] = v;
  }
  await supabase.from('services').update({ inference_meta: next }).eq('id', serviceId);
}

// ── Service units ───────────────────────────────────────────────────────────

export async function replaceUnits(serviceId, units) {
  await supabase.from('service_units').delete().eq('service_id', serviceId);
  if (!Array.isArray(units) || !units.length) return [];
  const rows = units.map(u => ({
    service_id:     serviceId,
    unit_type:      u.unit_type,
    price_per_unit: Number(u.price_per_unit) || 0,
    min_units:      u.min_units != null ? Number(u.min_units) : null,
    min_charge:     u.min_charge != null ? Number(u.min_charge) : null,
  }));
  const { data, error } = await supabase.from('service_units').insert(rows).select('*');
  if (error) throw error;
  return data;
}

// ── Service modifiers ───────────────────────────────────────────────────────

export async function replaceModifiers(serviceId, modifiers) {
  await supabase.from('service_modifiers').delete().eq('service_id', serviceId);
  if (!Array.isArray(modifiers) || !modifiers.length) return [];
  const rows = modifiers.map((m, idx) => ({
    service_id: serviceId,
    label:      String(m.label ?? ''),
    type:       m.type,
    value:      Number(m.value) || 0,
    default_on: Boolean(m.default_on),
    sort_order: idx,
  }));
  const { data, error } = await supabase.from('service_modifiers').insert(rows).select('*');
  if (error) throw error;
  return data;
}

// ── Combined save — atomic-ish "save this service" ─────────────────────────
// Updates the parent services row + replaces children. Best for the editor's
// per-service Save button. Children writes don't roll back if one fails —
// returns whatever we managed to write.

export async function saveServiceWithChildren(serviceId, { core, tiers, units, modifiers, cadi_context }) {
  const result = { service: null, tiers: null, units: null, modifiers: null };
  if (core) {
    result.service = await updateServiceCore(serviceId, core);
  }
  if (Array.isArray(tiers)) {
    result.tiers = await replaceTiers(serviceId, tiers);
  }
  if (Array.isArray(units)) {
    result.units = await replaceUnits(serviceId, units);
  }
  if (Array.isArray(modifiers)) {
    result.modifiers = await replaceModifiers(serviceId, modifiers);
  }
  // Free-form Cadi context (what Front Desk should know when quoting this
  // service). Empty string → clear it.
  if (cadi_context !== undefined) {
    const trimmed = typeof cadi_context === 'string' ? cadi_context.trim() : '';
    await mergeInferenceMeta(serviceId, { cadi_context: trimmed || null });
  }
  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
