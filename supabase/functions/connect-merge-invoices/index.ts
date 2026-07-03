/**
 * supabase/functions/connect-merge-invoices/index.ts
 *
 * Combine several draft invoices (auto-drafted on approval) into a single
 * multi-line draft invoice ready to submit. Typical use: contractor has
 * 5 approved jobs across the same FM in a billing period and wants to
 * send one bundled invoice covering all of them.
 *
 * Rules enforced:
 *   • All source invoices must belong to the caller (sub_user_id = me)
 *   • All sources must be status='draft'
 *   • All sources must share the same fm_organisation_id (no cross-FM bundling)
 *   • ≥2 sources required (bundling 1 invoice is a no-op)
 *
 * Result: one new draft invoice with all source lines re-pointed to it;
 * the source invoices are flipped to status='void' with a back-reference
 * in their note column so history is preserved.
 *
 * Audit-logged. Rate-limited 30/min/user.
 *
 * POST { source_invoice_ids: string[], reference?: string }
 *   → { ok, invoice_id, line_count, net_value, vat_value }
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
      p_bucket: "connect_merge_invoices", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as {
      source_invoice_ids?: string[]; reference?: string;
    };
    const sourceIds = Array.isArray(body.source_invoice_ids)
      ? body.source_invoice_ids.filter(x => typeof x === "string")
      : [];
    if (sourceIds.length < 2) {
      return json({ error: "Pick at least 2 draft invoices to merge." }, 400);
    }

    // Load all source invoices in one query
    const { data: sources, error: srcErr } = await sb
      .from("connect_invoices")
      .select("id, sub_user_id, fm_organisation_id, status, net_value, vat_value, service_date")
      .in("id", sourceIds);
    if (srcErr) return json({ error: srcErr.message }, 500);
    if (!sources || sources.length !== sourceIds.length) {
      return json({ error: "One or more invoices not found or not visible to you." }, 404);
    }

    // Validate ownership + state + same FM
    const fmIds = new Set<string>();
    for (const s of sources) {
      if (s.sub_user_id !== user.id) return json({ error: "All invoices must be yours." }, 403);
      if (s.status     !== "draft") return json({ error: "All invoices must be drafts." }, 409);
      fmIds.add(s.fm_organisation_id);
    }
    if (fmIds.size > 1) {
      return json({ error: "Pick invoices for a single FM at a time." }, 400);
    }
    const fmOrgId = [...fmIds][0];

    // Sum totals from the source rows (lines will be re-pointed below so we
    // keep the totals authoritative on the new parent up-front).
    const netSum = sources.reduce((s, r) => s + Number(r.net_value ?? 0), 0);
    const vatSum = sources.reduce((s, r) => s + Number(r.vat_value ?? 0), 0);

    // Service date on the parent = most recent source date (loose convention,
    // FM mostly cares about line dates anyway).
    const serviceDate = sources
      .map(s => s.service_date)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    const reference =
      (typeof body.reference === "string" && body.reference.trim())
        ? body.reference.trim().slice(0, 60)
        : `INV-M${Date.now().toString(36).slice(-6).toUpperCase()}`;

    const { data: parent, error: parentErr } = await sb
      .from("connect_invoices")
      .insert({
        sub_user_id:        user.id,
        fm_organisation_id: fmOrgId,
        reference,
        service_date:       serviceDate,
        net_value:          netSum,
        vat_value:          vatSum,
        status:             "draft",
        note:               `Merged from ${sources.length} invoices: ${sources.map(s => s.id.slice(0, 8)).join(", ")}`,
      })
      .select("id")
      .single();
    if (parentErr) return json({ error: parentErr.message }, 500);
    const parentId = parent!.id as string;

    // Re-point all lines from sources to the new parent
    const { error: lineErr } = await sb
      .from("connect_invoice_lines")
      .update({ invoice_id: parentId })
      .in("invoice_id", sourceIds);
    if (lineErr) return json({ error: lineErr.message }, 500);

    // Void sources with a back-reference
    const { error: voidErr } = await sb
      .from("connect_invoices")
      .update({
        status: "void",
        note:   `Merged into invoice ${parentId.slice(0, 8)}`,
      })
      .in("id", sourceIds);
    if (voidErr) return json({ error: voidErr.message }, 500);

    // Count actual lines now on parent
    const { count: lineCount } = await sb
      .from("connect_invoice_lines")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", parentId);

    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_invoices_merged",
      category: "connect",
      detail:   {
        parent_invoice_id: parentId,
        source_invoice_ids: sourceIds,
        fm_organisation_id: fmOrgId,
        net_value: netSum,
      },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok: true,
      invoice_id: parentId,
      line_count: lineCount ?? sources.length,
      net_value:  netSum,
      vat_value:  vatSum,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
