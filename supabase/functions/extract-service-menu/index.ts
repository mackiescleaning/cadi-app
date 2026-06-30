/**
 * supabase/functions/extract-service-menu/index.ts
 * Cadi — turn a photo / paste / URL into a structured service menu.
 *
 * POST { image_base64?, image_mime?, url?, text? }
 *   At least one input must be provided.
 *
 * Returns { services: ServiceDraft[], source } where ServiceDraft mirrors
 * the rows in src/lib/serviceTemplates.js so the UI can preview + edit
 * before bulk-inserting via bulkCreateServices.
 *
 * Strategy:
 *   1. If image_base64 → Sonnet vision multimodal call.
 *   2. If url → fetch HTML, strip to plaintext, Sonnet text call.
 *   3. If text → Sonnet text call.
 *
 * Env: ANTHROPIC_API_KEY (required). Function returns 503 when missing.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM = `You extract a UK cleaning business's service menu from messy real-world inputs (photos of printed price lists, website screenshots, PDFs, plain text).

Return ONLY a JSON object with this exact shape — no prose, no markdown:
{
  "services": [
    {
      "name": "string (the service title)",
      "category": "residential" | "exterior" | "commercial",
      "pricing_type": "hourly" | "fixed" | "per_sqm" | "per_room" | "per_size" | "custom",
      "price_hourly_rate": number | null,
      "price_hourly_minimum_hours": number | null,
      "price_fixed_basic": number | null,
      "price_fixed_standard": number | null,
      "price_fixed_premium": number | null,
      "price_per_sqm": number | null,
      "price_per_sqm_minimum": number | null,
      "price_per_room": number | null,
      "pricing_matrix": [{ "size_label": "string", "price": number }] | null,
      "duration_value": number | null,
      "duration_unit": "minutes" | "hours" | "days",
      "description_included": "string | null",
      "frequency_one_off": boolean,
      "frequency_weekly": boolean,
      "frequency_fortnightly": boolean,
      "frequency_monthly": boolean,
      "frequency_quarterly": boolean,
      "frequency_annually": boolean
    }
  ]
}

Rules:
- Set pricing_type based on what you see. If there's a single £ figure, use "fixed" with price_fixed_basic. If sizes (1-bed/2-bed/m²) are listed, use "per_size" + pricing_matrix or "per_sqm". If only hourly, use "hourly".
- Categorise carefully: "exterior" = windows/gutters/jet-washing; "residential" = inside homes; "commercial" = offices/retail/hospitality/contracts.
- Default frequencies: regular cleans → weekly+fortnightly+monthly true; deep cleans/end-of-tenancy → one_off true; window rounds → fortnightly+monthly true; commercial contracts → weekly true. Set every other to false.
- Strip currency symbols and commas from numbers.
- If a field is unknown, set null (numbers) or false (booleans).
- Skip rows that aren't actually services (terms, contact details, opening hours, address, photos).
- Return at most 30 services.`;

async function callAnthropic(messages: any[]) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM,
      messages,
    }),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Anthropic ${r.status}: ${errText.slice(0, 200)}`);
  }
  const j = await r.json();
  const text = j?.content?.[0]?.text ?? "";
  return text;
}

function parseModelOutput(text: string) {
  // The model is told to return JSON only, but be defensive — strip code
  // fences and grab the largest {...} block.
  const cleaned = text.replace(/```json\s*|```\s*$/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(slice);
  return Array.isArray(parsed?.services) ? parsed.services : [];
}

async function fetchUrlText(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "user-agent": "Cadi/1.0 (+https://cadi.cleaning)" },
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const html = await r.text();
  // Crude HTML → text strip. Replaceable later with a proper extractor.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);

  if (!ANTHROPIC_KEY) {
    return json({
      services: [],
      source: "unavailable",
      error: "ANTHROPIC_API_KEY is not configured on the server.",
    }, 503);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const { image_base64, image_mime, url, text } = body ?? {};
  let messages: any[];
  let source: string;

  try {
    if (image_base64) {
      const mime = image_mime || "image/jpeg";
      messages = [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: image_base64 } },
          { type: "text",  text: "Extract every service and price from this image. Return JSON only." },
        ],
      }];
      source = "image";
    } else if (url) {
      const pageText = await fetchUrlText(String(url));
      if (!pageText || pageText.length < 50) return json({ services: [], source: "url", error: "couldn't read enough text from that URL" });
      messages = [{ role: "user", content: `Extract the service menu from this page text. Return JSON only.\n\n${pageText}` }];
      source = "url";
    } else if (text) {
      messages = [{ role: "user", content: `Extract the service menu from this text. Return JSON only.\n\n${String(text).slice(0, 24000)}` }];
      source = "text";
    } else {
      return json({ error: "provide image_base64, url, or text" }, 400);
    }

    const raw = await callAnthropic(messages);
    const services = parseModelOutput(raw);
    return json({ services, source });
  } catch (err) {
    return json({ error: (err as Error).message ?? "unknown error", services: [], source: "error" }, 500);
  }
});
