# Accounts Foundation — Build Spec

**Status:** P1 SHIPPED · P2 + P3 BUILT (2026-07-12) · **Owner:** (you) · **Date:** 2026-07-12

> **P1 done:** migrations 095–097 applied to prod (business_tax_profile, chart_of_accounts,
> bank_category_rules, transactions.vat_treatment, seed fn + new-business trigger + backfill).
> All 6 businesses seeded (20-row chart + Starling map + tax profile). `statement-import` reworked
> to read the chart from the DB (deployed) — behaviour verified identical to the old hardcode.
> chris@mackies set to `ltd`.
>
> **P2 built (2026-07-12, uncommitted):** the client now READS the chart — new
> `src/lib/db/accountsDb.js` (chart + tax profile readers, LANE_META, personalNoun) and
> `src/hooks/useAccountsChart.js` (loads chart + tax profile once, exposes byLane/laneOf/
> labelOf/personalLabel). New `src/components/MoneyConfidenceDigest.jsx` renders the visible
> redesign in the Money tab's OpenBankingBanner (replacing the old Business/Personal/Review
> pill summary): a **trust bar** (categorised_by → you / bank / Cadi), the **four lanes**
> (money in · business costs · personal · transfers, personal labelled Drawings vs Director's
> loan per `business_tax_profile.structure`), and an inline **spot-check** (confirm/change
> Cadi's low-confidence guesses via the existing yapily-api categorise path). Prod build
> passes; digest is gated behind a real account with bank/statement transactions so it can't
> render in demo. Committed + pushed on branch `feat/accounts-p2-money-confidence` (also wires
> the Dashboard "Truly yours" hero to the same Drawings/Director's-loan framing).
>
> **P3 built (2026-07-12):** `src/components/AdaptiveAccountsSummary.jsx` — the Layer-2 adaptive
> summary, mounted at the top of the Accounts → Overview tab. Entity-aware, derived from the
> chart + `business_tax_profile`: turnover (useYtdIncome) → allowable costs (useYtdExpenses,
> filtered by chart.is_allowable on the expense lane) → profit → set-aside tax (calcSelfEmployedTax
> for sole traders, calculateCT for Ltd) → personal drawings/director's-loan (personal-lane
> transactions) → VAT flag when registered. "Indicative — your accountant files" disclaimer.
> Renders in demo with coherent demo figures; verified in-browser (arithmetic checked, no console
> errors). Reads `business_tax_profile.structure` (not `business_settings.entity_type`) as the
> entity source of truth. Committed on the same P2 branch.
> **Depends on:** the statement-upload bridge (`statement-import`), the `transactions` table, `yapily-api`.

The goal of this doc is the _foundation_ under the Money → Accounts experience: an
**entity-agnostic categorisation spine** that today powers a strong upload + money-confidence
experience, and later lets us bolt on filing engines (sole-trader MTD, sole-trader
under-threshold, limited company, VAT) **without ever re-categorising history**.

---

## 1. Principle: one foundation, many outputs

Categorisation is universal. Every entity type needs the _same_ first thing — transactions
sorted into lanes with tax meaning. What differs is the **report at the end**.

```
┌─ Layer 1 · SORT ─────────────────────────────┐   entity-agnostic
│ upload → categorise → 4 lanes → confidence    │   BUILD NOW
├─ Layer 2 · SEE ──────────────────────────────┤   entity-adaptive summary
│ profit · tax to set aside · drawings/DL       │   BUILD NOW (thin)
├─ Layer 3 · FILE ─────────────────────────────┤   entity-specific engines
│ MTD ITSA · CT600 pack · VAT returns           │   LATER, one at a time
└───────────────────────────────────────────────┘
```

**Rule:** Layer 3 must be pure add-on. Layers 1–2 capture enough metadata that any engine
can derive its numbers from existing data. The two things expensive to retrofit — **entity
type** and **VAT treatment** — are captured from day one; everything else (SA103 boxes, CT600
lines, VAT boxes) is a _slot_ filled when its engine is built.

---

## 2. Goals / Non-goals

**In scope (now)**

- Promote categories from hardcoded (`EXPENSE_CATS` in client, `BANK_CATEGORY_MAP` in edge) to a
  **per-business, data-driven chart of accounts** with tax/VAT metadata.
- Capture **entity type + VAT status** on the business.
- Make the import engine + Money tab read the chart from the DB.
- Ship the **money-confidence redesign** (digest · four lanes · personal→drawings/DL) on top.
- Layer-2 **adaptive Accounts summary** (no filing).

**Out of scope (deferred — do NOT build now)**

- Any actual submission: MTD ITSA quarterly updates, CT600/iXBRL, VAT return filing.
- Accountant multi-client portal (see §9 — foundation only).
- Chart-of-accounts UI polish beyond a basic editor.

---

## 3. Data model

### 3.1 `business_tax_profile` (1:1 with `businesses`)

Everything that re-frames the same transactions per entity.

```sql
create table public.business_tax_profile (
  business_id       uuid primary key references public.businesses(id) on delete cascade,
  structure         text    not null default 'sole_trader',   -- 'sole_trader'|'ltd'|'partnership'
  -- VAT
  vat_registered    boolean not null default false,
  vat_number        text,
  vat_scheme        text,        -- 'standard'|'flat_rate'|'cash'|null
  vat_flat_rate     numeric,     -- % if flat_rate
  vat_registered_from date,      -- so historical periods before this are non-VAT
  -- tax basis
  accounting_basis  text    not null default 'cash',           -- 'cash'|'accrual'
  fy_start_month    smallint,    -- sole trader = 4 (6 Apr); ltd = company year-end month
  fy_start_day      smallint,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

- `structure` drives Layer 2 labelling: personal spend = **drawings** (sole trader/partnership)
  or **director's loan** (ltd); "income" is measured against the VAT threshold for registration
  nudges.
- `vat_registered_from` matters: a business that registers mid-year must not have VAT applied to
  earlier transactions.

### 3.2 `chart_of_accounts` (per business)

The categories, as data. Accountant-editable (phase 2).

```sql
create table public.chart_of_accounts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  key           text not null,        -- stable slug; == transactions.category (join key)
  label         text not null,        -- display; accountant may rename
  emoji         text,
  color         text,
  lane          text not null,        -- 'income'|'expense'|'personal'|'transfer'  (the 4 lanes)
  is_allowable  boolean,              -- allowable for tax? (expense lane; null for income/transfer)
  vat_treatment text,                 -- 'standard'|'reduced'|'zero'|'exempt'|'outside_scope'|null
  -- filing-engine slots (null until the engine is built)
  sa103_box     text,                 -- sole-trader self-employment box
  ct600_ref     text,                 -- limited-company mapping
  vat_box       text,                 -- VAT return box
  sort_order    int  not null default 100,
  is_system     boolean not null default false,  -- seeded default: key is immutable, cannot delete
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, key)
);
create index chart_business_lane_idx on public.chart_of_accounts (business_id, lane);
```

**Key insight — no transaction migration for the join:** `transactions.category` already stores
the slug (`'fuel'`, `'directors_wages'`, `'personal'`, `'transfer'`, `'income_customer'`, …). So
`chart_of_accounts.key == transactions.category`. Join on `(business_id, key)`. The chart is the
metadata _over_ the value transactions already hold.

### 3.3 `bank_category_rules` (bank-scheme → chart mapping)

The Starling `Spending Category` → chart map, as editable data (replaces the hardcoded
`BANK_CATEGORY_MAP`).

```sql
create table public.bank_category_rules (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  source            text not null,        -- 'starling'|'monzo'|'ofx'|…
  bank_category     text not null,        -- e.g. 'FOOD_AND_DRINK'
  chart_key         text not null,        -- -> chart_of_accounts.key
  created_at        timestamptz not null default now(),
  unique (business_id, source, bank_category)
);
```

### 3.4 `fiscal_periods` (period lock)

```sql
create table public.fiscal_periods (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  status       text not null default 'open',   -- 'open'|'locked'
  locked_at    timestamptz,
  locked_by    uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (business_id, period_start, period_end)
);
```

When a period is `locked`, a trigger blocks category/amount edits on transactions whose
`transaction_date` falls inside it (post-lock changes must be explicit adjustments — a later
enhancement). Locking is compliance-positive (immutable, auditable record-keeping).

### 3.5 Transaction change — the one VAT future-proofer

`transactions` needs **one** new column so VAT can be retrofitted without re-touching rows:

```sql
alter table public.transactions
  add column vat_treatment text;   -- snapshot of the chart's vat_treatment at import time
