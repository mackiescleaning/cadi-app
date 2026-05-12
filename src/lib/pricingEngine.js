/**
 * Cadi Pricing Engine
 * Pure function — deterministic given a rule and a customer request.
 * No side effects, no network calls.
 */

// Default frequency modifiers if a rule doesn't define them
const DEFAULT_FREQ_MODIFIERS = {
  weekly:      0.90,
  fortnightly: 1.00,
  four_weekly: 1.05,
  monthly:     1.05,
  one_off:     1.25,
};

// Inferred bathroom counts when not provided (residential heuristic)
function inferBathrooms(bedrooms) {
  if (bedrooms <= 2) return 1;
  if (bedrooms <= 4) return 2;
  return 3;
}

// ─── Base price calculators per method ───────────────────────────────────────

function calcPerBedroom(base_amounts, property) {
  const beds = property.bedrooms;
  if (!beds) return { price: null, confidence: 'low', note: 'bedroom count unknown' };

  if (beds <= 5) {
    const price = base_amounts[String(beds)];
    if (price == null) return { price: null, confidence: 'low', note: `no price for ${beds} bed` };
    return { price, confidence: 'high' };
  }

  // 6+ bedrooms: extrapolate
  const base5 = base_amounts['5'];
  const extra  = base_amounts['6_plus_per_extra'] ?? 15;
  if (base5 == null) return { price: null, confidence: 'low', note: 'no 5-bed base for extrapolation' };
  return {
    price:      base5 + (beds - 5) * extra,
    confidence: 'medium',
    note:       `extrapolated from 5-bed + ${beds - 5} extra`,
  };
}

function calcPerBedroomBathroom(base_amounts, property) {
  const beds  = property.bedrooms;
  const baths = property.bathrooms ?? inferBathrooms(beds ?? 0);
  const inferred = !property.bathrooms;

  if (!beds) return { price: null, confidence: 'low', note: 'bedroom count unknown' };

  const { base = 0, per_bedroom = 0, per_bathroom = 0 } = base_amounts;
  return {
    price:      base + beds * per_bedroom + baths * per_bathroom,
    confidence: inferred ? 'medium' : 'high',
    note:       inferred ? `bathrooms inferred as ${baths}` : undefined,
  };
}

function calcPerSqm(base_amounts, property) {
  const sqm = property.sqm;
  if (!sqm) return { price: null, confidence: 'low', note: 'square meterage unknown' };

  const { tiered_rates, rate_per_sqm } = base_amounts;

  let rate;
  if (tiered_rates?.length) {
    const tier = tiered_rates.find(t => t.up_to_sqm == null || sqm <= t.up_to_sqm);
    rate = tier?.rate ?? rate_per_sqm;
  } else {
    rate = rate_per_sqm;
  }

  if (!rate) return { price: null, confidence: 'low', note: 'no rate configured' };
  return { price: sqm * rate, confidence: 'high' };
}

function calcPerHour(base_amounts, property) {
  const { hourly_rate, estimated_hours_by_size } = base_amounts;
  if (!hourly_rate) return { price: null, confidence: 'low', note: 'no hourly rate configured' };

  const beds  = property.bedrooms;
  const key   = beds ? `${beds}_bed` : null;
  const hours = key && estimated_hours_by_size?.[key];

  if (!hours) return { price: null, confidence: 'low', note: 'property size unknown for hour estimate' };
  return { price: hourly_rate * hours, confidence: 'medium' };
}

