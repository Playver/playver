// Runs the existing migrate-*.mjs scripts against a staging Neon branch,
// without editing any of them. Every migrate-*.mjs reads DATABASE_URL (and
// optionally PROD_DATABASE_URL) directly out of .env.local on disk — so
// this temporarily rewrites .env.local to point DATABASE_URL at staging
// and strips PROD_DATABASE_URL entirely (so no script's "also run against
// prod if PROD_DATABASE_URL is set" branch can ever fire while this runs),
// then restores the original file afterwards no matter what happens.
//
// Usage:
//   STAGING_DATABASE_URL=postgresql://... node scripts/run-staging-migrations.mjs
//   (or: npm run db:migrate:staging)
//
// Also creates the three tables that normally only exist because they're
// lazily created at runtime (see src/lib/tournament-tables.ts,
// game-tables.ts, mini-event-tables.ts) — migrate-wallet.mjs has a hard FK
// to "tournament_team", which won't exist yet on a genuinely empty DB.

import { Pool } from "@neondatabase/serverless";
import { execFileSync } from "child_process";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(__dirname, "../.env.local");

const STAGING_DATABASE_URL = process.env.STAGING_DATABASE_URL;
if (!STAGING_DATABASE_URL) {
  console.error("STAGING_DATABASE_URL is required (pass it in the shell env, not .env.local).");
  process.exit(1);
}

// Scripts here in dependency order (verified against each script's
// REFERENCES clauses) — the lazy-table SQL is injected right before
// migrate-wallet.mjs, the first script that needs "tournament_team".
const MIGRATION_SCRIPTS = [
  "migrate.mjs",
  "migrate-teams-events.mjs",
  "migrate-team-members.mjs",
  "migrate-event-participants.mjs",
  "migrate-payments.mjs",
  "migrate-registration-form.mjs",
  "migrate-roles.mjs",
  "migrate-organizations.mjs",
  "migrate-organization-invitations.mjs",
  "migrate-organization-onboarding.mjs",
  "migrate-organization-size.mjs",
  "migrate-organization-teams.mjs",
  "migrate-organization-partners.mjs",
  "migrate-event-organization.mjs",
  "__inject_lazy_tables__",
  "migrate-wallet.mjs",
  // Depends on migrate-wallet.mjs having already added event_payment.method
  // (this script only widens that column's CHECK constraint to also allow
  // 'stripe_direct') — must run after it, not before.
  "migrate-event-payment-stripe-direct.mjs",
  "migrate-event-status.mjs",
  "migrate-organization-wallet.mjs",
];

// migrate-*.mjs files that intentionally do NOT belong in MIGRATION_SCRIPTS —
// one-off historical backfills tied to the old-DB import, meaningless against
// a genuinely empty staging DB that was never migrated from it. Anything
// else under scripts/migrate-*.mjs must be schema (a CREATE TABLE/ALTER
// TABLE, even if script-owned rather than lazily created at runtime — see
// ARCHITECTURE.md §5), which staging DOES need, so it belongs in the list
// above. New migrate-*.mjs scripts are trivial to forget adding here since
// nothing else references this file — this is exactly what caused
// organization_team/organization_partner to be silently missing from
// staging (2026-09-29) while the app code that reads them shipped fine.
const INTENTIONALLY_EXCLUDED = new Set([
  "migrate-from-old-db.mjs",
  "migrate-gallery-types.mjs",
]);

function assertNoForgottenScripts() {
  const onDisk = readdirSync(__dirname).filter(
    (f) => /^migrate-.*\.mjs$/.test(f) || f === "migrate.mjs"
  );
  const known = new Set([...MIGRATION_SCRIPTS.filter((s) => s !== "__inject_lazy_tables__"), ...INTENTIONALLY_EXCLUDED]);
  const forgotten = onDisk.filter((f) => !known.has(f));
  if (forgotten.length > 0) {
    console.error(
      `\nRefusing to run: found migrate-*.mjs script(s) not accounted for in ` +
        `run-staging-migrations.mjs's MIGRATION_SCRIPTS or INTENTIONALLY_EXCLUDED list:\n` +
        forgotten.map((f) => `  - ${f}`).join("\n") +
        `\n\nAdd each one to MIGRATION_SCRIPTS (in dependency order) if staging needs ` +
        `its schema, or to INTENTIONALLY_EXCLUDED with a comment saying why not, then re-run.`
    );
    process.exit(1);
  }
}

