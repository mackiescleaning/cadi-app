// serviceTemplates.js — sub-industry starter packs for the Services page.
// Each pack seeds 5–8 services with realistic UK defaults (2026 pricing).
// Owners can then edit prices/details — pack is a fast on-ramp, not a contract.
//
// Shape mirrors the `services` table columns exactly (snake_case), minus
// business_id / display_order which are stamped at insert time.

export const SERVICE_TEMPLATE_PACKS = [
  // ── Residential ───────────────────────────────────────────────────────────
  {
    id:       'domestic-regular',
    label:    'Domestic — regular',
    category: 'residential',
    blurb:    'Weekly/fortnightly homes with deep-clean upsell.',
    icon:     '🏠',
    services: [
      svc({
        name: 'Regular clean',
        category: 'residential',
        pricing_type: 'hourly',
        price_hourly_rate: 22,
        price_hourly_minimum_hours: 2,
        duration_value: 3, duration_unit: 'hours',
        frequency_weekly: true, frequency_fortnightly: true, frequency_monthly: true,
        description_included: 'Hoover, mop, dust, kitchen surfaces, bathrooms, bedrooms.',
      }),
      svc({
        name: 'Deep clean',
        category: 'residential',
        pricing_type: 'fixed',
        price_fixed_basic: 180, price_fixed_standard: 250, price_fixed_premium: 350,
        duration_value: 6, duration_unit: 'hours',
        frequency_one_off: true,
        description_included: 'Inside oven, inside windows, skirting boards, behind appliances, full kitchen + bathroom deep clean.',
      }),
      svc({
        name: 'End of tenancy',
        category: 'residential',
        pricing_type: 'fixed',
        price_fixed_basic: 220, price_fixed_standard: 320, price_fixed_premium: 450,
        duration_value: 8, duration_unit: 'hours',
        frequency_one_off: true,
        description_included: 'Move-out checklist clean for deposit return — inside oven, fridge, all cupboards.',
      }),
      svc({
        name: 'Oven clean (add-on)',
        category: 'residential',
        pricing_type: 'fixed',
        price_fixed_basic: 65,
        duration_value: 90, duration_unit: 'minutes',
        frequency_one_off: true,
        description_included: 'Full oven strip-down — racks, trays, glass door.',
      }),
      svc({
        name: 'Carpet cleaning',
        category: 'residential',
        pricing_type: 'per_room',
        price_per_room: 40,
        duration_value: 45, duration_unit: 'minutes',
        frequency_one_off: true,
      }),
    ],
  },

  {
    id:       'domestic-holiday-let',
    label:    'Holiday let / Airbnb turnover',
    category: 'residential',
    blurb:    'Short-let changeover services on a weekly cadence.',
    icon:     '🏖️',
    services: [
      svc({
        name: 'Airbnb turnover',
        category: 'residential',
        pricing_type: 'fixed',
        price_fixed_basic: 55, price_fixed_standard: 85, price_fixed_premium: 130,
        duration_value: 2, duration_unit: 'hours',
        frequency_weekly: true, frequency_one_off: true,
        description_included: 'Full reset between guests — beds stripped, kitchen, bathrooms, hoover, mop, bin out.',
        description_excluded: 'Linen replacement (charged separately).',
      }),
      svc({
        name: 'Linen + towels swap',
        category: 'residential',
        pricing_type: 'fixed',
        price_fixed_basic: 25,
        duration_value: 30, duration_unit: 'minutes',
        frequency_weekly: true, frequency_one_off: true,
      }),
      svc({
        name: 'Deep clean (between bookings)',
        category: 'residential',
        pricing_type: 'fixed',
        price_fixed_basic: 160, price_fixed_standard: 240, price_fixed_premium: 320,
        duration_value: 5, duration_unit: 'hours',
        frequency_one_off: true, frequency_monthly: true,
      }),
      svc({
        name: 'Welcome pack restock',
        category: 'residential',
        pricing_type: 'fixed',
        price_fixed_basic: 15,
        duration_value: 15, duration_unit: 'minutes',
        frequency_weekly: true, frequency_one_off: true,
      }),
    ],
  },

  // ── Exterior ──────────────────────────────────────────────────────────────
  {
    id:       'window-cleaning-round',
    label:    'Window cleaning round',
    category: 'exterior',
    blurb:    'Domestic + small commercial windows with gutter upsells.',
    icon:     '🪟',
    services: [
      svc({
        name: 'Residential windows',
        category: 'exterior',
        pricing_type: 'per_size',
        pricing_matrix: [
          { size_label: '1 bed flat',  price: 12 },
          { size_label: '2 bed house', price: 16 },
          { size_label: '3 bed house', price: 22 },
          { size_label: '4 bed house', price: 28 },
          { size_label: '5 bed+',      price: 35 },
        ],
        duration_value: 25, duration_unit: 'minutes',
        frequency_fortnightly: true, frequency_monthly: true,
        description_included: 'Outside frames, sills, glass — water-fed pole.',
      }),
      svc({
        name: 'Conservatory glass',
        category: 'exterior',
        pricing_type: 'fixed',
        price_fixed_basic: 35, price_fixed_standard: 55,
        duration_value: 30, duration_unit: 'minutes',
        frequency_quarterly: true, frequency_one_off: true,
      }),
      svc({
        name: 'Gutter clearing',
        category: 'exterior',
        pricing_type: 'fixed',
        price_fixed_basic: 95, price_fixed_standard: 140, price_fixed_premium: 220,
        duration_value: 2, duration_unit: 'hours',
        frequency_annually: true, frequency_one_off: true,
        description_included: 'Hand + vac clear all gutters, downpipes flushed.',
      }),
      svc({
        name: 'Fascia & soffit clean',
        category: 'exterior',
        pricing_type: 'fixed',
        price_fixed_basic: 120, price_fixed_standard: 180,
        duration_value: 3, duration_unit: 'hours',
        frequency_annually: true, frequency_one_off: true,
      }),
      svc({
        name: 'Commercial windows',
        category: 'exterior',
        pricing_type: 'hourly',
        price_hourly_rate: 35, price_hourly_minimum_hours: 1,
        duration_value: 2, duration_unit: 'hours',
        frequency_weekly: true, frequency_fortnightly: true, frequency_monthly: true,
      }),
    ],
  },

  {
    id:       'pressure-washing',
    label:    'Driveways & pressure washing',
    category: 'exterior',
    blurb:    'Driveway, patio, render — high-margin one-offs.',
    icon:     '💦',
    services: [
      svc({
        name: 'Driveway jet wash',
        category: 'exterior',
        pricing_type: 'per_sqm',
        price_per_sqm: 3.5, price_per_sqm_minimum: 180,
        duration_value: 4, duration_unit: 'hours',
        frequency_one_off: true, frequency_annually: true,
        site_visit_required: true,
      }),
      svc({
        name: 'Patio / decking wash',
        category: 'exterior',
        pricing_type: 'per_sqm',
        price_per_sqm: 4, price_per_sqm_minimum: 150,
        duration_value: 3, duration_unit: 'hours',
        frequency_one_off: true, frequency_annually: true,
      }),
      svc({
        name: 'Render softwash',
        category: 'exterior',
        pricing_type: 'custom',
        duration_value: 6, duration_unit: 'hours',
        frequency_one_off: true,
        site_visit_required: true,
        pricing_notes: 'Site survey required — biocide treatment + rinse.',
      }),
      svc({
        name: 'Roof moss removal',
        category: 'exterior',
        pricing_type: 'custom',
        duration_value: 1, duration_unit: 'days',
        frequency_one_off: true,
        site_visit_required: true,
        pricing_notes: 'Quote after survey — scaffolding/access dependent.',
      }),
    ],
  },

  // ── Commercial ────────────────────────────────────────────────────────────
  {
    id:       'commercial-contract',
    label:    'Commercial contract clean',
    category: 'commercial',
    blurb:    'Offices, retail, multi-site contract starting points.',
    icon:     '🏢',
    services: [
      svc({
        name: 'Daily office clean',
        category: 'commercial',
        pricing_type: 'hourly',
        price_hourly_rate: 18, price_hourly_minimum_hours: 2,
        duration_value: 3, duration_unit: 'hours',
        frequency_weekly: true,
        description_included: 'Hoover, mop, bin empty, kitchen, bathrooms, desk wipe-down.',
      }),
      svc({
        name: 'Weekly office clean',
        category: 'commercial',
        pricing_type: 'fixed',
        price_fixed_basic: 120, price_fixed_standard: 220, price_fixed_premium: 380,
        duration_value: 4, duration_unit: 'hours',
        frequency_weekly: true,
      }),
      svc({
        name: 'Retail clean',
        category: 'commercial',
        pricing_type: 'hourly',
        price_hourly_rate: 20, price_hourly_minimum_hours: 2,
        duration_value: 3, duration_unit: 'hours',
        frequency_weekly: true, frequency_fortnightly: true,
      }),
      svc({
        name: 'Periodic deep clean',
        category: 'commercial',
        pricing_type: 'custom',
        duration_value: 1, duration_unit: 'days',
        frequency_quarterly: true,
        site_visit_required: true,
        pricing_notes: 'Quote after site survey — depends on floor type, area, access.',
      }),
      svc({
        name: 'Window clean (commercial)',
        category: 'commercial',
        pricing_type: 'custom',
        duration_value: 2, duration_unit: 'hours',
        frequency_monthly: true, frequency_quarterly: true,
      }),
    ],
  },

  {
    id:       'commercial-hospitality',
    label:    'Hospitality (pub/restaurant/hotel)',
    category: 'commercial',
    blurb:    'End-of-trade cleans, kitchens, accommodation turnover.',
    icon:     '🍽️',
    services: [
      svc({
        name: 'End-of-trade pub clean',
        category: 'commercial',
        pricing_type: 'fixed',
        price_fixed_basic: 95, price_fixed_standard: 140, price_fixed_premium: 220,
        duration_value: 3, duration_unit: 'hours',
        frequency_weekly: true,
        description_included: 'Bar, floors, toilets, kitchen wipe-down, bins out.',
      }),
      svc({
        name: 'Commercial kitchen deep clean',
        category: 'commercial',
        pricing_type: 'custom',
        duration_value: 1, duration_unit: 'days',
        frequency_quarterly: true,
        site_visit_required: true,
        pricing_notes: 'TR19/extract certification on request.',
      }),
      svc({
        name: 'Hotel room turnover',
        category: 'commercial',
        pricing_type: 'fixed',
        price_fixed_basic: 18,
        duration_value: 30, duration_unit: 'minutes',
        frequency_weekly: true,
      }),
      svc({
        name: 'Restaurant FOH daily',
        category: 'commercial',
        pricing_type: 'hourly',
        price_hourly_rate: 22, price_hourly_minimum_hours: 2,
        duration_value: 2, duration_unit: 'hours',
        frequency_weekly: true,
      }),
    ],
  },
];

// All boolean frequency_* default to false; default duration to hours; default category 'residential'.
// pricing_matrix is JSONB and only used when pricing_type === 'per_size'.
function svc(o) {
  const defaults = {
    description_included: null,
    description_excluded: null,
    pricing_type: 'custom',
    price_hourly_rate: null,
    price_hourly_minimum_hours: null,
    price_fixed_basic: null,
    price_fixed_standard: null,
    price_fixed_premium: null,
    price_per_sqm: null,
    price_per_sqm_minimum: null,
    price_per_room: null,
    price_per_bathroom: null,
    pricing_notes: null,
    duration_value: null,
    duration_unit: 'hours',
    frequency_one_off: false,
    frequency_weekly: false,
    frequency_fortnightly: false,
    frequency_monthly: false,
    frequency_quarterly: false,
    frequency_annually: false,
    service_area_uses_default: true,
    service_area_custom: null,
    materials_equipment_notes: null,
    pricing_matrix: null,
    site_visit_required: false,
    is_active: true,
  };
  return { ...defaults, ...o };
}

export function packsByCategory(category) {
  return SERVICE_TEMPLATE_PACKS.filter(p => p.category === category);
}
