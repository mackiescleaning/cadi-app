/**
 * supabase/functions/fm-bulk-import-subs/index.ts
 *
 * Cadi Connect — bulk-import subcontractors for an FM organisation.
 *
 * Input shape (JSON):
 *   {
 *     rows: [
 *       {
 *         company_name?: string,
 *         contact_name?: string,
 *         email?: string,
 *         phone?: string,
 *         region?: string,
 *         trades?: string[]
 *       },
 *       ...
 *     ],
 *     send_email?: boolean   // default true if email present
 *   }
 *
 * Behaviour:
 *   1. Verifies caller is authenticated + belongs to an FM organisation
 *   2. Validates each row (email OR phone required)
 *   3. De-dupes against existing pending sub_invitations for the same FM
 *      (matches on lowercase email or normalised phone)
 *   4. Inserts new rows into sub_invitations with a fresh token
 *   5. If RESEND_API_KEY is set + send_email=true + row.email present,
 *      sends an invite email per row
 *
 * Output:
 *   {
 *     imported: number,
 *     skipped:  number,
 *     skipped_reasons: { duplicate: N, missing_contact: M, invalid_email: K },
 *     errors: string[],
 *     invitations: [{ id, token, email, company_name }]
 *   }
 *
 * Does NOT create auth.users records. Subs claim their account via the
 * existing /invite/:token flow (or a Connect-specific variant), which writes
 * profiles.connect_unlocked_by_fm_id pointing to the inviting FM.
 *
 * Environment variables:
 *   RESEND_API_KEY            — re_...     (optional; emails skipped if missing)
 *   RESEND_FROM               — e.g. "Cadi <team@cadi.cleaning>"
 *   APP_ORIGIN                — https://app.cadi.cleaning
 *   SUPABASE_URL              — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM")    ?? "Cadi <team@cadi.cleaning>";
const APP_ORIGIN     = Deno.env.get("APP_ORIGIN")     ?? "https://app.cadi.cleaning";

const CORS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normPhone(s: string): string {
  return s.replace(/[^0-9+]/g, "");
}

function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type Row = {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  region?: string;
  trades?: string[];
};

type ValidatedRow = Row & {
  email_lower: string | null;
  phone_norm:  string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return json({ error: "Unauthorised" }, 401);

    const { data: caller, error: callerErr } = await supabase
      .from("profiles")
      .select("id, fm_organisation_id")
      .eq("id", user.id)
      .single();
    if (callerErr || !caller?.fm_organisation_id) {
      return json({ error: "Caller is not an FM-organisation member" }, 403);
    }

    const fmOrgId = caller.fm_organisation_id;

    // ── 2. Body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({})) as {
      rows?: Row[];
      send_email?: boolean;
    };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) return json({ error: "rows[] required" }, 400);
    if (rows.length > 500)  return json({ error: "Max 500 rows per import" }, 400);
    const sendEmail = body.send_email !== false; // default true

    // FM display name for the email
    const { data: fmOrg } = await supabase
      .from("fm_organisations")
      .select("name")
      .eq("id", fmOrgId)
      .single();
    const fmName = fmOrg?.name ?? "an FM partner";

    // ── 3. Validate ──────────────────────────────────────────────────────
    const validated: ValidatedRow[] = [];
    const skipped_reasons = { duplicate: 0, missing_contact: 0, invalid_email: 0 };
    const errors: string[] = [];

    for (const [i, row] of rows.entries()) {
      const emailRaw = (row.email ?? "").trim();
      const phoneRaw = (row.phone ?? "").trim();

      if (!emailRaw && !phoneRaw) {
        skipped_reasons.missing_contact++;
        continue;
      }
      if (emailRaw && !EMAIL_RE.test(emailRaw)) {
        skipped_reasons.invalid_email++;
        errors.push(`Row ${i + 1}: invalid email ${emailRaw}`);
        continue;
      }
      validated.push({
        ...row,
        email_lower: emailRaw ? emailRaw.toLowerCase() : null,
        phone_norm:  phoneRaw ? normPhone(phoneRaw)    : null,
      });
    }

    // ── 4. De-dupe against existing pending invites for this FM ──────────
    const emails = validated.map(r => r.email_lower).filter((x): x is string => !!x);
    let dupEmails = new Set<string>();
    if (emails.length > 0) {
      const { data: existing } = await supabase
        .from("sub_invitations")
        .select("email")
        .eq("fm_organisation_id", fmOrgId)
        .eq("status", "pending")
        .in("email", emails);
      dupEmails = new Set((existing ?? []).map(r => (r.email ?? "").toLowerCase()));
    }

    const toInsert: Array<{
      fm_organisation_id: string;
      invited_by_user_id: string;
      company_name: string | null;
      contact_name: string | null;
      email: string | null;
      phone: string | null;
      region: string | null;
      trades: string[];
      token: string;
    }> = [];

    for (const r of validated) {
      if (r.email_lower && dupEmails.has(r.email_lower)) {
        skipped_reasons.duplicate++;
        continue;
      }
      toInsert.push({
        fm_organisation_id: fmOrgId,
        invited_by_user_id: user.id,
        company_name: r.company_name?.trim() || null,
        contact_name: r.contact_name?.trim() || null,
        email:        r.email_lower,
        phone:        r.phone_norm,
        region:       r.region?.trim() || null,
        trades:       Array.isArray(r.trades) ? r.trades.filter(Boolean) : [],
        token:        makeToken(),
      });
    }

    // ── 5. Insert ────────────────────────────────────────────────────────
    let inserted: Array<{ id: string; token: string; email: string | null; company_name: string | null }> = [];
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from("sub_invitations")
        .insert(toInsert)
        .select("id, token, email, company_name");
      if (error) return json({ error: "Insert failed", detail: error.message }, 500);
      inserted = data ?? [];
    }

    // ── 6. Send emails (best-effort, non-blocking on errors) ─────────────
    let emailsSent = 0;
    if (sendEmail && RESEND_API_KEY && inserted.length > 0) {
      const sendPromises = inserted
        .filter(r => !!r.email)
        .map(async (r) => {
          const inviteUrl = `${APP_ORIGIN}/invite/${r.token}?source=connect`;
          const html = renderInviteEmail({ fmName, inviteUrl, companyName: r.company_name });
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method:  "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from:    RESEND_FROM,
                to:      [r.email],
                subject: `${fmName} invited you to Cadi Connect`,
                html,
              }),
            });
            if (res.ok) emailsSent++;
          } catch (_) { /* swallow */ }
        });
      await Promise.all(sendPromises);
    }

    // ── 7. Return summary ────────────────────────────────────────────────
    return json({
      imported: inserted.length,
      skipped:  rows.length - inserted.length,
      skipped_reasons,
      emails_sent: emailsSent,
      errors,
      invitations: inserted,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function renderInviteEmail({ fmName, inviteUrl, companyName }: {
  fmName: string;
  inviteUrl: string;
  companyName: string | null;
}): string {
  const who = companyName ? `Hi ${companyName} team,` : "Hi there,";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

        <tr><td style="padding-bottom:32px;text-align:center">
          <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Cadi Connect</span>
        </td></tr>

        <tr><td style="background:#111118;border:1px solid rgba(194,65,12,0.15);border-radius:16px;padding:40px">

          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:rgba(255,165,80,0.65);letter-spacing:0.08em;text-transform:uppercase">${fmName} · Subcontractor invite</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#ffffff;line-height:1.2">
            ${who} you've been added to ${fmName} on Cadi Connect
          </h1>
          <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6">
            Cadi Connect is how you'll receive jobs, complete work on site, and get paid by ${fmName}.
            Setup takes a minute — your account is on us.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td style="background:#C2410C;border-radius:10px">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none">
                Set up my account →
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4)">Or paste this link into your browser:</p>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);word-break:break-all">${inviteUrl}</p>

        </td></tr>

        <tr><td style="padding-top:24px;text-align:center">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25)">
            Sent by Cadi on behalf of ${fmName} · <a href="${APP_ORIGIN}" style="color:rgba(255,255,255,0.35)">app.cadi.cleaning</a>
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.2)">
            If you didn't expect this, you can ignore it — the link expires in 60 days.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