// Final-state schema for the three lazy-DDL table groups, copied from
// src/lib/tournament-tables.ts, src/lib/game-tables.ts,
// src/lib/mini-event-tables.ts — keep these in sync if those files change.
const LAZY_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "tournament_team" (
    "id"                text PRIMARY KEY,
    "tournamentId"      text NOT NULL REFERENCES "event"("id") ON DELETE CASCADE,
    "captainId"         text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "name"              text NOT NULL,
    "status"            text NOT NULL DEFAULT 'active',
    "recruitmentStatus" text NOT NULL DEFAULT 'closed',
    "inviteCode"        text NOT NULL UNIQUE,
    "paymentDeadline"   timestamp,
    "playerCount"       integer NOT NULL DEFAULT 1,
    "linkedTeamId"      text,
    "isImportedTeam"    boolean NOT NULL DEFAULT false,
    "createdAt"         timestamp NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "tournament_team_member" (
    "id"                 text PRIMARY KEY,
    "teamId"             text NOT NULL REFERENCES "tournament_team"("id") ON DELETE CASCADE,
    "userId"             text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "joinedAt"           timestamp NOT NULL DEFAULT NOW(),
    "confirmationStatus" text NOT NULL DEFAULT 'confirmed',
    "confirmationToken"  text UNIQUE
  )`,
  `DO $$ BEGIN
     ALTER TABLE "tournament_team_member" ADD CONSTRAINT "tournament_team_member_teamId_userId_key" UNIQUE ("teamId", "userId");
   EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "tournament_join_request" (
    "id"        text PRIMARY KEY,
    "teamId"    text NOT NULL REFERENCES "tournament_team"("id") ON DELETE CASCADE,
    "userId"    text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "status"    text NOT NULL DEFAULT 'pending',
    "createdAt" timestamp NOT NULL DEFAULT NOW()
  )`,
  `DO $$ BEGIN
     ALTER TABLE "tournament_join_request" ADD CONSTRAINT "tournament_join_request_teamId_userId_key" UNIQUE ("teamId", "userId");
   EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "game" (
    "id"            text PRIMARY KEY,
    "tournamentId"  text NOT NULL REFERENCES "event"("id") ON DELETE CASCADE,
    "homeTeamId"    text REFERENCES "tournament_team"("id") ON DELETE CASCADE,
    "awayTeamId"    text REFERENCES "tournament_team"("id") ON DELETE CASCADE,
    "court"         text,
    "round"         text,
    "notes"         text,
    "scheduledTime" timestamptz NOT NULL,
    "status"        text NOT NULL DEFAULT 'scheduled',
    "homeScore"     integer,
    "awayScore"     integer,
    "createdAt"     timestamptz NOT NULL DEFAULT NOW(),
    "updatedAt"     timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "game_player_stat" (
    "id"       text PRIMARY KEY,
    "gameId"   text NOT NULL REFERENCES "game"("id") ON DELETE CASCADE,
    "teamId"   text NOT NULL REFERENCES "tournament_team"("id") ON DELETE CASCADE,
    "userId"   text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "points"   integer NOT NULL DEFAULT 0,
    "rebounds" integer NOT NULL DEFAULT 0,
    "assists"  integer NOT NULL DEFAULT 0,
    "steals"   integer NOT NULL DEFAULT 0,
    "blocks"   integer NOT NULL DEFAULT 0
  )`,
  `DO $$ BEGIN
     ALTER TABLE "game_player_stat" ADD CONSTRAINT "game_player_stat_gameId_userId_key" UNIQUE ("gameId", "userId");
   EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "game_tournamentId_idx" ON "game" ("tournamentId")`,
  `CREATE INDEX IF NOT EXISTS "game_player_stat_userId_idx" ON "game_player_stat" ("userId")`,
  `CREATE TABLE IF NOT EXISTS "mini_event" (
    "id"            text PRIMARY KEY,
    "tournamentId"  text NOT NULL REFERENCES "event"("id") ON DELETE CASCADE,
    "title"         text NOT NULL,
    "court"         text,
    "notes"         text,
    "scheduledTime" timestamptz NOT NULL,
    "status"        text NOT NULL DEFAULT 'scheduled',
    "createdAt"     timestamptz NOT NULL DEFAULT NOW(),
    "updatedAt"     timestamptz NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "mini_event_result" (
    "id"          text PRIMARY KEY,
    "miniEventId" text NOT NULL REFERENCES "mini_event"("id") ON DELETE CASCADE,
    "userId"      text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "score"       integer NOT NULL DEFAULT 0
  )`,
  `DO $$ BEGIN
     ALTER TABLE "mini_event_result" ADD CONSTRAINT "mini_event_result_miniEventId_userId_key" UNIQUE ("miniEventId", "userId");
   EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "mini_event_tournamentId_idx" ON "mini_event" ("tournamentId")`,
];

async function injectLazyTables() {
  console.log("\n[staging] Creating lazily-created tables (tournament_team, game, mini_event, ...)...");
  const pool = new Pool({ connectionString: STAGING_DATABASE_URL });
  for (const statement of LAZY_TABLES_SQL) {
    await pool.query(statement);
  }
  await pool.end();
  console.log("[staging] ✓ lazy tables");
}

assertNoForgottenScripts();

const originalEnvLocal = readFileSync(envLocalPath, "utf8");

function restoreEnvLocal() {
  writeFileSync(envLocalPath, originalEnvLocal);
}
process.on("SIGINT", () => { restoreEnvLocal(); process.exit(1); });
process.on("SIGTERM", () => { restoreEnvLocal(); process.exit(1); });

try {
  const stagingEnvLocal = originalEnvLocal
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${STAGING_DATABASE_URL}`)
    .replace(/^PROD_DATABASE_URL=.*\n?/m, "");
  writeFileSync(envLocalPath, stagingEnvLocal);

  for (const script of MIGRATION_SCRIPTS) {
    if (script === "__inject_lazy_tables__") {
      await injectLazyTables();
      continue;
    }
    console.log(`\n=== ${script} ===`);
    execFileSync("node", [resolve(__dirname, script)], { stdio: "inherit" });
  }

  console.log("\nAll staging migrations complete.");
} finally {
  restoreEnvLocal();
}
