// postcode.js — UK postcode lookups.
// postcodes.io for postcode → town/county (free, no key).
// uk-address-search edge fn for street/address → postcode (Nominatim proxy).
// Both return null on failure; callers handle gracefully.

import { normalisePostcode } from './migration/parsers';
import { supabase } from './supabase';

export async function lookupPostcode(input) {
  const pc = normalisePostcode(input);
  if (!pc) return null;
  try {
    const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
    if (!r.ok) return null;
    const j = await r.json();
    const x = j?.result;
    if (!x) return null;
    return {
      postcode:   x.postcode,
      town:       x.admin_district || x.parish || x.region || null,
      county:     x.admin_county   || x.region || null,
      latitude:   x.latitude,
      longitude:  x.longitude,
      country:    x.country,
    };
  } catch {
    return null;
  }
}

// Search UK addresses by free-text street / building / partial address.
// Returns up to 5 results with postcode, town, county. Used when the
// owner knows the street name but not the postcode (e.g. "Gaveston Drive").
export async function searchAddresses(q, near = '') {
  if (!q || q.trim().length < 3) return [];
  try {
    const { data, error } = await supabase.functions.invoke('uk-address-search', {
      body: { q, near },
    });
    if (error) return [];
    return Array.isArray(data?.results) ? data.results : [];
  } catch {
    return [];
  }
}
