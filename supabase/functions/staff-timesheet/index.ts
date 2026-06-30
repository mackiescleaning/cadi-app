/**
 * supabase/functions/staff-timesheet/index.ts
 * Authenticated by short-lived staff JWT (Authorization: Bearer <token>).
 *
 * GET  ?date=YYYY-MM-DD          → all timesheet rows for this member on that date
 * POST { job_id?, date, action, lat?, lng?, accuracy? }
 *        action = 'clock_in'  → insert new row, calculate distance to job postcode
 *        action = 'clock_out' → update row with clock_out_at, mark clocked_out
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaffAuth } from "../_shared/staffJwt.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let claims;
  try { claims = await requireStaffAuth(req); }
  catch { return json({ error: "Unauthorized" }, 401); }
  const staff_id = claims.sub;
  const owner_id = claims.biz;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Confirm staff still active (revocation-by-deactivation while JWT lives)
  {
    const { data: active } = await sb
      .from("team_members")
      .select("id")
      .eq("id", staff_id)
      .eq("business_id", owner_id)
      .eq("is_active", true)
      .single();
    if (!active) return json({ error: "Unauthorized" }, 401);
  }

  if (req.method === "GET") {
    const date = new URL(req.url).searchParams.get("date");
    if (!date) return json({ error: "date required" }, 400);

    const { data, error } = await sb
      .from("timesheets")
      .select("*")
      .eq("staff_id", staff_id)
      .eq("business_id", owner_id)
      .eq("date", date)
      .order("created_at", { ascending: true });

    if (error) return json({ error: error.message }, 500);
    return json({ timesheets: data });
  }

  if (req.method === "POST") {
    let body: {
      job_id?: string | null;
      date: string;
      action: "clock_in" | "clock_out";
      lat?: number | null;
      lng?: number | null;
      accuracy?: number | null;
    };

    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON" }, 400); }

    const { job_id, date, action, lat, lng, accuracy } = body;
    if (!date || !action) return json({ error: "Missing fields" }, 400);

    // ── clock_in ──────────────────────────────────────────────────────────────
    if (action === "clock_in") {
      let siteDistM: number | null = null;

      if (lat != null && lng != null && job_id) {
        const { data: job } = await sb.from("jobs").select("postcode").eq("id", job_id).single();
        if (job?.postcode) {
          try {
            const pc  = job.postcode.replace(/\s/g, "");
            const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
            const d   = await res.json();
            if (d.result?.latitude) {
              siteDistM = Math.round(haversineMetres(lat, lng, d.result.latitude, d.result.longitude));
            }
          } catch { /* postcodes.io unavailable */ }
        }
      }

      const status = siteDistM != null && siteDistM > 500 ? "flagged" : "clocked_in";

      const { data, error } = await sb
        .from("timesheets")
        .insert({
          business_id:          owner_id,
          staff_id,
          job_id:               job_id ?? null,
          date,
          clock_in_at:          new Date().toISOString(),
          clock_in_lat:         lat ?? null,
          clock_in_lng:         lng ?? null,
          clock_in_accuracy_m:  accuracy != null ? Math.round(accuracy) : null,
          site_distance_m:      siteDistM,
          status,
        })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ timesheet: data });
    }

    // ── clock_out ─────────────────────────────────────────────────────────────
    if (action === "clock_out") {
      let query = sb
        .from("timesheets")
        .select("id, clock_in_at")
        .eq("staff_id", staff_id)
        .eq("business_id", owner_id)
        .eq("date", date)
        .in("status", ["clocked_in", "flagged"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (job_id) query = query.eq("job_id", job_id);

      const { data: existing } = await query.single();
      if (!existing) return json({ error: "No active clock-in found" }, 404);

      const clockOutAt   = new Date().toISOString();
      const durationMins = existing.clock_in_at
        ? Math.round((new Date(clockOutAt).getTime() - new Date(existing.clock_in_at).getTime()) / 60_000)
        : null;

      const { data, error } = await sb
        .from("timesheets")
        .update({
          clock_out_at:          clockOutAt,
          clock_out_lat:         lat ?? null,
          clock_out_lng:         lng ?? null,
          clock_out_accuracy_m:  accuracy != null ? Math.round(accuracy) : null,
          status:                "clocked_out",
          updated_at:            new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ timesheet: { ...data, duration_mins: durationMins } });
    }

    return json({ error: "Unknown action" }, 400);
  }

  return json({ error: "Method not allowed" }, 405);
});
