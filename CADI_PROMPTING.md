# Cadi — How to Use AI to Build Cadi
> The right way to prompt Claude Code (or Claude.ai) to write, edit, and test Cadi features.

---

## The Golden Rule

**Give Claude context it can't figure out itself.**

The AI can read the code — you don't need to explain what a useState hook is. What it can't know without you telling it:
- What the feature is *supposed to do*
- Which existing pattern to follow
- What the business constraint is
- What "done" looks like

---

## How to Run Claude Code on This Project

Claude Code is the AI coding tool used to build Cadi. You're reading this cheatsheet inside it.

```bash
# Open Claude Code from the terminal (in the project directory)
cd ~/cleaning\ business\ blueprints/cleaning-blueprints
claude

# Or open the Claude desktop app and point it at this folder
```

Claude Code has full access to read every file in the project. It can edit files, run commands, and deploy — but it'll always ask before doing anything destructive.

---

## Prompt Templates — Copy & Adapt These

### Adding a new page / screen

```
I want to add a new page called [PageName] at route /[path].

The page should: [describe what it does in 2-3 sentences]

Data it needs:
- [table name]: [what to fetch, any filters]
- [another table if needed]

It should be Pro-gated (or: open to all tiers).

Look at [an existing similar page, e.g. Customers.jsx] as a reference for 
the fetch pattern, loading state, and error handling style.

The user for this feature is: [a cleaner who wants to X]
```

### Adding a new database column / table

```
I need to add [column name] to the [table] table (or: create a new table called [name]).

It stores: [what data, what type — text, bool, int, jsonb, timestamptz]
It's needed for: [the feature it supports]

Write the SQL as a new migration file (016_[feature_name].sql).
Follow the pattern in the existing migrations — add RLS, use my_business_id() for 
the policy, add indexes if I'll be filtering by this column.

Then show me how to query it from the frontend using the Supabase client.
```

### Adding a new edge function

```
I need a new edge function called [name].

It should:
- Accept: [POST/GET], body: { [field]: type, ... }
- Do: [describe the logic — call Stripe/send email/query DB]
- Return: { [field]: type }
- Auth: [needs user JWT / public, no auth needed / webhook signature]

Use ANTHROPIC_API_KEY / STRIPE_SECRET_KEY / [whichever secret] from env.
Use the service role Supabase client for DB writes.

Follow the pattern in front-desk-chat/index.ts for CORS handling and error responses.
```

### Modifying an existing feature

```
In [filename.jsx] (around line [N]), the [feature] currently does [X].

I need it to instead do [Y].

Constraints:
- Don't change [something that must stay the same]
- The data for this comes from [table/hook]
- [Any other important constraint]

Read the file first, then make only the targeted change — don't refactor anything else.
```

### Debugging a bug

```
There's a bug in [page or feature].

What happens: [exact steps to reproduce]
What I expected: [expected behaviour]
What actually happens: [actual behaviour, including any console errors]

Relevant files: [list the files likely involved]

Start by reading those files and the Supabase schema for [table name], 
then tell me what you think is wrong before changing anything.
```

### Wiring a new Supabase edge function into the UI

```
The edge function [function-name] already exists and is deployed.
Its endpoint is POST /functions/v1/[function-name].
It accepts { [fields] } and returns { [fields] }.

Wire it into [ComponentName.jsx]:
- Call it when [user action / event]
- Show a loading state during the call
- Handle errors by [showing a toast / inline message]
- On success, [update state / redirect / show confirmation]

Use supabase.functions.invoke('[function-name]', { body: {...} }) — 
not a raw fetch — since the user is authenticated.
```

---

## Rules Claude Follows When Building Cadi

These are built into how Claude Code works in this project. You don't need to say them every time — but knowing them helps you spot when output is wrong.

**Data pattern:**
- Always use `supabase` (the singleton from `src/lib/supabase.js`) — never create a new client
- Never write raw SQL in components — use Supabase query builder
- Always handle `error` from Supabase responses