function calcFlatRateBySize(base_amounts, property) {
  const sqm  = property.sqm;
  const beds = property.bedrooms;

  // Try sqm match first, fall back to bedroom-based size guess
  const buckets = ['small', 'medium', 'large', 'extra_large'];
  let bucket;

  if (sqm) {
    bucket = buckets.find(k => {
      const b = base_amounts[k];
      return b && (b.max_sqm == null || sqm <= b.max_sqm);
    });
  } else if (beds) {
    // Rough bedroom→sqm heuristic for UK properties
    const estimatedSqm = beds <= 1 ? 45 : beds === 2 ? 65 : beds === 3 ? 90 : beds === 4 ? 130 : 180;
    bucket = buckets.find(k => {
      const b = base_amounts[k];
      return b && (b.max_sqm == null || estimatedSqm <= b.max_sqm);
    });
  }

  if (!bucket || !base_amounts[bucket]) {
    return { price: null, confidence: 'low', note: 'cannot determine size bucket' };
  }

  return {
    price:      base_amounts[bucket].price,
    confidence: sqm ? 'high' : 'medium',
    note:       sqm ? undefined : 'size bucket estimated from bedroom count',
  };
}

function calcFlatRateFixed(base_amounts) {
  const price = base_amounts.price;
  if (!price) return { price: null, confidence: 'low', note: 'no fixed price configured' };
  return { price, confidence: 'high' };
}

// ─── Duration calculator ─────────────────────────────────────────────────────

