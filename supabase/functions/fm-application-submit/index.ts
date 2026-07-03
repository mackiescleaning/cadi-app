/**
 * supabase/functions/fm-application-submit/index.ts
 *
 * Public endpoint for the "Apply to be an FM" form on /apply/fm. Replaces
 * the anon RLS INSERT that was in place — that was rate-limitless and
 * therefore trivially spammable once the marketing site was live.
 *
 * Guards:
 *   • Per-IP rate limit (5/hour) — legit form use is 1 submit; anything
 *     more is a bot or someone hammering refresh.
 *   • Honeypot field `hp_website2` — hidden from real users via CSS.
 *     Populated = bot. We return 200 OK silently without inserting so the
 *     bot doesn't try again with a different field name.
 *   • Payload size cap + basic email validation.
 *
 * POST { company_name, contact_name, contact_email, [hp_website2], ... }
 *   → { ok, id }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "unknown");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit BEFORE body parsing so a bot can't DOS us by spamming
    // large payloads. 5/hour per IP is generous for legit form use.
    const ip = clientIp(req);
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "fm_application_submit", p_key: ip, p_limit: 5, p_window_ms: 3600000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const raw = await req.text();
    if (raw.length > 20_000) return json({ error: "Payload too large" }, 413);
    const body = JSON.parse(raw || "{}") as Record<string, unknown>;

    // Honeypot — if bots populate this we quietly succeed without saving.
    // Real users never see the field (hidden via aria-hidden + off-screen).
    if (typeof body.hp_website2 === "string" && body.hp_website2.trim().length > 0) {
      await sb.from("audit_log").insert({
        actor_id: null,
        action:   "fm_application_honeypot",
        category: "fm_ops",
        detail:   { ip: ip === "unknown" ? null : ip, hp_value_length: body.hp_website2.length },
      }).then(() => {}).catch(() => {});
      return json({ ok: true, id: null });
    }

    // Required fields
    const companyName  = String(body.company_name  ?? "").trim();
    const contactName  = String(body.contact_name  ?? "").trim();
    const contactEmail = String(body.contact_email ?? "").trim().toLowerCase();

    if (!companyName || !contactName || !contactEmail) {
      return json({ error: "company_name, contact_name and contact_email are required" }, 400);
    }
    if (!EMAIL_RE.test(contactEmail)) {
      return json({ error: "Contact email doesn't look valid" }, 400);
    }

    // Text field caps — belt-and-braces vs anyone stuffing large payloads
    const capText = (v: unknown, max: number): string | null => {
      if (v == null) return null;
      const s = String(v).trim();
      if (!s) return null;
      return s.slice(0, max);
    };

    const regionsRaw = Array.isArray(body.regions_covered) ? body.regions_covered : [];
    const regions = regionsRaw
      .filter((r) => typeof r === "string")
      .map((r) => (r as string).trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 25);

    const toIntOrNull = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? Math.round(n) : null;
    };

    const { data: inserted, error: insErr } = await sb
      .from("fm_applications")
      .insert({
        company_name:     companyName.slice(0, 200),
        company_website:  capText(body.company_website,  300),
        company_size:     capText(body.company_size,      60),
        business_model:   capText(body.business_model,   300),
        regions_covered:  regions,
        sites_managed:    toIntOrNull(body.sites_managed),
        current_subs:     toIntOrNull(body.current_subs),
        current_software: capText(body.current_software, 300),
        contact_name:     contactName.slice(0, 200),
        contact_role:     capText(body.contact_role,     120),
        contact_email:    contactEmail.slice(0, 200),
        contact_phone:    capText(body.contact_phone,     50),
        why_cadi:         capText(body.why_cadi,        2000),
        status:           "pending",
      })
      .select("id")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    await sb.from("audit_log").insert({
      actor_id: null,
      action:   "fm_application_submitted",
      category: "fm_ops",
      detail:   { application_id: inserted?.id, company_name: companyName, ip: ip === "unknown" ? null : ip },
    }).then(() => {}).catch(() => {});

    return json({ ok: true, id: inserted?.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
