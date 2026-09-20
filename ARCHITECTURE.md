<!-- Onboarding doc: what Playver is, how it's built, and where things live. -->

# Playver — Architecture

This doc exists so a new developer can get productive without having watched the app get built. If something here goes stale, fix the doc in the same PR that makes it stale — don't let it rot.

## 1. What Playver is

A sports platform with two sides:

- **Athletes**: browse/join events and tournaments, join or create teams, build a public athlete profile with game history, hold a personal wallet.
- **Organizers**: multi-tenant "organizations" (clubs, leagues, academies) with role-based staff, an org-owned wallet paid out via Stripe Connect, and full event/tournament management scoped to their org.

Events/tournaments used to be creatable by any logged-in athlete directly. That model is gone — **creating an event now always requires an active organization** (see §7). A handful of pre-existing "legacy" events with no `organizationId` still exist in prod and are handled as a special case in a few places; don't be surprised by `organizationId IS NULL` branches.

## 2. Tech stack

| Area | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | **Next 16 has real breaking changes from what you may know** — e.g. middleware is `src/proxy.ts`, not `middleware.ts`. See `AGENTS.md`. Check `node_modules/next/dist/docs/` before assuming an API works the way it used to. |
| Database | Postgres via `@neondatabase/serverless` | **No ORM.** Every query is raw SQL through a pooled `Pool` (see §5). |
| Auth | `better-auth` | Email/password + Google OAuth. Session-cookie based. |
| Payments | `stripe` (Connect Express accounts) | Two separate money pools — athlete wallets and org wallets — both funded via Stripe Checkout and paid out via Stripe Connect. See §8. |
| Email | `resend` | Transactional email only (welcome, receipts, cancellations, reminders). |
| File uploads | `uploadthing` | Event covers, org logos/covers, profile photos, game gallery media. |
| i18n | `next-intl` | English + French, kept in exact sync. See §9. |
| Styling | Tailwind CSS v4 | No component library — everything is hand-built with Tailwind utility classes. Brand red is `#e21d12` everywhere; don't introduce new accent colors without a reason. |
| Testing | Vitest | See §10 — coverage is thin today. |

## 3. Request model — there is no separate backend

This is the single most important thing to internalize: **`src/app/actions/*.ts` *is* the backend.** These are Next.js Server Actions (`"use server"` files) — plain async functions that run only on the server, get called directly from Server Components (`await getEvents()`) and from Client Components (`onClick={() => joinEvent(id)}`), with Next handling the RPC wiring. There's no REST/GraphQL layer for app data, no separate API server, no client-side data-fetching library.

Real HTTP routes under `src/app/api/` exist **only** where something external needs to hit an actual endpoint:
- `api/auth/[...all]/route.ts` — Better Auth's catch-all handler.
- `api/stripe/webhook/route.ts`, `api/stripe/event-checkout/route.ts`, `api/stripe/wallet-topup/route.ts` — Stripe calls back into these; can't be a server action.
- `api/uploadthing/route.ts` (+ `core.ts`) — UploadThing's file router.
- `api/cron/upcoming-events/route.ts` — hit by a Vercel Cron job (`vercel.json`) to send event-reminder emails.

If you're adding a new feature and find yourself reaching for an API route, stop and ask whether it should be a server action instead — it almost always should.

## 4. Directory map

```
src/
  app/
    [locale]/           # every page, nested under the locale segment
      dashboard/        # athlete-facing area — has its own layout.tsx + sidebar
      organizer/        # organizer HQ — has its own layout.tsx + sidebar, org-scoped
      events/, tournaments/, teams/, athletes/[userId]/   # public browse + detail pages
      auth/, legal/, invite/[token]/, request-a-feature/
    actions/             # the backend — one file per domain, see §6
    api/                 # real HTTP routes, see §3
    layout.tsx           # root shell (fonts, <html>, nothing app-specific)
  components/            # one folder per feature area, mirrors src/app/[locale]/
    organizer/create-wizard/   # the 10-step "create an organization" wizard
    home-feed/                 # the logged-in "/" social feed shell (newest, mostly static-content UI)
    events/, teams/, tournaments/, athletes/, dashboard/, auth/, layout/, legal/, ui/, home/
  lib/                   # cross-cutting helpers — db, auth, permissions, email, formatting
  i18n/                  # next-intl config (routing.ts, request.ts)
messages/en.json, messages/fr.json   # all UI copy, see §9
scripts/                 # manual one-off DB migration scripts, see §5
docs/                    # narrower how-to docs — Stripe testing, cashout/refunds/cancellations, a full payments test checklist
```

Only three route segments have their own `layout.tsx` beyond the locale root: `dashboard/`, `organizer/`, and `[locale]/` itself. Every other page composes `Navbar`/`Footer` (or, for the logged-in home feed, its own `FeedSidebar`) directly rather than inheriting a shared shell.

## 5. Database — raw SQL, two places schema lives