```

Why snapshot rather than derive later: a category's VAT treatment (or the business's VAT status)
can change over time. Snapshotting at import means a future VAT engine computes net/VAT from
`amount` + `vat_treatment` deterministically, honouring history. Net/VAT amounts themselves stay
**derived** (not stored) until the VAT engine exists — no premature denormalisation.

Everything else the lanes need already exists on `transactions`: `category` (= chart key),
`is_business`, `is_hidden`, `categorised_by`, `matched_invoice_id`.

---

## 4. RLS

All four new tables follow the existing pattern (see CLAUDE.md §Multi-tenancy):

```sql
alter table public.chart_of_accounts enable row level security;
create policy coa_owner on public.chart_of_accounts for all
  using (business_id = my_business_id()) with check (business_id = my_business_id());
-- + membership read/write for the accountant role (phase 2):
create policy coa_member on public.chart_of_accounts for all
  using (is_full_access_member((select owner_user_id from businesses where id = business_id)))
  with check (is_full_access_member((select owner_user_id from businesses where id = business_id)));
```

Repeat for `business_tax_profile`, `bank_category_rules`, `fiscal_periods`. **Tenant isolation is
the #1 risk** once the accountant role exists — every policy scoped, verified (same discipline as
the FM/Connect audit).

---

## 5. Migrations (next number: **095**)

1. `095_business_tax_profile.sql` — table + RLS + seed row for every existing business +
   trigger to create a row when a `businesses` row is inserted (mirror the existing
   profile→business trigger).
2. `096_chart_of_accounts.sql` — table + RLS + **seed defaults for every existing business** +
   new-business trigger. Seed from the canonical default set (§7).
3. `097_bank_category_rules.sql` — table + RLS + seed Starling defaults (from current
   `BANK_CATEGORY_MAP`) for every business + trigger.
4. `098_transactions_vat_treatment.sql` — add column; backfill from chart where possible.
5. `099_fiscal_periods.sql` — table + RLS + lock-enforcement trigger (can ship after Layer-1).

Never edit an applied migration; each new table gets `enable row level security` + policy +
indexes on filter columns.

---

## 6. Import engine changes

`statement-import` (and `yapily-api`) stop hardcoding categories and read the chart.

**Before** (current): hardcoded `BANK_CATEGORY_MAP` + `CATEGORY_RULES`.
**After:**

```
on import, load once per request:
  taxProfile   = business_tax_profile row
  chart        = chart_of_accounts rows for business   (Map by key)
  bankRules    = bank_category_rules for business+source (Map by bank_category)
  merchantRules= merchant_rules for user                (unchanged, still priority 1)

