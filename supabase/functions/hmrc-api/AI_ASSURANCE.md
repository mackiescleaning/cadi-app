# AI Assurance — HMRC MTD Integration

Per HMRC's Developer Hub Terms of Use (June 2026 update), where AI tools are
used in the development of MTD-recognised software, developers must apply
appropriate assurance and remain fully accountable for their software's
correctness. This document records the assurance process Cadi applies to all
AI-assisted code in the MTD integration path.

## Scope

Files covered by this assurance regime:

- `supabase/functions/hmrc-api/index.ts` — all HMRC API calls
- `supabase/functions/hmrc-auth/index.ts` — OAuth + token storage
- `supabase/functions/_shared/auditLog.ts` — audit-trail writer
- `supabase/functions/_shared/tokenCrypto.ts` — token encryption (AES-GCM-256)
- `supabase/functions/_shared/rateLimit.ts` — rate limiting
- `src/lib/hmrcFraudHeaders.js` — client-side fraud-prevention header collection
- `src/hooks/useHmrc.js` — UI integration hook
- `src/components/AccountsTab.jsx` — submission UI

## Process

Every change to the files above goes through the following review steps before
being deployed to a production environment.

1. **Specification check.** The change is mapped to a specific clause in
   HMRC's published API documentation (Developer Hub) or the MTD ITSA
   end-to-end service guide. The clause reference is included in the PR
   description or commit message.

2. **Manual review.** A human (the founder, Rhianna Paice) reads the diff
   line-by-line. AI-generated suggestions are accepted only when the reviewer
   can explain *why* each change is correct against the spec — not by
   reference to "the assistant said so."

3. **Sandbox round-trip.** Any change touching an outbound HMRC request is
   re-tested in the HMRC sandbox before production deploy. HMRC's published
   30-day testing-log retention is honoured: production access is requested
   only when sandbox testing has been completed within the prior 30 days.

4. **Fraud-prevention header verification.** Header values are compared
   against the spec at <https://developer.service.hmrc.gov.uk/guides/fraud-prevention/>
   on every release. The `buildFraudHeaders` function in `hmrc-api/index.ts`
   carries inline citations to the spec for each header it emits.

5. **No silent fallbacks.** Legacy plaintext-token fallbacks are gated by
   environment variables that default to OFF. Re-enabling requires an explicit
   change to the deployment environment, captured in audit.

6. **Audit log.** Every HMRC submission, token refresh, and admin action
   writes to `audit_log` via `writeAudit()`. The audit trail is the source of
   truth for "what did our software do" — superseding any AI-generated
   narrative or summary.

## What AI tools are used for

- Suggesting refactors and identifying duplicated code
- Drafting test scenarios from HMRC's published Gov-Test-Scenario tables
- Documenting endpoints (comments, this file)
- Code review feedback on diffs

## What AI tools are NOT used for

- Inventing API endpoints not present in HMRC's documentation
- Choosing API version numbers without consulting the change log
- Generating fraud-prevention header values
- Auto-deploying without human approval

## Evidence trail

Pull requests touching the files in scope are tagged with the relevant HMRC
spec clause and the date of the last sandbox test run. Production access
requests reference this document and the most recent sandbox test log.

— Last reviewed: 2026-06-23
