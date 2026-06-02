# Cadi — Tech Stack Cheatsheet
> For Chris. Everything we use, why we use it, and where it lives.

---

## What is Cadi?

**Cadi** (`app.cadi.cleaning`) is a SaaS business management platform for UK cleaning companies. It handles scheduling, invoicing, customers, staff, payments, HMRC tax filing, AI chat agents, and reviews — all in one place.

The repo is called `cleaning-blueprints` (legacy name). The product is Cadi.

---

## The Big Picture

```
Browser (React SPA)
     │
     ▼
Vercel (hosts the built static files)
     │
     ├── Supabase Postgres DB (data)
     ├── Supabase Auth (login / sessions)
     ├── Supabase Edge Functions (serverless API, called directly by the app)
     │         ├── Stripe (billing)
     │         ├── Anthropic Claude API (AI agents)
     │         ├── HMRC MTD API (tax filing)
     │         ├── GoCardless (direct debit)
     │         └── TrueLayer (open banking)
     └── Supabase Realtime (live updates — not heavily used yet)
```

There is **no separate Express/Node backend**. The frontend talks directly to Supabase (for DB + auth) and to Supabase Edge Functions (for anything that needs a secret key or server-side logic).

---

## Frontend

| What | Tech | Why |
|------|------|-----|
| Framework | **React 19** | Everyone knows it; fast; huge ecosystem |
| Build tool | **Vite 8** | Instant HMR in dev; fast production builds |
| Routing | **React Router v7** | De-facto standard SPA router |
| Styling | **Tailwind CSS 3** | Utility classes = no CSS files to maintain; consistent spacing/colour |
| Icons | **Lucide React** | Clean, consistent icon set; tree-shakeable |
| Maps | **React Leaflet** | Free, open-source map tiles for the Route Planner |
| Spreadsheet import | **xlsx** | Parse Excel files for customer imports |

### Key frontend folders

```
src/
  App.jsx           — router: every URL → component mapping lives here
  context/          — global state (Auth, Data, Invoice, Client, Staff)
  hooks/            — reusable logic (usePlan, useAuth, useBusinessId…)
  lib/
    supabase.js     — single Supabase client used everywhere
    db/             — helper query functions (don't write raw SQL in components)
    agentFramework.js — AI agent plumbing
    pricingEngine.js  — pricing calculation logic
  pages/            — one file per route/screen
  components/       — shared UI pieces (layout, cards, modals, etc.)
```

### How state works

| Layer | What lives here |
|-------|----------------|
| `AuthContext` | Logged-in user + profile. Loaded once on app start. |
| `DataContext` | Shared data fetched from Supabase (customers, jobs, etc.) |
| `InvoiceContext` | Invoice draft state |
| `ClientContext` | Client-portal-specific state |
| Local `useState` | Anything that only one component cares about |

---

## Backend — Supabase

Supabase is **our backend**. It gives us:

- **Postgres database** — all data lives here
- **Auth** — email/password signup, JWTs, magic links
- **Row Level Security (RLS)** — every table has policies so users can only see their own data
- **Edge Functions** — TypeScript serverless functions (run on Deno)
- **Realtime** — live DB subscriptions

### Supabase project ID
`cufgozpwbinjhjnkimmn`

### Why Supabase over Firebase / custom Node?
- Postgres is a real database (joins, constraints, migrations)
- RLS means the frontend can query the DB directly without a middleware API
- Edge Functions are co-located with the DB — low latency, shared env vars
- Free tier is generous; scales predictably

---

## Database

All migrations are in `supabase/migrations/` — numbered `001_` → `015_` in order. **Never edit a migration that's already been applied.** Always add a new numbered file.

### Core tables

| Table | What it stores |
|-------|---------------|
| `profiles` | One row per user. Business name, subscription tier, settings. |
| `businesses` | 1-to-1 companion to profiles. Primary FK for all new tables. |
| `customers` | The customer list. Linked to `businesses`. |
| `jobs` | Scheduled/completed cleans. Statuses: `enquiry → quoted → booked → completed`. |
| `job_events` | Append-only event bus. Every action on a job logs here. |
| `leads` | Web chat enquiries (not yet converted to customers). |
| `conversations` + `messages` | Front Desk chat threads. |
| `reviews` | Review requests sent to customers. |
| `agent_actions` | AI agent "proposals" waiting for owner approval. |
| `agent_settings` | Per-business agent config (off / manual / approval / autonomous). |
| `pricing_rules` | How each service is priced (per bedroom, per sqm, flat rate, etc.). |
| `availability_slots` | When crew are available. |
| `webhook_events` | Audit log for incoming Stripe/GoCardless webhooks. |

