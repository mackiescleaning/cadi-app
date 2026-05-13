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

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

// ─── Build system prompt from business context ────────────────────────────────

function buildSystemPrompt(ctx: BusinessContext): string {
  const { businessName, serviceArea, services, brandVoice, agentMode } = ctx;

  if (agentMode === "off") {
    return `You are a chat assistant. The business has disabled automated chat. Politely tell the visitor that online chat isn't currently available and invite them to call or email. Keep it brief.`;
  }

  const formatServiceLine = (s: ServiceRecord): string => {
    if (s.pricing_type === "per_size" && s.pricing_matrix?.length) {
      const tiers = s.pricing_matrix.map(t => `${t.label}: £${t.price}`).join(" / ");
      return `- ${s.name} — priced by size: ${tiers} (ask the customer how many bedrooms)`;
    }
    if (s.pricing_type === "hourly" && s.price_hourly_rate) {
      let line = `- ${s.name} — £${s.price_hourly_rate}/hr`;
      if (s.price_hourly_minimum_hours) line += `, minimum ${s.price_hourly_minimum_hours}hr`;
      return line;
    }
    if (s.pricing_type === "fixed" && s.price_fixed_basic) {
      return `- ${s.name} — £${s.price_fixed_basic} fixed`;
    }
    if (s.pricing_type === "per_sqm" && s.price_per_sqm) {
      return `- ${s.name} — £${s.price_per_sqm}/m²`;
    }
    if (s.pricing_type === "per_room" && s.price_per_room) {
      let line = `- ${s.name} — £${s.price_per_room}/room`;
      if (s.price_per_bathroom) line += ` + £${s.price_per_bathroom}/bathroom`;
      return line;
    }
    return `- ${s.name} — pricing to be confirmed, collect enquiry details`;
  };

  const serviceList = services.length > 0
    ? services.map(formatServiceLine).join("\n")
    : "- General cleaning services (pricing configured separately)";

  const toneMap: Record<string, string> = {
    warm:         "warm, friendly and approachable — use first names, casual but professional",
    professional: "professional and formal — Dear/Hi, complete sentences, no emoji",
    casual:       "casual and direct — short messages, conversational",
  };
  const tone = toneMap[brandVoice?.tone ?? "warm"] ?? toneMap.warm;
  const signOff = brandVoice?.sign_off_name ? `\nAlways sign off as: ${brandVoice.sign_off_name}` : "";

  return `You are the AI chat assistant for ${businessName}, a cleaning business. You help potential customers get instant quotes and book services.

## Your personality
Tone: ${tone}${signOff}

## Services offered
${serviceList}

## Service area
${serviceArea?.length ? `We cover: ${serviceArea.join(", ")}` : "We cover various areas — ask for the customer's postcode to confirm."}

## Conversation flow
1. Greet warmly and ask what service they're looking for
2. For residential: ask number of bedrooms, then frequency (weekly/fortnightly/monthly/one-off)
3. Ask for their postcode (to confirm service area)
4. When you have enough info, output a quote using the QUOTE marker below
5. Ask if they'd like to book — collect name, email/phone
6. Thank them and confirm someone will be in touch within 24 hours

## Rules
- Ask ONE question at a time — never stack multiple questions
- Keep messages SHORT (2-4 sentences max)
- Never make up prices — only output a quote when you have service + bedrooms/size + postcode
- If asked about something outside cleaning services, politely redirect
- If the visitor is rude or unreasonable, stay calm and professional

## Quoting
When you have enough info to quote, append a QUOTE block AFTER your message:

QUOTE_START
{
  "service": "regular_clean",
  "bedrooms": 3,
  "frequency": "fortnightly",
  "postcode": "CF10"
}
QUOTE_END

The system will calculate the price and show it to the customer — you don't need to state the price in your message.

## Contact capture
When the customer says they want to book, extract their details and append:

CONTACT_START
{ "name": "Jane Smith", "email": "jane@example.com", "phone": "07700900000" }
CONTACT_END

Only include fields they've actually provided.

## Suggestions
At the end of EVERY response, append quick reply suggestions:

SUGGESTIONS_START
["Option 1", "Option 2", "Option 3"]
SUGGESTIONS_END

Keep suggestions short (2-5 words each), maximum 4 options, relevant to what comes next.`;
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
}

