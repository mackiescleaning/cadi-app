/**
 * supabase/functions/_shared/auditLog.ts
 *
 * Append-only audit trail for sensitive actions. Writes are fire-and-forget —
 * we never want a logging failure to bring down the underlying operation. If
 * the table is unreachable, console.error and move on.
 *
 * Categories:
 *   - 'hmrc'    HMRC MTD submissions, NINO changes, OAuth events
 *   - 'banking' Yapily connect/disconnect, GoCardless events
 *   - 'account' Sign-up, account deletion, plan changes
 *   - 'billing' Stripe events
 *
 * `owner_id` is the business owner the action is FOR (e.g. the user whose
 * tax was submitted). `actor_id` is who DID the action (usually the same,
 * but differs when an accountant submits on a client's behalf).
 */

// deno-lint-ignore no-explicit-any
type Sb = any;

export type AuditEntry = {
  ownerId:   string;
  actorId:   string;
  action:    string;
  category:  "hmrc" | "banking" | "account" | "billing" | "other";
  detail?:   Record<string, unknown>;
};

export async function writeAudit(sb: Sb, req: Request, entry: AuditEntry): Promise<void> {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent") ?? null;
    await sb.from("audit_log").insert({
      owner_id:   entry.ownerId,
      actor_id:   entry.actorId,
      action:     entry.action,
      category:   entry.category,
      detail:     entry.detail ?? {},
      ip,
      user_agent: ua,
    });
  } catch (err) {
    // Never throw — logging mustn't break the calling operation.
    console.error("audit_log write failed:", err);
  }
}
