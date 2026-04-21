/**
 * supabase/functions/ai-customer-message/index.ts
 * Cadi — AI-drafted customer outreach messages
 *
 * Generates a short, warm, UK-English message from the business owner to one
 * of their customers — for win-backs, reminders, upsells, etc.
 *
 * POST body:
 *   {
 *     customer: {
 *       name, notes?, lastJobDate?, services?: [{ label, date }]
 *     },
 *     messageType: "winback" | "reminder" | "upsell_deep" | "upsell_oven" | "loyalty" | ...,
 *     customInstructions?: string
 *   }
 *
 * Response:
 *   { text: string }
 *
 * Secrets required: ANTHROPIC_API_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@^0.88.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function requireUser(req: Request) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) throw new Error("Missing Authorization header");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Not authenticated");
  return user;
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You write short, warm, professional messages from UK cleaning business owners to their customers.

Style:
- 3-4 short paragraphs max
- Starts with "Hi [first name],"
- Ends with "Kind regards"
- Friendly, personal, not corporate — sound like a real person who knows this customer
- No subject line, no name placeholder at the end, no markdown
- UK English spelling and tone`;

interface CustomerPayload {
  name: string;
  notes?: string;
  lastJobDate?: string | null;
  services?: Array<{ label?: string; date?: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await requireUser(req);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY secret not set" }, 500);

    const { customer, messageType, customInstructions } = (await req.json()) as {
      customer: CustomerPayload;
      messageType: string;
      customInstructions?: string;
    };

    if (!customer?.name || !messageType) {
      return json({ error: "customer.name and messageType are required" }, 400);
    }

    const client = new Anthropic({ apiKey });

    const daysSince = customer.lastJobDate
      ? Math.floor(
          (Date.now() - new Date(customer.lastJobDate).getTime()) / 86400000,
        )
      : null;

    const lastServiceLabel = customer.services?.[0]?.label;
    const servicesList = customer.services?.length
      ? [...new Set(customer.services.map((s) => s.label).filter(Boolean))].join(", ")
      : "";

    const userPrompt = [
      `Customer: ${customer.name}`,
      daysSince !== null
        ? `Last job: ${daysSince} days ago${lastServiceLabel ? ` (${lastServiceLabel})` : ""}`
        : "No previous jobs logged",
      customer.notes ? `Notes: ${customer.notes}` : "",
      servicesList ? `Services they've had: ${servicesList}` : "",
      `Message purpose: ${messageType}`,
      customInstructions ? `Additional instructions: ${customInstructions}` : "",
      "",
      "Write the message now.",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
    if (!text) return json({ error: "No text response from model" }, 502);

    return json({ text });
  } catch (err) {
    console.error("ai-customer-message error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const status = /authenticat|Authorization/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});