`src/lib/db.ts` exports a single pooled `Pool` (`pool`) and a `withTransaction(fn)` helper. **Never mix `pool.query()` calls with statements meant to be in the same transaction** — each `pool.query()` can land on a different pooled connection; use `withTransaction` and run everything on the passed `client` when atomicity matters (e.g. debit-then-credit money movement).

There is **no declarative schema file** (no Prisma/Drizzle, no `schema.sql`). Table definitions live in two different places and you need to know which one applies:

1. **`scripts/migrate-*.mjs`** (17 of them) — run manually with `node scripts/migrate-whatever.mjs`. Each script reads `DATABASE_URL` and `PROD_DATABASE_URL` from `.env.local` and, when both are set, **runs against both stage and prod in the same invocation**. There is no version/ordering table — scripts are idempotent (`ADD COLUMN IF NOT EXISTS`, etc.) but you have to know which ones already ran. Read the most recent 2-3 migration scripts before writing a new one to match the style.
2. **Lazy in-app DDL** — several tables self-create on first use via a memoized `ensure*()` function (`ensureTournamentTables`, `ensureGameTables`, `ensureMiniEventTables`, `ensureEventParticipantsTable`, `ensureFormTables`, `ensureTeamMembersTable`, `ensureUserProfileColumns`, etc.), called at the top of the server actions that touch those tables. These exist because the table was added after the fact and a manual migration wasn't run in every environment — the `ensure*()` call makes it self-healing instead.

**When adding a column/table**: if it's on a table already covered by an `ensure*()` function, extend that function (idempotent `ADD COLUMN IF NOT EXISTS`) rather than writing a new migration script — it'll self-apply everywhere including prod on first request. If it's a genuinely new schema concern tied to a specific rollout, follow the `scripts/migrate-*.mjs` pattern instead and actually run it against prod.

## 6. `src/app/actions/` — the backend, by domain

| File | Owns |
|---|---|
| `event.ts` (largest, ~1,360 lines) | Event CRUD, join/leave, custom registration form fields, paid signups, cancel/postpone + refund emails. Org-permission gated (see §7). |
| `tournament.ts` | Tournament teams, invites, join requests, team registration + payment receipts. |
| `game.ts` | Games within a tournament: scheduling, results, box scores. |
| `organization.ts` | Org CRUD, slugs, membership/roles, `requireOrganizationPermission()`, the `active_org_id` cookie. |
| `organizer-people.ts` | Org member roster + email invitations (7-day expiry). |
| `organizer-registrations.ts` | Organizer's view of who's registered for their events. |
| `organizer-events.ts` | Thin organizer-scoped read layer over `event.ts`. |
| `organizer-wallet.ts` | Org wallet + Stripe Connect payouts. |
| `wallet.ts` | Athlete's personal wallet + Stripe Connect payouts — **parallel implementation to `organizer-wallet.ts`**, not shared (see §8). |
| `team.ts` | Standalone teams (outside tournaments) + membership. |
| `athlete.ts` | Public athlete profiles, profile fields, game history. |
| `miniEvent.ts` | Mini-events / side competitions inside a tournament. |
| `admin.ts` | Site-admin-only ops (role changes, force-cancel, removing participants). |

Almost every mutating action in the organizer-scoped files follows the same shape: resolve the caller's session → resolve their active org via `requireOrganizationPermission("SOME_PERMISSION")` → do the DB work. Copy that pattern rather than inventing a new one.

## 7. Organization & permission model

