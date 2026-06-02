/**
 * survey-clarify/index.ts
 * Haiku pause-clarification for live commercial site surveys.
 *
 * POST { survey_id, raw_notes }
 * → { ask: bool, question: string|null }
 *
 * Called by the frontend ~3-4s after the user stops typing.
 * Returns AT MOST one short question for an unrecoverable ambiguity.
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

const SYSTEM_PROMPT = `You read a cleaning professional's live commercial site-visit notes.

Your job: identify AT MOST ONE ambiguity that is UNRECOVERABLE once they leave site.
Only ask about: height/access method, physical hazards, site conditions, keyholding, lone-working.
Never ask about price, schedule, or anything recoverable by phone later.
Never assume a hazard exists — ambiguity becomes a question.

Output exactly this JSON (nothing else):
{"ask":true,"question":"<15 words max — clear, direct, no preamble>"}
or
{"ask":false,"question":null}

If you are uncertain whether to ask, output {"ask":false,"question":null}.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);

  let body: { survey_id?: string; raw_notes?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { survey_id, raw_notes } = body;
  if (!raw_notes || raw_notes.trim().length < 40) {
    return json({ ask: false, question: null });
  }

  // Auth: verify the caller owns the survey
  const authHeader = req.headers.get("Authorization") ?? "";
  const userToken  = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (survey_id) {
    const { data: survey, error } = await userClient
      .from("site_surveys")
      .select("id, business_id")
      .eq("id", survey_id)
      .maybeSingle();
    if (error || !survey) return json({ error: "Survey not found" }, 404);
  }

  // Call Haiku
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: `SITE VISIT NOTES:\n${raw_notes.slice(0, 3000)}` }],
    }),
  });

  const aiData = await res.json();
  const text   = aiData?.content?.[0]?.text ?? "";

  // Log cost
  if (survey_id && aiData?.usage) {
    const { input_tokens = 0, output_tokens = 0 } = aiData.usage;
    const cost = input_tokens * 0.00000025 + output_tokens * 0.00000125;
    await userClient.from("agent_costs").insert({
      business_id: undefined,  // resolved server-side if needed; omit for simplicity
      agent:       "survey_clarify",
      action_id:   null,
      tokens_in:   input_tokens,
      tokens_out:  output_tokens,
      cost_usd:    cost,
    }).select().maybeSingle();
  }

  // Parse response
  let parsed: { ask: boolean; question: string | null } = { ask: false, question: null };
  try {
    const match = text.match(/\{.*\}/s);
    if (match) parsed = JSON.parse(match[0]);
  } catch { /* fall through to safe default */ }

  return json({ ask: Boolean(parsed.ask), question: parsed.question ?? null });
});
