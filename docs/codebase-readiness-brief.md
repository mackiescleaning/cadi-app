# Task: Codebase Readiness Hardening — Cadi app

## Context
- Work in `cleaning-blueprints/` (the Cadi SaaS app). React 19 + Vite 8 + Supabase.
  GitHub: mackiescleaning/cadi-app. Read CLAUDE.md (auto-loaded) + HANDOFF.md for architecture.
- A full launch **security audit (Tier 0 + Tier 1) is already complete** — see memory
  `project_launch_security_audit.md`. DO NOT redo security work. This task is the runbook's
  separate **"Codebase readiness"** section: maintainability / can-a-new-dev-onboard, NOT security.
- Goal: bring the repo to "a future dev can clone and be productive" standard.

## Current state (verified) + work items, in suggested order
1. **README is wrong** — it's stale Create-React-App boilerplate. Reality: Vite (not CRA);
   `npm start` runs the dev server; build output goes to `/build` (not `/dist`); deploy is
   `npm run deploy` (→ app.cadi.cleaning). Rewrite it: setup, env vars (`.env.example` is now
   correct), run, build, deploy, and a pointer to CLAUDE.md/HANDOFF.md. Quick, high value.
2. **No linter/formatter** — none configured. Add ESLint (React config) + Prettier; wire a
   pre-commit hook (husky + lint-staged) or a CI step. Expect to fix a backlog of warnings.
3. **CI is security-only** — `.github/workflows/security.yml` (gitleaks + npm audit) exists and
   is green. Add a CI job that runs install + lint + `npm run build` (+ tests once they exist)
   and blocks merge on failure.
4. **No tests exist anywhere** — no test runner (App.test.js/setupTests.js are dead CRA
   leftovers; only scripts/test-catalogue.mjs runs). This is the biggest item.
   - Add **Vitest** (integrates with Vite).
   - Start with pure-logic units that cover the "scary paths": `usePlan`/`resolveTier` tier
     gating, `supabase/functions/_shared/entitlements.ts` resolveTier, invoice PDF generation
     (`src/lib/invoicePdf.js`), CustomerImport column/date parsing, webhook signature-verification
     helpers (stripe/gocardless/resend), export-data `scrub()`.
   - RLS / cross-tenant isolation and edge-function auth are integration-level (client talks to
     Supabase directly; edge fns are Deno). Note these were already proven live in the security
     audit; a repeatable integration harness (Supabase local/branch, or Deno tests for edge fns)
     is a stretch goal — scope it, don't force it into Vitest.
5. **Fresh-clone test** — never done. From a clean `git clone`, get it running following the
   README alone, timed (~<60 min target); fix whatever's missing.
6. **TypeScript** — N/A; this is a JS project. The runbook assumes TS. Either accept as-is
   (optionally add JSDoc types) or scope a TS migration as a SEPARATE effort. Don't force it.

## Constraints that will bite (from CLAUDE.md — read it)
- Build output is `/build`, not `/dist` (overridden in vite.config.js; Vercel + deploy.sh rely on it).
- Vite 8 strict rolldown: any file your new code imports that isn't committed will break the
  Vercel build. Ensure everything is git-tracked before pushing.
- Deploy is manual: `npm run deploy` (build + `vercel --prod` + alias app.cadi.cleaning).
- `npm audit` is currently 0 vulnerabilities — keep it clean. `xlsx` is pinned to a SheetJS CDN
  tarball on purpose (no npm fix); don't "fix" it back to the npm version.
- Never run build commands from the workspace root — only inside `cleaning-blueprints/`.
- End commit messages with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Branch/commit/push only when asked; verify changes build before pushing.

## Definition of done
README accurate · ESLint+Prettier enforced · CI runs lint+build (blocks merge) · Vitest set up
with meaningful coverage on the scary paths · fresh-clone test passed · TS decision recorded.