- `OrgRole` (`src/lib/organizer-permissions.ts`): `OWNER`, `ADMINISTRATOR`, `OPERATIONS_MANAGER`, `COACH`, `STAFF`, `READ_ONLY`. `hasPermission(role, permission)` checks a static matrix; `canAssignRole(assignerRole, targetRole)` separately gates promoting/demoting admins (requires `MANAGE_ADMINISTRATORS`, not just `MANAGE_PEOPLE`, specifically so `STAFF` can't self-promote).
- A user's **active organization** is tracked via the `active_org_id` cookie. `getActiveOrganization()` (`src/app/actions/organization.ts`) reads it and **re-verifies membership server-side on every call** — a forged/stale cookie just resolves to "not a member," never elevated access. `requireOrganizationPermission(permission)` wraps this and throws `ForbiddenError` (`src/lib/organizer-errors.ts`) on failure.
- Users can belong to multiple orgs; `setActiveOrganization(id)` switches which one is "active" after re-verifying membership. The org-creation wizard (`src/components/organizer/create-wizard/`) writes progressively as the user goes — nothing is persisted until step 2 (name/slug required), every step after upserts and bumps `wizardStep`, so closing and reopening resumes where they left off. A `publicationStatus` of `'draft'` vs `'published'` distinguishes a finished org from a WIP one — **check this, not just membership existence, when deciding whether a user "is an organizer."**

## 8. Money flow

Two Stripe Connect Express integrations exist **in parallel, not shared**: an athlete's personal wallet (`wallet.ts`) and an organization's wallet (`organizer-wallet.ts`). Both:
- Credit on successful Stripe Checkout for a paid event, or on internal wallet-to-wallet event payment.
- Enforce a **48-hour withdrawal hold** after an event ends (funds stay held indefinitely if the event was cancelled, so refunds always have money to draw from) and a **$10 minimum withdrawal**.
- Pay out via a Stripe Connect Express account tied to the user or the org respectively.

`MIN_WITHDRAWAL_CENTS`, `WITHDRAWAL_HOLD_HOURS`, and `InsufficientFundsError` are **copy-pasted between the two files**, not shared from a common module. This is known debt — if you change one of these rules, change it in both files, and consider factoring the shared logic out while you're there.

Which wallet a payment lands in is decided by whether the event has an `organizationId` (org wallet) or not (legacy personal wallet) — see the branching in `event.ts`'s payment-completion functions.

Connect **onboarding** (the KYC/bank-account form) renders inline via Stripe Connect embedded components (`@stripe/connect-js`, `src/components/payments/ConnectPayoutOnboarding.tsx`) styled to Playver's branding, not a redirect to Stripe's hosted `connect.stripe.com` — see `docs/cashout-refunds-cancellations.md` for the full write-up of that plus the cashout/refund/cancellation flows end to end.

**Stripe safety rule**: always confirm you're using `sk_test_...` keys before any payment testing, live or local. Never use `sk_live_...` outside of actually deploying to production. See `docs/stripe-testing.md` for the full test workflow (test-mode Connect onboarding gotchas, wallet-funded join testing, held-balance expiry testing).

## 9. i18n

- Config: `src/i18n/routing.ts` (locales `en`/`fr`, default `en`, `localePrefix: "as-needed"` — no `/en` prefix on the default locale) and `src/i18n/request.ts` (loads `messages/${locale}.json`).
- `src/proxy.ts` is Next 16's replacement for `middleware.ts` — it's just the `next-intl` locale-routing middleware, nothing else lives there.
- **`useTranslations` (from `next-intl`, a hook) is for Client Components. `getTranslations` (from `next-intl/server`, async) is for Server Components.** Using the wrong one for a component's type fails silently or breaks the build depending on the case — this has been a recurring real bug while building this app (a component missing `"use client"` that used the sync hook). If a component doesn't have `"use client"` at the top, it must use `await getTranslations(...)`, not `useTranslations(...)`.
- **Every new UI string needs a key in both `messages/en.json` and `messages/fr.json`** — they're expected to stay in exact structural sync (same namespaces, same keys, only values differ). There are 28 top-level namespaces today; add new copy under the existing namespace for that feature area rather than inventing a new one unless it's genuinely a new area.

## 10. Testing

Vitest (`npm test`), no config file (running on defaults). Coverage today is **narrow and honest about it**: four pure-function unit test files, all under `src/lib/` — `slug.test.ts`, `organizer-permissions.test.ts`, `organizer-invitations.test.ts`, `organization-completeness.test.ts`. There is currently **no test coverage** of `src/app/actions/` (the entire backend), the Stripe webhook, or any component. New pure-logic helpers in `src/lib/` should get a colocated `*.test.ts` following the existing pattern; anything touching the DB is currently verified manually (see `docs/stripe-testing.md` for the manual Stripe verification workflow).

## 11. "I want to work on X, where do I look"

| Feature | Files |
|---|---|
| Event creation/management | `src/app/actions/event.ts`, `src/components/events/`, `src/app/[locale]/events/`, `src/app/[locale]/organizer/events/` |
| Organizer roles/permissions | `src/lib/organizer-permissions.ts`, `src/app/actions/organization.ts` |
| Org wallet / Stripe Connect payouts | `src/app/actions/organizer-wallet.ts`, `src/app/[locale]/organizer/payments/` |
| Athlete wallet | `src/app/actions/wallet.ts`, `src/app/[locale]/dashboard/wallet/` |
| Org creation wizard | `src/components/organizer/create-wizard/` (`CreateOrganizationWizard.tsx` + `Step1…Step10`) |
| Logged-in home feed (`/`) | `src/components/home-feed/`, `src/app/[locale]/page.tsx` |
| Logged-out marketing landing page | `src/components/home/` |
| Teams | `src/app/actions/team.ts`, `src/components/teams/` |
| Tournaments | `src/app/actions/tournament.ts`, `src/app/actions/game.ts`, `src/components/tournaments/` |
| Translations | `messages/en.json` + `messages/fr.json`, keep in sync |
| Stripe webhook handling | `src/app/api/stripe/webhook/route.ts` |

## 12. Known quirks, in one place

- **Next 16 breaking changes** — see `AGENTS.md`; don't assume training-data knowledge of Next.js APIs is current, check `node_modules/next/dist/docs/`.
- **No migration ordering/versioning** (§5) — read recent migration scripts before writing a new one; know whether a table is migration-owned or `ensure*()`-owned before changing it.
- **Duplicated wallet constants** between `wallet.ts` and `organizer-wallet.ts` (§8).
- **Two DB env vars**: `DATABASE_URL` (your local/dev DB) and `PROD_DATABASE_URL` (production) — migration scripts run against both when both are set in `.env.local`. Be deliberate about which one you're pointed at before running anything destructive.
