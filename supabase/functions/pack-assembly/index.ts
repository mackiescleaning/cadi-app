/**
 * pack-assembly/index.ts
 * Sonnet — generates RAMS + welcome letter content for the onboarding pack.
 *
 * POST { pack_id }  (auth required)
 * → { components: PackComponent[] }
 *
 * Assembles pack_components rows:
 *   - credential slots from business settings + accreditations defaults
 *   - rams / method_statement generated from survey_structured hazards + height
 *   - welcome letter generated from quote cleaning_plan
 *   - crew cert validation → agent_actions if issues found
 *
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

async function callSonnet(system: string, user: string, maxTokens = 1500): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages:   [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  return { text: data?.content?.[0]?.text ?? "", usage: data?.usage ?? { input_tokens: 0, output_tokens: 0 } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);

  let body: { pack_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { pack_id } = body;
  if (!pack_id) return json({ error: "pack_id required" }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Load pack + related data
  const { data: pack, error: packErr } = await sb
    .from("onboarding_packs")
    .select("*, customers(name, address_line_1, town), site_surveys(raw_notes), quotes(cleaning_plan, price, hrs, payload)")
    .eq("id", pack_id)
    .maybeSingle();

  if (packErr || !pack) return json({ error: "Pack not found" }, 404);

  // Load survey_structured
  const { data: structured } = await sb
    .from("survey_structured")
    .select("*")
    .eq("survey_id", pack.survey_id)
    .maybeSingle();

  // Load business defaults + settings
  const { data: bizRow } = await sb.from("businesses").select("owner_user_id").eq("id", pack.business_id).maybeSingle();

  const [{ data: bizSettings }, { data: profile }] = await Promise.all([
    sb.from("business_settings").select("setup_data").eq("owner_id", bizRow?.owner_user_id ?? "").maybeSingle(),
    sb.from("profiles")
      .select("business_name")
      .eq("id",
        (await sb.from("businesses").select("owner_user_id").eq("id", pack.business_id).maybeSingle())?.data?.owner_user_id ?? ""
      )
      .maybeSingle(),
  ]);

  const defaults = (bizSettings?.setup_data as Record<string, unknown>)?.commercial_survey_defaults as Record<string, unknown> ?? {};
  const accreditations = (defaults.accreditations as string[]) ?? [];
  const businessName = (profile as Record<string, unknown>)?.business_name as string ?? "Cleaning Services";

  const customerName = (pack.customers as Record<string, unknown>)?.name as string ?? "Client";
  const cleaningPlan = (pack.quotes as Record<string, unknown>)?.cleaning_plan as Record<string, unknown> ?? {};

  const components: Array<Record<string, unknown>> = [];
  let totalTokensIn = 0, totalTokensOut = 0;

  // ── Credentials from settings + accreditations ───────────────────────────────
  const credentialSlots: Array<{ title: string; source: string }> = [
    { title: "Public Liability Insurance Certificate", source: "settings" },
    { title: "Employers' Liability Insurance Certificate", source: "settings" },
    { title: "Health & Safety Policy", source: "settings" },
  ];

  const accreditationTitles: Record<string, string> = {
    chas:              "CHAS Certificate",
    safecontractor:    "SafeContractor Certificate",
    constructionline:  "Constructionline Certificate",
    smas:              "SMAS Worksafe Certificate",
  };

  for (const acc of accreditations) {
    const title = accreditationTitles[acc.toLowerCase()];
    if (title) credentialSlots.push({ title, source: "settings" });
  }

  components.push(...credentialSlots.map((c, i) => ({
    business_id:   pack.business_id,
    pack_id,
    kind:          "credential",
    source:        c.source,
    title:         c.title,
    content:       { status: "awaiting_upload" },
    sort:          i,
  })));

  // ── RAMS / Method Statement (Sonnet) ─────────────────────────────────────────
  const hazards    = structured?.hazards   ?? {};
  const height     = structured?.height    ?? {};
  const siteVars   = structured?.site_variables ?? {};
  const services   = structured?.services  ?? [];

  const ramsSystem = `You are Cadi, helping a cleaning company write a RAMS (Risk Assessment & Method Statement).

Rules:
- Base EVERYTHING on the survey data provided. Never invent hazards not in the data.
- For working at height, apply the Reg 6 hierarchy explicitly: avoid → collective → personal → ladders.
- Use plain English, professional tone. No fluff or padding.
- COSHH entries: only list products explicitly mentioned in notes; do not invent SDS data.
- Structure with clear headings. Aim for 400–600 words.`;

  const ramsUser = `Business: ${businessName}
Customer / Site: ${customerName}

Services: ${JSON.stringify(services)}
Site variables: ${JSON.stringify(siteVars)}
Hazards: ${JSON.stringify(hazards)}
Height assessment: ${JSON.stringify(height)}
Cleaning plan: ${JSON.stringify(cleaningPlan)}

Write the RAMS document.`;

  const ramsRes = await callSonnet(ramsSystem, ramsUser, 1200);
  totalTokensIn  += ramsRes.usage.input_tokens;
  totalTokensOut += ramsRes.usage.output_tokens;

  components.push({
    business_id: pack.business_id,
    pack_id,
    kind:    "rams",
    source:  "generated",
    title:   "Risk Assessment & Method Statement",
    content: { text: ramsRes.text },
    sort:    100,
  });

  // ── Welcome Letter (Sonnet) ──────────────────────────────────────────────────
  const welcomeSystem = `You are Cadi, writing a client welcome letter for a cleaning company.

Rules:
- Warm, professional tone. One page maximum.
- Confirm: services, frequency, named contact, how to flag issues.
- Never include pricing (that is in the quote).
- End with a clear call to action (who to call if anything needs changing before start date).`;

  const welcomeUser = `Business: ${businessName}
Customer: ${customerName}
Cleaning plan: ${JSON.stringify(cleaningPlan)}
Site contact: ${(siteVars as Record<string, unknown>)?.signoff_contact ?? "to be confirmed"}

Write the welcome letter.`;

  const welcomeRes = await callSonnet(welcomeSystem, welcomeUser, 600);
  totalTokensIn  += welcomeRes.usage.input_tokens;
  totalTokensOut += welcomeRes.usage.output_tokens;

  components.push({
    business_id: pack.business_id,
    pack_id,
    kind:    "welcome",
    source:  "generated",
    title:   "Client Welcome Letter",
    content: { text: welcomeRes.text },
    sort:    200,
  });

  // ── Insert components ────────────────────────────────────────────────────────
  // Clear any previous generated components so re-assembly is safe
  await sb.from("pack_components")
    .delete()
    .eq("pack_id", pack_id)
    .in("source", ["generated"]);

  const { data: saved, error: insertErr } = await sb
    .from("pack_components")
    .insert(components)
    .select();

  if (insertErr) return json({ error: insertErr.message }, 500);

  // ── Crew cert validation ─────────────────────────────────────────────────────
  const assignedCrew: string[] = (cleaningPlan?.assigned_crew as string[]) ?? [];
  const firstVisit: string | null = (cleaningPlan?.schedule as Record<string, unknown>)?.first_visit as string ?? null;

  if (assignedCrew.length > 0 && firstVisit) {
    const { data: trainingRows } = await sb
      .from("staff_training")
      .select("staff_id, cert_type, cert_label, expiry_date")
      .in("staff_id", assignedCrew)
      .not("expiry_date", "is", null);

    const firstVisitDate = new Date(firstVisit);
    const warnDate = new Date(firstVisit);
    warnDate.setDate(warnDate.getDate() + 30);

    const issues = (trainingRows ?? []).filter(t => {
      const exp = new Date(t.expiry_date as string);
      return exp <= warnDate;
    });

    for (const issue of issues) {
      const expired = new Date(issue.expiry_date as string) <= firstVisitDate;
      await sb.from("agent_actions").insert({
        business_id:      pack.business_id,
        agent:            "operations_manager",
        action_type:      "cert_expiry_warning",
        status:           "pending_approval",
        proposed_payload: { staff_id: issue.staff_id, cert_type: issue.cert_type, cert_label: issue.cert_label, expiry_date: issue.expiry_date, first_visit: firstVisit },
        reasoning:        `${issue.cert_label} ${expired ? "expired" : "expires within 30 days of first visit"} (${issue.expiry_date}). Crew member must not attend without a valid certificate.`,
      });
    }
  }

  // ── Log cost ─────────────────────────────────────────────────────────────────
  const cost = totalTokensIn * 0.000003 + totalTokensOut * 0.000015;
  await sb.from("agent_costs").insert({
    business_id: pack.business_id,
    agent:       "pack_assembly",
    tokens_in:   totalTokensIn,
    tokens_out:  totalTokensOut,
    cost_usd:    cost,
  });

  // Advance pack status
  await sb.from("onboarding_packs").update({ status: "awaiting_signoff" }).eq("id", pack_id).eq("status", "assembling");

  return json({ components: saved });
});