**Auth:**
- Use `useAuth()` to get the user — never read from localStorage directly
- Use `ProtectedRoute` for gated pages (it's already wired in App.jsx)
- Use `usePlan()` for feature gating — never hard-code tier strings like `plan === 'pro'`

**Styling:**
- Tailwind utility classes only — no inline styles, no new CSS files
- Follow the card/panel visual pattern from existing pages

**Edge functions:**
- Deno, not Node — use `https://deno.land/std` imports, not npm
- Always include CORS headers + OPTIONS handler
- Never return secrets to the client

**Migrations:**
- Add a new numbered file — never edit an existing migration
- Always include RLS + policy + indexes

---

## What to Tell Claude When Starting a Session

At the start of a new conversation, Claude Code loads your memory files automatically. But for complex features, start with:

```
I'm working on Cadi (the cleaning business SaaS at app.cadi.cleaning).
Supabase project: cufgozpwbinjhjnkimmn
Today I want to: [describe the feature or bug]
```

This anchors it to the right project before you give more detail.

---

## Prompting for Specific Cadi Areas

### Subscription / billing changes

```
I need to change the billing/pricing. Currently:
- Lite: free, [limits]
- Pro: £39/mo, [limits]

I want to: [the change]

Update usePlan.js (the FEATURES object and PRICES object).
If there's a new Stripe price, I'll set STRIPE_MAX_PRICE_ID in Supabase secrets separately.
Also update create-checkout/index.ts if the tier name or logic changes.
```

### AI agent changes (Front Desk / Reviews / etc.)

```
The [agent name] agent lives in supabase/functions/[function-name]/index.ts.
It currently [describe current behaviour].

I need it to [describe new behaviour].

The business's trust_level setting (cautious / balanced / autonomous) should 
affect [how it should change based on trust level, if relevant].
Agent actions the user must approve go into the agent_actions table.
```

### Adding to the scheduler / jobs

```
The jobs table has status: enquiry → quoted → booked → en_route → in_progress → completed → invoiced → reviewed.

I need to add logic for: [describe the status change or new job feature]

Write a job_event to the job_events table whenever the status changes 
(source: 'owner', event_type: '[meaningful name]', payload: { old_status, new_status }).
```

### HMRC / tax / financial features

```
The HMRC integration is in supabase/functions/hmrc-api/index.ts.
It uses OAuth tokens stored in the hmrc_tokens table.
The fraud headers required by HMRC are built in src/lib/hmrcFraudHeaders.js.

I need to: [describe the HMRC change]

Don't change the OAuth flow or the fraud header generation — those are certified.
```

---

## Things That Need Extra Care

### Demo mode
The `/demo` route and demo pages use a fake user (sessionStorage key: `cadi_demo_session`). If you change AuthContext or profile fetching, **always check it doesn't break demo mode**. Tell Claude:

```
Make sure the change works in demo mode too (where user.id === 'demo-user' 
and profile is a hardcoded object in AuthContext).
```

### RLS / security
If you're adding a new table, **always add RLS**. Tell Claude:

```
Add RLS to this table using the my_business_id() helper function, same pattern as jobs or leads.
```

### Migrations on production
The migration files in `supabase/migrations/` have already been applied to the live database. **Never delete or edit them.** Tell Claude:

```
Add this as a new migration (the next number after 015). Don't touch any existing migration files.
```

### Service role key
The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. It should **only be used inside edge functions**, never in frontend code. If Claude ever suggests using it in a React component, flag it and ask for a different approach.

---

## Quick Reference — File to Edit for Common Tasks

| Task | File to edit |
|------|-------------|
| Change what's on a page | `src/pages/[PageName].jsx` |
| Change the sidebar/nav | `src/components/layout/AppLayout.jsx` or `Sidebar.jsx` |
| Change feature gating | `src/hooks/usePlan.js` — FEATURES object |
| Add a route | `src/App.jsx` — Routes section |
| Change auth behaviour | `src/context/AuthContext.jsx` |
| Add global state | `src/context/DataContext.jsx` (or a new context) |
| Add a reusable hook | `src/hooks/useYourHook.js` |
| Add a DB table | New file in `supabase/migrations/` |
| Add an edge function | New folder in `supabase/functions/` |
| Change billing tiers | `src/hooks/usePlan.js` + `supabase/functions/create-checkout/index.ts` |
| Change the AI chat bot | `supabase/functions/front-desk-chat/index.ts` |
| Change HMRC filing | `supabase/functions/hmrc-api/index.ts` |

---

## When Claude Gets It Wrong

If the output looks off, the most common fixes:

1. **It used the wrong pattern** — point it at the file that does it correctly: `"Follow the same approach as Customers.jsx"`

2. **It changed too much** — say: `"Revert everything except [specific thing]. Make only the targeted change."`

3. **It made up a table or column** — say: `"That column doesn't exist. Read the migration files in supabase/migrations/ to see what's actually in the schema."`

4. **It used Node.js imports in an edge function** — say: `"Edge functions run on Deno, not Node. Use https://deno.land/std imports and https://esm.sh for npm packages."`

5. **It hard-coded a subscription check** — say: `"Use isFeatureEnabled() from usePlan() instead of checking the tier string directly."`
