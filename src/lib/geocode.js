// geocode.js — UK postcode → {lat, lng} resolution via postcodes.io.
// Cached per-postcode in localStorage so the round map only hits the API
// once per unique postcode across the session/device. postcodes.io is free,
// no key, generous limits, and supports a /postcodes batch endpoint that we
// use here so a 30-customer round costs one HTTP round trip, not thirty.

const CACHE_KEY = 'cadi_geocode_cache_v1';

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {}; }
  catch { return {}; }
}
function writeCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota — ignore */ }
}

function normalisePostcode(pc) {
  return String(pc || '').toUpperCase().replace(/\s+/g, '').trim();
}

// Returns { [postcode]: {lat, lng} | null } for every postcode supplied.
// Hits the cache first, batches the remainder, caches the response, returns
// the merged map. Failed lookups are cached as null so we don't keep retrying.
export async function geocodePostcodes(postcodes) {
  const unique = [...new Set((postcodes || []).map(normalisePostcode).filter(Boolean))];
  if (unique.length === 0) return {};

  const cache = readCache();
  const result = {};
  const need   = [];
  for (const pc of unique) {
    if (pc in cache) result[pc] = cache[pc];
    else need.push(pc);
  }
  if (need.length === 0) return result;

  // postcodes.io batches up to 100 per request.
  const chunks = [];
  for (let i = 0; i < need.length; i += 100) chunks.push(need.slice(i, i + 100));

  for (const chunk of chunks) {
    try {
      const r = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: chunk }),
      });
      if (!r.ok) throw new Error(`postcodes.io ${r.status}`);
      const body = await r.json();
      for (const item of body?.result ?? []) {
        const pc = normalisePostcode(item.query);
        if (item.result?.latitude && item.result?.longitude) {
          cache[pc] = { lat: item.result.latitude, lng: item.result.longitude };
        } else {
          cache[pc] = null;
        }
        result[pc] = cache[pc];
      }
    } catch {
      // Network/API failed — mark this chunk as null so the UI doesn't hang
      // on a spinner. Next session will retry.
      for (const pc of chunk) {
        cache[pc] = null;
        result[pc] = null;
      }
    }
  }

  writeCache(cache);
  return result;
}

// Convenience export — same key normalisation the cache uses, so a UI
// component can look up the result map by the customer's raw postcode.
export { normalisePostcode };

// Haversine great-circle distance in miles. Returns Infinity if either
// coord is missing so callers can filter/sort them to the bottom of a list.
export function haversineMiles(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;
  const R_MI = 3958.7613;   // Earth radius, miles
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R_MI * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