per transaction, resolve category key:
  1. user merchant rule            -> key
  2. bank_category_rules[bankCat]  -> key           (was BANK_CATEGORY_MAP)
  3. regex autoCategory fallback   -> key
then look up chart[key]:
  lane          -> drives is_business / is_hidden:
                     income|expense => is_business = true
                     personal       => is_business = false
                     transfer       => is_business = false, is_hidden = true
  vat_treatment -> snapshot onto transactions.vat_treatment (only if taxProfile.vat_registered
                   and txn date >= vat_registered_from; else null)
  is_allowable  -> available for Layer-2 profit calc (derive at read; no need to store)
```

Reconciliation (invoice matching) is unchanged and still runs for income-lane credits.

Keep a **hardcoded fallback default chart** in the edge function so a business with no seeded
chart (edge case) still imports — but the seed migrations mean this is belt-and-braces.

---

## 7. Canonical default chart (seed data)

Seed every business with this; `is_system = true`. (Derived from today's `EXPENSE_CATS` +
`BANK_CATEGORY_MAP` so behaviour is identical on day one.)

| key             | label             | lane     | allowable | vat_treatment |
| --------------- | ----------------- | -------- | --------- | ------------- |
| income_customer | Customer payment  | income   | —         | standard      |
| income_other    | Other income      | income   | —         | standard      |
| directors_wages | Directors wages   | expense  | yes       | outside_scope |
| staff           | Staff costs       | expense  | yes       | outside_scope |
| vehicle         | Vehicle           | expense  | yes       | standard      |
| fuel            | Fuel & travel     | expense  | yes       | standard      |
| equipment       | Equipment         | expense  | yes       | standard      |
| supplies        | Supplies          | expense  | yes       | standard      |
| insurance       | Insurance         | expense  | yes       | exempt        |
| marketing       | Marketing         | expense  | yes       | standard      |
| phone           | Phone & internet  | expense  | yes       | standard      |
| premises        | Premises          | expense  | yes       | standard      |
| professional    | Professional fees | expense  | yes       | standard      |
| subscriptions   | Subscriptions     | expense  | yes       | standard      |
| bankfees        | Bank & finance    | expense  | yes       | exempt        |
| other           | Other             | expense  | yes       | standard      |
| personal        | Personal          | personal | no        | outside_scope |
| transfer        | Transfer          | transfer | —         | outside_scope |

(VAT treatments are sensible defaults; the accountant tunes per client. E.g. insurance is exempt,
wages outside scope. Cleaning-service income is standard-rated.)

Starling map seed (`bank_category_rules`, source `starling`) = the current `BANK_CATEGORY_MAP`
pairs (FOOD_AND_DRINK→personal, VEHICLES→vehicle, TRANSFERS→transfer, DIRECTORS_WAGES→
directors_wages, …).

---

## 8. Read paths

### 8.1 Money (Layer 1)

- **Four lanes** = group live `transactions` by `chart[category].lane` (income/expense/personal/
  transfer). The Money tab query is unchanged (`is_hidden = false` already drops transfers).
- **Digest** = counts by lane + by `categorised_by` (bank/user/cadi_ai) for the trust bar.
- **Personal label** = `taxProfile.structure` → "drawings" | "director's loan".

### 8.2 Accounts summary (Layer 2 — adaptive, no filing)

Derived, entity-aware, per selected period:

```
turnover        = Σ income lane
allowable costs = Σ expense lane where chart.is_allowable
profit          = turnover − allowable costs
tax to set aside:
  sole_trader   → income-tax bands on profit (+ Class 2/4 NIC)   [rough estimate only]
  ltd           → corporation tax on profit (19%/25% marginal)
