/**
 * supabase/functions/uk-address-search/index.ts
 * Cadi — UK address autocomplete with postcode lookup.
 *
 * POST { q: string, near?: string }
 *   q    — free-text street / building / partial address
 *   near — optional town/postcode hint
 *
 * Returns { results: [{ label, address, postcode, town, county, lat, lng }] }
 *
 * Strategy:
 *   1. Forward-geocode the query with Nominatim (free OSM) — needs a real
 *      User-Agent so we proxy it through this function (browsers can't set UA).
 *   2. For each match we also pull postcode via postcodes.io reverse_geocode
 *      so we always return a postcode even when Nominatim's own address
 *      lacks one.
 *   3. UK only, top 5 matches, simplified shape for the UI.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age":       "86400",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const UA = "Cadi/1.0 (https://cadi.cleaning; rhianna@mackies.cleaning)";

type Match = {
  label:    string;
  address:  string;
  postcode: string | null;
  town:     string | null;
  county:   string | null;
  lat:      number;
  lng:      number;
};

async function nominatimSearch(query: string): Promise<any[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=gb&limit=5`;
  const r = await fetch(url, {
    headers: { "user-agent": UA, "accept-language": "en-GB" },
  });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  return await r.json();
}

async function postcodeFromCoords(lat: number, lng: number): Promise<string | null> {
  const r = await fetch(`https://api.postcodes.io/postcodes?lat=${lat}&lon=${lng}&limit=1`);
  if (!r.ok) return null;
  const j = await r.json();
  return j?.result?.[0]?.postcode ?? null;
}

function buildLabel(item: any): string {
  // Nominatim has display_name as a long comma-separated string. Build
  // something shorter that matches how UK people read addresses.
  const a = item.address ?? {};
  const street = a.road || a.pedestrian || a.path || '';
  const house  = a.house_number ? `${a.house_number} ` : '';
  const town   = a.city || a.town || a.village || a.suburb || a.hamlet || '';
  const left   = [`${house}${street}`.trim(), town].filter(Boolean).join(', ');
  return left || item.display_name?.split(',').slice(0, 2).join(', ') || item.display_name;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const q     = String(body?.q ?? "").trim();
  const near  = String(body?.near ?? "").trim();
  if (!q || q.length < 3) return json({ results: [] });

  const query = near ? `${q}, ${near}` : `${q}, UK`;

  try {
    const raw = await nominatimSearch(query);
    if (!raw.length) return json({ results: [] });

    // Resolve postcodes in parallel for items missing them.
    const enriched: Match[] = await Promise.all(raw.map(async (item) => {
      const a = item.address ?? {};
      let postcode = a.postcode ?? null;
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      if (!postcode && Number.isFinite(lat) && Number.isFinite(lng)) {
        postcode = await postcodeFromCoords(lat, lng);
      }
      return {
        label:    buildLabel(item),
        address:  item.display_name,
        postcode: postcode ? postcode.toUpperCase() : null,
        town:     a.city || a.town || a.village || a.suburb || a.hamlet || null,
        county:   a.county || a.state_district || a.state || null,
        lat,
        lng,
      };
    }));

    // Drop any without a usable postcode — they're useless for our flow.
    return json({ results: enriched.filter(r => r.postcode) });
  } catch (err) {
    return json({ error: (err as Error).message ?? "unknown", results: [] }, 500);
  }
});
