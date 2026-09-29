# Playver

A sports events/tournaments platform (Next.js App Router, Neon Postgres, Better Auth, Stripe Connect). See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full tech stack, directory layout, and conventions.

## Getting Started

1. `cp .env.example .env.local` and fill in real values (ask a teammate for dev credentials, or provision your own Neon/Stripe test/Resend/UploadThing/Google OAuth accounts).
2. `npm install`
3. Run the schema migrations against your local `DATABASE_URL` — see each file's header comment in `scripts/migrate-*.mjs` for the exact command, run in the order listed there.
4. `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Environments

| | Local | Staging | Production |
|---|---|---|---|
| URL | `localhost:3000` | `staging.playver.ca` | `playver.ca` |
| Git branch | (your working branch) | `staging` | `main` |
| Neon DB branch | your own dev branch | `staging` (empty, seeded — not a clone of prod) | `main`/production |
| Stripe mode | test | test | live |
| Outgoing emails | real (Resend) | guarded — logged, not sent (`EMAIL_MODE=log`) | real (Resend) |

## Workflow

Feature/fix work happens on its own branch off `main` — not directly on `staging`.

1. **Merge that branch into `staging`.** Vercel auto-deploys it to `staging.playver.ca`.
2. **Test it there** (see "Testing on staging" below).
3. **Merge the *same* branch into `main`** — same commits, not a re-do. This is what keeps `staging` and production from silently drifting into different code. Deploys to `playver.ca`.
4. Since `staging` picks up a change slightly before `main` does (steps 1 vs 3), **fast-forward `staging` from `main` afterward**:
   ```bash
   git checkout staging && git pull && git merge --ff-only main && git push origin staging
   ```
   There's no CI enforcing any of this — it's manual discipline. Do this promptly after every merge to `main` so `staging` doesn't fall meaningfully behind what's actually live.

If something needs a tweak after testing on staging, fix it on the same feature branch and re-merge into staging to re-test — don't patch `staging` directly with something that doesn't also make it into `main`.

## Testing on staging

**Getting in**: `staging.playver.ca` is behind an HTTP Basic Auth gate (`src/proxy.ts`, active whenever `APP_ENV=staging` — see `.env.example`) — noindex/robots.txt alone only stops search engines, not people who have the URL. Credentials are `STAGING_BASIC_AUTH_USER`/`STAGING_BASIC_AUTH_PASSWORD` in Vercel's staging-scoped env vars; ask a teammate or check there, not documented here since this file is committed to git.

**Staging DB is deliberately empty, not a clone of prod** — no real user PII or payment/wallet records live there, so testing can't leak real data or accidentally act on it. If the staging Neon branch is ever re-created from prod (branching there always copies data — see the branch's own history for the exact procedure), wipe it immediately with `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` before doing anything else.

**Rebuilding schema + seeding a known test login** (from your machine, against the staging Neon branch — never run these against `PROD_DATABASE_URL`):
```bash
STAGING_DATABASE_URL=<staging Neon connection string> npm run db:migrate:staging
STAGING_DATABASE_URL=<staging Neon connection string> STAGING_APP_URL=https://staging.playver.ca npm run db:seed:staging
```
`db:migrate:staging` runs the existing `scripts/migrate-*.mjs` files (plus the tables normally created lazily at runtime) against a genuinely empty DB — see that script's header comment for details. It's safe and cheap to re-run any time (every script is idempotent), so when in doubt, just run it. `db:seed:staging` then creates one test login, one organization, and one event to click around with; it prints the test login credentials at the end (not reproduced here — re-run the script if you need them again, it's idempotent-ish per fresh DB but will fail on duplicate rows against an already-seeded one).

**If you add a new `scripts/migrate-*.mjs` script**: it does NOT automatically apply to staging — add it to `MIGRATION_SCRIPTS` in `scripts/run-staging-migrations.mjs` (in dependency order) yourself, then run `db:migrate:staging` before merging that branch into `staging`. The runner will refuse to run and tell you exactly which script is unaccounted for if you forget — see ARCHITECTURE.md §5 for why this list exists separately from the dev/prod dual-run.

**Smoke test checklist** (worth running after any change that touches auth, payments, or email — not just after standing the environment up from scratch):
- [ ] Visit `staging.playver.ca` — Basic Auth prompt appears; correct credentials get you through to a working homepage, not an error page (a 500 here after a migration usually means schema drift — re-run `db:migrate:staging`; if a page 500s specifically with "relation ... does not exist," that's a new script-owned table that never got added to `run-staging-migrations.mjs` — see above).
- [ ] Sign in with the seeded test login.
- [ ] Join an event that triggers `sendEventJoinedEmail` — should succeed with no error. Check Vercel's function logs for that deployment (Deployments → the staging deployment → Functions/Logs) for a line starting `[EMAIL_MODE=log] would send:` — confirms the email guard is active and no real email went out.
- [ ] Create (or use an existing) paid event and run one test purchase with a [Stripe test card](./docs/stripe-testing.md) — confirm the Checkout redirect lands back on `staging.playver.ca`, not `playver.ca` (a wrong `NEXT_PUBLIC_BASE_URL` is the usual cause if it doesn't).
- [ ] `curl -sI https://playver.ca/robots.txt` — confirm production still says `Allow: /` (hasn't regressed from anything staging-related).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Playver-specific architecture, conventions, and a "where do I look for X" lookup table
- [`docs/stripe-testing.md`](./docs/stripe-testing.md) — local Stripe webhook testing setup
