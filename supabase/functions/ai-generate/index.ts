/**
 * supabase/functions/ai-generate/index.ts
 * Cadi — Anthropic Claude proxy.
 *
 * Keeps ANTHROPIC_API_KEY server-side; the browser never sees it.
 * Requires a valid Supabase JWT (authenticated users only).
 *
 * Request body:
 *   { messages: [{role, content}][], model?: string, max_tokens?: number }
 *
 * Response body (pass-through from Anthropic):
 *   { content: [{type: "text", text: string}][] }
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY — sk-ant-... from console.anthropic.com
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_ORIGIN"),
  "https://cadi.cleaning",
  "https://app.cadi.cleaning",
].filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "*");
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors });
  }

  // Verify the caller is an authenticated Cadi user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { error: authError } = await sb.auth.getUser();
  if (authError) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  let body: { messages: unknown[]; model?: string; max_tokens?: number; system?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: cors });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response("messages array required", { status: 400, headers: cors });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      body.model      ?? "claude-haiku-4-5-20251001",
      max_tokens: body.max_tokens ?? 350,
      messages:   body.messages,
      ...(body.system && { system: body.system }),
    }),
  });

  const data = await anthropicRes.json();

  return new Response(JSON.stringify(data), {
    status: anthropicRes.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
