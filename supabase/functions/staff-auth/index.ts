/**
 * supabase/functions/staff-auth/index.ts
 * No JWT required — public endpoint scoped by staff_login_token.
 *
 * GET  ?token=xxx          → returns [{id, name, role}] for that business (no PINs)
 * POST {token, pin}        → returns staff member if PIN matches, else 401
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── GET — list staff names for a business token ─────────────────────────────
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return json({ error: "token required" }, 400);

    // Look up owner by token
    const { data: biz } = await supabase
      .from("business_settings")
      .select("owner_id")
      .eq("staff_login_token", token)
      .single();

    if (!biz) return json({ error: "Invalid token" }, 404);

    const { data: staff } = await supabase
      .from("staff_members")
      .select("id, name, role")
      .eq("owner_id", biz.owner_id)
      .eq("active", true)
      .order("name");

    return json({ staff: staff ?? [] });
  }

  // ── POST — validate PIN and return staff member ──────────────────────────────
  if (req.method === "POST") {
    const { token, pin } = await req.json() as { token: string; pin: string };
    if (!token || !pin) return json({ error: "token and pin required" }, 400);

    const { data: biz } = await supabase
      .from("business_settings")
      .select("owner_id")
      .eq("staff_login_token", token)
      .single();

    if (!biz) return json({ error: "Invalid token" }, 404);

    const { data: member } = await supabase
      .from("staff_members")
      .select("id, name, role, hourly_rate")
      .eq("owner_id", biz.owner_id)
      .eq("pin_hash", pin)
      .eq("active", true)
      .single();

    if (!member) return json({ error: "Incorrect PIN" }, 401);

    return json({ member });
  }

  return json({ error: "Method not allowed" }, 405);
});
