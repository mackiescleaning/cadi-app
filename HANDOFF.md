# Cadi Connect — session handoff (2026-06-28)

## What Cadi is

UK cleaning-business SaaS at **app.cadi.cleaning** (prod). Product name is **"Cadi"**, marketplace platform is **"Cadi Connect"** (one brand spanning both FM and sub sides). Project root: `/Users/mackiescleaning/cleaning business blueprints/cleaning-blueprints`. Repo: `mackiescleaning/cadi-app` on GitHub. Deployed to Vercel project `cadi-app` (auto-deploy on push to main).

**Important naming**: Cadi Connect is the WHOLE platform — FM side (running contracts/approvals/accounts) AND sub side (receiving jobs/check-in/invoicing). Do NOT split it into "Cadi for FM" vs "Cadi Connect" (corrected mid-session). Don't use "Britannia" as a placeholder either — they're a real first customer.

## Where we are

Cadi Connect is now **end-to-end functional in production** through this session's work (Phases 4–9):

- **Phases 1–3** (prior sessions): sub-side marketplace, my jobs, check-in/out, invoicing — all live
- **Phase 4** (this session): FM Ops Portal shell + Contractors screen
- **Phase 5**: Contracts (list + 3-step new + detail view with allocation)
- **Phase 6**: Marketplace + award flow (`award-listing` edge function deployed)
- **Phase 7**: Remaining 5 screens — Approval, Accounts inbox, Sites, Schedule, Overview
- **Phase 8**: FM onboarding loop — public application → Cadi-admin review → org creation → invite → claim → portal access
- **Phase 9**: Britannia-style upload-invoice wizard on `/connect/invoice` (4-step: pick draft → simulated OCR → confirm → send)

Plus: stripe-webhook v43 patched with metadata + email fallback (auto-heals orphan customer events going forward).

## Production state

- **Frontend**: latest commit on `main` is `8c41810` (invoice upload wizard). All deployed to `https://app.cadi.cleaning` via Vercel.
- **Database**: Supabase project `cufgozpwbinjhjnkimmn`. Migrations 053–058 applied.
- **Edge functions** (all ACTIVE):
  - Phase 1–3: `connect-invite-lookup`, `connect-invite-accept`, `connect-checkin`, `connect-checkout`, `connect-approve-job`, `connect-submit-invoice`, `connect-export-accounts`, `fm-bulk-import-subs`, `expire-sub-invitations`
  - Phase 6: `award-listing` (v1)
  - Phase 8: `fm-approve-application`, `fm-invite-lookup`, `fm-invite-accept`, `fm-invite-teammate` (all v1)
  - Patched: `stripe-webhook` v43 with metadata + email fallback
- **Bootstrap**: rhianna@mackies.cleaning has `profiles.is_cadi_admin=true` so `/admin/fm-applications` works.

## What's live & working

| Route | What it does |
|---|---|
| `/apply/fm` | Public 3-step FM application form |
| `/admin/fm-applications` | Cadi-admin review queue (gated by `is_cadi_admin`) |
| `/fm-ops/*` | Full FM Ops Portal — Overview · Contracts · Sites · Contractors · Marketplace · Schedule · Work approval · Accounts inbox · Team |
| `/connect/*` | Existing sub-side flow with new upload-wizard on `/connect/invoice` |
| `/invite/:token?source=fm-ops` | FM teammate / admin invite claim flow |

## Schema additions this session

**Migration 057** (`fm_ops_write_policies.sql`) — adds FM-org `*_fm_insert`/`*_fm_update` policies on `end_clients` + `sites` (they only had SELECT before, silently breaking client-side inserts).

**Migration 058** (`fm_applications_and_invitations.sql`) — adds:
- `fm_applications` table (intake + review queue, public INSERT + admin SELECT/UPDATE)
- `fm_invitations` table (token-based join links, FM-org scoped + admin all + claimant own)
- `profiles.is_cadi_admin` boolean flag
- FM-org INSERT/UPDATE policies on `fm_organisations` for admins

## Important context / gotchas

- **CORS preflight gotcha**: Supabase Functions gateway strips `x-client-info` on OPTIONS preflight. `supabase.functions.invoke()` always sends it, so the POST gets `net::ERR_FAILED`. Workaround: call FM/Connect functions with raw `fetch()` + only `Content-Type`/`Authorization`/`apikey`. See `callFmFn()` in `src/lib/db/fmOpsDb.js` and `callConnectFn()` in `src/lib/db/connectDb.js`.
- **All FM-side writes are audit-logged** to `public.audit_log` with `category='fm_ops'` or `'connect'`.
- **RLS pattern for FM-side**: `fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())`. Reuse, don't reinvent.
- **Working-tree-vs-commit chaos** (now resolved): when committing this session's work, ~50+ prior-session files were sitting in working tree, uncommitted but referenced by tracked code. Strict rolldown in vite ^8.0.13 surfaced every transitive missing module. Took 6 commits to get Vercel green. If you write new code that references modules not in git, the build WILL break — always check the import graph from `App.jsx` before pushing.
- **supabase.js fallback restored** (commit `78363c1`): the working-tree version had removed the hardcoded URL+anon fallback, but Vercel doesn't have `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set. Fallback is restored as a stopgap. To remove cleanly: set those env vars in Vercel Project Settings, then drop the fallback in `src/lib/supabase.js`.