function calcDuration(rule, property) {
  const est = rule.duration_estimates;
  if (!est) return null;

  const beds = property.bedrooms;
  if (beds) {
    const mins = est[String(Math.min(beds, 5))];
    if (mins) return mins;
  }

  // flat_rate_by_size: look up bucket
  if (rule.pricing_method === 'flat_rate_by_size' && property.sqm) {
    const sizes = ['small', 'medium', 'large', 'extra_large'];
    for (const k of sizes) {
      const b = rule.base_amounts[k];
      if (b && (b.max_sqm == null || property.sqm <= b.max_sqm)) {
        return est[k] ?? null;
      }
    }
  }

  return est.default ?? null;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * @param {object} rule   - A pricing_rules row from Supabase
 * @param {object} input  - QuoteRequest (service, property, frequency, postcode, addons)
 * @param {object[]} addons - pricing_addons rows for this service
 * @returns QuoteResult
 */
export function calculateQuote(rule, input, addons = []) {
  const { property = {}, frequency = 'fortnightly', postcode = '', addons: selectedAddonIds = [] } = input;

  // Commercial / site visit — never quote
  if (rule.category === 'commercial' || rule.pricing_method === 'site_visit_required') {
    return routeToHuman('Commercial enquiry — site visit needed');
  }

  // Calculate base price
  let baseResult;
  switch (rule.pricing_method) {
    case 'per_bedroom':
      baseResult = calcPerBedroom(rule.base_amounts, property);
      break;
    case 'per_bedroom_bathroom':
      baseResult = calcPerBedroomBathroom(rule.base_amounts, property);
      break;
    case 'per_sqm':
      baseResult = calcPerSqm(rule.base_amounts, property);
      break;
    case 'per_hour':
      baseResult = calcPerHour(rule.base_amounts, property);
      break;
    case 'flat_rate_by_size':
      baseResult = calcFlatRateBySize(rule.base_amounts, property);
      break;
    case 'flat_rate_fixed':
      baseResult = calcFlatRateFixed(rule.base_amounts);
      break;
    default:
      return routeToHuman(`Unknown pricing method: ${rule.pricing_method}`);
  }

  if (baseResult.price == null) {
    return routeToHuman(baseResult.note ?? 'Cannot calculate price from available information');
  }

  const breakdown = [{ label: describeBase(rule, property), amount: baseResult.price }];
  let price = baseResult.price;
  let confidence = baseResult.confidence;

  // Apply frequency modifier
  const modifiers   = rule.frequency_modifiers ?? DEFAULT_FREQ_MODIFIERS;
  const freqMod     = modifiers[frequency] ?? 1.0;
  const isAbsolute  = rule.frequency_is_absolute ?? false;

  if (isAbsolute) {
    if (modifiers[frequency] != null) {
      price = modifiers[frequency];
      breakdown.push({ label: `${formatFreq(frequency)} price (fixed)`, amount: price - baseResult.price });
    }
  } else if (freqMod !== 1.0) {
    const diff = price * freqMod - price;
    price = price * freqMod;
    breakdown.push({ label: `${formatFreq(frequency)} adjustment (×${freqMod})`, amount: Math.round(diff * 100) / 100 });
  }

  price = Math.round(price * 100) / 100;

  // Apply postcode tier modifier
  if (rule.postcode_tiers) {
    const tier = findPostcodeTier(rule.postcode_tiers, postcode);
    if (tier && tier.modifier !== 1.0) {
      const diff = Math.round(price * (tier.modifier - 1) * 100) / 100;
      price = Math.round(price * tier.modifier * 100) / 100;
      breakdown.push({ label: `Area adjustment (${postcode})`, amount: diff });
      if (confidence === 'high') confidence = 'medium'; // postcode tier adds soft uncertainty
    }
  }

  // Apply minimum price floor
  const warnings = [];
  if (rule.minimum_price != null && price < rule.minimum_price) {
    price = rule.minimum_price;
    warnings.push('Minimum charge applied');
    breakdown.push({ label: 'Minimum charge', amount: rule.minimum_price - (breakdown.reduce((s, b) => s + b.amount, 0)) });
  }

  // Sanity check
  if (price <= 0 || price > 10000) {
    return routeToHuman(`Calculated price £${price} is outside expected range`);
  }

  // Duration
  const baseDuration = calcDuration(rule, property) ?? null;

  // Addons
  const commonAddons = addons.filter(a => a.active && a.display_mode === 'common');
  const selectedAddons = addons.filter(a => selectedAddonIds.includes(a.id));
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const addonDuration = selectedAddons.reduce((s, a) => s + (a.duration_minutes_added ?? 0), 0);

  if (selectedAddons.length) {
    selectedAddons.forEach(a => breakdown.push({ label: a.name, amount: a.price }));
  }

  return {
    price:            Math.round((price + addonTotal) * 100) / 100,
    base_price:       price,
    duration_minutes: baseDuration != null ? baseDuration + addonDuration : null,
    confidence,
    confidence_reason: buildConfidenceReason(confidence, baseResult.note),
    breakdown,
    addon_options:    commonAddons,
    warnings,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function routeToHuman(reason) {
  return {
    price:             null,
    base_price:        null,
    duration_minutes:  null,
    confidence:        'route_to_human',
    confidence_reason: reason,
    breakdown:         [],
    addon_options:     [],
    warnings:          [],
  };
}

function describeBase(rule, property) {
  const beds = property.bedrooms;
  switch (rule.pricing_method) {
    case 'per_bedroom':
    case 'per_bedroom_bathroom':
      return beds ? `${beds}-bed base price` : 'Base price';
    case 'per_sqm':
      return property.sqm ? `${property.sqm}m² × rate` : 'Base price (per m²)';
    case 'per_hour':
      return 'Estimated hours × hourly rate';
    case 'flat_rate_by_size':
      return 'Flat rate (by size)';
    case 'flat_rate_fixed':
      return 'Fixed rate';
    default:
      return 'Base price';
  }
}

function formatFreq(freq) {
  const map = {
    weekly:      'Weekly',
    fortnightly: 'Fortnightly',
    four_weekly: 'Four-weekly',
    monthly:     'Monthly',
    one_off:     'One-off',
  };
  return map[freq] ?? freq;
}

function findPostcodeTier(postcodeTiers, postcode) {
  if (!postcode || !postcodeTiers) return null;
  const district = postcode.trim().toUpperCase().split(' ')[0];
  for (const [, tier] of Object.entries(postcodeTiers)) {
    if (tier.postcodes?.some(p => p.toUpperCase() === district)) {
      return tier;
    }
  }
  return null;
}

function buildConfidenceReason(confidence, note) {
  if (confidence === 'high')   return 'All details known — price is exact';
  if (confidence === 'medium') return note ?? 'Some details estimated — price may vary slightly';
  if (confidence === 'low')    return note ?? 'Key details missing — this is an approximate range';
  return note ?? '';
}
