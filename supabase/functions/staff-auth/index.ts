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
      .from("team_members")
      .select("id, first_name, last_name, role")
      .eq("business_id", biz.owner_id)
      .eq("is_active", true)
      .order("first_name");

    const mapped = (staff ?? []).map(s => ({
      id: s.id,
      name: [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "Unnamed",
      role: s.role,
    }));
    return json({ staff: mapped });
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
      .from("team_members")
      .select("id, first_name, last_name, role, hourly_rate")
      .eq("business_id", biz.owner_id)
      .eq("pin_hash", pin)
      .eq("is_active", true)
      .single();

    if (!member) return json({ error: "Incorrect PIN" }, 401);

    const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim() || "Unnamed";
    return json({
      member: {
        id: member.id,
        name,
        role: member.role,
        hourly_rate: member.hourly_rate,
        owner_id: biz.owner_id,
      },
    });
  }

  return json({ error: "Method not allowed" }, 405);
});
