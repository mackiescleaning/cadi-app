/**
 * supabase/functions/connect-notify-bid/index.ts
 *
 * Sub-side. Sidecar called after a successful client-side placeBid() insert.
 * Emails every member of the FM organisation that owns the listing so they
 * know a new bid arrived in /fm-ops/marketplace.
 *
 * Best-effort: a missed notification doesn't undo the bid; the bid row is
 * authoritative. This function only sends if the caller actually owns the
 * bid row (RLS-equivalent guard) — no spoofing other users into spam waves.
 *
 * POST { listing_id, bid_id }
 *   → { ok, notified }
 *
 * JWT required. Rate-limited 30/min per user.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM")    ?? "Cadi <team@cadi.cleaning>";
const APP_ORIGIN     = Deno.env.get("APP_ORIGIN")     ?? "https://app.cadi.cleaning";

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "unknown");
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
    });
    return res.ok;
  } catch { return false; }
}

// deno-lint-ignore no-explicit-any
async function getUserEmail(sb: any, userId: string): Promise<string | null> {
  try {
    const { data, error } = await sb.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email as string;
  } catch { return null; }
}

function renderBidEmail(opts: {
  bidderName: string;
  bidPrice: number;
  siteName: string;
  marketplaceUrl: string;
}): { subject: string; html: string } {
  const { bidderName, bidPrice, siteName, marketplaceUrl } = opts;
  const amount = `£${bidPrice.toFixed(2)}`;
  return {
    subject: `New bid · ${siteName} · ${amount}`,
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">New bid received</h1>
        <p style="margin:0 0 4px;font-size:14px;color:#475569;"><strong>${siteName}</strong></p>
        <p style="margin:16px 0;font-size:14px;color:#334155;line-height:1.6;"><strong>${bidderName}</strong> bid <strong>${amount}</strong>. Open the marketplace to review the bid, fit score, and contractor profile.</p>
        <p style="margin:24px 0 0;"><a href="${marketplaceUrl}" style="display:inline-block;padding:10px 20px;background:#ea580c;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open marketplace →</a></p>
      </div>
    </body></html>`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const ip = clientIp(req);
    const ua = req.headers.get("user-agent") ?? "";

    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "connect_notify_bid", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as { listing_id?: string; bid_id?: string };
    const { listing_id, bid_id } = body;
    if (!listing_id || !bid_id) return json({ error: "listing_id + bid_id required" }, 400);

    // Verify the bid exists, belongs to this caller, and matches the listing.
    // Anti-spam guard: only the sub who placed the bid can trigger its email.
    const { data: bid, error: bidErr } = await sb
      .from("marketplace_bids")
      .select("id, listing_id, sub_user_id, bid_price")
      .eq("id", bid_id)
      .eq("listing_id", listing_id)
      .eq("sub_user_id", user.id)
      .maybeSingle();
    if (bidErr) return json({ error: bidErr.message }, 500);
    if (!bid)   return json({ error: "Bid not found or not yours" }, 404);

    // Load listing → FM org + site
    const { data: listing, error: lErr } = await sb
      .from("marketplace_listings")
      .select(`
        id, fm_organisation_id,
        visit_spec:visit_specs ( site:sites ( name ) )
      `)
      .eq("id", listing_id)
      .maybeSingle();
    if (lErr || !listing) return json({ error: "Listing not found" }, 404);

    const siteName = listing.visit_spec?.site?.name ?? "a site";
    const fmOrgId  = listing.fm_organisation_id;

    // Bidder display name
    const { data: bidderProfile } = await sb
      .from("profiles")
      .select("business_name, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const bidderName =
      bidderProfile?.business_name ||
      [bidderProfile?.first_name, bidderProfile?.last_name].filter(Boolean).join(" ") ||
      "A contractor";

    // Find every profile linked to this FM org. We don't dedupe by role yet —
    // there's no fm_role column, so the whole team gets notified. When roles
    // arrive, restrict to admins.
    const { data: recipients } = await sb
      .from("profiles")
      .select("id")
      .eq("fm_organisation_id", fmOrgId);

    const marketplaceUrl = `${APP_ORIGIN}/fm-ops/marketplace`;
    const { subject, html } = renderBidEmail({
      bidderName,
      bidPrice: Number(bid.bid_price) || 0,
      siteName,
      marketplaceUrl,
    });

    let notified = 0;
    for (const r of recipients ?? []) {
      const email = await getUserEmail(sb, r.id);
      if (!email) continue;
      const ok = await sendEmail(email, subject, html);
      if (ok) notified++;
    }

    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_bid_notification_sent",
      category: "connect",
      detail:   { listing_id, bid_id, fm_organisation_id: fmOrgId, recipients: recipients?.length ?? 0, notified },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({ ok: true, notified });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
