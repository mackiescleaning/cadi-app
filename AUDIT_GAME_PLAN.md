# Cadi Audit & Game Plan — Schedule, Customers, Services

## TL;DR (5 bullets)

- **Three critical data/security bugs must ship-block launch**: (1) drag-to-reorder in Scheduler.jsx:824-839 destroys real `start_hour` times by overwriting with 0.01h micro-increments, corrupting VAT/MTD evidence; (2) hardcoded staff PINs `'1234'/'5678'/'0000'` in Customers.jsx:945-950 ship in the client bundle and "secure" vault data lives in `localStorage`; (3) overlapping RLS policies on `jobs` (003_missing_tables.sql:80 + 007_cadi_foundations.sql:148) OR-combine to widen access; `customers` is owner-only so staff can't see anything.
- **Two "wow" features are vapor**: Rounds "Schedule" button (Scheduler.jsx:2139, 2245-2249) pre-fills a single job with the round name as the customer name; PhotoCapture "Apply AI prices" (PricingCalculator.jsx:428) has a no-op `onClick` returning a function instead of calling it. Both must be wired or hidden before any demo.
- **The product is held back by three god-components**: Scheduler.jsx (2449 LoC), Customers.jsx (2782 LoC), PricingCalculator.jsx (4415 LoC). Splitting unlocks every other roadmap item.
- **The unique moat is the cross-tab graph**: only Cadi owns services × customers × schedule × payroll × route in one schema. Three killer AI features fall out of that — Profitability X-ray, conversational command bar, causal churn/revenue engine. Squeegee/Jobber/ServiceM8 structurally cannot copy them.
- **Migration is the single biggest growth lever and Cadi is 80% there.** Extend CustomerImport.jsx with Jobber/Aworka/ServiceM8 detectors, worded-number frequency parser, credit-suffix balances, single-field address splitter, postcode normaliser, and an "undo last import" rollback by `import_batch_id`. Then add a "photo of price list → service menu" flow nobody else has.

## Critical fixes (security/compliance, blockers) — must-do before launch

| # | Issue | File:line | Severity | Effort |
|---|-------|-----------|----------|--------|
| 1 | Hardcoded PINs in bundle, vault data + audit log in `localStorage` | Customers.jsx:945-1024 | CRITICAL | L |
| 2 | Drag-reorder rewrites `start_hour` with 36-second gaps, corrupting business records | Scheduler.jsx:824-839 | CRITICAL | M |
| 3 | Rounds "Schedule" button pre-fills round name as customer name — promised killer flow is vapor | Scheduler.jsx:2139, 2245-2249 | CRITICAL | XL |
| 4 | Overlapping RLS policies on `jobs` (owner_id OR business_id) widen access | 003_missing_tables.sql:80 vs 007_cadi_foundations.sql:148 | HIGH | S |
| 5 | `customers` RLS gates on `owner_id` only; staff/membership invisible | schema.sql:115-117 | HIGH | L |
| 6 | `team_members` RLS uses `auth.uid()` not `my_business_id()`; breaks Britannia multi-user | 013_autobooking_foundation.sql:52 | HIGH | M |
| 7 | No role separation: staff see every customer's address, price, `private_notes` | 007:75-78, 008:67-68 | HIGH | L |
| 8 | Customer name leaked in URL query string (history, logs, Referer) | Customers.jsx:2420; Scheduler.jsx:2225 | MED | S |
| 9 | Free-text customer notes + private_notes posted to Anthropic with no consent UI, no DPA disclosure | ServiceChat.jsx:212-233, Customers.jsx:389-402 | MED | M |
| 10 | No GDPR Art 17 erasure path — "Remove customer" is a soft archive only | customersDb.js:72-81 | HIGH | L |
| 11 | Import wizard logs full PII rows to `console.error` | CustomerImport.jsx:1335, 1364, 1436 | MED | S |
| 12 | Hardcoded London-centroid postcode fallback writes wrong mileage to HMRC log | RoutePlanner.jsx:51 | MED | M |
| 13 | `mileage_logs` ON DELETE CASCADE wipes HMRC records on staff removal (6-year retention rule) | 003_missing_tables.sql:149 | MED | M |
| 14 | `pending_customers` retention undefined (GDPR Art 5(1)(e)) | 008.sql:152 | LOW | S |

