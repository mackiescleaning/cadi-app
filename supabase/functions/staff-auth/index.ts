/**
 * supabase/functions/staff-auth/index.ts
 * Public endpoint scoped by staff_login_token (no end-user JWT required).
 *
 * GET  ?token=xxx          → returns [{id, name, role}] for that business (no PINs)
 * POST {token, pin}        → on success returns { member, staffToken } — the
 *                            staffToken is an 8h HS256 JWT used as the bearer
 *                            credential for staff-jobs/staff-timesheet/
 *                            staff-payslip. Previously the staff UUID was
 *                            passed in URL query strings — replaced because it
 *                            leaked via referrers + had no expiry.
 *
 * On wrong PIN: increments per-business attempt counter. After 5 failed
 * attempts the business is locked out for 15 minutes (returns 423 Locked).
 * Bcrypt-hashed PIN compare runs inside a SECURITY DEFINER RPC so the bcrypt
 * column never has to leave the database.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signStaffToken } from "../_shared/staffJwt.ts";
import { checkRateLimit, clientIp, rateLimitedResponse } from "../_shared/rateLimit.ts";

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

  // ── POST — validate PIN and return staff member + signed JWT ───────────────
  if (req.method === "POST") {
    const { token, pin } = await req.json() as { token: string; pin: string };
    if (!token || !pin) return json({ error: "token and pin required" }, 400);
    if (!/^[0-9]{4,8}$/.test(pin)) return json({ error: "PIN must be 4-8 digits" }, 400);

    // Rate limit per (ip + token) — 20 attempts / 5 min. The per-business
    // lockout inside validate_staff_pin is the security backstop (5 attempts
    // → 15 min lockout); this stops a botnet from grinding through PIN space
    // before the business lockout even fires.
    const rl = await checkRateLimit(supabase, {
      bucket:   "staff-auth-pin",
      key:      `${clientIp(req)}:${token}`,
      limit:    20,
      windowMs: 5 * 60 * 1000,
    });
    if (!rl.ok) return rateLimitedResponse(CORS, rl.resetAt);

    const { data, error } = await supabase.rpc("validate_staff_pin", {
      p_token: token,
      p_pin:   pin,
    });

    if (error) {
      console.error("validate_staff_pin RPC error:", error);
      return json({ error: "Server error" }, 500);
    }

    // RPC returns: empty array (bad token OR wrong PIN), or one row.
    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      // Empty result — either token invalid or PIN wrong. Don't distinguish:
      // returning 404 vs 401 here would help enumerate live tokens.
      return json({ error: "Incorrect PIN" }, 401);
    }

    if (row.locked) {
      const retryAfter = row.locked_until ? new Date(row.locked_until).getTime() - Date.now() : null;
      return json({
        error:        "Too many incorrect PIN attempts. Please wait before trying again.",
        locked_until: row.locked_until,
        retry_after_ms: retryAfter,
      }, 423);
    }

    const staffToken = await signStaffToken({
      id:       row.id,
      owner_id: row.owner_id,
      role:     row.role ?? "cleaner",
    });

    return json({
      member: {
        id:          row.id,
        name:        row.name,
        role:        row.role,
        hourly_rate: row.hourly_rate,
        owner_id:    row.owner_id,
      },
      staffToken,
    });
  }

  return json({ error: "Method not allowed" }, 405);
});
