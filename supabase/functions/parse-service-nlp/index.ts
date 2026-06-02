/**
 * supabase/functions/parse-service-nlp/index.ts
 * Cadi — parse plain-English service answers into structured data.
 *
 * POST { step, input }
 *   step:  'pricing' | 'duration' | 'inclusions' | 'frequency' | 'notes_category'
 *   input: the user's raw text
 *
 * Returns the same JSON shape as the client-side regex parsers in ServiceChat.jsx,
 * so the front-end can use this as a drop-in with regex fallback.
 *
 * Requires: Authorization: Bearer <user access token>
 * Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// ── Prompts per step ──────────────────────────────────────────────────────────

const SYSTEM = "You are a data extraction assistant for a UK cleaning business app. Extract structured data from the owner's plain-English answer. Respond ONLY with valid JSON, no explanation.";

function prompt(step: string, input: string): string {
  switch (step) {
    case "pricing":
      return `A UK cleaning business owner was asked "How do you price this service?" and replied:
"${input}"

Extract their pricing. Return JSON:
{
  "pricing_type": "hourly" | "fixed" | "per_sqm" | "per_size" | "custom",
  "confidence": <0.0–1.0, how certain you are>,
  "extracted_values": {
    // hourly:   { "price_hourly_rate": number, "price_hourly_minimum_hours": number|null }
    // fixed:    { "price_fixed_basic": number }
    // per_sqm:  { "price_per_sqm": number, "price_per_sqm_minimum": number|null }
    // per_size: { "pricing_matrix": [{ "size_label": "1 bed"|"2 bed"|"3 bed"|"4 bed"|"5 bed+"|"Studio"|"Small"|"Medium"|"Large", "price": number }] }
    // custom:   {}
  },
  "follow_up_question": null | "<ask this if confidence < 0.7>"
}`;

    case "duration":
      return `A UK cleaning business owner was asked "How long does this take?" and replied:
"${input}"

Extract the duration. Return JSON:
{
  "varies": <true if they said it depends/varies>,
  "duration_value": <number or null>,
  "duration_unit": "minutes" | "hours" | "days",
  "is_range": <true if they gave a range>,
  "range_max": <upper bound if range, else null>
}`;

    case "inclusions":
      return `A UK cleaning business owner described what is and isn't included in their service:
"${input}"

Extract the included and excluded items as short phrases. Return JSON:
{
  "included": ["phrase1", "phrase2"],
  "excluded": ["phrase1", "phrase2"]
}`;

    case "frequency":
      return `A UK cleaning business owner was asked how often customers want this service and replied:
"${input}"

Return JSON with true/false for each frequency:
{
  "frequency_one_off": boolean,
  "frequency_weekly": boolean,
  "frequency_fortnightly": boolean,
  "frequency_monthly": boolean,
  "frequency_quarterly": boolean,
  "frequency_annually": boolean
}`;

    case "notes_category":
      return `Categorise this note from a UK cleaning business owner:
"${input}"

Return JSON:
{
  "category": "pricing_notes" | "service_area_custom" | "materials_equipment_notes" | "private_notes"
}
pricing_notes = pricing adjustments, discounts, surcharges
service_area_custom = areas covered, postcodes, travel
materials_equipment_notes = what they bring, supplies, chemicals
private_notes = anything else`;

    default:
      throw new Error(`Unknown step: ${step}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  // Parse body
  let body: { step?: string; input?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { step, input } = body;
  if (!step || !input) return json({ error: "Missing step or input" }, 400);

  const validSteps = ["pricing", "duration", "inclusions", "frequency", "notes_category"];
  if (!validSteps.includes(step)) return json({ error: "Invalid step" }, 400);

  // Call Haiku
  let haiku: Response;
  try {
    haiku = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system:     SYSTEM,
        messages:   [{ role: "user", content: prompt(step, input.trim()) }],
      }),
    });
  } catch (e) {
    console.error("Anthropic fetch error:", e);
    return json({ error: "NLP unavailable" }, 503);
  }

  if (!haiku.ok) {
    const err = await haiku.json().catch(() => ({}));
    console.error("Anthropic API error:", err);
    return json({ error: "NLP error" }, 502);
  }

  const haikuData = await haiku.json();
  const text = haikuData?.content?.[0]?.text ?? "{}";

  // Extract JSON from response (sometimes Haiku wraps it in markdown)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return json({ error: "No JSON in response" }, 502);

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return json(parsed);
  } catch {
    console.error("Failed to parse Haiku response:", text);
    return json({ error: "Parse error" }, 502);
  }
});