### The multi-tenancy pattern

Every table that belongs to a business uses `business_id` as its tenant key. There is a DB helper:

```sql
select public.my_business_id()  -- returns the business id for the logged-in user
```

RLS policies on every table look like:

```sql
using (business_id = my_business_id())
```

This means **users can never see another business's data**, even if they write a query that tries.

---

## Hosting & Deployment

| What | Where | Why |
|------|-------|-----|
| Frontend (React app) | **Vercel** | One-command deploys; global CDN; auto-HTTPS |
| Production URL | `app.cadi.cleaning` | Custom domain aliased in Vercel |
| Edge Functions | **Supabase** (Deno Deploy under the hood) | Co-located with DB; no separate server needed |
| Secrets/env vars | Supabase project settings | Never committed to git |

### To deploy a frontend change:
```bash
npm run deploy        # builds + deploys to Vercel + aliases to app.cadi.cleaning
# or step by step:
npm run build         # creates /build folder
vercel deploy --prod  # pushes to Vercel
```

### To deploy an edge function:
```bash
supabase functions deploy <function-name>
# e.g.
supabase functions deploy front-desk-chat
```

---

## Billing — Stripe

Three tiers:

| Tier | Price | Key limits |
|------|-------|-----------|
| Lite | Free | 50 customers, 5 review emails/mo, no AI agents |
| Pro | £39/mo | Unlimited customers, 5 crew, full AI agents |
| Max | £79/mo | Everything, 20 crew, SMS reviews |

**How it works:**
1. Frontend calls edge function `create-checkout` → returns a Stripe Checkout URL
2. User pays on Stripe's hosted page
3. Stripe fires a webhook → edge function `stripe-webhook` → updates `profiles.subscription_tier`
4. `usePlan()` hook reads `subscription_tier` from the profile and gates features

```js
const { tier, isPro, isFeatureEnabled } = usePlan();
if (!isPro) return <UpgradePrompt />;
```

---

## AI — Anthropic Claude

Used for:
- **Front Desk chat** (`front-desk-chat` function) — web chat bot on the cleaner's website
- **Service NLP** (`parse-service-nlp`) — parses natural language service descriptions
- **AI Generate** (`ai-generate`) — generates content, quotes, emails
- **Walkthrough Analysis** (`walkthrough-analysis`) — analyses financial data

Model used: **Claude Haiku** (fast + cheap) for chat; **Sonnet** for deeper analysis.

The API key lives in Supabase secrets: `ANTHROPIC_API_KEY`

---

## External Integrations

| Integration | What it does | Edge Function |
|-------------|-------------|---------------|
| **HMRC MTD** | Submits quarterly VAT/income tax returns | `hmrc-api`, `hmrc-auth` |
| **GoCardless** | Direct debit collection from customers | `gocardless-api`, `gocardless-auth`, `gocardless-webhook` |
| **TrueLayer** | Open banking — read bank transactions | `truelayer-api`, `truelayer-auth` |
| **Stripe** | Subscription billing | `create-checkout`, `stripe-webhook`, `create-portal` |

---

## Subscription Feature Gating

Always use `usePlan()` to gate features — **never hard-code tier checks**:

```jsx
import { usePlan } from '../hooks/usePlan';

function MyFeature() {
  const { isPro, isFeatureEnabled } = usePlan();

  if (!isFeatureEnabled('canUseFrontDesk')) {
    return <UpgradePrompt feature="Front Desk" />;
  }
  // ... rest of component
}
```

Available feature flags: `canChaseInvoices`, `canUseOpenBanking`, `canUseGoCardless`, `canUseTeamMode`, `canUseFrontDesk`, `canUseReviewsAgent`, `canUseOperationsManager`, `canUseSmsReviews`, `crewSeatLimit`, `teamMemberLimit`, `reviewsMonthlyLimit`.

---

## Demo Mode

The app has a demo mode (no real Supabase account needed). It's triggered by:

```js
sessionStorage.setItem('cadi_demo_session', '1')
```

`AuthContext` detects this and injects a fake `DEMO_USER` and `DEMO_PROFILE`. The `/demo` route and demo landing pages use this. **Don't break demo mode** when editing Auth or profile-related code.
