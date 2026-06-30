/**
 * supabase/functions/met-office/index.ts
 * Cadi — daily weather forecast for a UK postcode via Met Office DataHub.
 *
 * POST { postcode }
 *   Returns { source: 'cache'|'live'|'unavailable', forecast: DayForecast[] }
 *
 * Strategy:
 *   1. postcodes.io → lat/lng  (no key required)
 *   2. weather_cache lookup    (TTL: 1 hour)
 *   3. Met Office daily forecast (header: apikey)
 *   4. Upsert cache + return
 *
 * Env: MET_OFFICE_API_KEY (optional — without it the function returns
 *      { source: 'unavailable' } so the UI gracefully degrades).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MET_KEY = Deno.env.get("MET_OFFICE_API_KEY") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TTL_MS = 60 * 60 * 1000; // 1 hour

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

type DayForecast = {
  date: string;             // YYYY-MM-DD
  tempMinC: number | null;
  tempMaxC: number | null;
  rainPct: number | null;   // probability of precipitation (0-100)
  windKmh: number | null;
  condition: string;        // free-form short label
};

function normalisePostcode(input: string): string | null {
  if (!input) return null;
  const collapsed = input.replace(/\s+/g, "").toUpperCase();
  if (collapsed.length < 5 || collapsed.length > 7) return null;
  return `${collapsed.slice(0, -3)} ${collapsed.slice(-3)}`;
}

async function geocode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.result) return null;
  return { lat: j.result.latitude, lng: j.result.longitude };
}

function mapWeatherCode(code: number | null): string {
  // Met Office "significantWeatherCode" lookup (subset).
  const m: Record<number, string> = {
    0: "Clear night", 1: "Sunny", 2: "Partly cloudy", 3: "Partly cloudy",
    5: "Mist", 6: "Fog", 7: "Cloudy", 8: "Overcast",
    9: "Light rain", 10: "Light rain", 11: "Drizzle", 12: "Light rain",
    13: "Heavy rain", 14: "Heavy rain", 15: "Heavy rain",
    16: "Sleet", 17: "Sleet", 18: "Sleet",
    19: "Hail", 20: "Hail", 21: "Hail",
    22: "Light snow", 23: "Light snow", 24: "Light snow",
    25: "Heavy snow", 26: "Heavy snow", 27: "Heavy snow",
    28: "Thunder", 29: "Thunder", 30: "Thunder",
  };
  return code != null ? (m[code] ?? "Unknown") : "Unknown";
}

async function fetchMetOffice(lat: number, lng: number): Promise<DayForecast[] | null> {
  if (!MET_KEY) return null;
  const url = `https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/daily?latitude=${lat}&longitude=${lng}&excludeParameterMetadata=true`;
  const r = await fetch(url, { headers: { apikey: MET_KEY, accept: "application/json" } });
  if (!r.ok) return null;
  const j = await r.json();
  const series = j?.features?.[0]?.properties?.timeSeries ?? [];
  return series.slice(0, 7).map((d: any): DayForecast => ({
    date:       (d.time || "").slice(0, 10),
    tempMinC:   d.nightMinScreenTemperature ?? d.midnight15MinScreenTemperature ?? null,
    tempMaxC:   d.dayMaxScreenTemperature   ?? d.daySignificantWeatherCode != null ? d.dayMaxScreenTemperature ?? null : null,
    rainPct:    d.daySignificantWeatherCode != null
                  ? (d.dayProbabilityOfPrecipitation ?? null)
                  : (d.midnightProbabilityOfPrecipitation ?? null),
    windKmh:    d.midday10MWindSpeed != null
                  ? Math.round(d.midday10MWindSpeed * 3.6)
                  : null,
    condition:  mapWeatherCode(d.daySignificantWeatherCode ?? null),
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);

  try {
    const { postcode: raw } = await req.json();
    const postcode = normalisePostcode(String(raw ?? ""));
    if (!postcode) return json({ error: "invalid postcode" }, 400);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Cache hit?
    const { data: cached } = await sb
      .from("weather_cache")
      .select("forecast, fetched_at")
      .eq("postcode", postcode)
      .maybeSingle();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS) {
      return json({ source: "cache", forecast: cached.forecast });
    }

    // 2. No key → graceful no-op (UI hides the overlay).
    if (!MET_KEY) return json({ source: "unavailable", forecast: [] });

    // 3. Live fetch
    const geo = await geocode(postcode);
    if (!geo) return json({ source: "unavailable", forecast: [] });
    const forecast = await fetchMetOffice(geo.lat, geo.lng);
    if (!forecast) return json({ source: "unavailable", forecast: [] });

    // 4. Cache + return
    await sb.from("weather_cache").upsert({
      postcode,
      forecast,
      fetched_at: new Date().toISOString(),
    });
    return json({ source: "live", forecast });
  } catch (err) {
    return json({ error: (err as Error).message ?? "unknown error" }, 500);
  }
});
