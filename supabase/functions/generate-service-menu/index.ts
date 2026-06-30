/**
 * supabase/functions/generate-service-menu/index.ts
 * Cadi — Step 4 of customer migration. Reads the user's just-committed
 * customers + recurring_jobs (from THIS onboarding session's commit batch),
 * groups by service + division, computes price stats, and asks Sonnet to
 * draft a clean service menu in Cadi voice. Caches the draft on
 * onboarding_sessions.menu_draft so reloads don't re-spend tokens.
 *
 * POST { session_id, regenerate?: boolean }
 * Returns { menu: { sections: [...] } }
 *
 * Auth: requires Supabase JWT. Uses service role internally so RLS doesn't
 * leak this user's data outside their owner_id.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL         = "claude-sonnet-4-5";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `You are Cadi, helping a UK cleaning business owner turn their messy real-world service labels + prices into a clean, tiered, shareable service menu.

**IMPORTANT**: pricing_model, booking_mode, and the tier structure (count, ranges) have ALREADY been decided by Cadi's deterministic inference engine. Echo them back UNCHANGED. Your only job is drafting the copy on top — canonical names, clean descriptions, friendly tier labels, clarification questions, and add-on suggestions.

== Template-locked services ==
For any service entry where input includes "template_locked": true:
- Echo tier shape (count, key, label, suggested_price) EXACTLY as provided in input.tier_entries.
- Echo pricing_model and booking_mode unchanged.
- You only contribute: description (one sentence), and the canonical service name.
- Estimated tiers (where is_estimated: true) carry their estimated price — pass it through unchanged. The UI flags them visually.
- Owner can override any price in the editor. Do not flag estimated tiers as outliers — they aren't.

You'll receive an array, one entry per (division, raw service label) combo, with:
- The raw service label as the owner wrote it
- The total customer count
- The actual prices charged across those customers
- "tiers" — pre-computed natural price bands (already capped at ≤4, long-tail outliers separated). Each tier carries: price_low, price_high, suggested_price, count, prices, is_from_tier (true when the top tier absorbed the tail — display as "from £X"), is_outlier (true when this is a custom-priced outlier, not a real tier).
- "pricing_model" — already inferred. ECHO BACK UNCHANGED.
- "booking_mode" — already inferred. ECHO BACK UNCHANGED.

== What to produce ==
Return ONLY a JSON object — no prose, no markdown fences, no explanation.

Shape:
{
  "sections": [
    {
      "division": "residential" | "commercial" | "exterior",
      "services": [
        {
          "name": string,                       // Clean tier-aware name — see Naming rules below
          "description": string,                // ONE short sentence in Cadi voice — straight-talking, UK English, no exclamation marks, no marketing fluff
          "price_low": number | null,
          "price_high": number | null,
          "suggested_price": number | null,     // Echo from the matching tier
          "price_unit": "per_visit" | "per_hour" | "per_month" | null,
          "customer_count": number,
          "price_spread_flag": boolean,         // true if price_high/price_low > 1.4
          "tier_of": string | null,             // For tiered services, the parent service name e.g. "Window Cleaning". Null for single-tier or non-tiered services.
          "pricing_model": "flat" | "tiered" | "by_unit" | "by_frequency" | "quote_only",  // ECHO unchanged from input
          "booking_mode":  "instant" | "quick_quote" | "enquiry",                          // ECHO unchanged from input
          "from_price":    boolean,             // True ONLY when echoing a tier with is_from_tier=true. Sets the menu label to "From £X".
          "is_outlier":    boolean              // True for tiers marked is_outlier in input — these are custom-priced. Label as "Custom" or similar.
        }
      ],
      "question": string | null,                // ONE short question to the owner about this division — see Question rules. Null if there's nothing to clarify.
      "suggestions": [                          // Related services they don't currently offer but probably should — see Suggestions rules
        { "name": string, "why": string }       // why = one short reason why a customer would want it
      ]
    }
  ]
}

== Tiering rule (this is the most important rule) ==
When a service has tiers in the input, emit ONE service entry PER TIER, not a single entry covering the whole range. The tiers represent real bands in the owner's pricing.

For each tier in the input:
- Echo the tier's price_low, price_high, suggested_price exactly.
- If the tier has is_from_tier=true, set from_price=true on the output (this signals the UI to display "From £X" instead of "£X" — the tier absorbed the long tail).
- If the tier has is_outlier=true, set is_outlier=true on the output (custom-priced exceptions — label them appropriately, e.g. add "(custom)" suffix to the name).
- Skip is_outlier tiers if you can't sensibly name them, but never silently drop a non-outlier tier.

Name each tier sensibly based on the service type:
- Window Cleaning + 3 tiers around £10/£18/£35 → "Window Cleaning — Terraced", "Window Cleaning — Semi-detached", "Window Cleaning — Detached" (UK house archetypes). NEVER use Small/Medium/Large for windows.
- Gutter Clear + 2 tiers → "Gutter Clear — Standard property", "Gutter Clear — Larger property / 3-storey"
- Regular Domestic Clean + 2 tiers → "Regular Clean — Up to 3 bedrooms", "Regular Clean — 4+ bedrooms"
- Office Clean + 2 tiers → "Office Clean — Small site", "Office Clean — Larger site"
- Commercial work always its own tier even if price overlaps.

Set tier_of to the parent canonical service name ("Window Cleaning") on every tier so the UI can group them.

If a service has no tiers in the input (single price band or flat model), emit ONE entry with tier_of = null and tiers fields omitted.

== Naming (canonical) ==
- "windows" / "wins" / "window round" → "Window Cleaning"
- "gutters" / "gutter clear" → "Gutter Clear"
- "regular clean" / "weekly clean" / "domestic" → "Regular Domestic Clean"
- "end of tenancy" / "EOT" → "End of Tenancy Clean"
- "deep clean" / "spring clean" → "Deep Clean"
- "office clean" / "office" → "Office Clean"
- "carpet" → "Carpet Cleaning"
- "oven" → "Oven Clean"
- "conservatory" → "Conservatory Clean"
- "fascia" / "soffit" → "Fascia & Soffit Clean"
- "softwash" / "soft wash" → "Soft Wash"
- "pressure wash" / "jet wash" → "Pressure Washing"
- "driveway" → "Driveway Clean"
- "patio" → "Patio Clean"
- "roof" → "Roof Clean"
- "render" → "Render Clean"
Title case for menu display. Tier name appended with em-dash + space: "Window Cleaning — Terraced".

== Description (Cadi voice) ==
ONE short sentence per service. Examples:
- "Outside-window clean using pure-water poles — frames and sills included."
- "Gutters cleared by vacuum from the ground, downpipes flushed."
- "Top-to-bottom domestic clean: kitchens, bathrooms, dusting, floors."
- "Office clean tailored to your opening hours — bins, surfaces, kitchens, washrooms."
NEVER use exclamation marks. NEVER write marketing fluff like "sparkle", "make immaculate", "professional service".

== Question rule ==
For divisions that ended up with TIERED services from clusters, ask ONE clarifying question to the owner so they can confirm or rename the tiers. Examples:
- "I split your window-clean prices into terraced / semi / detached. Does that match how you price, or do you go by something else like bedrooms?"
- "I see two regular-clean price bands. Are these by number of bedrooms, or by frequency (weekly vs fortnightly)?"
For divisions with no tiers, set question to null. The question lands in Cadi's voice, first person ("I split…", "I see…"). UK English, no exclamation marks.

NEVER suggest pane-counting as a pricing dimension — UK cleaning businesses quote windows by property archetype (residential) or building size + access (commercial), never by pane count.

== Suggestions rule (proactive add-ons) ==
For each division, suggest 2–4 related services the owner DOESN'T currently have (compare against the services you generated for that division). Pick canonical UK ones likely for this division:
- Exterior already has Window Cleaning → suggest Gutter Clear, Conservatory Clean, Fascia & Soffit, Soft Wash, Driveway Clean (whichever they don't have yet)
- Residential has Regular Domestic Clean → suggest End of Tenancy, Deep Clean, Oven Clean, Carpet Cleaning, Airbnb Turnover (whichever missing)
- Commercial has Office Clean → suggest Pub / Restaurant Clean, Retail Clean, Periodic Deep, Contract Clean (missing ones)
Each suggestion: short "why" sentence ("Common pairing — most window-clean customers want gutters once a year.").
Skip the suggestions array (return empty []) if everything sensible is already on the menu.

== Output ==
- ONLY the JSON object. Start with { and end with }. No code fences, no preamble.
- Empty divisions (no services) → omit from sections entirely.
- Order services within a section by customer_count descending. Tier siblings stay grouped.`;

type ServiceUsage = {
  division: string | null;
  service:  string;
  count:    number;
  prices:   number[];
};

async function callSonnet(payload: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: payload }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const j = await r.json();
  return j?.content?.[0]?.text ?? "";
}

function parseJsonObject(text: string): any {
  const cleaned = text.replace(/```json\s*|```\s*$/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

function normaliseLabel(s: string): string {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Inference engine (Phase C, spec §6.3–6.6) ─────────────────────────────
// Pure TypeScript, deterministic. AI never decides pricing model or booking
// mode — only drafts copy. This is the "one pricing brain, many faces"
// principle: every surface (Front Desk, portal, scheduler, quoter) will
// read the same shapes computed here.

type PricingModel = "flat" | "tiered" | "by_unit" | "by_frequency" | "quote_only";
type BookingMode  = "instant" | "quick_quote" | "enquiry";

function coefficientOfVariation(prices: number[]): number {
  if (prices.length < 2) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (mean === 0) return 0;
  const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length;
  return Math.sqrt(variance) / mean;
}

// Spec §6.4 — constrained tier clustering.
// Cap at 3-4 tiers, fold sparse long tail into the top tier as a "from"
// price, flag true outliers as custom (count<2 AND wildly above), never
// emit a tier holding <~3% of customers.
type Tier = {
  price_low:      number;
  price_high:     number;
  suggested_price: number;
  count:          number;
  prices:         number[];
  is_from_tier:   boolean;     // True for the highest tier when we folded a long tail into it
  is_outlier:     boolean;     // True for clusters we kept aside as custom-priced
};

function clusterTiersConstrained(prices: number[]): Tier[] {
  const valid = prices.filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (valid.length < 4) return [];
  if (valid[valid.length - 1] / valid[0] <= 1.5) return [];   // no real spread

  // 1. Find raw gap indices.
  const gaps: number[] = [];
  for (let i = 0; i < valid.length - 1; i++) {
    if (valid[i + 1] / valid[i] >= 1.4 && valid[i + 1] - valid[i] >= 5) gaps.push(i + 1);
  }
  if (!gaps.length) {
    const third = Math.floor(valid.length / 3);
    if (third < 2) return [];
    gaps.push(third, third * 2);
  }

  // 2. Build raw segments.
  let segments: number[][] = [];
  let prev = 0;
  for (const g of gaps) { segments.push(valid.slice(prev, g)); prev = g; }
  segments.push(valid.slice(prev));
  segments = segments.filter(s => s.length > 0);

  // 3. Detect long-tail outliers: top segment with very few prices AND
  // a huge jump above the segment below. Pull aside as custom outliers
  // rather than dragging the displayed tier price way up.
  const outliers: number[][] = [];
  const minTierShare = Math.max(2, Math.floor(valid.length * 0.03));   // ~3% floor
  while (segments.length > 1) {
    const top  = segments[segments.length - 1];
    const next = segments[segments.length - 2];
    const ratio = top[0] / next[next.length - 1];
    if (top.length < minTierShare && ratio >= 1.5) {
      outliers.unshift(top);
      segments.pop();
    } else {
      break;
    }
  }

  // 4. Merge any remaining tiny segments into adjacents (still preserves
  // outlier separation thanks to step 3).
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].length < minTierShare && segments.length > 1) {
      const target = i === 0 ? 1 : i - 1;
      segments[target] = [...segments[target], ...segments[i]].sort((a, b) => a - b);
      segments.splice(i, 1);
    }
  }

  // 5. Cap at 4 tiers — merge the smallest gaps until ≤4.
  while (segments.length > 4) {
    let smallestIdx = 0, smallestRatio = Infinity;
    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i][segments[i].length - 1];
      const b = segments[i + 1][0];
      const ratio = b / a;
      if (ratio < smallestRatio) { smallestRatio = ratio; smallestIdx = i; }
    }
    segments[smallestIdx] = [...segments[smallestIdx], ...segments[smallestIdx + 1]].sort((a, b) => a - b);
    segments.splice(smallestIdx + 1, 1);
  }

  if (segments.length < 2) return [];

  // 6. Build the tier list. Top tier becomes a "from £X" if we removed
  // long-tail outliers (so the menu still says "starts at £X" even
  // though some real customers pay more).
  const tiers: Tier[] = segments.map((seg, idx): Tier => {
    const suggested = seg.length <= 4
      ? Math.round(seg.reduce((a, b) => a + b, 0) / seg.length)
      : seg[Math.floor(seg.length / 2)];
    return {
      price_low:       seg[0],
      price_high:      seg[seg.length - 1],
      suggested_price: suggested,
      count:           seg.length,
      prices:          seg,
      is_from_tier:    idx === segments.length - 1 && outliers.length > 0,
      is_outlier:      false,
    };
  });

  for (const out of outliers) {
    tiers.push({
      price_low:       out[0],
      price_high:      out[out.length - 1],
      suggested_price: Math.round(out.reduce((a, b) => a + b, 0) / out.length),
      count:           out.length,
      prices:          out,
      is_from_tier:    false,
      is_outlier:      true,
    });
  }

  return tiers;
}

// Spec §6.3 — pricing model inference, deterministic.
// Inputs: raw service label, prices, optional notes/freq stats.
function inferPricingModel(opts: {
  label:    string;
  prices:   number[];
  tiers:    Tier[];
  notes?:   string;
}): PricingModel {
  const label = `${opts.label} ${opts.notes ?? ""}`.toLowerCase();

  // 1. Explicit per-unit signals in the label or notes.
  if (/per\s+window|per\s+hour|hourly|per\s+sq\s?m|per\s+sqm|per\s+metre|per\s+m\b|per\s+room|per\s+panel/i.test(label)) {
    return "by_unit";
  }

  // (Step 2 — by_frequency — needs grouping by rrule. Skipped for now since
  // we don't have per-row frequency on this side of the aggregation. The
  // catalogue surface can refine later.)

  // 3. Real tiers were detected → tiered
  if (opts.tiers.length >= 2 && opts.tiers.some(t => !t.is_outlier)) {
    return "tiered";
  }

  // 4. Low coefficient of variation → flat
  if (opts.prices.length >= 3 && coefficientOfVariation(opts.prices) < 0.15) {
    return "flat";
  }

  // 5. Fallback — wide unstructured spread → quote_only (enquiry floor)
  return "quote_only";
}

// Spec §6.5 — booking-mode inference. enquiry is the floor.
function inferBookingMode(model: PricingModel, division: string | null): BookingMode {
  if (model === "quote_only")                 return "enquiry";
  if ((division ?? "") === "commercial")      return "enquiry";
  if (model === "flat")                       return "instant";
  if (model === "tiered" || model === "by_frequency") return "quick_quote";
  if (model === "by_unit")                    return "quick_quote";
  return "enquiry";
}

// Spec §6.6 — seed duration in minutes by service archetype + division.
// Editable in the UI; this is just the safe pre-fill so Skip leaves a
// working catalogue.
function seedDuration(canonical: string, division: string | null): number | null {
  const c = canonical.toLowerCase();
  if (/window/.test(c))               return 25;
  if (/gutter/.test(c))               return 50;
  if (/conservatory/.test(c))         return 40;
  if (/fascia|soffit/.test(c))        return 30;
  if (/end of tenancy/.test(c))       return 240;
  if (/deep clean/.test(c))           return 180;
  if (/regular.*clean|domestic/.test(c)) return 100;
  if (/oven/.test(c))                 return 120;
  if (/carpet/.test(c))               return 90;
  if (/office/.test(c))               return null;     // commercial — ask
  if (/pressure|jet wash/.test(c))    return 60;
  if (/softwash|soft wash/.test(c))   return 90;
  if (/driveway|patio/.test(c))       return 90;
  if (/roof/.test(c))                 return 120;
  if (division === "commercial")      return null;     // always ask for commercial
  return null;
}

// Split a list of prices into natural tiers. The goal is to find real
// pricing bands the owner uses (e.g. terraced £10-15, semi £18-25, detached
// £35-50) rather than blindly chopping into N percentiles.
//
// Algorithm:
//   1. If <4 prices OR max/min <= 1.5, no clustering — return one band.
//   2. Sort prices, walk pairs, mark a "gap" when prices[i+1] / prices[i] >= 1.4.
//   3. Group consecutive prices between gaps into clusters.
//   4. Merge clusters with <2 prices into the nearest neighbour so we never
//      produce a one-customer tier.
//   5. Cap at 4 tiers (merge smallest gaps if more).
//
// Returns [{ price_low, price_high, suggested_price (median), count }, ...]
type Cluster = { price_low: number; price_high: number; suggested_price: number; count: number; prices: number[] };

function clusterPrices(prices: number[]): Cluster[] {
  const valid = prices.filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (valid.length < 4) return [];
  if (valid[valid.length - 1] / valid[0] <= 1.5) return [];

  // Find gap indices.
  const gaps: number[] = [];
  for (let i = 0; i < valid.length - 1; i++) {
    if (valid[i + 1] / valid[i] >= 1.4 && valid[i + 1] - valid[i] >= 5) gaps.push(i + 1);
  }
  if (!gaps.length) {
    // No natural gaps — use thirds as a fallback so the owner still gets
    // tiers to confirm/rename rather than one £10-£240 row.
    const third = Math.floor(valid.length / 3);
    if (third < 2) return [];
    gaps.push(third, third * 2);
  }

  let segments: number[][] = [];
  let prev = 0;
  for (const g of gaps) {
    segments.push(valid.slice(prev, g));
    prev = g;
  }
  segments.push(valid.slice(prev));
  segments = segments.filter(s => s.length > 0);

  // Merge tiny segments into the nearest neighbour.
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].length < 2 && segments.length > 1) {
      const target = i === 0 ? 1 : i - 1;
      segments[target] = [...segments[target], ...segments[i]].sort((a, b) => a - b);
      segments.splice(i, 1);
    }
  }

  // Cap at 4 tiers — merge smallest gaps if more.
  while (segments.length > 4) {
    let smallestIdx = 0, smallestRatio = Infinity;
    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i][segments[i].length - 1];
      const b = segments[i + 1][0];
      const ratio = b / a;
      if (ratio < smallestRatio) { smallestRatio = ratio; smallestIdx = i; }
    }
    segments[smallestIdx] = [...segments[smallestIdx], ...segments[smallestIdx + 1]].sort((a, b) => a - b);
    segments.splice(smallestIdx + 1, 1);
  }

  if (segments.length < 2) return [];

  return segments.map(seg => {
    // For tiny clusters (≤4 prices) use the mean — a 2-price cluster like
    // [850, 1430] should suggest the centre (£1140), not the high value.
    // For larger clusters median is more robust to outliers.
    const suggested = seg.length <= 4
      ? Math.round(seg.reduce((a, b) => a + b, 0) / seg.length)
      : seg[Math.floor(seg.length / 2)];
    return {
      price_low:        seg[0],
      price_high:       seg[seg.length - 1],
      suggested_price:  suggested,
      count:            seg.length,
      prices:           seg,
    };
  });
}

// ── Template ladders (Phase D) ──────────────────────────────────────────────
// Canonical industry-standard tier ladders per (division, service_name).
// When a service matches a template, observed prices are *fitted* to the
// known ladder rather than clustered freely — so a window-clean round
// always produces 1-bed → 5-bed+ tiers regardless of which slots actually
// have customers. Empty slots get estimated prices via progression
// multipliers. This is what makes the catalogue+Front Desk consistent.
//
// Keep in sync with src/lib/catalogue/templates.js — same data shape.

const SERVICE_TEMPLATES: Record<string, Record<string, any>> = {
  residential: {
    'Window Cleaning': {
      tiers: [
        { key:'1bed', label:'1 bed',  hint:'Studio or 1-bedroom flat',  multiplier:0.70 },
        { key:'2bed', label:'2 bed',  hint:'Terraced 2-bed',            multiplier:0.85 },
        { key:'3bed', label:'3 bed',  hint:'Semi-detached 3-bed',       multiplier:1.00 },
        { key:'4bed', label:'4 bed',  hint:'Detached 4-bed',            multiplier:1.30 },
        { key:'5bed', label:'5 bed+', hint:'Large detached',            multiplier:1.65 },
      ], defaultTier:'3bed', baseTier:'3bed', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:25,
    },
    'Regular Domestic Clean': {
      tiers: [
        { key:'1bed', label:'1 bed',  multiplier:0.60 },
        { key:'2bed', label:'2 bed',  multiplier:0.80 },
        { key:'3bed', label:'3 bed',  multiplier:1.00 },
        { key:'4bed', label:'4 bed',  multiplier:1.30 },
        { key:'5bed', label:'5+ bed', multiplier:1.70 },
      ], defaultTier:'3bed', baseTier:'3bed', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:120,
    },
    'End of Tenancy Clean': {
      tiers: [
        { key:'1bed', label:'1 bed',  multiplier:0.65 },
        { key:'2bed', label:'2 bed',  multiplier:0.85 },
        { key:'3bed', label:'3 bed',  multiplier:1.00 },
        { key:'4bed', label:'4 bed',  multiplier:1.35 },
        { key:'5bed', label:'5+ bed', multiplier:1.80 },
      ], defaultTier:'3bed', baseTier:'3bed', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:240,
    },
    'Deep Clean': {
      tiers: [
        { key:'1bed', label:'1 bed',  multiplier:0.60 },
        { key:'2bed', label:'2 bed',  multiplier:0.80 },
        { key:'3bed', label:'3 bed',  multiplier:1.00 },
        { key:'4bed', label:'4 bed',  multiplier:1.30 },
        { key:'5bed', label:'5+ bed', multiplier:1.70 },
      ], defaultTier:'3bed', baseTier:'3bed', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:180,
    },
    'Oven Clean': {
      tiers: [
        { key:'standard', label:'Standard oven', multiplier:1.00 },
        { key:'range',    label:'Range cooker',  multiplier:1.50 },
        { key:'aga',      label:'Aga',           multiplier:2.00 },
      ], defaultTier:'standard', baseTier:'standard', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:120,
    },
    'Carpet Cleaning': {
      tiers: [
        { key:'1room',       label:'1 room',      multiplier:1.0 },
        { key:'2-3rooms',    label:'2-3 rooms',   multiplier:2.5 },
        { key:'whole-house', label:'Whole house', multiplier:5.0 },
      ], defaultTier:'2-3rooms', baseTier:'1room', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:90,
    },
    'Airbnb Turnover': {
      tiers: [
        { key:'studio', label:'Studio', multiplier:0.70 },
        { key:'1bed',   label:'1 bed',  multiplier:0.85 },
        { key:'2bed',   label:'2 bed',  multiplier:1.00 },
        { key:'3bed',   label:'3 bed',  multiplier:1.30 },
        { key:'4bed',   label:'4+ bed', multiplier:1.70 },
      ], defaultTier:'2bed', baseTier:'2bed', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:90,
    },
  },
  exterior: {
    'Window Cleaning': {
      tiers: [
        { key:'1bed', label:'1 bed',  hint:'Flat',           multiplier:0.70 },
        { key:'2bed', label:'2 bed',  hint:'Terraced',       multiplier:0.85 },
        { key:'3bed', label:'3 bed',  hint:'Semi-detached',  multiplier:1.00 },
        { key:'4bed', label:'4 bed',  hint:'Detached',       multiplier:1.30 },
        { key:'5bed', label:'5 bed+', hint:'Large detached', multiplier:1.65 },
      ], defaultTier:'3bed', baseTier:'3bed', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:25,
    },
    'Gutter Clear': {
      tiers: [
        { key:'bungalow', label:'Bungalow',         multiplier:0.75 },
        { key:'2storey',  label:'2 storey',         multiplier:1.00 },
        { key:'3storey',  label:'3 storey',         multiplier:1.45 },
        { key:'large',    label:'Larger property',  multiplier:1.80 },
      ], defaultTier:'2storey', baseTier:'2storey', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:50,
    },
    'Conservatory Clean': {
      tiers: [
        { key:'standard', label:'Standard 3x3m', multiplier:1.00 },
        { key:'large',    label:'Larger 4x5m+',  multiplier:1.60 },
      ], defaultTier:'standard', baseTier:'standard', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:40,
    },
    'Fascia & Soffit Clean': {
      tiers: [
        { key:'bungalow', label:'Bungalow', multiplier:0.70 },
        { key:'2storey',  label:'2 storey', multiplier:1.00 },
        { key:'3storey',  label:'3 storey', multiplier:1.40 },
      ], defaultTier:'2storey', baseTier:'2storey', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:30,
    },
    'Soft Wash': {
      tiers: [
        { key:'small',  label:'Small',  multiplier:1.00 },
        { key:'medium', label:'Medium', multiplier:1.60 },
        { key:'large',  label:'Large',  multiplier:2.40 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:90,
    },
    'Pressure Washing': {
      tiers: [
        { key:'patio',      label:'Patio (up to 20m²)', multiplier:1.00 },
        { key:'driveway',   label:'Driveway',           multiplier:1.50 },
        { key:'large-area', label:'Large area',         multiplier:2.50 },
      ], defaultTier:'driveway', baseTier:'patio', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:90,
    },
    'Driveway Clean': {
      tiers: [
        { key:'small',  label:'Small drive (1 car)', multiplier:1.00 },
        { key:'medium', label:'Medium (2-3 cars)',   multiplier:1.50 },
        { key:'large',  label:'Large (4+ cars)',     multiplier:2.20 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'quick_quote', pricing_model:'tiered', duration_mins:90,
    },
    'Roof Clean': {
      tiers: [
        { key:'bungalow', label:'Bungalow', multiplier:0.70 },
        { key:'2storey',  label:'2 storey', multiplier:1.00 },
        { key:'3storey',  label:'3 storey', multiplier:1.40 },
      ], defaultTier:'2storey', baseTier:'2storey', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:120,
    },
  },
  commercial: {
    'Window Cleaning': {
      tiers: [
        { key:'small',  label:'Small',   hint:'Single-storey shop or small office unit', multiplier:1.00 },
        { key:'medium', label:'Medium',  hint:'2-3 storey office, ground-level access',  multiplier:2.50 },
        { key:'large',  label:'Large',   hint:'Multi-floor block, needs reach pole / cherry picker', multiplier:6.00 },
        { key:'xlarge', label:'X-Large', hint:'High-rise / hotel — rope access or scaffolding',     multiplier:14.0 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:null,
    },
    'Office Clean': {
      tiers: [
        { key:'small',  label:'Small office',     multiplier:1.00 },
        { key:'medium', label:'Medium office',    multiplier:2.20 },
        { key:'large',  label:'Large office',    multiplier:5.00 },
        { key:'xlarge', label:'Multi-floor / HQ', multiplier:12.0 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:null,
    },
    'Retail Clean': {
      tiers: [
        { key:'small',  label:'Small shop',               multiplier:1.0 },
        { key:'medium', label:'Mid-size store',           multiplier:2.5 },
        { key:'large',  label:'Department / supermarket', multiplier:8.0 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:null,
    },
    'Pub / Restaurant Clean': {
      tiers: [
        { key:'small',  label:'Small pub / cafe',           multiplier:1.0 },
        { key:'medium', label:'Pub or mid-size restaurant', multiplier:2.0 },
        { key:'large',  label:'Large or multi-unit',        multiplier:4.5 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:null,
    },
    'Periodic Deep Clean': {
      tiers: [
        { key:'small',  label:'Small site',          multiplier:1.0 },
        { key:'medium', label:'Medium site',         multiplier:2.5 },
        { key:'large',  label:'Large or multi-site', multiplier:6.0 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:null,
    },
    'Contract Clean': {
      tiers: [
        { key:'small',  label:'Small contract',  multiplier:1.0 },
        { key:'medium', label:'Medium contract', multiplier:2.5 },
        { key:'large',  label:'Large contract',  multiplier:6.0 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:null,
    },
    'Commercial Gutters': {
      tiers: [
        { key:'small',  label:'Small site',  multiplier:1.0 },
        { key:'medium', label:'Medium site', multiplier:2.0 },
        { key:'large',  label:'Large site',  multiplier:4.0 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:null,
    },
    'Commercial Pressure Wash': {
      tiers: [
        { key:'small',  label:'Small forecourt',             multiplier:1.0 },
        { key:'medium', label:'Medium car park',             multiplier:2.5 },
        { key:'large',  label:'Large car park / industrial', multiplier:5.0 },
      ], defaultTier:'medium', baseTier:'small', booking_mode:'enquiry', pricing_model:'tiered', duration_mins:null,
    },
  },
};

const TEMPLATE_ALIASES: Record<string, string> = {
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

function findTemplate(division: string | null, name: string): { name: string; template: any } | null {
  const div = SERVICE_TEMPLATES[String(division ?? '').toLowerCase()];
  if (!div) return null;
  const want = String(name ?? '').toLowerCase().trim();
  if (!want) return null;
  for (const k of Object.keys(div)) {
    if (k.toLowerCase() === want) return { name: k, template: div[k] };
  }
  if (TEMPLATE_ALIASES[want] && div[TEMPLATE_ALIASES[want]]) {
    return { name: TEMPLATE_ALIASES[want], template: div[TEMPLATE_ALIASES[want]] };
  }
  for (const [alias, canonical] of Object.entries(TEMPLATE_ALIASES)) {
    if (want.includes(alias) && div[canonical]) {
      return { name: canonical, template: div[canonical] };
    }
  }
  for (const k of Object.keys(div)) {
    const kl = k.toLowerCase();
    const firstWord = kl.split(' ')[0];
    if (want.includes(firstWord) || kl.includes(want)) return { name: k, template: div[k] };
  }
  return null;
}

function medianOf(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

type FittedTier = {
  key: string; label: string; hint: string | null;
  multiplier: number; price: number | null;
  customer_count: number; is_estimated: boolean;
  observed_low: number | null; observed_high: number | null;
};

function fitObservedPricesToTemplate(template: any, observedPrices: number[]): {
  tiers: FittedTier[]; base_price_observed: number | null;
  gap_summary: { has_meaningful_gap: boolean; gap_description: string | null };
} {
  const tiers = template.tiers ?? [];
  const baseTier = tiers.find((t: any) => t.key === template.baseTier) ?? tiers[0];
  const baseMul  = baseTier?.multiplier ?? 1;
  const valid = (observedPrices ?? []).map(Number).filter((p: number) => Number.isFinite(p) && p > 0);

  const anchorPrice = valid.length ? medianOf(valid) : null;
  const buckets: number[][] = tiers.map(() => []);
  if (valid.length && anchorPrice != null) {
    const expected = tiers.map((t: any) => anchorPrice * (t.multiplier / baseMul));
    for (const p of valid) {
      let bestIdx = 0;
      let bestRatio = Infinity;
      for (let i = 0; i < expected.length; i++) {
        const r = expected[i] > 0 ? Math.abs(Math.log(p / expected[i])) : Infinity;
        if (r < bestRatio) { bestRatio = r; bestIdx = i; }
      }
      buckets[bestIdx].push(p);
    }
  }

  const baseIdx = Math.max(0, tiers.findIndex((t: any) => t.key === template.baseTier));
  let anchorIdx = -1;
  let anchorMul = baseMul;
  for (let d = 0; d < tiers.length; d++) {
    const lo = baseIdx - d, hi = baseIdx + d;
    if (lo >= 0 && buckets[lo].length) { anchorIdx = lo; anchorMul = tiers[lo].multiplier; break; }
    if (hi < tiers.length && hi !== lo && buckets[hi].length) { anchorIdx = hi; anchorMul = tiers[hi].multiplier; break; }
  }
  const observedBasePrice = anchorIdx >= 0 ? medianOf(buckets[anchorIdx]) : null;

  const fittedTiers: FittedTier[] = tiers.map((t: any, i: number) => {
    const bucket = buckets[i];
    if (bucket.length) {
      return {
        key: t.key, label: t.label, hint: t.hint ?? null,
        multiplier: t.multiplier,
        price: medianOf(bucket),
        customer_count: bucket.length,
        is_estimated: false,
        observed_low: Math.min(...bucket),
        observed_high: Math.max(...bucket),
      };
    }
    const estimated = observedBasePrice != null
      ? Math.round(observedBasePrice * (t.multiplier / anchorMul))
      : null;
    return {
      key: t.key, label: t.label, hint: t.hint ?? null,
      multiplier: t.multiplier, price: estimated,
      customer_count: 0, is_estimated: true,
      observed_low: null, observed_high: null,
    };
  });

  const n = fittedTiers.length;
  let lowEmpty = 0;
  for (let i = 0; i < n; i++) { if (fittedTiers[i].is_estimated) lowEmpty++; else break; }
  let highEmpty = 0;
  for (let i = n - 1; i >= 0; i--) { if (fittedTiers[i].is_estimated) highEmpty++; else break; }
  let longestRun = 0, run = 0;
  for (let i = lowEmpty; i < n - highEmpty; i++) {
    if (fittedTiers[i].is_estimated) { run++; longestRun = Math.max(longestRun, run); }
    else run = 0;
  }
  let hasGap = false;
  let gapDescription: string | null = null;
  if (highEmpty >= 1 && lowEmpty < n) {
    hasGap = true;
    const firstEmpty = fittedTiers[n - highEmpty];
    gapDescription = `No customers yet at ${firstEmpty.label.toLowerCase()} or up — set a price so quoting is ready when one calls.`;
  } else if (lowEmpty >= 1 && highEmpty < n) {
    hasGap = true;
    const lastEmpty = fittedTiers[lowEmpty - 1];
    gapDescription = `No customers yet at ${lastEmpty.label.toLowerCase()} or below — set a price so quoting is ready when one calls.`;
  } else if (longestRun >= 3) {
    hasGap = true;
    gapDescription = 'A few mid-range sizes have no customers yet — review the estimates.';
  }
  if (valid.length === 0) { hasGap = false; gapDescription = null; }

  return {
    tiers: fittedTiers,
    base_price_observed: observedBasePrice,
    gap_summary: { has_meaningful_gap: hasGap, gap_description: gapDescription },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
  const sessionId  = String(body?.session_id ?? "").trim();
  const regenerate = Boolean(body?.regenerate);
  if (!sessionId) return json({ error: "session_id required" }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Load the session — gives us business_id + cached draft.
  const { data: session, error: sErr } = await sb
    .from("onboarding_sessions")
    .select("id, business_id, menu_draft")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr || !session) return json({ error: "session not found" }, 404);

  // Return cache unless regenerate requested.
  if (session.menu_draft && !regenerate) {
    return json({ menu: session.menu_draft, cached: true });
  }

  // Pull all customers + their recurring_jobs from THIS session's commits.
  // We identify them by joining via customer_imports.session_id → customers.import_id.
  const { data: imports } = await sb
    .from("customer_imports")
    .select("id")
    .eq("session_id", sessionId);
  const importIds = (imports ?? []).map((i: any) => i.id);
  if (!importIds.length) return json({ menu: { sections: [] }, empty: true });

  const { data: customers } = await sb
    .from("customers")
    .select("id, category, service_types, price_per_visit")
    .in("import_id", importIds);

  const { data: jobs } = await sb
    .from("recurring_jobs")
    .select("customer_id, service, type, price")
    .in("customer_id", (customers ?? []).map((c: any) => c.id));

  // ── Aggregate by (division, normalised service) ─────────────────────────
  // We use both customers.service_types[] and recurring_jobs.service for the
  // service label, recurring_jobs.price for prices. Falls back to
  // customers.price_per_visit when there's no recurring job.
  const usage = new Map<string, ServiceUsage>();
  const upsert = (division: string | null, service: string, price: number | null) => {
    const label = normaliseLabel(service);
    if (!label) return;
    const key = `${division ?? "unknown"}::${label}`;
    if (!usage.has(key)) usage.set(key, { division, service: label, count: 0, prices: [] });
    const u = usage.get(key)!;
    u.count++;
    if (price != null && Number.isFinite(price) && price > 0) u.prices.push(Number(price));
  };

  for (const j of jobs ?? []) {
    const c = (customers ?? []).find((cc: any) => cc.id === j.customer_id);
    upsert(c?.category ?? null, j.service, j.price);
  }
  // Customers with NO recurring_job (Decision-bucket) — count their service_types too.
  const customersWithJob = new Set((jobs ?? []).map((j: any) => j.customer_id));
  for (const c of customers ?? []) {
    if (customersWithJob.has(c.id)) continue;
    const svs: string[] = Array.isArray(c.service_types) ? c.service_types : [];
    svs.forEach(s => upsert(c.category ?? null, s, c.price_per_visit));
  }

  if (!usage.size) return json({ menu: { sections: [] }, empty: true });

  // ── Build the Sonnet input ──────────────────────────────────────────────
  const byDivision: Record<string, ServiceUsage[]> = {};
  for (const u of usage.values()) {
    const div = u.division ?? "unknown";
    if (!byDivision[div]) byDivision[div] = [];
    byDivision[div].push(u);
  }

  // Spec §6.3-6.6: all decisions are made HERE, deterministically. AI gets
  // pre-computed pricing_model + booking_mode + tier shape and is told to
  // echo them back unchanged — it only drafts the copy on top.
  const summary = Object.entries(byDivision).map(([div, list]) => ({
    division: div,
    services: list.map(s => {
      const divKey  = div === "unknown" ? null : div;

      // Phase D — template-locked path. When the service matches a known
      // ladder, fit observed prices to the canonical tiers instead of
      // clustering freely. Empty slots get estimated prices via the
      // template's progression multipliers.
      const match = findTemplate(divKey, s.service);
      if (match) {
        const fit = fitObservedPricesToTemplate(match.template, s.prices);
        // Build pre-locked tier entries Sonnet must echo (one per tier).
        const tier_entries = fit.tiers.map((t, idx) => ({
          tier_key:        t.key,
          tier_label:      t.label,
          tier_hint:       t.hint,
          suggested_price: t.price,
          customer_count:  t.customer_count,
          is_estimated:    t.is_estimated,
          is_default:      t.key === match.template.defaultTier,
          sort_order:      idx,
        }));
        return {
          raw_label:        s.service,
          template_locked:  true,
          canonical_name:   match.name,
          customer_count:   s.count,
          prices:           s.prices.slice(0, 30),
          tier_entries,
          pricing_model:    match.template.pricing_model,
          booking_mode:     match.template.booking_mode,
          duration_mins:    match.template.duration_mins,
          gap_summary:      fit.gap_summary,
          base_price_observed: fit.base_price_observed,
        };
      }

      // Non-template fallback — existing clustering path.
      const tiers   = clusterTiersConstrained(s.prices);
      const model   = inferPricingModel({ label: s.service, prices: s.prices, tiers });
      const mode    = inferBookingMode(model, divKey);
      return {
        raw_label:      s.service,
        customer_count: s.count,
        prices:         s.prices.slice(0, 30),
        tiers:          tiers.length ? tiers : null,
        pricing_model:  model,                          // LOCKED — Sonnet must echo
        booking_mode:   mode,                           // LOCKED — Sonnet must echo
      };
    }),
  }));

  let menu: any;
  try {
    const out = await callSonnet(JSON.stringify(summary, null, 2));
    menu = parseJsonObject(out);
    if (!menu?.sections) throw new Error("no sections in response");
  } catch (e) {
    return json({ error: `menu generation failed: ${(e as Error).message}` }, 500);
  }

  // ── Enrich each generated service with the source prices that drove it ──
  // This gives the UI a "show source prices" affordance so the owner can see
  // exactly where a suggested price came from (and spot quarterly/annual
  // totals masquerading as per-visit prices).
  //
  // We match Sonnet's output back to our clusters by:
  //   1. Find the input service for the same division whose price ranges
  //      best overlap with the output service's price_low/price_high
  //   2. Attach that cluster's prices[] as source_prices
  //
  // Also: when a tier's price > 5x the median of OTHER tiers in the same
  // division, flag as suspected cumulative total — owner edits to per-visit.
  for (const section of menu.sections ?? []) {
    const div = String(section.division ?? "").toLowerCase();
    const inputSection = summary.find(s => s.division === div);
    if (!inputSection) continue;

    // Spec §6.3-6.6 — enforce the deterministic decisions. If Sonnet
    // mangled or omitted pricing_model / booking_mode / from_price /
    // is_outlier, we restore them from the input. The model only drafts
    // copy; it never gets to override pricing or booking semantics.
    for (const svc of section.services ?? []) {
      const inputSvc = inputSection.services.find(s => {
        // Match by canonical-name root (everything before the em-dash)
        const root = String(svc.name ?? "").split(/[—\-]/)[0].trim().toLowerCase();
        return s.raw_label === root || normaliseLabel(s.raw_label).startsWith(root.split(" ")[0]);
      }) ?? inputSection.services[0];
      if (inputSvc) {
        svc.pricing_model = inputSvc.pricing_model;
        svc.booking_mode  = inputSvc.booking_mode;
      }
      // Match this service entry back to a specific tier (if any) by the
      // closest suggested_price — that's the tier whose from_price /
      // is_outlier flags we should echo.
      if (inputSvc?.tiers?.length) {
        const target = Number(svc.suggested_price);
        if (Number.isFinite(target)) {
          let best = inputSvc.tiers[0];
          let bestDelta = Math.abs(best.suggested_price - target);
          for (const t of inputSvc.tiers) {
            const d = Math.abs(t.suggested_price - target);
            if (d < bestDelta) { bestDelta = d; best = t; }
          }
          svc.from_price = Boolean(best.is_from_tier);
          svc.is_outlier = Boolean(best.is_outlier);
        }
      } else {
        svc.from_price = false;
        svc.is_outlier = false;
      }
      // Editable seed: scheduler slot sizing (spec §6.6).
      const dKey = div === "unknown" ? null : div;
      svc.default_duration_mins = seedDuration(String(svc.name ?? ""), dKey);
      // Evidence object — surfaces this on the card so the owner sees the
      // sample size driving the suggestion.
      svc.evidence = {
        customer_count: Number(svc.customer_count) || 0,
        observed_low:   Number(svc.price_low)  || null,
        observed_high:  Number(svc.price_high) || null,
      };
    }

    // Pre-compute the median tier price within this section for the
    // "cumulative total" sanity check.
    const tierMedians = (section.services ?? [])
      .map((s: any) => Number(s.suggested_price))
      .filter((n: number) => Number.isFinite(n) && n > 0)
      .sort((a: number, b: number) => a - b);
    const sectionMedian = tierMedians.length
      ? tierMedians[Math.floor(tierMedians.length / 2)]
      : null;

    for (const svc of section.services ?? []) {
      // Find the best-matching cluster across all input services in this
      // division by midpoint distance.
      const targetMid = (Number(svc.price_low) + Number(svc.price_high)) / 2;
      let bestPrices: number[] | null = null;
      let bestDelta  = Infinity;
      for (const inputSvc of inputSection.services) {
        const candidates = inputSvc.clusters
          ? inputSvc.clusters
          : (inputSvc.prices?.length ? [{ price_low: Math.min(...inputSvc.prices), price_high: Math.max(...inputSvc.prices), prices: inputSvc.prices }] : []);
        for (const c of candidates) {
          const mid = (Number(c.price_low) + Number(c.price_high)) / 2;
          const delta = Math.abs(mid - targetMid);
          if (delta < bestDelta) { bestDelta = delta; bestPrices = c.prices ?? null; }
        }
      }
      if (bestPrices?.length) svc.source_prices = bestPrices;

      // Cumulative-total hint: very small cluster with prices wildly above
      // the rest of the section. Owner probably has quarterly or annual
      // totals from their old software.
      if (
        sectionMedian &&
        Number(svc.suggested_price) > sectionMedian * 5 &&
        Number(svc.customer_count) <= 4
      ) {
        svc.cumulative_hint = "These look like quarterly or annual totals from your old software, not per-visit prices. Edit to the per-visit price you'd put on a menu.";
      }
    }
  }

  // ── Template-lock enforcement ───────────────────────────────────────────
  // For every input service that was template-locked, REPLACE the matching
  // services in the Sonnet output with our authoritative tier entries.
  // Sonnet may have re-ordered, mis-priced, or skipped tiers — we don't
  // trust it on shape. We keep its description text via best-match (by
  // canonical name root) and discard everything else.
  for (const section of menu.sections ?? []) {
    const div = String(section.division ?? "").toLowerCase();
    const inputSection = summary.find(s => s.division === div);
    if (!inputSection) continue;

    const lockedInputs = inputSection.services.filter((s: any) => s.template_locked);
    if (!lockedInputs.length) continue;

    // For each locked input service, collect any descriptions Sonnet wrote
    // for it (matched by canonical-name root).
    for (const locked of lockedInputs) {
      const canonical: string = locked.canonical_name;
      const canonicalLower = canonical.toLowerCase();

      // Pull any Sonnet entries that look like they belong to this service
      // (by name root match), grab descriptions, then remove them.
      const descByTierLabel = new Map<string, string>();
      let fallbackDescription: string | null = null;
      section.services = (section.services ?? []).filter((svc: any) => {
        const root = String(svc?.tier_of ?? svc?.name ?? '').split(/[—\-]/)[0].trim().toLowerCase();
        const looksLikeThis = root === canonicalLower
          || canonicalLower.startsWith(root.split(' ')[0])
          || root.startsWith(canonicalLower.split(' ')[0]);
        if (!looksLikeThis) return true;
        const desc = String(svc?.description ?? '').trim();
        if (desc) {
          if (!fallbackDescription) fallbackDescription = desc;
          const tierLabel = String(svc?.name ?? '').split(/[—\-]/).slice(1).join('-').trim().toLowerCase();
          if (tierLabel) descByTierLabel.set(tierLabel, desc);
        }
        return false;     // drop — we'll re-emit authoritative entries below
      });

      // Re-emit one entry per template tier — locked shape, Sonnet desc.
      for (const t of locked.tier_entries) {
        const desc = descByTierLabel.get(String(t.tier_label).toLowerCase())
                   ?? fallbackDescription
                   ?? null;
        section.services.push({
          name:            `${canonical} — ${t.tier_label}`,
          tier_of:         canonical,
          description:     desc,
          price_low:       t.suggested_price,
          price_high:      t.suggested_price,
          suggested_price: t.suggested_price,
          price_unit:      'per_visit',
          customer_count:  t.customer_count,
          price_spread_flag: false,
          pricing_model:   locked.pricing_model,
          booking_mode:    locked.booking_mode,
          from_price:      false,
          is_outlier:      false,
          is_estimated:    Boolean(t.is_estimated),
          is_default:      Boolean(t.is_default),
          tier_key:        t.tier_key,
          tier_hint:       t.tier_hint,
          default_duration_mins: locked.duration_mins,
          evidence: {
            customer_count: Number(t.customer_count) || 0,
            observed_low:   null,
            observed_high:  null,
          },
        });
      }

      // Attach the gap insight to the section (UI reads section.gap_insights).
      if (locked.gap_summary?.has_meaningful_gap && locked.gap_summary?.gap_description) {
        section.gap_insights = section.gap_insights ?? [];
        section.gap_insights.push({
          service: canonical,
          message: locked.gap_summary.gap_description,
        });
      }
    }
  }

  // Cache the draft.
  await sb
    .from("onboarding_sessions")
    .update({ menu_draft: menu, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return json({ menu, cached: false });
});