interface BusinessContext {
  businessId:   string;
  businessName: string;
  serviceArea:  string[];
  services:     ServiceRecord[];
  legacyRules:  Array<{ service: string; service_label: string; pricing_method: string; base_amounts: Record<string, unknown>; frequency_modifiers?: Record<string, number>; minimum_price?: number }>;
  brandVoice:   Record<string, string> | null;
  agentMode:    string;
}

// ─── Load business context ────────────────────────────────────────────────────

async function loadBusinessContext(sb: ReturnType<typeof createClient>, businessId: string): Promise<BusinessContext | null> {
  const { data: biz } = await sb
    .from("businesses")
    .select("id, owner_user_id")
    .eq("id", businessId)
    .single();

  if (!biz) return null;

  const [{ data: profile }, { data: pricingRules }, { data: agentSetting }, { data: serviceRows }] = await Promise.all([
    sb.from("profiles")
      .select("display_name, brand_voice, service_postcodes, trust_level")
      .eq("id", biz.owner_user_id)
      .maybeSingle(),
    sb.from("pricing_rules")
      .select("service, service_label, pricing_method, base_amounts, frequency_modifiers, minimum_price")
      .eq("business_id", businessId)
      .eq("status", "active"),
    sb.from("agent_settings")
      .select("mode")
      .eq("business_id", businessId)
      .eq("agent", "front_desk")
      .maybeSingle(),
    sb.from("services")
      .select("id, name, pricing_type, pricing_matrix, price_hourly_rate, price_hourly_minimum_hours, price_fixed_basic, price_per_sqm, price_per_room, price_per_bathroom, pricing_notes, frequency_one_off, frequency_weekly, frequency_fortnightly, frequency_monthly")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  const brandVoice = profile?.brand_voice as Record<string, string> | null;

  return {
    businessId,
    businessName: brandVoice?.business_name ?? profile?.display_name ?? "Cleaning Services",
    serviceArea:  (profile?.service_postcodes as string[]) ?? [],
    services:     (serviceRows ?? []) as ServiceRecord[],
    legacyRules:  (pricingRules ?? []) as BusinessContext["legacyRules"],
    brandVoice,
    agentMode:    agentSetting?.mode ?? "approval",
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

    const tone = ctx.brandVoice?.tone ?? "warm";
    const greeting = tone === "professional"
      ? `Good day! I'm the virtual assistant for ${ctx.businessName}. I'm here to help you with a cleaning quote or to book a service. How may I assist you?`
      : `Hi there! 👋 I'm Cadi, the virtual assistant for ${ctx.businessName}. I can give you an instant quote for any of our cleaning services.\n\nWhat can I help you with today?`;

    return json({
      business_name: ctx.businessName,
      service_area:  ctx.serviceArea,
      greeting,
      agent_mode:    ctx.agentMode,
    });
  }

  // ── POST: handle a chat message ───────────────────────────────────────────

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: {
    business_id:     string;
    conversation_id?: string;
    message:         string;
    visitor_info?:   Record<string, string>;
  };

  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { business_id, conversation_id, message, visitor_info = {} } = body;
  if (!business_id || !message) return json({ error: "Missing required fields" }, 400);

  const ctx = await loadBusinessContext(sb, business_id);
  if (!ctx) return json({ error: "Business not found" }, 404);

  // Get or create conversation
  let convId = conversation_id ?? null;
  if (!convId) {
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
      max_tokens: 500,
      system:     systemPrompt,
      messages:   history,
    }),
  });

  const aiData   = await anthropicRes.json();
  const rawReply = aiData?.content?.[0]?.text ?? "Sorry, I'm having trouble responding right now. Please try again.";

  // Parse structured blocks
  const quoteRequest = extractBlock(rawReply, "QUOTE_START", "QUOTE_END") as {
    service: string; bedrooms?: number; frequency?: string; postcode?: string;
  } | null;

  const contactData   = extractBlock(rawReply, "CONTACT_START", "CONTACT_END") as Record<string, string> | null;
  const suggestionsRaw = extractBlock(rawReply, "SUGGESTIONS_START", "SUGGESTIONS_END");
  const suggestions   = Array.isArray(suggestionsRaw) ? suggestionsRaw as string[] : [];
  const cleanReply    = cleanText(rawReply);

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
    conversation_id: convId,
    message:         cleanReply,
    quote,
    suggestions:     suggestions.length > 0 ? suggestions : undefined,
    lead_captured:   leadCaptured || undefined,
    visitor_info:    contactData ? { ...visitor_info, ...contactData } : undefined,
  });
});
