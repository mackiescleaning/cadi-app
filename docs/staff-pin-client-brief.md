# Task: Staff-PIN login — two-step client UI (`StaffLogin.jsx`)

## Context — what's already done (don't redo)

The **backend** for per-member staff-PIN login is built, deployed, and verified
(see memory `project_launch_security_audit.md` → "STAFF PIN PER-MEMBER"):

- **Migration 090** added `validate_staff_pin(token, member_id, pin)` — validates the
  PIN against ONE identified member, with per-member lockout (`team_members.pin_failed_attempts` /
  `pin_locked_until`). The old `validate_staff_pin(token, pin)` (matches against ALL staff) still
  exists for backward compat.
- **`staff-auth`** edge fn is **dual-mode**: uses the per-member RPC when the POST includes
  `member_id`, else falls back to the legacy match-all path. So the current client keeps working —
  **this task activates the secure path.**

**Why it matters:** the old flow checks a PIN against every staff member, so at enterprise scale
(e.g. Britannia's 1500 staff, 10k 4-digit PIN space) a random guess likely matches _someone_, and
the old per-business lockout would lock out the whole company. Identifying the member first fixes
both.

## The `staff-auth` API contract (already live)

Public function — client sends **`apikey` only, NOT `Authorization`** (it's deployed
`--no-verify-jwt`).

- `GET /functions/v1/staff-auth?token=TOKEN[&q=SEARCH]`
  → `{ staff: [{ id, name, role, has_pin }], total: number, searchable: boolean }`
  - `searchable = true` when the business has >50 active staff (roster is capped at 50; use `?q=` to
    search by name). `has_pin` = whether that member can log in.
- `POST /functions/v1/staff-auth` body `{ token, member_id, pin }` ← **include `member_id`**
  - `200 { member: {id,name,role,hourly_rate,owner_id}, staffToken }`
  - `401` wrong PIN / unknown member · `423 { locked_until, retry_after_ms }` per-member lockout
    (5 fails / 15 min) · `400` validation error

## Current file

`src/pages/StaffLogin.jsx` — route `/staff/:token`. Today: fetches the staff list, shows names as a
label, 4-digit auto-submit keypad, `POST {token, pin}` (no `member_id`). Helpers `fetchStaffList()` +
`validatePin()` at the top. On success: `useStaff().loginAsStaff(member, staffToken)` →
`navigate('/staff-dashboard')`.

## Build — two-step UX

1. **Identify the member.**
   - `searchable === false` (≤50 staff): show the staff as a tappable list/grid of name buttons.
     Indicate/disable members with `has_pin === false` ("no PIN set").
   - `searchable === true` (large org): show a **search box** → debounced `GET ?q=` → render matches
     as tappable buttons. Never render 1500 at once.
2. **Enter PIN** for the selected member (reuse the existing keypad UI + dark styling). Keep 4-digit
   auto-submit as the common case (backend accepts 4–8). `POST { token, member_id: selected.id, pin }`.
   - Handle `401` (shake, clear, retry), `423` (show lockout minutes from `retry_after_ms`/`locked_until`),
     success (loginAsStaff + navigate). Add a "back" affordance to re-pick the member.

## Constraints (read CLAUDE.md)

- `staff-auth` is public (`--no-verify-jwt`); send **`apikey` only, no `Authorization`**.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` are already imported from `src/lib/supabase.js`.
- Keep the existing visual style (`#010a4f`, keypad, `CadiWordmark`).
- Browser-observable → verify in preview (`preview_start "cadi-dev"`, load `/staff/<token>`). To test
  a real flow, set up test data via the Supabase MCP: put a `staff_login_token` on a test business and
  insert a `team_member` with `pin_hash_bcrypt = extensions.crypt('4321', extensions.gen_salt('bf'))`,
  `has_pin = true`, `is_active = true` — then **clean it up** (delete the member, null the token).
  `rhianna@mackies.cleaning` (`426eb970-2fb5-4e5c-ae94-8759f83d2db5`) is a safe empty test business.
- Vite build → `/build`; deploy via `npm run deploy`; ensure all imports are git-tracked before pushing
  (Vite 8 strict). Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Definition of done

Pick/search name → enter PIN → logs in via the per-member path (`member_id` in the POST). Small and
large rosters both handled; `401`/`423` handled; preview-verified; old single-step flow replaced.

## Optional follow-up (same area, high value)

Add `supabase/config.toml` listing all **public** functions as `verify_jwt = false` so a plain
`supabase functions deploy` can't silently re-break them (webhooks, `front-desk-chat`,
`receive-site-visit`, `event-dispatcher`, `staff-*`, `*-invite-lookup`). See CLAUDE.md "verify_jwt
deploy trap".
