# Cadi

UK cleaning-business SaaS. Production app at **[app.cadi.cleaning](https://app.cadi.cleaning)**.

> The folder is named `cleaning-blueprints` for historical reasons — the product is **Cadi**,
> and the GitHub repo is `mackiescleaning/cadi-app`.

**Stack:** React 19 + Vite 8 (SPA) · Supabase (Postgres + Auth + Edge Functions) · Tailwind CSS.
There is **no Node/Express backend** — the React app talks to Supabase directly for CRUD, and to
Supabase Edge Functions (Deno) for anything that needs a secret (Stripe, Anthropic, HMRC MTD,
GoCardless, TrueLayer/Yapily, Resend).

---

## Prerequisites

- **Node 20+** (CI runs on Node 20; local development is fine on 20–24).
- **npm** (the repo ships a `package-lock.json` — use `npm ci` for reproducible installs).
- A **Supabase project** if you want live data. The repo hard-codes the public anon URL + key as a
  fallback (see [`src/lib/supabase.js`](src/lib/supabase.js)), so `npm start` renders without any
  `.env` — but you'll be pointing at the shared project. Set your own values in `.env` to isolate.
- Optional: the **Supabase CLI** (`brew install supabase/tap/supabase`) — only needed to deploy or
  run edge functions. The frontend does not require it.

## Setup

```bash
git clone git@github.com:mackiescleaning/cadi-app.git
cd cadi-app            # folder is "cleaning-blueprints" in the multi-project workspace
npm ci                 # or: npm install
cp .env.example .env   # then fill in the values below
```

### Environment variables

All client-side vars are **`VITE_`-prefixed** and get **baked into the public browser bundle** — so
only ever put **public** values here. Server secrets live on Supabase Edge Functions
(`supabase secrets set …`), never in this file. See [`.env.example`](.env.example).

| Var                                  | Required | What                                                                   |
| ------------------------------------ | -------- | ---------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                  | yes\*    | Supabase project URL (public)                                          |
| `VITE_SUPABASE_ANON_KEY`             | yes\*    | Supabase anon/publishable key (public by design)                       |
| `VITE_STRIPE_CLIENT_ID`              | no       | Public Stripe Connect client id — only for local payment-connect flows |
| `VITE_GOCARDLESS_PAYMENTS_CLIENT_ID` | no       | Public GoCardless client id — same                                     |

\* The two Supabase vars have a hard-coded public fallback in `src/lib/supabase.js`, so the app boots
without a `.env`. Set them to target your own project instead of the shared one.

## Commands

```bash
npm start              # dev server on http://localhost:3000  (Vite — NOT Create React App)
npm run build          # production build → /build  (NOT /dist — overridden in vite.config.js)
npm run preview        # serve the built bundle on :3000
npm run lint           # ESLint (flat config, eslint.config.mjs) — CI runs this
npm run format         # Prettier — write
npm run format:check   # Prettier — check only
npm test               # Vitest (single run) — CI runs this
npm run test:watch     # Vitest watch mode
npm run test:coverage  # Vitest with V8 coverage
npm run deploy         # build + deploy to Vercel prod + alias app.cadi.cleaning (see deploy.sh)
```

> ⚠️ **Despite the boilerplate history, this is a Vite app, not CRA.** `npm start` runs Vite;
> there is no `npm run eject`. Build output is **`/build`** (Vite's default `dist` is overridden in
> [`vite.config.js`](vite.config.js) because Vercel and `deploy.sh` expect `build/`).

Pre-commit hooks (husky + lint-staged) auto-run ESLint + Prettier on **staged** files, so formatting
stays consistent without reformatting the whole tree.

## Testing

Tests run on **[Vitest](https://vitest.dev/)** (`*.test.js` beside the code under test, plus
[`src/test/`](src/test) for edge-function pure logic). Coverage today targets the high-risk
"scary paths": subscription-tier gating, invoice/VAT math, the customer-import parsers, the GDPR
export scrubber, and webhook signature comparison. Run `npm test`.

There is **no type-checker** (this is a JavaScript project — see [TypeScript](#typescript) below) and
`src/App.test.js` / `src/setupTests.js` are dead CRA leftovers that don't run.

Integration-level concerns (RLS/multi-tenant isolation, edge-function auth) were verified live in the
July 2026 security audit and are **not** covered by Vitest — a repeatable Supabase-local / Deno
integration harness is a tracked stretch goal, not yet built.

## Deployment

```bash
npm run deploy         # runs deploy.sh
```

`deploy.sh` builds, runs `vercel deploy --prod`, then aliases the deployment to
**app.cadi.cleaning**. Deploys are manual and run from **inside this folder only** — never build from
the workspace root.

**Edge functions** (Deno, in `supabase/functions/`) deploy one at a time:

```bash
supabase functions deploy <name>     # e.g. stripe-webhook
supabase secrets list                # inspect configured secrets
```

Supabase project ref: `cufgozpwbinjhjnkimmn`.

### Build-graph gotcha

Vite 8's Rolldown is strict: if new code imports a file that isn't committed to git, the Vercel build
breaks even though it worked locally. **Before pushing, make sure everything your new code imports is
tracked in git.**

## TypeScript

This is a **JavaScript** project by decision — there is no TS build step or type-checker, and none is
planned as part of routine work. Edge functions under `supabase/functions/` are TypeScript (Deno
requires it), but the React app is plain JS/JSX. A full TS migration would be a separate, scoped
effort; see [`docs/typescript-decision.md`](docs/typescript-decision.md).

## Where to read next

The source-of-truth architecture docs live in this folder:

- **[CLAUDE.md](CLAUDE.md)** — the essentials: multi-tenancy/RLS patterns, state contexts, DB query
  helpers, edge-function CORS gotcha, migration rules, subscription tiers. **Read this first.**
- **[HANDOFF.md](HANDOFF.md)** — latest session state and what's live in production.
- **[CADI_STACK.md](CADI_STACK.md)** · **[CADI_BACKEND.md](CADI_BACKEND.md)** ·
  **[CADI_PROMPTING.md](CADI_PROMPTING.md)** — deep dives on stack, backend, and AI prompting.
- **[SMOKE_TEST.md](SMOKE_TEST.md)** — manual smoke-test checklist (no automated e2e yet).

## Repo layout note

This folder is one of four sibling projects in the `cleaning business blueprints` workspace
(the Cadi app, the marketing site, the embeddable widget, Mackies' own site). Each deploys
independently — see the workspace `CLAUDE.md`. **Almost all engineering happens here.**
