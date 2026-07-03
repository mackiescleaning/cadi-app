# Cadi pre-launch smoke test

Run this against **production** (app.cadi.cleaning) before inviting real users.
Use a fresh email you control (e.g. a +launchtest alias). Each section is a
hard pass/fail — if anything is shaky, stop and flag it.

Time: ~25 minutes end to end.

---

## Part 1 — Signup + onboarding (5 min)

- [ ] Open https://app.cadi.cleaning in a clean browser profile (no cookies).
- [ ] Cookie banner appears — choose **Decline**. FullStory must NOT record.
- [ ] Click **Sign up free**.
- [ ] **T&C/Privacy checkbox is required** — try submitting without ticking it (must block).
- [ ] Submit with valid email + 8+ char password + the box ticked.
- [ ] Email confirmation page renders; check the inbox; click the link.
- [ ] Lands on /onboarding (conversational chat).
- [ ] AI disclosure line is visible at the top of onboarding ("Cadi uses AI…").
- [ ] Walk all 14 turns. Confirm:
  - The "confirm" turn shows the pre-filled name/business/email from signup.
  - VAT scheme question shows the "Most cleaning businesses use Standard Rate" hint.
  - Sectors button reads `Continue →` (not "Continue with N sectors").
  - Services chat opens; AI disclosure visible there too.
  - Summary fires confetti + lands you on /dashboard.

**FAIL CRITERIA:** any step throws, copy regression, or AI disclosure missing.

---

## Part 2 — Dashboard first render (3 min)

- [ ] /dashboard renders without console errors (open DevTools).
- [ ] Cadi score for an empty account is **< 30** (was 61 before the fix).
- [ ] No `Infinity%` anywhere. KPI strip shows "Set a target →" if monthlyTarget=0.
- [ ] taxReservePct dim bar never overflows 100%.
- [ ] Leaderboard widget renders, your name appears at the bottom with `(you)` badge.
- [ ] 30-Day Plan card visible; Phase 1 active; clicking a Phase 1 step navigates.
- [ ] Banner at top does NOT say "Viewing as accountant" (regression check).
- [ ] Activity feed renders; no duplicate ids (browser console check).

**FAIL CRITERIA:** score ≥ 60 for empty account; any 401/500 in network tab; accountant banner shows.

---

## Part 3 — Settings + auth flows (3 min)

- [ ] Settings → Your Data → **Cookie preferences** toggle present; clicking Allow turns FullStory on (network tab → request to fullstory.com); Decline turns it off.
- [ ] Settings → Export All Data downloads a JSON.
- [ ] Sign out → /login.
- [ ] Try the **password reset** flow: forgot password → email arrives → reset link works.
- [ ] Sign back in. Land on /dashboard.

**FAIL CRITERIA:** cookie toggle silent; export 500; password reset doesn't email.

---

## Part 4 — Staff PIN + JWT (5 min)

Requires you to have a staff member added with a PIN. If none, create one in
Settings → Team → Add team member.

- [ ] Go to Settings → Team. Confirm the PIN column shows **"PIN set ✓"** (green pill), not raw digits.
- [ ] Get the staff login URL from Settings → Team → Copy staff link.
- [ ] Open the staff link in a **private/incognito window**.
- [ ] Enter the wrong PIN 5 times. The 6th attempt should return "Too many incorrect PIN attempts. Please wait before trying again."
- [ ] Wait 30 seconds (lockout is 15 min; testing patience helps).
- [ ] Reload, enter the correct PIN. Lands on /staff-dashboard.
- [ ] Verify in DevTools → Application → Session storage: a `staff_token` is set (JWT-shaped). `staff_session` JSON is also there.
- [ ] **URL has no `?staff_id=`** anywhere (this is the audit fix point).
- [ ] Click a job, try Clock In. Should work (or report no-GPS but that's expected).
- [ ] Close the tab → reopen the staff URL → must re-enter PIN (session storage gone).

**FAIL CRITERIA:** lockout doesn't fire after 5; `?staff_id=` appears in any URL; clock-in 401s with valid token.

---

## Part 5 — Money + Yapily (sandbox) (3 min)

- [ ] Money tab loads. No console errors.
- [ ] Bank picker: Yapily sandbox banks are listed (until `VITE_YAPILY_ENV=production` is set).
- [ ] Connect a sandbox bank (Modelo Sandbox is reliable). Land back in Money with transactions.
- [ ] Tap **Business** or **Personal** on a transaction → the "Got it" toast appears immediately (the rage-click fix).
- [ ] Verify the 15 expense categories are visible in the bank-tx categoriser (Fuel, Supplies, Equipment, Insurance, Marketing, Vehicle, Staff, Premises, Professional fees, Subscriptions, Phone & internet, Training, Uniform & PPE, Bank & finance, Other).

**FAIL CRITERIA:** toast missing; categories < 15; bank disconnect leaves duplicate is_active=true rows in DB.

---

## Part 6 — Walkthrough (2 min)

- [ ] /walkthrough renders. If no analysis yet, click **Run it now** — analysis returns in ~30s (not 5-10 min as the old copy said).
- [ ] Screen 3 (Money out) shows category labels like "Bank & finance" — never raw "bankfees".
- [ ] Holes screen: unpaid invoice cards show **Draft a chase / Ignore** only (no fake "Mark as paid" button).

**FAIL CRITERIA:** Run it now 500s; raw bucket ids visible; "Mark as paid" still there.

---

## Part 7 — Security headers + leaderboard sanity (2 min)

- [ ] `curl -sI https://app.cadi.cleaning/` shows all of:
  - `strict-transport-security: max-age=31536000; includeSubDomains; preload`
  - `content-security-policy: default-src 'self'; …`
  - `x-frame-options: DENY`
  - `x-content-type-options: nosniff`
  - `referrer-policy: strict-origin-when-cross-origin`
- [ ] On dashboard, opt into the leaderboard via Settings → Cadi Community. Verify your name appears on the public board.
- [ ] If only seed/demo rows exist, the "ranked anonymously" CTA must say **"You'd be ranked ~#N if you joined"** (hypothetical), not "you're ranked #N".

**FAIL CRITERIA:** any header missing; CTA still says "ranked anonymously".

---

## Part 8 — Webhooks + Stripe (2 min, needs a paid test sub)

Only run if you've configured Stripe test mode.

- [ ] Trigger `checkout.session.completed` from Stripe CLI:
  `stripe trigger checkout.session.completed`
- [ ] Resend the same event from Stripe dashboard → should return 200 with `{duplicate: true}` (idempotency).
- [ ] DB: `select event_id, succeeded_at from stripe_webhook_events order by received_at desc limit 5;` — should show the event with a timestamp.

**FAIL CRITERIA:** retry runs handler twice; webhook returns 200 on handler error.

---

## What to do if anything fails

- **Stop**, don't invite anyone yet.
- Capture: the failing step, browser console output, network tab response, and the SQL row state.
- If it's a fix you can describe in one paragraph, tell me; otherwise I'll repro and patch.

---

## When all 8 sections pass

You're clear to invite 2–3 friendly testers (not the wider list). Watch FullStory recordings for the first week. Wider invites after that.
