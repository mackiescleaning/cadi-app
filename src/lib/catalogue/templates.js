// Catalogue templates — the canonical tier ladders Cadi knows about per
// (division, service_name). Observed prices from a user's customer data fill
// the slots; empty slots get estimates via the progression multiplier.
//
// Pure data + a name resolver. No DB. Same file is duplicated into the edge
// function so Deno + browser stay in sync — if you edit one, edit both.

export const SERVICE_TEMPLATES = {
  residential: {
    'Window Cleaning': {
      tiers: [
        { key: '1bed', label: '1 bed',  hint: 'Studio or 1-bedroom flat',  multiplier: 0.70 },
        { key: '2bed', label: '2 bed',  hint: 'Terraced 2-bed',            multiplier: 0.85 },
        { key: '3bed', label: '3 bed',  hint: 'Semi-detached 3-bed',       multiplier: 1.00 },
        { key: '4bed', label: '4 bed',  hint: 'Detached 4-bed',            multiplier: 1.30 },
        { key: '5bed', label: '5 bed+', hint: 'Large detached',            multiplier: 1.65 },
      ],
      defaultTier: '3bed', baseTier: '3bed',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 25,
    },
    'Regular Domestic Clean': {
      tiers: [
        { key: '1bed', label: '1 bed',  hint: 'Studio / 1-bed flat',   multiplier: 0.60 },
        { key: '2bed', label: '2 bed',  hint: '2-bed flat or terrace', multiplier: 0.80 },
        { key: '3bed', label: '3 bed',  hint: 'Semi 3-bed',            multiplier: 1.00 },
        { key: '4bed', label: '4 bed',  hint: 'Detached 4-bed',        multiplier: 1.30 },
        { key: '5bed', label: '5+ bed', hint: 'Large or HMO',          multiplier: 1.70 },
      ],
      defaultTier: '3bed', baseTier: '3bed',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 120,
    },
    'End of Tenancy Clean': {
      tiers: [
        { key: '1bed', label: '1 bed',  multiplier: 0.65 },
        { key: '2bed', label: '2 bed',  multiplier: 0.85 },
        { key: '3bed', label: '3 bed',  multiplier: 1.00 },
        { key: '4bed', label: '4 bed',  multiplier: 1.35 },
        { key: '5bed', label: '5+ bed', multiplier: 1.80 },
      ],
      defaultTier: '3bed', baseTier: '3bed',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 240,
    },
    'Deep Clean': {
      tiers: [
        { key: '1bed', label: '1 bed',  multiplier: 0.60 },
        { key: '2bed', label: '2 bed',  multiplier: 0.80 },
        { key: '3bed', label: '3 bed',  multiplier: 1.00 },
        { key: '4bed', label: '4 bed',  multiplier: 1.30 },
        { key: '5bed', label: '5+ bed', multiplier: 1.70 },
      ],
      defaultTier: '3bed', baseTier: '3bed',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 180,
    },
    'Oven Clean': {
      tiers: [
        { key: 'standard', label: 'Standard oven', multiplier: 1.00 },
        { key: 'range',    label: 'Range cooker',  multiplier: 1.50 },
        { key: 'aga',      label: 'Aga',           multiplier: 2.00 },
      ],
      defaultTier: 'standard', baseTier: 'standard',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 120,
    },
    'Carpet Cleaning': {
      tiers: [
        { key: '1room',       label: '1 room',       multiplier: 1.0 },
        { key: '2-3rooms',    label: '2-3 rooms',    multiplier: 2.5 },
        { key: 'whole-house', label: 'Whole house',  multiplier: 5.0 },
      ],
      defaultTier: '2-3rooms', baseTier: '1room',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 90,
    },
    'Airbnb Turnover': {
      tiers: [
        { key: 'studio', label: 'Studio', multiplier: 0.70 },
        { key: '1bed',   label: '1 bed',  multiplier: 0.85 },
        { key: '2bed',   label: '2 bed',  multiplier: 1.00 },
        { key: '3bed',   label: '3 bed',  multiplier: 1.30 },
        { key: '4bed',   label: '4+ bed', multiplier: 1.70 },
      ],
      defaultTier: '2bed', baseTier: '2bed',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 90,
    },
  },

  exterior: {
    'Window Cleaning': {
      tiers: [
        { key: '1bed', label: '1 bed',  hint: 'Flat',           multiplier: 0.70 },
        { key: '2bed', label: '2 bed',  hint: 'Terraced',       multiplier: 0.85 },
        { key: '3bed', label: '3 bed',  hint: 'Semi-detached',  multiplier: 1.00 },
        { key: '4bed', label: '4 bed',  hint: 'Detached',       multiplier: 1.30 },
        { key: '5bed', label: '5 bed+', hint: 'Large detached', multiplier: 1.65 },
      ],
      defaultTier: '3bed', baseTier: '3bed',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 25,
    },
    'Gutter Clear': {
      tiers: [
        { key: 'bungalow', label: 'Bungalow',         hint: 'Single storey',                   multiplier: 0.75 },
        { key: '2storey',  label: '2 storey',         hint: 'Standard house',                  multiplier: 1.00 },
        { key: '3storey',  label: '3 storey',         hint: 'Townhouse or loft conversion',    multiplier: 1.45 },
        { key: 'large',    label: 'Larger property',  hint: 'L-shape or with extensions',      multiplier: 1.80 },
      ],
      defaultTier: '2storey', baseTier: '2storey',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 50,
    },
    'Conservatory Clean': {
      tiers: [
        { key: 'standard', label: 'Standard 3x3m',     multiplier: 1.00 },
        { key: 'large',    label: 'Larger 4x5m+',      multiplier: 1.60 },
      ],
      defaultTier: 'standard', baseTier: 'standard',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 40,
    },
    'Fascia & Soffit Clean': {
      tiers: [
        { key: 'bungalow', label: 'Bungalow',  multiplier: 0.70 },
        { key: '2storey',  label: '2 storey',  multiplier: 1.00 },
        { key: '3storey',  label: '3 storey',  multiplier: 1.40 },
      ],
      defaultTier: '2storey', baseTier: '2storey',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 30,
    },
    'Soft Wash': {
      tiers: [
        { key: 'small',  label: 'Small',  multiplier: 1.00 },
        { key: 'medium', label: 'Medium', multiplier: 1.60 },
        { key: 'large',  label: 'Large',  multiplier: 2.40 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 90,
    },
    'Pressure Washing': {
      tiers: [
        { key: 'patio',      label: 'Patio (up to 20m²)', multiplier: 1.00 },
        { key: 'driveway',   label: 'Driveway',           multiplier: 1.50 },
        { key: 'large-area', label: 'Large area',         multiplier: 2.50 },
      ],
      defaultTier: 'driveway', baseTier: 'patio',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 90,
    },
    'Driveway Clean': {
      tiers: [
        { key: 'small',  label: 'Small drive (1 car)',     multiplier: 1.00 },
        { key: 'medium', label: 'Medium (2-3 cars)',       multiplier: 1.50 },
        { key: 'large',  label: 'Large (4+ cars)',         multiplier: 2.20 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'quick_quote', pricing_model: 'tiered', duration_mins: 90,
    },
    'Roof Clean': {
      tiers: [
        { key: 'bungalow', label: 'Bungalow', multiplier: 0.70 },
        { key: '2storey',  label: '2 storey', multiplier: 1.00 },
        { key: '3storey',  label: '3 storey', multiplier: 1.40 },
      ],
      defaultTier: '2storey', baseTier: '2storey',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: 120,
    },
  },

  commercial: {
    'Window Cleaning': {
      tiers: [
        { key: 'small',  label: 'Small',   hint: 'Single-storey shop or small office unit', multiplier: 1.00 },
        { key: 'medium', label: 'Medium',  hint: '2-3 storey office, ground-level access',  multiplier: 2.50 },
        { key: 'large',  label: 'Large',   hint: 'Multi-floor block, needs reach pole / cherry picker', multiplier: 6.00 },
        { key: 'xlarge', label: 'X-Large', hint: 'High-rise / hotel — rope access or scaffolding',     multiplier: 14.00 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: null,
    },
    'Office Clean': {
      tiers: [
        { key: 'small',  label: 'Small office',     hint: 'Up to 5 people',          multiplier: 1.00 },
        { key: 'medium', label: 'Medium office',    hint: '5-25 people',             multiplier: 2.20 },
        { key: 'large',  label: 'Large office',     hint: '25-100 people',           multiplier: 5.00 },
        { key: 'xlarge', label: 'Multi-floor / HQ', hint: '100+ people, multi-floor', multiplier: 12.00 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: null,
    },
    'Retail Clean': {
      tiers: [
        { key: 'small',  label: 'Small shop',                  multiplier: 1.0 },
        { key: 'medium', label: 'Mid-size store',              multiplier: 2.5 },
        { key: 'large',  label: 'Department / supermarket',    multiplier: 8.0 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: null,
    },
    'Pub / Restaurant Clean': {
      tiers: [
        { key: 'small',  label: 'Small pub / cafe',                multiplier: 1.0 },
        { key: 'medium', label: 'Pub or mid-size restaurant',      multiplier: 2.0 },
        { key: 'large',  label: 'Large or multi-unit',             multiplier: 4.5 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: null,
    },
    'Periodic Deep Clean': {
      tiers: [
        { key: 'small',  label: 'Small site',         multiplier: 1.0 },
        { key: 'medium', label: 'Medium site',        multiplier: 2.5 },
        { key: 'large',  label: 'Large or multi-site', multiplier: 6.0 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: null,
    },
    'Contract Clean': {
      tiers: [
        { key: 'small',  label: 'Small contract',  multiplier: 1.0 },
        { key: 'medium', label: 'Medium contract', multiplier: 2.5 },
        { key: 'large',  label: 'Large contract',  multiplier: 6.0 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: null,
    },
    'Commercial Gutters': {
      tiers: [
        { key: 'small',  label: 'Small site',   multiplier: 1.0 },
        { key: 'medium', label: 'Medium site',  multiplier: 2.0 },
        { key: 'large',  label: 'Large site',   multiplier: 4.0 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: null,
    },
    'Commercial Pressure Wash': {
      tiers: [
        { key: 'small',  label: 'Small forecourt',                 multiplier: 1.0 },
        { key: 'medium', label: 'Medium car park',                 multiplier: 2.5 },
        { key: 'large',  label: 'Large car park / industrial',     multiplier: 5.0 },
      ],
      defaultTier: 'medium', baseTier: 'small',
      booking_mode: 'enquiry', pricing_model: 'tiered', duration_mins: null,
    },
  },
};

// Common aliases parsers and Sonnet emit. Maps to canonical template names.
const ALIASES = {
  'windows': 'Window Cleaning',
  'wins': 'Window Cleaning',
  'window round': 'Window Cleaning',
  'window clean': 'Window Cleaning',
  'gutters': 'Gutter Clear',
  'gutter clearance': 'Gutter Clear',
  'gutter cleaning': 'Gutter Clear',
  'regular clean': 'Regular Domestic Clean',
  'weekly clean': 'Regular Domestic Clean',
  'domestic': 'Regular Domestic Clean',
  'domestic clean': 'Regular Domestic Clean',
  'end of tenancy': 'End of Tenancy Clean',
  'eot': 'End of Tenancy Clean',
  'spring clean': 'Deep Clean',
  'office': 'Office Clean',
  'carpet': 'Carpet Cleaning',
  'oven': 'Oven Clean',
  'conservatory': 'Conservatory Clean',
  'fascia': 'Fascia & Soffit Clean',
  'soffit': 'Fascia & Soffit Clean',
  'softwash': 'Soft Wash',
  'soft wash': 'Soft Wash',
  'pressure wash': 'Pressure Washing',
  'jet wash': 'Pressure Washing',
  'driveway': 'Driveway Clean',
  'roof': 'Roof Clean',
};

// Resolve a (division, free-text service name) pair to a template entry.
// Returns { name, template } or null. Tries exact match, then aliases, then
// loose substring match on canonical names.
export function findTemplate(division, name) {
  const div = SERVICE_TEMPLATES[String(division ?? '').toLowerCase()];
  if (!div) return null;
  const want = String(name ?? '').toLowerCase().trim();
  if (!want) return null;

  // Direct match
  for (const k of Object.keys(div)) {
    if (k.toLowerCase() === want) return { name: k, template: div[k] };
  }

  // Alias
  if (ALIASES[want] && div[ALIASES[want]]) {
    return { name: ALIASES[want], template: div[ALIASES[want]] };
  }
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (want.includes(alias) && div[canonical]) {
      return { name: canonical, template: div[canonical] };
    }
  }

  // Loose substring on the canonical key (first word)
  for (const k of Object.keys(div)) {
    const kl = k.toLowerCase();
    const firstWord = kl.split(' ')[0];
    if (want.includes(firstWord) || kl.includes(want)) {
      return { name: k, template: div[k] };
    }
  }

  return null;
}