## Known gaps / next-up work

### Immediate / blocking real use

1. **FM-side marketing landing page** — there's no public page anywhere that explains Cadi Connect to FMs and links to `/apply/fm`. Without it, no applications come in. Lives at the separate `cadi-website/` repo (alongside the existing `/features.html`).
2. **Real OCR for upload wizard** — currently animated stub. Wire to Mindee, AWS Textract, or Google Document AI via a new edge function `connect-ocr-invoice`. Output replaces the simulated values.
3. **Postcode→distance for fit score** — `getListingWithBids` has `distanceComp = 80` hardcoded TODO. `lib/postcode.js` + `lib/geocode.js` get most of the way.

### Hardening

4. **`delete-account` edge function doesn't cancel Stripe subscriptions** — confirmed root cause of orphan `cus_UPi9rmbr4dAokU` (mackiescleaning@icloud.com had a deleted Cadi account but their Stripe sub was still Active, firing webhooks). Patch: before deleting auth user, list active subs on `profiles.stripe_customer_id` and cancel them.
5. **Listing auto-expiry cron** — when `bid_window_hours` runs out on a `marketplace_listings` row, no one closes it. Add to migration 054's cron set.
6. **Scheduled-visits materialisation** — recurring `visit_specs` don't auto-create `jobs` rows. Currently jobs are only created on award (one-off) or manual FM scheduling. Add a daily cron that materialises the next visit per recurring spec.
7. **Notifications** — sub bids, FM approves, invoice paid — all only hit `audit_log` today. Wire Resend emails for at least: bid received (FM), job approved (sub), invoice paid (sub).

### Open product questions

8. **FM-side billing model** — no Stripe integration for FMs yet. Free during Britannia pilot? Per-site? Per-seat? Tiered? Needs a decision before second FM signs up.
9. **Stripe duplicate-customer cleanup** — the orphan-customer pattern (user goes through Checkout twice, ends up with two Stripe customers) is worth a code fix: `create-checkout` could look up existing customers by email before creating a new one. Rhianna manually deleting test customers in Stripe dashboard for now.

## Most-touched files

- `src/App.jsx` — all `/fm-ops/*`, `/admin/fm-applications`, `/apply/fm` routes
- `src/components/fm-ops/FmOpsLayout.jsx` — sidebar shell, gated by `profile.fm_organisation_id`
- `src/lib/db/fmOpsDb.js` — FM-side data helpers (28 exported names — contracts, listings, approvals, accounts, sites, schedule, overview KPIs)
- `src/lib/db/fmApplyDb.js` — application + invitation helpers
- `src/lib/db/connectDb.js` — sub-side helpers (extended this session with invoice upload pattern)
- `src/pages/fm-ops/Fm*.jsx` — 12 files covering all 8 portal screens + Team + Stub
- `src/pages/FmApply.jsx` — public application form
- `src/pages/AdminFmApplications.jsx` — admin review queue
- `src/pages/InviteAccept.jsx` — extended for `?source=fm-ops` alongside Connect + accountant
- `src/pages/earn/EarnInvoice.jsx` + `EarnInvoiceUploadWizard.jsx` — Phase 9 upload wizard
- `supabase/functions/fm-*` — 4 new edge functions
- `supabase/functions/award-listing/` — marketplace award
- `supabase/functions/stripe-webhook/` — v43 with fallback (source recovered + redeployed)
- `supabase/migrations/057_*` + `058_*`

## Memory files worth reading

In `/Users/mackiescleaning/.claude/projects/-Users-mackiescleaning-cleaning-business-blueprints/memory/`:

- `project_connect_real_build.md` — full phase log (Phases 1–8 + the upload wizard)
- `project_product_identity.md` — "Cadi Connect is one brand" rule + Britannia-is-real
- `project_britannia_connect_rollout.md` — Britannia rollout context
- `project_stripe_billing.md` — pricing tier context

## Where to start the new session

Open question: **the marketing landing page first, or hardening?**

Recommended: **landing page first** — without a front door, the FM application flow gets zero traffic. Lives in the `cadi-website/` repo (separate from cadi-app). One-page describing Cadi Connect for FMs + a "Apply now" CTA → `app.cadi.cleaning/apply/fm`.

After that, in priority order: real OCR → notifications → `delete-account` Stripe cancellation → listing expiry cron → distance fit-score → FM billing decision.
