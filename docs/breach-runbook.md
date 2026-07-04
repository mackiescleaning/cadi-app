# Cadi — Data Breach Runbook

What to do when you suspect personal data has been exposed, altered, or lost.
Cadi holds financial and tax records for UK cleaning businesses (and their
customers and staff), so a breach is squarely in scope for **UK GDPR** and the
**ICO's 72-hour** notification rule. Speed matters: the clock starts when you
become *aware*, not when you finish investigating.

## 0. Roles (fill in real names/numbers before launch)

| Role | Who | Responsibility |
|---|---|---|
| **Incident lead** | _Rhianna (founder)_ | Owns the incident end to end, makes the report/notify call |
| **Technical responder** | _<name>_ | Containment, forensics, Supabase/Stripe/HMRC actions |
| **Comms** | _<name>_ | Drafts messages to affected users; single external voice |

For a solo/small team one person may hold all three — that's fine, but write it
down so there's no hesitation at 2am.

## 1. Detect & record (first 30 minutes)

- Start a timestamped log **now** (a shared doc). Every action + time goes in it.
  The ICO expects a record of the breach and your reasoning even if you don't report.
- Capture: what signal fired (advisor alert, user report, anomalous logs), what
  data/tables/buckets are potentially involved, how many people, when it started.
- Do **not** wipe evidence. Snapshot logs before changing anything (Supabase
  Dashboard → Logs; `get_logs`; Stripe/GoCardless dashboards).

## 2. Contain (Supabase-specific)

Pick what fits the incident — don't do all of it reflexively:

- **Leaked anon key is fine** (public by design). **Leaked `service_role` key is critical** — rotate immediately: Dashboard → Settings → API → roll the service_role key, then update `SUPABASE_SERVICE_ROLE_KEY` on every edge function and redeploy.
- **Compromised user session / account takeover** → force logout: revoke sessions (Dashboard → Authentication → Users → sign out user, or delete/rotate). Reset the affected user's password.
- **RLS hole / data exposed via the API** → the fastest kill switch is to tighten or drop the offending RLS policy (make it deny-all) until fixed. See the audit runbook for the tenancy patterns.
- **Malicious edge-function abuse** → redeploy the function with the call disabled, or rotate the relevant secret (Stripe/GoCardless/HMRC/`EVENT_DISPATCHER_SECRET`) so forged calls fail.
- **Third-party token leak** (Stripe/HMRC/GoCardless/Yapily/TrueLayer) → revoke + rotate at the provider, then update `supabase secrets`.
- **Storage exposure** → flip the bucket to private / rotate any signed-URL secrets.

## 3. Assess — is it reportable? (within hours, not days)

Report to the ICO **unless** the breach is *unlikely to result in a risk to
people's rights and freedoms*. Given Cadi holds financial data, bank details,
tax info (NINO), and customer/staff PII, assume **reportable** unless you can
clearly justify otherwise. Weigh:

- **Data type** — financial/bank/tax/NINO/physical-access-codes = high sensitivity.
- **Volume** — one record vs many businesses.
- **Reversibility** — contained before access? encrypted at rest? (vault codes are pgp-encrypted; tokens are redacted in exports.)
- **Consequence** — fraud, identity theft, financial loss, physical security (key/alarm/gate codes).

Write the conclusion and the reasoning in the log either way.

## 4. Notify

- **ICO — within 72 hours of awareness** if reportable. You can report in phases
  if you don't have all the facts yet — report on time, update later.
  - Report: https://ico.org.uk/for-organisations/report-a-breach/ (or call the ICO helpline).
  - Include: what happened, categories & rough number of people/records, likely
    consequences, measures taken/proposed, your contact details.
- **Affected individuals — without undue delay** if the breach is likely
  **high risk** to them (e.g. bank details / access codes exposed). Tell them
  plainly: what happened, likely impact, what you're doing, what they should do
  (e.g. watch statements, change codes), and a contact point.
- **Payment/data processors** as required by contract (Stripe, GoCardless,
  HMRC, banking providers).

## 5. Recover & review

- Confirm the hole is closed (re-run the relevant audit checks / `get_advisors`).
- Restore from backup if data was lost/altered (**requires Supabase Pro backups + PITR — enable at go-live**; until then there is no restore path — see the audit runbook).
- Post-incident review within a week: root cause, what detection would have
  caught it sooner, follow-up fixes. Add a regression check so it can't recur.

## Key contacts & references

- **ICO breach report:** https://ico.org.uk/for-organisations/report-a-breach/
- **ICO helpline:** 0303 123 1113
- **Supabase project ref:** `cufgozpwbinjhjnkimmn` · org `Mackies Cleaning`
- **Providers to rotate/revoke at:** Supabase, Stripe, GoCardless, HMRC (MTD), Yapily/TrueLayer, Resend
- **Related:** `docs/launch-security-audit.md` (tenancy patterns, kill-switch context)

_Review this runbook at least annually and after any incident. Last updated: 2026-07-04._
