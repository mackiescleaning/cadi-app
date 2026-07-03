/**
 * supabase/functions/front-desk-chat/index.ts
 * Cadi Front Desk — web chat AI handler.
 *
 * GET  ?business_id=xxx         → returns public business info (name, greeting, colour)
 * POST { business_id, conversation_id?, message, visitor_info? }
 *      → processes message, returns AI reply + optional quote/suggestions
 *
 * No auth required — this is called by the embeddable widget from any website.
 * Uses service role key internally for DB writes (bypasses RLS).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tierForBusiness, LITE_LIMITS } from "../_shared/entitlements.ts";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

// Render one service for the system prompt. If the owner has supplied
// cadi_context in the catalogue editor, include it indented under the
// name so the LLM has the owner's own framing when quoting.
function formatServiceLine(s: ServiceRecord): string {
  const ctx = (s.inference_meta?.cadi_context ?? '').trim();
  return ctx
    ? `- ${s.name}\n    Owner's notes: ${ctx.replace(/\n+/g, ' ')}`
    : `- ${s.name}`;
}

// ─── Build system prompt from business context ────────────────────────────────

function buildSystemPrompt(ctx: BusinessContext): string {
  const { businessName, serviceArea, services, brandVoice, widgetConfig, agentMode, selectedMode } = ctx;

  if (agentMode === "off") {
    return `You are a chat assistant. The business has disabled automated chat. Politely tell the visitor that online chat isn't currently available and invite them to call or email. Keep it brief.`;
  }

  const tonePreset = widgetConfig?.tone_preset ?? brandVoice?.tone ?? "warm";
  const toneMap: Record<string, string> = {
    warm:         "warm and conversational — use first names, sound like a real person",
    professional: "professional and composed — complete sentences, measured, no emoji",
    casual:       "casual and direct — short, punchy, like texting a mate",
    formal:       "formal and courteous — full sentences, polite address",
  };
  const tone    = toneMap[tonePreset] ?? toneMap.warm;
  const signOff = brandVoice?.sign_off_name ? `\nAlways sign off as: ${brandVoice.sign_off_name}` : "";
  const neverSay = widgetConfig?.never_say?.length
    ? `\nNEVER USE THESE PHRASES: ${widgetConfig.never_say.join(", ")}`
    : "";
  const responseWindow = widgetConfig?.response_window ?? "2 hours";

  const areaLine = serviceArea?.length
    ? `We cover: ${serviceArea.join(", ")}`
    : "We cover various areas — ask for their postcode to confirm.";

  const SHARED_RULES = `
## Hard rules — follow these in every message
- Ask ONE question per message. Never stack two questions.
- Keep messages SHORT — 1 to 3 sentences max.
- No exclamation marks. None. Not one.
- No hollow affirmations — never say "Great!", "Perfect!", "Absolutely!", "Sure thing!" or similar.
- Sound like a real person, not a chatbot. Don't repeat back what the customer just said.
- Never quote prices. If asked about price, say: "The team will confirm pricing once they've had a look — they'll be in touch within ${responseWindow}."
- Never commit to dates or availability.
- If the visitor seems to be asking about a different type of service (e.g. residential in a commercial chat), gently clarify and continue collecting what you need.${neverSay}

## Suggestions
ALWAYS write your conversational message first. Then append suggestions on a new line.
NEVER output suggestions with no message text — there must always be at least one sentence above the suggestions block.

SUGGESTIONS_START
["Option A", "Option B", "Option C"]
SUGGESTIONS_END

Suggestions must be 2–5 words, max 4, directly relevant to what comes next in the conversation.`;

  // ── RESIDENTIAL ───────────────────────────────────────────────────────────
  if (selectedMode === "residential") {
    const resServices = services
      .filter(s => !s.category || s.category === "residential" || s.category === "other")
      .map(formatServiceLine)
      .join("\n") || "- General home cleaning services";

    return `You are the lead-capture assistant for ${businessName}, a cleaning business. A website visitor is looking for residential cleaning.

## Tone
${tone}${signOff}

## Services offered
${resServices}

## Service area
${areaLine}

## Your goal
Collect a complete lead. Do NOT quote prices. Do NOT book anything. Just gather the information the team needs to follow up.

## Conversation flow — collect these in order, one at a time
1. What type of clean? (regular clean / one-off / end of tenancy / after builders)
2. If regular: what frequency? (weekly / fortnightly / monthly)
3. How many bedrooms?
4. Postcode — to confirm coverage
5. Their name
6. How they'd like to be contacted (call / text / email) — then collect that detail

## CRITICAL: Do not output SITE_VISIT_START until you have: clean type, bedrooms, postcode, name, AND a contact method + detail.

## Lead capture
Once you have all six pieces, append AFTER your closing message:

SITE_VISIT_START
{ "mode": "residential", "name": "Jane Smith", "phone": "07700900000", "email": "jane@example.com", "clean_type": "regular", "frequency": "fortnightly", "bedrooms": 3, "postcode": "CF10 1AB" }
SITE_VISIT_END

Only include fields collected. Omit any not provided.
${SHARED_RULES}`;
  }

  // ── EXTERIOR ──────────────────────────────────────────────────────────────
  if (selectedMode === "exterior") {
    const extServices = services
      .filter(s => s.category === "exterior")
      .map(formatServiceLine)
      .join("\n") || "- Window cleaning\n- Gutter clearing\n- Pressure washing\n- Fascias & soffits";

    return `You are the lead-capture assistant for ${businessName}, a cleaning business. A website visitor wants exterior cleaning.

## Tone
${tone}${signOff}

## Exterior services offered
${extServices}

## Service area
${areaLine}

## Your goal
Collect a complete lead. The property address is the most important piece of information — with it the team can assess the job on Google Maps and prepare a quote.

Do NOT ask how many windows, how high the gutters are, or any other quantifying questions. The address is enough.
Do NOT quote prices.

## Conversation flow — collect these in order, one at a time
1. Which services are they interested in? (they can name multiple — use chips to guide them)
2. What's the full property address? (street + town + postcode — not just a postcode)
   - If they give only a postcode: "And the street address?"
3. Any access issues to be aware of? (locked gate, dog, parking restrictions — keep it light)
4. Their name
5. Best contact method (call / text / email) — then collect that detail

## CRITICAL: Do not output SITE_VISIT_START until you have: services, full address (not just postcode), name, AND contact detail.

## Lead capture
Once you have all five pieces, append AFTER your closing message:

SITE_VISIT_START
{ "mode": "exterior", "name": "Jane Smith", "phone": "07700900000", "email": "jane@example.com", "services": ["Window Cleaning", "Gutter Clearing"], "address": "14 High Street, Cardiff CF10 1AB", "access_notes": "Side gate, code 1234" }
SITE_VISIT_END

Only include fields collected.
${SHARED_RULES}`;
  }

  // ── COMMERCIAL ────────────────────────────────────────────────────────────
  if (selectedMode === "commercial") {
    const commServices = services
      .filter(s => s.category === "commercial")
      .map(formatServiceLine)
      .join("\n") || "- Commercial cleaning\n- Office cleaning\n- Deep clean";

    return `You are the lead-capture assistant for ${businessName}, a cleaning business. A website visitor wants commercial cleaning.

## Tone
${tone}${signOff}

## Commercial services offered
${commServices}

## Service area
${areaLine}

## Your goal
Collect a high-quality commercial lead. Commercial jobs always require a site visit — never quote prices.

## Conversation flow — collect these in order, one at a time
1. Type of premises? (office / retail / school / healthcare / warehouse / other)
2. Current situation? (no cleaner at the moment / unhappy with current provider / new premises)
3. Rough size? (small — under 2,000 sq ft / medium — 2–5,000 / large — over 5,000)
4. Cleaning frequency needed? (daily / weekly / fortnightly / monthly)
5. Timeline? (need someone ASAP / within the next month / planning ahead)
6. Their name and job title or role
7. Best contact method (call / text / email) — then collect that detail

## Compliance
If premises type is school or healthcare, add "compliance_flag": "DBS check required" to the SITE_VISIT block.

## CRITICAL: Do not output SITE_VISIT_START until you have: premises type, situation, size, frequency, timeline, name + role, AND contact detail.

## Lead capture
Once complete, append AFTER your closing message:

SITE_VISIT_START
{ "mode": "commercial", "name": "Jane Smith", "role": "Office Manager", "phone": "07700900000", "email": "jane@example.com", "premises_type": "office", "situation": "switching provider", "size": "medium", "frequency": "weekly", "timeline": "within a month", "compliance_flag": "" }
SITE_VISIT_END

Only include fields collected. Leave compliance_flag empty string if not applicable.
${SHARED_RULES}`;
  }

  // ── FALLBACK (unknown mode) ───────────────────────────────────────────────
  return `You are the lead-capture assistant for ${businessName}, a cleaning business. Understand what the visitor needs and collect their name and contact details so the team can follow up.

## Tone
${tone}${signOff}

## Service area
${areaLine}

## Rules
- One question at a time
- Never quote prices
- Collect: what they need, their name, and phone or email

## Contact capture
When you have name + (phone or email), append:

CONTACT_START
{ "name": "Jane Smith", "email": "jane@example.com", "phone": "07700900000" }
CONTACT_END
${SHARED_RULES}`;
}

// ─── Parse structured markers from AI response ────────────────────────────────

function extractBlock(text: string, start: string, end: string): unknown | null {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1) return null;
  try {
    return JSON.parse(text.slice(s + start.length, e).trim());
  } catch {
    return null;
  }
}

function cleanText(text: string): string {
  return text
    .replace(/QUOTE_START[\s\S]*?QUOTE_END/g, "")
    .replace(/CONTACT_START[\s\S]*?CONTACT_END/g, "")
    .replace(/SITE_VISIT_START[\s\S]*?SITE_VISIT_END/g, "")
    .replace(/SUGGESTIONS_START[\s\S]*?SUGGESTIONS_END/g, "")
    .trim();
}

// ─── Simple pricing engine (mirrors pricingEngine.js logic) ──────────────────

interface PricingRule {
  pricing_method: string;
  base_amounts: Record<string, unknown>;
  frequency_modifiers?: Record<string, number>;
  minimum_price?: number;
}

function quickQuote(rule: PricingRule, bedrooms: number, frequency: string): { price: number; confidence: string; breakdown: Array<{label: string; amount: number}> } | null {
  if (!rule) return null;

  const DEFAULT_FREQ: Record<string, number> = {
    weekly: 0.90, fortnightly: 1.00, four_weekly: 1.05, monthly: 1.05, one_off: 1.25,
  };

  let basePrice: number | null = null;
  let baseLabel = "Base price";

  if (rule.pricing_method === "per_bedroom") {
    const amounts = rule.base_amounts as Record<string, number>;
    const key = String(Math.min(bedrooms, 5));
    basePrice = amounts[key] ?? null;
    baseLabel = `${bedrooms}-bed base price`;
  } else if (rule.pricing_method === "flat_rate_fixed") {
    basePrice = (rule.base_amounts as Record<string, number>).price ?? null;
    baseLabel = "Fixed rate";
  } else if (rule.pricing_method === "per_bedroom_bathroom") {
    const amounts = rule.base_amounts as Record<string, number>;
    const baths = bedrooms <= 2 ? 1 : bedrooms <= 4 ? 2 : 3;
    basePrice = (amounts.base ?? 0) + bedrooms * (amounts.per_bedroom ?? 0) + baths * (amounts.per_bathroom ?? 0);
    baseLabel = `${bedrooms}-bed base price`;
  }

  if (basePrice === null) return null;

  const breakdown: Array<{label: string; amount: number}> = [{ label: baseLabel, amount: basePrice }];
  let price = basePrice;

  const modifiers = rule.frequency_modifiers ?? DEFAULT_FREQ;
  const freqMod   = modifiers[frequency] ?? 1.0;
  if (freqMod !== 1.0) {
    const diff = Math.round(price * freqMod * 100) / 100 - price;
    price = Math.round(price * freqMod * 100) / 100;
    const freqLabels: Record<string, string> = {
      weekly: "Weekly discount", fortnightly: "Standard rate",
      four_weekly: "4-weekly uplift", monthly: "Monthly uplift", one_off: "One-off uplift",
    };
    if (Math.abs(diff) > 0.01) {
      breakdown.push({ label: freqLabels[frequency] ?? frequency, amount: diff });
    }
  }

  if (rule.minimum_price && price < rule.minimum_price) {
    price = rule.minimum_price;
    breakdown.push({ label: "Minimum charge", amount: rule.minimum_price - basePrice });
  }

  return {
    price:      Math.round(price * 100) / 100,
    confidence: "high",
    breakdown,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SizeTier { label: string; price: number; }

interface ServiceRecord {
  id: string;
  name: string;
  category?: string;
  pricing_type: string;
  pricing_matrix?: SizeTier[] | null;
  price_hourly_rate?: number | null;
  price_hourly_minimum_hours?: number | null;
  price_fixed_basic?: number | null;
  price_per_sqm?: number | null;
  price_per_room?: number | null;
  price_per_bathroom?: number | null;
  pricing_notes?: string | null;
  frequency_one_off?: boolean;
  frequency_weekly?: boolean;
  frequency_fortnightly?: boolean;
  frequency_monthly?: boolean;
  site_visit_required?: boolean;
  inference_meta?: { cadi_context?: string | null } | null;
}

interface WidgetConfig {
  id:                     string;
  business_id:            string;
  enabled:                boolean;
  modes:                  string[];
  business_name:          string | null;
  owner_name:             string | null;
  service_area:           string | null;
  response_window:        string | null;
  working_hours:          Record<string, string> | null;
  tone_preset:            string | null;
  never_say:              string[] | null;
  notify_email:           boolean;
  notify_sms:             boolean;
  notify_push:            boolean;
  notify_email_address:   string | null;
  second_recipient_email: string | null;
  second_recipient_sms:   string | null;
  setup_step:             number;
}

interface BusinessContext {
  businessId:   string;
  businessName: string;
  serviceArea:  string[];
  services:     ServiceRecord[];
  legacyRules:  Array<{ service: string; service_label: string; pricing_method: string; base_amounts: Record<string, unknown>; frequency_modifiers?: Record<string, number>; minimum_price?: number }>;
  brandVoice:   Record<string, string> | null;
  agentMode:    string;
  widgetGoal:   string;     // legacy — kept for backward compat
  widgetModes:  string[];
  selectedMode: string;     // resolved per-request (from POST body or derived from widgetGoal)
  widgetConfig: WidgetConfig | null;
}

// ─── Load business context ────────────────────────────────────────────────────

async function loadBusinessContext(sb: ReturnType<typeof createClient>, businessId: string): Promise<BusinessContext | null> {
  const { data: biz } = await sb
    .from("businesses")
    .select("id, owner_user_id")
    .eq("id", businessId)
    .single();

  if (!biz) return null;

  const [
    { data: profile },
    { data: pricingRules },
    { data: agentSetting },
    { data: serviceRows },
    { data: widgetConfig },
  ] = await Promise.all([
    sb.from("profiles")
      .select("business_name, brand_voice, service_postcodes, trust_level")
      .eq("id", biz.owner_user_id)
      .maybeSingle(),
    sb.from("pricing_rules")
      .select("service, service_label, pricing_method, base_amounts, frequency_modifiers, minimum_price")
      .eq("business_id", businessId)
      .eq("status", "active"),
    sb.from("agent_settings")
      .select("mode, config")
      .eq("business_id", businessId)
      .eq("agent", "front_desk")
      .maybeSingle(),
    sb.from("services")
      .select("id, name, category, pricing_type, pricing_matrix, price_hourly_rate, price_hourly_minimum_hours, price_fixed_basic, price_per_sqm, price_per_room, price_per_bathroom, pricing_notes, frequency_one_off, frequency_weekly, frequency_fortnightly, frequency_monthly, site_visit_required, inference_meta")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    sb.from("widget_configs")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const brandVoice  = profile?.brand_voice as Record<string, string> | null;
  const agentConfig = agentSetting?.config as Record<string, string> | null;

  // widget_configs is the new source of truth for enabled state + modes
  // Fall back to agent_settings for businesses that pre-date the migration
  const widgetEnabled = widgetConfig !== null
    ? widgetConfig.enabled
    : (agentSetting?.mode !== "off");

  const widgetModes = (widgetConfig?.modes as string[] | null) ?? ["residential", "exterior", "commercial"];

  // Business name priority: widget_configs > brand_voice > profiles
  const businessName =
    (widgetConfig?.business_name as string | null) ??
    brandVoice?.business_name ??
    profile?.business_name ??
    "Cleaning Services";

  // widgetGoal: legacy field — kept for backward compat until Phase 2 mode selector lands
  const widgetGoal = agentConfig?.widget_goal ?? "site_visit";

  return {
    businessId,
    businessName,
    serviceArea:  (profile?.service_postcodes as string[]) ?? [],
    services:     (serviceRows ?? []) as ServiceRecord[],
    legacyRules:  (pricingRules ?? []) as BusinessContext["legacyRules"],
    brandVoice,
    agentMode:    widgetEnabled ? "approval" : "off",
    widgetGoal,
    widgetModes,
    selectedMode: "residential", // default; overridden per-request in POST handler
    widgetConfig: widgetConfig as WidgetConfig | null,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── GET: return public business info ──────────────────────────────────────

  if (req.method === "GET") {
    const url = new URL(req.url);
    const businessId = url.searchParams.get("business_id");
    if (!businessId) return json({ error: "Missing business_id" }, 400);

    const ctx = await loadBusinessContext(sb, businessId);
    if (!ctx) return json({ error: "Business not found" }, 404);

    const isPro = (ctx.widgetConfig?.tone_preset ?? ctx.brandVoice?.tone) === "professional";
    const hi    = isPro ? "Hello." : "Hi —";
    const biz   = ctx.businessName;

    // Per-mode greetings and chips
    const modeConfigs: Record<string, { greeting: string; chips: string[] }> = {
      residential: {
        greeting: `${hi} I'm the virtual assistant for ${biz}. What type of home cleaning are you looking for?`,
        chips:    ["Regular clean", "One-off clean", "End of tenancy", "After builders"],
      },
      exterior: {
        greeting: `${hi} I'm the virtual assistant for ${biz}. Which exterior services are you interested in?`,
        chips:    ["Window cleaning", "Gutter clearing", "Pressure washing", "Fascias & soffits"],
      },
      commercial: {
        greeting: `${hi} I'm the virtual assistant for ${biz}. What type of premises do you have?`,
        chips:    ["Office", "Retail", "School / healthcare", "Warehouse"],
      },
    };

    // Only return configs for modes this business has enabled
    const filteredModeConfigs = Object.fromEntries(
      ctx.widgetModes
        .filter(m => modeConfigs[m])
        .map(m => [m, modeConfigs[m]])
    );

    return json({
      business_name:   ctx.businessName,
      service_area:    ctx.serviceArea,
      modes:           ctx.widgetModes,
      mode_configs:    filteredModeConfigs,
      agent_mode:      ctx.agentMode,
      response_window: ctx.widgetConfig?.response_window ?? "2 hours",
      // Legacy fields — kept for any old widget builds still in the wild
      widget_goal:     ctx.widgetGoal,
      greeting:        filteredModeConfigs[ctx.widgetModes[0]]?.greeting ?? `${hi} I'm the virtual assistant for ${biz}. How can I help?`,
      initial_chips:   filteredModeConfigs[ctx.widgetModes[0]]?.chips ?? [],
    });
  }

  // ── POST: handle a chat message ───────────────────────────────────────────

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: {
    business_id:      string;
    conversation_id?: string;
    message:          string;
    visitor_info?:    Record<string, string>;
    selected_mode?:   string;
  };

  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { business_id, conversation_id, message, visitor_info = {}, selected_mode } = body;
  if (!business_id || !message) return json({ error: "Missing required fields" }, 400);

  const ctx = await loadBusinessContext(sb, business_id);
  if (!ctx) return json({ error: "Business not found" }, 404);

  // Resolve selectedMode: use request body value if valid, otherwise derive from legacy widgetGoal
  const legacyModeMap: Record<string, string> = {
    site_visit:    "residential",
    instant_quote: "residential",
    enquiry:       "residential",
  };
  const validModes = ["residential", "exterior", "commercial"];
  ctx.selectedMode = (selected_mode && validModes.includes(selected_mode))
    ? selected_mode
    : (legacyModeMap[ctx.widgetGoal] ?? "residential");

  // Get or create conversation
  let convId = conversation_id ?? null;
  if (!convId) {
    // Server-side entitlement gate: Lite businesses get a capped number of
    // Front Desk conversations per month. The client tracks this too, but the
    // widget endpoint is public, so the real cap must live here. Only a NEW
    // conversation consumes quota; continuing an existing one (conversation_id
    // supplied) does not. Fail open on a DB hiccup so a real lead is never lost.
    if ((await tierForBusiness(sb, business_id)) === "lite") {
      const thisMonth = new Date().toISOString().slice(0, 7) + "-01";
      const { data: allowed, error: rpcErr } = await sb.rpc("check_and_consume_fd_limit", {
        p_business_id: business_id,
        p_month:       thisMonth,
        p_limit:       LITE_LIMITS.frontDeskMonthlyLimit,
      });
      if (!rpcErr && !allowed) {
        return json({
          conversation_id: null,
          message:         "Thanks for your message! This chat has reached its limit for now — please reach out to the business directly and they'll be happy to help.",
          limit_reached:   true,
        });
      }
    }

    const { data: newConv } = await sb
      .from("conversations")
      .insert({ business_id, channel: "web_chat", status: "open" })
      .select("id")
      .single();
    convId = newConv?.id ?? null;
  }

  // Save inbound message
  if (convId) {
    await sb.from("messages").insert({
      conversation_id: convId,
      direction: "inbound",
      channel: "web_chat",
      sender: "customer",
      body: message,
    });
  }

  // Load conversation history for context (last 20 messages)
  let history: Array<{ role: string; content: string }> = [];
  if (convId) {
    const { data: prevMsgs } = await sb
      .from("messages")
      .select("direction, body")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(20);

    history = (prevMsgs ?? []).map(m => ({
      role:    m.direction === "inbound" ? "user" : "assistant",
      content: m.body ?? "",
    }));
  } else {
    history = [{ role: "user", content: message }];
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt(ctx);

  // Call Anthropic
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   history,
    }),
  });

  const aiData = await anthropicRes.json();
  if (!anthropicRes.ok || !aiData?.content?.[0]?.text) {
    console.error(`Anthropic error ${anthropicRes.status}:`, JSON.stringify(aiData));
  }
  const rawReply = aiData?.content?.[0]?.text ?? "Sorry, I'm having trouble responding right now. Please try again.";

  // Parse structured blocks
  const quoteRequest = extractBlock(rawReply, "QUOTE_START", "QUOTE_END") as {
    service: string; bedrooms?: number; frequency?: string; postcode?: string;
  } | null;

  const contactData    = extractBlock(rawReply, "CONTACT_START", "CONTACT_END") as Record<string, string> | null;
  const siteVisitData  = extractBlock(rawReply, "SITE_VISIT_START", "SITE_VISIT_END") as Record<string, unknown> | null;
  const suggestionsRaw = extractBlock(rawReply, "SUGGESTIONS_START", "SUGGESTIONS_END");
  const suggestions    = Array.isArray(suggestionsRaw) ? suggestionsRaw as string[] : [];
  let cleanReply = cleanText(rawReply);
  // If the AI output only structured blocks with no visible text, synthesise a closing message
  if (!cleanReply) {
    cleanReply = siteVisitData
      ? "We have everything we need. The team will be in touch within a couple of hours."
      : contactData
        ? "Got it — we have your details. The team will be in touch soon."
        : "Got it. Is there anything else I can help with?";
  }

  // If site visit data was captured, call receive-site-visit and await it.
  // Must be awaited — fire-and-forget is killed by the Deno runtime before the
  // secondary fetch completes, so the inbox item and email never arrive.
  let siteVisitRequested = false;
  if (siteVisitData) {
    siteVisitRequested = true;
    try {
      const svRes = await fetch(`${SUPABASE_URL}/functions/v1/receive-site-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          business_id,
          enquiry_source: "widget_chat",
          ...siteVisitData,
        }),
      });
      if (!svRes.ok) {
        const errText = await svRes.text();
        console.error(`receive-site-visit returned ${svRes.status}:`, errText);
      }
    } catch (err) {
      console.error("receive-site-visit call failed:", err);
    }
  }

  // Calculate quote if requested
  let quote: ReturnType<typeof quickQuote> | null = null;
  if (quoteRequest) {
    const serviceName = (quoteRequest.service ?? "").toLowerCase();

    // Try services table first (per_size matrix)
    const svc = ctx.services.find(s => s.name.toLowerCase().includes(serviceName) || serviceName.includes(s.name.toLowerCase()));
    if (svc) {
      if (svc.pricing_type === "per_size" && svc.pricing_matrix?.length) {
        const bedrooms = quoteRequest.bedrooms ?? 3;
        // Match label containing bedroom count, fall back to closest
        const match = svc.pricing_matrix.find(t => t.label.includes(String(bedrooms)))
          ?? svc.pricing_matrix[svc.pricing_matrix.length - 1];
        if (match) {
          quote = { price: match.price, confidence: "high", breakdown: [{ label: match.label, amount: match.price }] };
        }
      } else {
        // Build a legacy-style rule from services record for quickQuote
        const legacyRule = {
          pricing_method: svc.pricing_type === "hourly" ? "flat_rate_fixed" : "flat_rate_fixed",
          base_amounts: { price: svc.price_fixed_basic ?? svc.price_hourly_rate ?? 0 },
        };
        quote = quickQuote(legacyRule, quoteRequest.bedrooms ?? 3, quoteRequest.frequency ?? "fortnightly");
      }
    } else {
      // Fall back to legacy pricing_rules
      const rule = ctx.legacyRules.find(s =>
        s.service === quoteRequest.service ||
        s.service_label?.toLowerCase().includes(serviceName)
      );
      if (rule) {
        quote = quickQuote(rule, quoteRequest.bedrooms ?? 3, quoteRequest.frequency ?? "fortnightly");
      }
    }
  }

  // Save/update lead if contact data captured
  let leadCaptured = false;
  if (contactData && convId) {
    const mergedContact = { ...visitor_info, ...contactData };
    const { data: existingLead } = await sb
      .from("leads")
      .select("id")
      .eq("business_id", business_id)
      .eq("conversation_id", convId)
      .single();

    if (existingLead) {
      await sb.from("leads").update({
        name:    mergedContact.name ?? null,
        email:   mergedContact.email ?? null,
        phone:   mergedContact.phone ?? null,
        updated_at: new Date().toISOString(),
      }).eq("id", existingLead.id);
    } else {
      await sb.from("leads").insert({
        business_id,
        conversation_id: convId,
        name:    mergedContact.name ?? null,
        email:   mergedContact.email ?? null,
        phone:   mergedContact.phone ?? null,
        enquiry_source: "web_chat",
        status: "qualifying",
      });
    }
    leadCaptured = true;
  }

  // Save outbound message
  if (convId) {
    await sb.from("messages").insert({
      conversation_id: convId,
      direction: "outbound",
      channel: "web_chat",
      sender: "agent",
      body: cleanReply,
    });

    // Update conversation last_message_at
    await sb.from("conversations").update({
      last_message_at: new Date().toISOString(),
      status: leadCaptured ? "converted" : "open",
    }).eq("id", convId);
  }

  return json({
    conversation_id:      convId,
    message:              cleanReply,
    quote,
    site_visit_requested: siteVisitRequested || undefined,
    suggestions:          suggestions.length > 0 ? suggestions : undefined,
    lead_captured:        leadCaptured || undefined,
    visitor_info:         contactData ? { ...visitor_info, ...contactData } : undefined,
  });
});
