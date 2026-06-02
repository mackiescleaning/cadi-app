# Cadi — Backend Reference Cheatsheet
> How the backend actually works. Supabase, edge functions, DB patterns, auth.

---

## How the Frontend Talks to the Backend

There are **two ways** the React app makes backend calls:

### 1. Direct Supabase queries (most common)
Used for normal CRUD. The DB's Row Level Security enforces that users only ever touch their own data.

```js
import { supabase } from '../lib/supabase';

// Read
const { data, error } = await supabase
  .from('customers')
  .select('*')
  .eq('owner_id', user.id);

// Insert
const { data, error } = await supabase
  .from('customers')
  .insert({ name: 'Jane Smith', email: 'jane@example.com', owner_id: user.id });

// Update
const { data, error } = await supabase
  .from('jobs')
  .update({ status: 'completed' })
  .eq('id', jobId);

// Delete
const { data, error } = await supabase
  .from('jobs')
  .delete()
  .eq('id', jobId);
```

The Supabase client is a **singleton** at `src/lib/supabase.js`. Import it everywhere — never create a second client.

### 2. Edge Function calls (for secrets / server logic)
Used when you need a secret API key (Stripe, Anthropic, HMRC) or need to do something Postgres can't do (send emails, call external APIs).

```js
const { data, error } = await supabase.functions.invoke('create-checkout', {
  body: { tier: 'pro', returnUrl: window.location.href },
});
```

Or with a raw fetch (needed for CORS-open functions like front-desk-chat):

```js
const res = await fetch(`${SUPABASE_URL}/functions/v1/front-desk-chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ business_id: '...', message: 'hi' }),
});
```

---

## Auth — How Login Works

Auth is handled by **Supabase Auth** (JWTs under the hood). The flow:

```
User signs up / logs in
         ↓
supabase.auth.signUp() or signInWithPassword()
         ↓
Supabase issues a JWT (access token + refresh token)
         ↓
AuthContext stores the user + fetches their profile from `profiles` table
         ↓
All subsequent Supabase queries automatically include the JWT in headers
         ↓
Postgres RLS policies check auth.uid() matches the row's owner
```

### The `profiles` table
Every user has one row in `profiles`. It stores everything beyond what Supabase Auth tracks:

```
profiles
  id                  — matches auth.users.id (the user's UUID)
  business_name       — "Mackies Cleaning"
  first_name          — "Rhianna"
  plan                — legacy field: 'free' | 'pro'
  subscription_tier   — canonical: 'lite' | 'pro' | 'max'
  onboarding_complete — bool
  dashboard_tour_complete — bool
  google_review_url   — "https://g.page/r/..."
  trust_level         — 'cautious' | 'balanced' | 'autonomous' (AI agent behaviour)
  timezone            — 'Europe/London'
  country             — 'GB'
  currency            — 'GBP'
```

### Getting the current user in a component

```jsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, profile, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;

  return <div>Hello {profile.first_name}</div>;
}
```

### ProtectedRoute
Every page inside the main app is wrapped by `ProtectedRoute` in App.jsx. If there's no session it redirects to `/login`. You don't need to add your own auth checks inside page components.

---

## Edge Functions — How to Read and Write Them

Edge functions live in `supabase/functions/<name>/index.ts`. They run on Deno (not Node.js).

### Anatomy of an edge function

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1. Read secrets from env (never hard-code these)
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 2. CORS headers (required for browser calls)
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// 3. Helper to return JSON
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// 4. Main handler
serve(async (req) => {
  // Always handle OPTIONS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Create a Supabase client with the SERVICE role (bypasses RLS)
  // Use this to write data that needs to bypass user permissions
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Or create a user-scoped client (respects RLS)
  const authHeader = req.headers.get("Authorization");
  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: authHeader! } },
  });

  const body = await req.json();

  // ... your logic ...

  return json({ success: true });
});
```

### Service role vs anon key — when to use which

