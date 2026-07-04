# TypeScript decision

**Date:** 2026-07-04
**Status:** Decided — stay on JavaScript for the React app. Revisit only if a concrete
pain point (a class of runtime bug TS would have caught) recurs.

## Decision

The Cadi React app (`src/`) stays **plain JavaScript / JSX**. We are **not** adding a
TypeScript build step, a type-checker, or migrating `.jsx` → `.tsx` as part of routine work.

Edge functions under `supabase/functions/` remain **TypeScript** — Deno runs `.ts` natively,
so they already get types for free with no build step. That split stays.

## Why not migrate now

- **No build step to hang it on.** The app is Vite + plain JSX with no `tsc` in the pipeline.
  A migration means introducing `tsconfig.json`, a type-check CI gate, and either `allowJs`
  interop or a big-bang rename of ~280 files. That is a project in its own right, not a
  readiness cleanup.
- **The higher-value readiness gaps were elsewhere.** An accurate README, a real test runner
  on the money/tier/PII paths, ESLint, and CI move the "can a new dev be productive" needle
  much further per hour than a type migration would, and none of them depend on TS.
- **The scary paths are now unit-tested.** Tier gating, invoice/VAT math, import parsers, the
  GDPR scrubber and webhook signature comparison — the places a type error would actually hurt
  — are covered by Vitest. Types would add a second safety net there, but the first net exists.
- **`npm audit` and lockfile hygiene are clean.** Adding the TS toolchain (typescript, ts
  plugins, `@types/*`) enlarges the dependency surface for a benefit we can get incrementally.

## If/when we do reconsider

Reasonable, low-friction on-ramps, in increasing order of commitment:

1. **JSDoc + `checkJs`** — annotate the shared `src/lib/**` helpers with JSDoc `@param`/
   `@returns` and turn on `// @ts-check` per file. Gets editor-level type safety on the
   риskiest pure modules with zero rename and zero build change.
2. **`tsconfig.json` with `allowJs` + `checkJs: false`** — type-check only `.ts`/`.tsx` files
   as they're added, letting new code be TS while old code stays JS.
3. **Incremental `.jsx` → `.tsx`** — migrate leaf components and `src/lib/**` first (they have
   the fewest inbound deps), add a `tsc --noEmit` CI gate once a critical mass is typed.

Treat a full migration as a scoped, separately-planned effort — not something to bolt onto an
unrelated PR. The Vite 8 / Rolldown build is import-graph-strict (see the README build-graph
gotcha), so a migration must land its config and renames atomically to avoid breaking Vercel.

## Related

- Test coverage of the scary paths: `src/test/`, `src/lib/**/*.test.js`.
- Build/deploy constraints: [README](../README.md), [CLAUDE.md](../CLAUDE.md).