None of these block coding new features; all of them block telling a Britannia-scale customer the product is enterprise-ready.

## Per-tab snapshot

### Schedule

**What's working**
- Five views (Day/Week/Month/Quarter/Rounds), live Supabase sync, demo data, glass UI, count-up revenue strip, drawer/modal flows.
- Crew filter derivation is correctly emitting `__unassigned__` (mapper claim it's dead is wrong — `deriveCrews` at Scheduler.jsx:524-550 emits and sorts it; code-health finding correctly overrides the original tab map).
- `SchedulerPreview.jsx` already implements the marketed swim-lane DayView — the design exists, it's just not wired to the live view.

**What's broken / dead-ends**
- DayView (Scheduler.jsx:744) renders a flat run-sheet but `HourRuler`/`CrewLane`/`JobBlock` (lines 619-663) are defined and unused; marketing copy promises lanes.
- WeekView (Scheduler.jsx:964-971) reads `j.day` that only exists because parent decorates at 2280-2285. Sunday legacy data remaps to col 6.
- `handleRoute` (Scheduler.jsx:797-801) has no origin — Google Maps treats first customer as start; `profile.home_postcode` is ignored.
- Recurrence creates exactly 11 future jobs regardless of cadence (Scheduler.jsx:1776-1788), no `series_id`, uses 30/91-day month/quarter (calendar drift).
- `RoundsView` swallows `listAllRounds` errors and shows demo data on transient network failure (Scheduler.jsx:2066-2070, 2090) — indistinguishable from empty account.
- Mobile search is `hidden md:block` only (Scheduler.jsx:2350); no mobile affordance.
- QuarterView (Scheduler.jsx:1255-1382) is fully read-only; no week drill-down.
- `RoutePlanner.jsx` `getCoords` (line 51) returns London centroid for any postcode outside SW/SE/W/EC/WC/N/NW/E.

**Duplicates to remove**
- `TYPE`/colour constants triplicated: Scheduler.jsx:33-66, SchedulerPreview.jsx:12-37, RoutePlanner.jsx:185-194 → extract to `src/lib/jobTheme.js`.
- DayView + WeekView filter logic verbatim copy: Scheduler.jsx:748-756 vs 954-962 → `applyJobFilters()`.
- Time formatters: Scheduler.jsx:248-260 plus `hourToTime` redefined inside NewJobModal at 1639-1643 → `src/lib/format.js`.
- Modal shells across NewJobModal, AddStopModal, SaveRouteModal → single `<ModalShell>` with Esc + overlay-click dismiss (all three currently lack both).

**UX wow opportunities**
1. Multi-lane DayView restored from `SchedulerPreview` when >1 crew; swipeable lane stack on mobile.
2. Empty Day as a celebration: "Fancy a day off, or shall we... [See demo round / Import from CleanerPlanner / Add one-off]" — borrow Rounds tab's energy (2094-2101).
3. End-of-day full-bleed celebration when `done===total`: animated £ total, miles, "Invoice all £X" CTA, one-time confetti.
4. Weather overlay on Week header + per-job rain warning on exterior jobs via Met Office DataHub (free tier) — the screenshot moment for marketing.
5. Drive-time grey gap blocks between jobs, red-edge pulse on overdue Rounds customers, clock badge on hard-deadline jobs.
6. Context-aware single drawer button ("Start job ▶" → "Mark complete ✓") + swipe-right complete on cards (727-739 already has a Done button to promote).

**AI features to add** (in priority order)
- Conflict & risk detector (Haiku, passive amber chip): weather × holiday × overlap × customer notes. Killer because no competitor cross-checks all four.
- Smart recurrence inference on job-create (Haiku): "Looks like 4-weekly — apply?" — removes #1 data-entry mistake.
- Voice/text quick-add (Haiku): "Add Mrs Henderson 2pm Friday £35" → confirmed card.
- NL schedule editor (Sonnet): "shift Friday by 30 min, swap Jake/Mel after 1pm" — JSON patch with diff preview.
- Auto-fill empty slots from Rounds backlog (Sonnet).
- Route-optimised re-sequencer (OR-tools deterministic + Sonnet narration) respecting customer access windows — Jobber's bolt-on doesn't.
- Weekly crew pre-brief via cron 18:00 (Haiku).
- Revenue gap analyser on Quarter view (Sonnet).

**Migration easing**
- Build a `recurring_jobs` table FIRST (currently jobs are flat — there is nowhere to store an RRULE). Store `{customer_id, frequency_weeks, next_due_date, last_done_date, schedule_policy: 'original'|'completion', rrule?}` and project visit instances on demand. Without this every import fans into N concrete dates and loses the rule.
- Per-customer `schedule_policy` setting; at import time ask which the old system used (Squeegee = completion; Aworka = completion; CP = configurable). This alone prevents the "wrong day on a 4-weekly" silent breakage.
- Vendor preset dropdown (Squeegee / Aworka / CP / Jobber / ServiceM8 / Other) with known column-header maps.

### Customers

**What's working**
- Density-aware rendering, status/segment/type filters, urgency scoring, suggestion engine, GoCardless wiring, import wizard with confetti, message templates + Claude personalisation, surveys integration.

**What's broken / dead-ends**
- "Call" button (Customers.jsx:1761-1763) and "Add note" (1764-1766) have no `onClick`.
- "Customer portal" appears in two places: badge at 1518-1527 ("Coming soon", no link) and dot at 706-708 ("Portal ready" — actively misleading).
- Hardcoded VAULT_STAFF PINs (945-950); vault data + access log in `localStorage` only (965-976, 1014).
- All three customer-detail effects (1330-1382) swallow errors with `.catch(() => {})`; `surveysLoaded` flag never resets (2317-2334) so survey strip goes stale.
- `handleStartSurvey` uses native `alert()` (1342).
- `gcSuccess` banner sticks across customer navigation (1410-1445).
- `generateAIMessage` (401-405) assumes `data.content[0].text` without validation — silent empty replace.
- StarRating in header (1483-1485) is a tap-trap with no label, no undo.
- Hover-only archive button (573-585, 639-651, 713-725) is invisible on touch devices.
- Suggestions can never be dismissed (52-193 regenerates every render).

**Duplicates to remove**
- Archive confirm UI triplicated across density modes (573-585, 639-651, 713-725) → `<ArchiveAffordance size>`.
- GlassCard background+grid texture inlined in MessageComposer (787-802), AddCustomerModal (2117-2131), CustomerImport ModalShell (408-418) → promote `GlassCard` + `ModalShell` to `src/components/ui/`.
- Static templates (195-231) and AI generator (384-406) live in separate worlds; unify in a single `messageTypes` config.
- `py-2.5 rounded-xl border` button class repeated 30+ times → `<Button variant>`.

**UX wow opportunities**
1. Default sort = `urgent` if any urgent suggestion exists (Customers.jsx:2309); save last choice.
2. Surface the highest-£ suggestion on every list row (replaces "Portal ready"); dashboard banner "£840 in suggested upsells across 12 customers".
3. Postcode → address lookup (getaddress.io / ideal-postcodes) at top of AddCustomerModal (2208-2230).
4. Source field → dropdown + custom (2259-2263), then unlock a marketing-source stat in the header strip.
5. "Near today's jobs" filter using jobs + customer postcode prefix — message: "I'm in SW4 tomorrow — want me to pop in for the windows?" The viral feature.
6. Demo-data seed button on empty state (2658-2679) — DEMO_CUSTOMERS array lives at 234-381 ready to resurrect.
7. After import, auto-jump to `sortBy='urgent'` so the highest-value customer is the first thing seen (currently lands on an undifferentiated list).
8. Vault redesign: one PIN unlocks today's stops in order; per-staff identity ("Who's looking?") before keypad.

**AI features to add**
- NL search/filter (Haiku): "lapsed residentials in BS7 worth >£500".
- Churn prediction + reasoning (Sonnet nightly batch) reading free-text notes; new cols `customers.churn_score / churn_reason / churn_scored_at`.
- Smart dedupe/merge in import wizard step 3 (Haiku).
- Auto column-mapping for unknown CSVs (Haiku).
- Conversational customer creation (Sonnet, mirrors ServiceChat).
- Per-customer upsell briefing joined to user's own Services catalogue (Sonnet).
- Notes summariser cached on `customers.ai_summary`, refreshed debounced on note save (Haiku).
- Win-back batch grouped by lapse-cause (Sonnet).
- Vault entry parsed from pasted text / photo of welcome pack (Sonnet vision).

**Migration easing** — extends CustomerImport.jsx
- Add detectors: Jobber (`First Name + Last Name + Street 1`), Aworka (`Customer + Round + Next Due` without `Cust Ref`), ServiceM8 (`Client UUID` or concatenated address), Squeegee (`All jobs.csv` filename or `Services + Frequency + Cost`).
- Extend `KEYWORD_MAP`: `first name / last name / company name / street 1 / street 2 / city / state / zip / site name / manager name`.
- `parseFrequencyDays`: add worded numbers (one/two/four/six/eight), `\d+\s*wk` abbrev, `every X weeks` prefix, `adhoc / on request → null + note`.
- `parseCurrency`: handle `12.50 CR` (credit suffix) and `(12.50)` (bracketed negative) with sign flip.
- `normalisePostcode()`: uppercase + insert space before last 3 chars.
- `splitConcatenatedAddress()`: regex on UK postcode to split single-field addresses (ServiceM8, QuickBooks).
- Widen dedupe to `email OR (nameLower + postcodeLower)`.
- "Skip jobs not done in 12 months" checkbox on Preview (Squeegee dead-job bug).
- `import_batch_id` on every created row + "Roll back this import" button for 7 days.
- Post-import GDPR card: pre-filled email to old vendor's support requesting deletion.

### Services

**What's working**
- Six pricing methods, frequency flags, inclusions/exclusions, ServiceChat conversational builder (Haiku-ready parsers), catalogue picker, first-setup seeding from onboarding, Front Desk preview.

**What's broken / dead-ends**
- `openAdd` (Services.jsx:1152) always opens ChatSession — catalogue picker only reachable via "Use form instead" inside chat (1393).
- "Profit margin tracking — unlock with Pro" tease (1021-1024) — there is no Pro tier (memory: single £29/mo).
- Delete has no Undo despite irreversible warning (1199-1212, 898-919).
- PricingCalculator.jsx:273-278: `analysePhoto` throws permanently ("AI photo analysis coming soon").
- PricingCalculator.jsx:428: PhotoCapture "Apply AI prices" returns a function instead of calling it — even if AI worked, nothing happens.
- PricingConversation.jsx:327-332, 364: archive update + addons insert errors silently swallowed → can produce two active rules for same service.
- Three frequency vocabularies cannot reconcile at the DB level: services booleans (`frequency_one_off/weekly/fortnightly/monthly/quarterly/annually`) vs `pricing_rules.frequency_modifiers` (`one_off/weekly/fortnightly/four_weekly/monthly`). A `four_weekly` modifier has no matching service flag; a `quarterly` service has no matching modifier.

**Duplicates to remove**
- Service catalogue duplicated 4×: Services.jsx:23-42, PricingConversation.jsx:8-31, PricingSandbox.jsx:6-29 (literal copy-paste of `ALL_SERVICES`), PricingSettings.jsx:15-44. Extract `src/lib/catalogue.js`.
- Pricing method vocabulary 3× with mismatched keys (per_size vs per_bedroom etc.) → `src/lib/pricingMethods.js`.
- PricingCalculator.jsx Residential/Commercial/Exterior tabs each re-implement the same saved-quotes / customer search / target-margin state (3× 10-15 useStates) → `usePricingTab()` hook.
- localStorage flags `cadi_services_visited`/`cadi_services_chat_opened` (1121, 1145-1149) not user-scoped — break husband-wife shared device.

**UX wow opportunities**
1. Split-button "Chat / Pick from list" on header instead of forcing chat first.
2. Sub-industry template packs (Domestic / Airbnb / Window / Carpet / Office / Post-construction) one-tap-installs 3-5 pre-priced services. Housecall Pro does this for trades; nobody does it for UK cleaning with native fields.
3. **Photo-of-price-list → menu** via Sonnet vision (single new edge fn `extract-service-menu` handling photo + paste + URL + PDF). Marketing leader for `/features` page.
4. Bulk operations: "Raise all prices X%", duplicate-across-category, CSV round-trip, click-to-edit price inline.
5. Per-frequency multiplier in size matrix (Services.jsx:736-760) — Front Desk currently quotes one-offs at recurring prices, losing margin.
6. Replace inclusions/exclusions textareas (701-718) with chip editor — solves the comma-joining bug from ServiceChat parseIncEx.
7. After first priced service saved, auto-show 2-line Front Desk peek simulating a customer quote.

**AI features to add**
- Market-rate pricing intelligence (Sonnet + optional WebSearch) keyed on postcode + service.
- Conversational bulk pricing review ("raise exteriors 5% and draft customer email", Sonnet).
- Auto-build menu from URL / PDF / photo (Sonnet vision + WebFetch).
- Service description rewriter "Polish for Front Desk" (Haiku).
- Service health monitor nightly digest (Haiku checks + Sonnet narrative).
- Quote-to-service feedback loop: cluster custom quotes from Calculator/Front Desk, propose new services (Sonnet).
- Frequency optimiser (Sonnet) — fortnightly → weekly upsell with personalised scripts.
- Profitability X-ray per service (Sonnet, see cross-tab).

**Migration easing**
- "Snap a photo of your current price list" as the lead onboarding option for switchers from Squeegee (no menu at all) and Cleaner Planner (per-customer pricing).
- Coming-from-Squeegee lane: "You probably price each customer individually — let's capture your typical rates so Front Desk can quote enquiries" → straight into chat.

## Cross-tab AI strategy

### Killer features (the 3 competitors can't copy)

1. **Profitability X-ray.** Nightly Sonnet batch joins `services × jobs × payroll × customers × mileage_logs`. Outputs per-service margin, per-customer margin, per-crew daily P&L with prose ("Tuesday domestic round loses £4.20/hr once travel + Sarah's NI-loaded wage are factored"). Surfaced as red/amber chips on Service cards + customer detail + Quarter-view causal insight. Squeegee/Jobber/ServiceM8 cannot compute this because they don't own payroll + route + service catalogue in one schema.

2. **Conversational operations bar** (see spec below). Requires unified entity resolution across customers, services, schedule, staff. Reuses ServiceChat parser scaffold, so it feels native.

3. **Causal revenue + churn engine.** Joins free-text customer notes with cancellations, weather, staff holiday, payroll cost. Sonnet reads notes (rules engines can't) and explains week-on-week deltas. New columns: `customers.churn_score/reason/scored_at`. Drives auto-grouped win-back batches.

### Cadi command bar spec

- Single pinned input ("Ask Cadi…") + mic. Optional `Cmd-K`.
- **Step 1 (Haiku, ~200 tokens):** classify intent into ~10 verbs (`schedule.edit / schedule.fill / schedule.optimise / customer.find / customer.add / customer.message / service.price / service.add / service.bundle / insight.explain`); extract entity strings.
- **Step 2:** resolve entities locally against snapshot maps (customers by fuzzy name + postcode, services by name, staff by first name). No round-trip if confidence > 0.85.
- **Step 3:** Sonnet for multi-constraint verbs (`schedule.edit/optimise/explain/price`); Haiku for parse-only (`add/find/message-draft`). Output: `{intent, entities, patch, clarifyingQ?, confidence}`.
- **Step 4:** verb-specific diff modal (`ScheduleDiffModal / CustomerDiffModal / ServiceDiffModal / InsightCard / MessageReviewTable`). Never a blind write.
- **Step 5:** Apply runs existing mutation paths (`updateJob`, `addCustomer`, `updateService`) inside a transaction; failure rolls back and re-prompts.
- Confidence < 0.7 → clarifying question instead of patch.
- Telemetry: `{intent, confidence, applied, edited_before_apply}` to tune prompts.
- Cost ceiling: blended < £4.50/user/month on £29 tier (~15% of ARPU), hard cap £6.

## Security & compliance punch list (severity-ranked)

| Rank | Item | Action |
|------|------|--------|
| 1 | Vault PINs in client bundle; data in localStorage | Server-side `verify_vault_pin` edge fn returning short-lived token; vault data in `customer_vault` table with business-scoped RLS; tamper-proof access log |
| 2 | Overlapping RLS on `jobs` (003 vs 007) | Audit `pg_policies`; drop `jobs_owner_all`; add migration documenting canonical model |
| 3 | `customers` RLS owner_id only | Switch to `business_id = my_business_id()`; split SELECT (`customers_business_full` for owner, restricted view for staff role) |
| 4 | `team_members` uses `auth.uid()` directly | Migrate to `my_business_id()` + `WITH CHECK`; expose `team_members_public` view excluding email/phone for non-owner roles |
| 5 | No role separation (`private_notes`, prices visible to any business member) | Add `business_members(user_id, business_id, role)`; column-level grants or separate `services_private` table |
| 6 | No GDPR Art 17 hard delete | Hard-delete RPC + cascade or anonymise; per-customer "Export & forget" returning JSON |
| 7 | `mileage_logs` cascade on `auth.users` delete | Change to `SET NULL`; add `driver_user_id`; switch to `business_id` model (HMRC 6-year retention) |
| 8 | Customer PII in URL query strings | Pass via `navigate(path, { state })`; clear param on mount |
| 9 | AI prompts include `notes`/`private_notes` without DPA disclosure | Strip `private_notes` before send; one-time disclosure modal; sub-processor list published; per-business AI toggle |
| 10 | Console.error logs full PII rows on import failure | Log row index + error message only; hash email if needed |
| 11 | Google Maps URLs leak postcodes + Referer | `rel="noopener noreferrer"` + `referrerPolicy="no-referrer"`; document Google as sub-processor; OS/HERE EU alternative |
| 12 | London-centroid postcode fallback writes wrong HMRC mileage | postcodes.io lookup; refuse to log on fallback |
| 13 | No audit trail of customer/job access | `access_log` via trigger or app-layer; required for Britannia insider-misuse detection |
| 14 | `pending_customers` retention undefined | Scheduled purge after 90 days; disclosed in upgrade modal |
| 15 | No CSV-injection guard on future exports | Prefix `= + - @` with `'` on export |

ESLint: enforce `react/no-danger` (clean today, lock it).

## Code-quality punch list (refactors, prioritised)

1. **Split the three god-components** (do this before any new feature):
   - `src/pages/scheduler/` with `views/`, `components/`, `lib/` (Scheduler.jsx 2449 → root <400).
   - `src/pages/customers/` with per-tab files + `ui/`, `suggestions.js`, `messageTemplates.js` (Customers.jsx 2782 → <400).
   - `src/components/pricing-calculator/` with `ResidentialTab/CommercialTab/ExteriorTab` + `usePricingTab` + `profitEngine.js` (PricingCalculator.jsx 4415, 2-3 day refactor).
   - Services.jsx (1406) split: `ServiceModal/ServiceCard/DeleteModal/Toast` + `lib/services/constants.js`.
2. **Single sources of truth**: `src/lib/jobTheme.js`, `src/lib/format.js`, `src/lib/catalogue.js`, `src/lib/pricingMethods.js`, `src/lib/frequencies.js`. Migration to reconcile `services.frequency_*` booleans vs `pricing_rules.frequency_modifiers` keys (this is the data-model fracture blocking quote accuracy).
3. **One `<ModalShell>`** with role=dialog, aria-modal, Esc, focus-trap, overlay-dismiss. Replaces NewJobModal/AddStopModal/SaveRouteModal/MessageComposer/AddCustomerModal/CustomerImport ModalShell. Fixes accessibility across the board.
4. **One `<UndoToast>`** with `role="status"`, `aria-live="polite"`, pause-on-hover, close button. Wire to Services delete, Customer archive, Job delete with soft-delete + `deleted_at` column.
5. **`useCustomerDetailData(customerId, isCommercial)`** hook consolidates 3 racing useEffects (Customers.jsx:1330-1382) into one query; install `@tanstack/react-query` for the next wave.
6. **Replace flat `jobs.start_hour`-as-sort with `display_order` int column.** Stops drag-reorder corrupting real times (Scheduler.jsx:824-839).
7. **Recurring jobs as a rule**: new `recurring_jobs` table + visit-generator. Removes the 11-occurrence hard-cap, 30/91-day calendar drift, and lack of `series_id`.
8. **Extract & unit-test parsers**: `src/lib/services/chatParsers.js` (parsePricing/parseDuration/parseIncEx/parseFrequency). These are the highest bug-risk code; zero tests today.
9. **Stop swallowing errors**: replace all `.catch(() => {})` and `} catch {` with `} catch (err) { console.error('[Tag] op failed', err); setError(err?.message); }`. Centralise via `reportError(action, e)` for future Sentry/PostHog.
10. **Stabilise `isLive`** in AuthContext (Scheduler treats demo-user as not-live; RoutePlanner treats it as live and would write real Supabase rows under demo creds).
11. **Lift `team_members` fetch into DataContext** (Scheduler.jsx:1653-1669 re-fetches on every modal open, silently).
12. **Scope localStorage flags by `user.id`** or move to `profiles.setup_data`.

## Phased roadmap

### Week 1 (must-fix)
- Fix drag-to-reorder corrupting `start_hour` → add `display_order` column.
- Hide vault PIN feature behind "this device only" label until server-side rebuild ships; remove hardcoded PINs from source even if temporarily disabled.
- Drop overlapping `jobs_owner_all` policy; audit `pg_policies`.
- Wire dead buttons: Call (`tel:`), Add note (inline composer), or hide them.
- Remove "Coming soon" portal teaser + "Portal ready" dot from list rows.
- Hide PhotoCapture entirely or `disabled` the file input (PricingCalculator.jsx:428 + analysePhoto throw).
- Remove "unlock with Pro" tease on Service cards.
- Rename Rounds "Schedule" → "New job from round" until real batch flow ships (Scheduler.jsx:2139).
- Fix WeekView to derive day-of-week from `j.date` internally.
- Add `referrerPolicy="no-referrer"` to all Google Maps links.
- Stop logging PII rows in CustomerImport `console.error`.
- Pass customer name via router state, not query string.

### Week 2-3 (uplevel wow)
- Split god-components; extract shared `<ModalShell>`, `<UndoToast>`, `<Button>`, `jobTheme.js`.
- Real Rounds → batch job creation modal (XL but unblocks the killer demo).
- Add KeyboardSensor + focus rings + aria-labels across Scheduler, Customers, Services.
- Empty-state redesigns (Day, Customers, Services).
- Default sort `urgent` on Customers; surface highest-£ suggestion on every row.
- Mobile search affordance on Scheduler.
- Postcode → address lookup in AddCustomerModal.
- Sub-industry template packs in Services catalogue.
- Migration extensions: Jobber/Aworka/ServiceM8 detectors, worded-number frequency parser, credit-suffix balances, postcode normaliser, single-field address splitter, `import_batch_id` + rollback.
- Build `recurring_jobs` table + visit generator; back-fill `series_id` on existing recurring sets.
- Server-side `verify_vault_pin` + DB-backed vault with tamper-proof audit log.
- Role-aware RLS (`business_members(role)` + per-action policies).

### Month 2 (AI killer features)
- Phase-1 Haiku set: conflict/risk detector, recurrence inference, voice quick-add, CSV column auto-map, notes summariser, EoD wrap-up, description rewriter, service health monitor, crew pre-brief.
- Photo-of-price-list → menu (`extract-service-menu` Sonnet vision edge fn, also handles URL + paste + PDF).
- Cadi command bar v1 (intent router + 3 diff modals: Schedule, Customer, Service).
- Weather overlay on Scheduler.
- NL customer search/filter; conversational customer creation.
- Smart dedupe/merge in import wizard step 3.

### Month 3+ (competitive moats)
- Profitability X-ray (cross services × payroll × route × customers, nightly Sonnet).
- Causal churn + revenue engine (`churn_score`, `churn_reason`).
- Route-optimised re-sequencer with access-window respect (OR-tools + Sonnet narration).
- Frequency optimiser, win-back batch grouped by lapse-cause, market-rate pricing intelligence, service-menu gap detector from lost leads.
- Customer-side reschedule negotiator (auto-reply drafts).
- A/B testing for service descriptions on Front Desk.
- Vault re-imagined as "today's access" panel (cross-feature with Scheduler).
- "Near today's jobs" customer filter — the viral feature.

## Open questions for the founder

1. **Pro tier or single tier?** Memory says £29 single tier, but Services.jsx:1021-1024 ships a "unlock with Pro" tease and `usePlan` references `isPro`. Decide and prune.
2. **Recurrence model commitment.** Will you accept materialising a `recurring_jobs` rule table now (right answer for Britannia + migrations)? It's a 1-week DB + generator job that unblocks every migration, scheduling, and AI feature downstream.
3. **Vault scope.** Per-device "quick reference" vs full enterprise-grade keysafe with per-staff identity? The honest first step is relabelling and a server-side rebuild — but if Britannia needs full identity/audit on day one, scope changes to L+.
4. **Multi-tenant role model.** Is the canonical model `businesses(owner_user_id)` (current `my_business_id()`) or `business_members(user_id, business_id, role)`? Britannia at 1500 PAYE staff demands the latter; the entire RLS rewrite hinges on this answer.
5. **AI consent UX.** Acceptable to ship a one-time "We use Anthropic to power Cadi's AI features — see processors" modal on first AI use, or do you want a per-business toggle defaulted to off? The latter is safer GDPR but kills adoption of half the killer features.
6. **Migration tooling depth.** Is "Roll back this import" + "GDPR delete-request email to old vendor" enough, or do you want managed migrations (we receive the CSV, run import for them) as a £-add-on like CleanerPlanner does?
7. **Met Office API key in your name.** Want weather overlay shipped under a Cadi DataHub account (recommended) so customers don't manage keys?
8. **Marketing position for `/features`**. Lead with "Snap a photo of your price list" (concrete, demo-able) or "Cadi understands your whole business" (Profitability X-ray, harder to GIF)? Both ship Month 2-3 — which one anchors the hero?