| Client type | When to use |
|-------------|------------|
| **Service role** (`SUPABASE_SERVICE_ROLE_KEY`) | Writing system data, webhook handlers, anything that must bypass RLS |
| **User-scoped** (forward the user's JWT) | Reading user data while still enforcing RLS |

**Never expose the service role key to the browser.** It only lives in edge function env vars.

### Deploying an edge function

```bash
supabase functions deploy front-desk-chat

# Deploy all functions at once (careful — runs them all)
supabase functions deploy
```

### Setting secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
# Check what's set (values are hidden):
supabase secrets list
```

---

## Row Level Security (RLS) — the Rules

Every table has RLS enabled. The pattern is always:

```sql
-- The helper function — returns your business_id
create function public.my_business_id()
returns uuid as $$
  select id from public.businesses where owner_user_id = auth.uid() limit 1;
$$ language sql stable security definer;

-- A typical policy
create policy "jobs_owner_all" on public.jobs
  for all
  using (business_id = my_business_id())
  with check (business_id = my_business_id());
```

**What this means:** the Postgres DB automatically filters every query so you only see rows where `business_id` matches your logged-in account. You can't accidentally query someone else's data even if you forget a WHERE clause.

### Tables WITHOUT RLS (service role only)
- `webhook_events` — audit log for incoming webhooks, no user access needed

---

## Adding a New Database Table — Checklist

1. Create a new migration file: `supabase/migrations/016_your_feature.sql`
2. Include in the SQL:
   - `create table if not exists public.your_table (...)`
   - `alter table public.your_table enable row level security;`
   - A policy using `my_business_id()` if it's business-scoped data
   - Indexes for any column you'll filter/order by frequently
3. Apply locally: `supabase db push` (or paste into the Supabase SQL editor)
4. Use the table from the frontend via normal Supabase queries

**Never edit a migration that's already been applied to production.** Always add a new numbered file.

---

## The `businesses` Table — Why It Exists

You'll notice there are two very similar tables: `profiles` and `businesses`. Here's why:

- `profiles.id = auth.users.id` — it's glued to Supabase Auth
- `businesses` is a "clean" table that's the primary FK for all new data tables

When a new user signs up, a trigger automatically creates a `businesses` row:

```sql
-- This trigger fires after a profile is inserted
create trigger on_profile_created_make_business
  after insert on public.profiles
  for each row execute procedure public.handle_new_business();
```

So all new data (jobs, leads, pricing rules, agent actions) links to `businesses.id`, not to `profiles.id` directly. This keeps the auth identity (`profiles`) separate from business data (`businesses`).

---

## Key Edge Functions Reference

| Function | What it does | Needs auth? |
|----------|-------------|-------------|
| `create-checkout` | Creates a Stripe checkout session | Yes (user JWT) |
| `stripe-webhook` | Handles Stripe events, updates subscription tier | No (Stripe signature) |
| `create-portal` | Opens Stripe billing portal | Yes |
| `front-desk-chat` | AI web chat bot (called from widget on client's site) | No (public) |
| `hmrc-api` | Submits HMRC MTD returns | Yes |
| `hmrc-auth` | HMRC OAuth flow | Yes |
| `gocardless-api` | Direct debit API calls | Yes |
| `gocardless-webhook` | GoCardless payment events | No (signature) |
| `truelayer-api` | Open banking read | Yes |
| `send-invoice` | Emails an invoice PDF | Yes |
| `send-review-request` | Emails a review request link | Yes |
| `send-welcome` | Welcome email on signup | No (triggered by DB) |
| `send-invite` | Team member invite email | Yes |
| `parse-service-nlp` | Parses natural language into a service definition | Yes |
| `ai-generate` | General AI content generation | Yes |
| `monthly-report` / `weekly-report` | Generates business reports | Yes |

---

## Common Patterns in the Codebase

### Fetching data in a component

```jsx
const [customers, setCustomers] = useState([]);
const [loading, setLoading] = useState(true);
const { user } = useAuth();

useEffect(() => {
  async function load() {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('owner_id', user.id)
      .order('name');
    setCustomers(data ?? []);
    setLoading(false);
  }
  if (user) load();
}, [user]);
```

### Getting the business_id in a component

```js
import { useBusinessId } from '../hooks/useBusinessId';
const businessId = useBusinessId();
```

### Checking subscription tier

```jsx
import { usePlan } from '../hooks/usePlan';

const { tier, isPro, isMax, isFeatureEnabled } = usePlan();
// tier = 'lite' | 'pro' | 'max'
// isPro = true if pro OR max
// isFeatureEnabled('canUseFrontDesk') = boolean
```

### Error handling pattern

```jsx
const { data, error } = await supabase.from('jobs').insert({...});
if (error) {
  console.error('Failed to create job:', error.message);
  setErrorMessage('Something went wrong. Please try again.');
  return;
}
// proceed with data
```

---

## Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (hot reload)
npm start
# → opens http://localhost:5173

# 3. The app connects to the LIVE Supabase project by default
# (credentials are baked into src/lib/supabase.js)
# So dev changes affect real data — be careful with production users

# 4. Build for production
npm run build
# → outputs to /build

# 5. Deploy
npm run deploy
# → builds + Vercel deploy + aliases to app.cadi.cleaning
```

The app **does not need a local Supabase instance** to develop — it talks to the live project. This means you're testing against real data. Use a test account (not Rhianna's real account) when developing.