personal        = Σ personal lane  → "drawings" (ST) | "director's loan balance" (Ltd)
vat (if registered) = derived from vat_treatment snapshots  [box breakdown deferred to engine]
```

All estimates carry a clear "indicative — your accountant files" disclaimer (compliance §).

---

## 9. Accountant access (phase 2 — foundation only here)

Not built now, but the model is designed so it slots in:

- Reuse the membership layer (`is_full_access_member`) + a new **`accountant`** role.
- Client-authorised invite (invite flows _from_ the client — never accountant self-adding — a
  data-protection requirement).
- RLS `*_member` policies (§4) already grant the linked accountant read/write to chart,
  bank rules, transactions, periods.
- Multi-client portal is a **later** layer built _on top of_ proven single-client isolation.

**Compliance posture** (see prior discussion): Cadi stays the _tool_, the accountant stays the
_filer_ (files via their own HMRC Agent Services Account / their software). This keeps Cadi out of
AML supervision, out of being the filing agent, and out of regulated advice. Required: UK GDPR/DPA
(processor role + DPA per firm + audit logs + least privilege), bulletproof tenant isolation, and
T&Cs that estimates are indicative.

---

## 10. Phased delivery

- **P1 — Chart foundation (this spec's core):** migrations 095–098, import engine reads DB chart,
  seed + backfill. No visible change; behaviour identical, but categories are now data.
- **P2 — Money confidence redesign:** digest, four lanes, personal→drawings/DL, spot-checks
  (reads the chart). _This is the visible win._
- **P3 — Adaptive Accounts summary (Layer 2):** entity-aware profit/tax/drawings view.
- **P4 — Chart editor + entity/VAT onboarding UI:** let the owner (later accountant) edit.
- **P5 — Period lock** (migration 099) + audit surfacing.
- **P6+ — Accountant invite → portal**, then filing engines (ITSA, CT, VAT), each consuming the
  foundation.

Ship P1 invisibly first (de-risks the data move), then P2 for the experience.

---

## 11. Decisions (resolved 2026-07-12)

1. **`business_tax_profile` = new table** (not extending `business_settings`). Keeps tax config
   cohesive and RLS simple. Confirm no field clash with `business_settings` at build time.
2. **No `chart_account_id` FK on transactions.** `transactions.category` (text slug) is the join
   to `chart_of_accounts.key`; keys are immutable (`is_system`; only `label` is editable). This
   removes a migration + backfill. The only case an FK would serve — transactions following a
   **merged/deleted** category — is handled by an explicit, **audited "merge category" operation**
   that rewrites `transactions.category` old-key→new-key in bulk. Reclassification stays explicit
   and logged, which is what an accounting system wants. Build the merge op with the chart editor.
3. **VAT treatment is per-business and time-safe by design.** `vat_treatment` is a column on each
   business's _own_ `chart_of_accounts` rows, so it varies by business and the accountant tunes it
   per client. It's modulated by `business_tax_profile` choices (not registered → ignored;
   flat-rate → different maths, handled by the VAT engine). Time-variance is safe because we
   **snapshot `vat_treatment` onto each transaction at import** and honour `vat_registered_from`;
   changing a category's treatment applies forward, and correcting a past period is a deliberate
   "re-derive period" action (VAT-engine feature), never silent.
4. **Sole-trader income-tax estimate** — reuse existing `useYtdIncome`/`useYtdExpenses` + the MTD
   ITSA work already in the codebase; Ltd corp-tax estimate is new (simple % for now).

---

## 12. Onboarding — train Cadi on the business's history

**Idea:** at onboarding, let the user upload **a few years of bank statements** so Cadi gets the
big picture _and_ learns their business from day one — instead of the categoriser being cold and
"money confidence" taking months of use to earn.

This reuses the _entire_ foundation — it's the same `statement-import` pipeline pointed at a
multi-year backfill, plus a **learn pass** and a **baselines pass**.

### 12.1 What it produces

1. **A learned categoriser.** Walk the historical corpus (already categorised via bank tags +
   chart) and, per merchant, promote the dominant category to a **`merchant_rules`** entry. Result:
   future imports land pre-sorted — "Cadi already knows Screwfix is Equipment and Tesco is
   personal." This is the "training" — it's just seeding rules + refining the chart from history.
2. **Baselines & seasonality** (new derived table `business_baselines`): typical monthly
   income/expense per category, recurring bills (subscriptions/DDs), and seasonal shape (cleaning
   is seasonal). Powers anomaly nudges ("fuel is 40% above your norm") and forecasting.
3. **Big-picture money confidence from day one:** multi-year P&L trend, YoY growth, quiet-month
   cash warnings, opening drawings / director's-loan position.

### 12.2 Flow

```
onboarding → "Want Cadi to learn your business? Upload 1–3 years of statements."
  → drag N files (per-bank, per-year) → same parse + chart categorisation
  → dedup is already safe (date+amount+balance fingerprint handles file overlap)
  → LEARN pass: build merchant_rules from the corpus (dominant category per merchant, min-count threshold)
  → BASELINE pass: compute business_baselines (monthly norms, recurring, seasonality)
  → show the "big picture" digest: "3 years, £X turnover, here's your shape"
```

### 12.3 Build considerations

- **Volume/cap:** 1–3 years can exceed the 5,000-row import cap → accept multiple files, or raise
  the cap for the onboarding path (chunked server-side). Dedup makes re-runs / overlaps safe.
- **Statements vs filed accounts:** _statements_ (bank CSV/OFX) are the high-value, achievable
  input and give transaction-level learning. Parsing _filed accounts / tax-return PDFs_ (summary
  figures for reconciliation/benchmarking) is a **later** add-on — defer.
- **Trust:** the same digest + spot-check UX applies; the learn pass shows "I built 40 rules from
  your history — review them" rather than applying silently.
- **Tier:** this is a strong paid-onboarding hook (Pro), consistent with the open-banking gate.

### 12.4 Where it sits

Insert as **P2.5** in §10 (after the money-confidence redesign, before the accountant portal) —
it's an onboarding surface over the same engine, not a new subsystem.

```

```
