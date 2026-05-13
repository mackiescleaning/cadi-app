// servicesDb.js — CRUD for the services table
// services is the single source of truth for Front Desk quoting + user-facing service management.

import { supabase } from '../supabase';

async function getBusinessId() {
  // Explicitly refresh the session before the RPC call.
  // When the JWT is expired, auth.uid() returns null inside my_business_id()
  // even though PostgREST still returns HTTP 200 — so we get null silently.
  await supabase.auth.refreshSession();
  const { data } = await supabase.rpc('my_business_id');
  return data;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function listServices({ includeInactive = false } = {}) {
  let query = supabase
    .from('services')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listServicesForFrontDesk() {
  // Returns only active services, ordered for quoting context.
  // Front Desk must call this (never read inactive services).
  const { data, error } = await supabase
    .from('services')
    .select([
      'id', 'category', 'name',
      'description_included', 'description_excluded',
      'pricing_type',
      'price_hourly_rate', 'price_hourly_minimum_hours',
      'price_fixed_basic', 'price_fixed_standard', 'price_fixed_premium',
      'price_per_sqm', 'price_per_sqm_minimum',
      'price_per_room', 'price_per_bathroom',
      'pricing_notes',
      'duration_value', 'duration_unit',
      'frequency_one_off', 'frequency_weekly', 'frequency_fortnightly',
      'frequency_monthly', 'frequency_quarterly', 'frequency_annually',
      'service_area_uses_default', 'service_area_custom',
      'materials_equipment_notes',
    ].join(','))
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getService(id) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function countActiveServices() {
  const { count, error } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (error) throw error;
  return count ?? 0;
}

export async function countServicesNeedingPricing() {
  // Services that are active but have no usable pricing — Front Desk can't quote these.
  const { data, error } = await supabase
    .from('services')
    .select('id, pricing_type, price_hourly_rate, price_fixed_basic, price_fixed_standard, price_fixed_premium, price_per_sqm, price_per_room')
    .eq('is_active', true);
  if (error) throw error;
  if (!data) return 0;
  return data.filter(s => !serviceHasPricing(s)).length;
}

export function serviceHasPricing(s) {
  if (s.pricing_type === 'custom') return true; // custom = quote manually, no price needed
  if (s.pricing_type === 'hourly') return !!s.price_hourly_rate;
  if (s.pricing_type === 'fixed') return !!(s.price_fixed_basic || s.price_fixed_standard || s.price_fixed_premium);
  if (s.pricing_type === 'per_sqm') return !!s.price_per_sqm;
  if (s.pricing_type === 'per_room') return !!s.price_per_room;
  return false;
}

export function formatPricingSummary(s) {
  if (s.pricing_type === 'hourly') {
    if (!s.price_hourly_rate) return 'Price needed';
    let str = `£${s.price_hourly_rate}/hr`;
    if (s.price_hourly_minimum_hours) str += `, min ${s.price_hourly_minimum_hours}hr`;
    return str;
  }
  if (s.pricing_type === 'fixed') {
    const prices = [s.price_fixed_basic, s.price_fixed_standard, s.price_fixed_premium].filter(Boolean);
    if (!prices.length) return 'Price needed';
    if (prices.length === 1) return `£${prices[0]} fixed`;
    return `£${Math.min(...prices)} – £${Math.max(...prices)} fixed`;
  }
  if (s.pricing_type === 'per_sqm') {
    if (!s.price_per_sqm) return 'Price needed';
    return `£${s.price_per_sqm}/m²`;
  }
  if (s.pricing_type === 'per_room') {
    if (!s.price_per_room) return 'Price needed';
    let str = `£${s.price_per_room}/room`;
    if (s.price_per_bathroom) str += ` + £${s.price_per_bathroom}/bathroom`;
    return str;
  }
  if (s.pricing_type === 'custom') return 'Custom quote';
  return 'Price needed';
}

export function formatDuration(s) {
  if (!s.duration_value) return null;
  const unit = s.duration_unit === 'minutes' ? 'min' : s.duration_unit === 'hours' ? 'hr' : 'day';
  return `≈ ${s.duration_value} ${unit}${s.duration_value !== 1 ? 's' : ''}`;
}

export function getFrequencyLabels(s) {
  const labels = [];
  if (s.frequency_one_off) labels.push('One-off');
  if (s.frequency_weekly) labels.push('Weekly');
  if (s.frequency_fortnightly) labels.push('Fortnightly');
  if (s.frequency_monthly) labels.push('Monthly');
  if (s.frequency_quarterly) labels.push('Quarterly');
  if (s.frequency_annually) labels.push('Annually');
  return labels;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createService(fields) {
  const businessId = await getBusinessId();
  const { data, error } = await supabase
    .from('services')
    .insert({ ...fields, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateService(id, fields) {
  const { data, error } = await supabase
    .from('services')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteService(id) {
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function setServiceActive(id, isActive) {
  return updateService(id, { is_active: isActive });
}

export async function duplicateService(id) {
  const original = await getService(id);
  const { id: _id, created_at, updated_at, ...fields } = original;
  return createService({ ...fields, name: `${fields.name} (copy)`, display_order: fields.display_order + 1 });
}

// ── Onboarding bridge ─────────────────────────────────────────────────────────

const CATEGORY_MAP = {
  // residential
  'Weekly Clean': 'residential', 'Fortnightly Clean': 'residential', 'Monthly Clean': 'residential',
  'Deep Clean': 'residential', 'End of Tenancy': 'residential', 'Move In / Move Out': 'residential',
  'Spring Clean': 'residential', 'After Party Clean': 'residential',
  'Airbnb Turnover': 'residential', 'Holiday Let Changeover': 'residential',
  'Oven Clean': 'residential', 'Carpet Clean': 'residential',
  'Inside Windows': 'residential', 'Ironing Service': 'residential',
  // commercial
  'Daily Office Clean': 'commercial', 'Weekly Office Clean': 'commercial', 'Retail Clean': 'commercial',
  'School / College': 'commercial', 'Nursery / Childcare': 'commercial',
  'Medical Practice': 'commercial', 'Care Home': 'commercial',
  'Restaurant / Cafe': 'commercial', 'Hotel': 'commercial',
  'Pub / Bar': 'commercial', 'Event Venue': 'commercial',
  'Post-Construction Clean': 'commercial', 'Periodic Deep Clean': 'commercial',
  'Industrial / Warehouse': 'commercial',
  // exterior
  'Residential Windows': 'exterior', 'Commercial Windows': 'exterior', 'Conservatory Glass': 'exterior',
  'Gutter Clearing': 'exterior', 'Fascia & Soffit Clean': 'exterior', 'Roof Moss Removal': 'exterior',
  'Driveway Jet Wash': 'exterior', 'Patio / Decking': 'exterior', 'Path & Steps': 'exterior',
  'Render Wash': 'exterior', 'UPVC Restoration': 'exterior', 'Solar Panel Clean': 'exterior',
};

const FREQUENCY_DEFAULTS = {
  'Weekly Clean': { frequency_weekly: true, frequency_one_off: false },
  'Fortnightly Clean': { frequency_fortnightly: true, frequency_one_off: false },
  'Monthly Clean': { frequency_monthly: true, frequency_one_off: false },
  'Daily Office Clean': { frequency_weekly: true, frequency_one_off: false },
  'Weekly Office Clean': { frequency_weekly: true, frequency_one_off: false },
  'Airbnb Turnover': { frequency_one_off: true, frequency_weekly: true },
  'Holiday Let Changeover': { frequency_one_off: true, frequency_weekly: true },
};

export async function seedServicesFromOnboarding(serviceNames, customServiceText) {
  const businessId = await getBusinessId();
  const existing = await listServices({ includeInactive: true });
  if (existing.length > 0) return; // already seeded — don't overwrite

  const toInsert = [];
  let order = 0;

  for (const name of serviceNames) {
    const category = CATEGORY_MAP[name] ?? 'residential';
    const freqOverrides = FREQUENCY_DEFAULTS[name] ?? {};
    toInsert.push({
      business_id: businessId,
      name,
      category,
      pricing_type: 'custom',
      display_order: order++,
      frequency_one_off: true,
      ...freqOverrides,
    });
  }

  // Custom services from free-text field
  if (customServiceText) {
    const extras = customServiceText.split(',').map(s => s.trim()).filter(Boolean);
    for (const name of extras) {
      toInsert.push({
        business_id: businessId,
        name,
        category: 'residential',
        pricing_type: 'custom',
        display_order: order++,
        frequency_one_off: true,
      });
    }
  }

  if (!toInsert.length) return;

  const { error } = await supabase.from('services').insert(toInsert);
  if (error) throw error;
}
