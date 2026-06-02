/**
 * survey-structure/index.ts
 * Sonnet — Phase 2 structuring: reads raw survey notes + media → proposes survey_structured.
 *
 * POST { survey_id }   (auth required — reads survey and media, writes proposal)
 * → { structured: SurveyStructured }
 *
 * Reads commercial_survey_defaults from business_settings to pre-fill Reg 6 height answers.
 * Logs token usage to agent_costs.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);

  let body: { survey_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { survey_id } = body;
  if (!survey_id) return json({ error: "survey_id required" }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Load survey + media
  const [surveyRes, mediaRes] = await Promise.all([
    sb.from("site_surveys").select("*, customers(name, address_line_1, town)").eq("id", survey_id).maybeSingle(),
    sb.from("survey_media").select("kind, transcript, caption").eq("survey_id", survey_id),
  ]);

  const survey = surveyRes.data;
  if (!survey) return json({ error: "Survey not found" }, 404);

  // Load business defaults via owner_user_id (business_settings is owner_id-scoped)
  const { data: biz } = await sb
    .from("businesses")
    .select("owner_user_id")
    .eq("id", survey.business_id)
    .maybeSingle();

  const { data: bizSettings } = await sb
    .from("business_settings")
    .select("setup_data")
    .eq("owner_id", biz?.owner_user_id ?? "")
    .maybeSingle();

  const defaults = (bizSettings?.setup_data as Record<string, unknown>)?.commercial_survey_defaults as Record<string, unknown> ?? {};

  // Build media context
  const mediaLines: string[] = (mediaRes.data ?? []).map((m) => {
    if (m.kind === "voice" && m.transcript) return `[Voice transcript]: ${m.transcript}`;
    if (m.kind === "photo" && m.caption)    return `[Photo caption]: ${m.caption}`;
    return "";
  }).filter(Boolean);

  const defaultsContext = Object.keys(defaults).length
    ? `\n\nBUSINESS DEFAULTS (pre-fill where consistent):\n${JSON.stringify(defaults, null, 2)}`
    : "";

  const SYSTEM_PROMPT = `You are Cadi, reading a cleaning company's commercial site-visit notes.

Your job: PROPOSE structured fields from the notes. You PROPOSE — the human confirms.
Rules:
- Never invent a hazard. If a hazard is possible but not confirmed, list it in open_questions.
- Never invent a COSHH entry (chemicals only from notes, SDS required for any product data).
- Never invent a price or cost figure.
- Ambiguity → open_questions, never an assumption.
- For Reg 6 height: record WHICH safer tier was considered and WHY it was rejected, per the notes.
- Property size band: "small" <500m², "medium" 500-2000m², "large" >2000m² (estimate from context).

Output ONLY valid JSON matching this exact shape (no commentary, no markdown fences):
{
  "services": [{"service_id":null,"name":"string","frequency":"string","notes":"string"}],
  "site_variables": {
    "access": "string|null",
    "keyholding": "string|null",
    "hours_in": "string|null",
    "hours_out": "string|null",
    "lone_working_flag": false,
    "welfare": "string|null",
    "parking": "string|null",
    "induction_required": false,
    "induction_notes": "string|null",
    "signoff_contact": "string|null"
  },
  "hazards": {
    "fragile_surfaces": "string|null",
    "anchor_points": "string|null",
    "exclusion_zone": "string|null",
    "runoff_drainage": "string|null",
    "chemical_restrictions": "string|null",
    "other": []
  },
  "height": {
    "involves_height": false,
    "avoid_ground_level_first": "string|null",
    "collective_before_personal": "string|null",
    "ladders_justification": "string|null",
    "proposed_method": "string|null"
  },
  "open_questions": ["string"],
  "property_size_band": "small|medium|large|null",
  "involves_height": false,
  "service_tags": ["string"]
}`;

  const userMessage = `SITE VISIT NOTES:\n${survey.raw_notes || "(no notes yet)"}${
    mediaLines.length ? `\n\nMEDIA:\n${mediaLines.join("\n")}` : ""
  }${defaultsContext}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-6",
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userMessage }],
    }),
  });

  const aiData = await res.json();
  const text   = (aiData?.content?.[0]?.text ?? "").trim();

  // Log cost
  if (aiData?.usage) {
    const { input_tokens = 0, output_tokens = 0 } = aiData.usage;
    const cost = input_tokens * 0.000003 + output_tokens * 0.000015;
    await sb.from("agent_costs").insert({
      business_id: survey.business_id,
      agent:       "survey_structure",
      tokens_in:   input_tokens,
      tokens_out:  output_tokens,
      cost_usd:    cost,
    });
  }

  let proposed: Record<string, unknown>;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    proposed = match ? JSON.parse(match[0]) : {};
  } catch {
    return json({ error: "AI returned unparseable JSON", raw: text.slice(0, 500) }, 500);
  }

  // Upsert survey_structured
  const { data: saved, error: saveErr } = await sb
    .from("survey_structured")
    .upsert({
      business_id:         survey.business_id,
      survey_id:           survey_id,
      services:            proposed.services ?? [],
      site_variables:      proposed.site_variables ?? {},
      hazards:             proposed.hazards ?? {},
      height:              proposed.height ?? {},
      open_questions:      proposed.open_questions ?? [],
      confirmed:           false,
      property_size_band:  proposed.property_size_band ?? null,
      involves_height:     Boolean(proposed.involves_height),
      service_tags:        (proposed.service_tags as string[]) ?? [],
    }, { onConflict: "survey_id" })
    .select()
    .maybeSingle();

  if (saveErr) return json({ error: saveErr.message }, 500);

  // Advance survey status to 'structured'
  await sb.from("site_surveys").update({ status: "structured" }).eq("id", survey_id).eq("status", "capturing");

  return json({ structured: saved });
});
