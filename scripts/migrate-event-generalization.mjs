// node scripts/migrate-event-generalization.mjs
//
// Part of the event-flow-redesign effort (see plan). Stage 1's backfill:
// registrationMode ('individual'|'team') was a dead column until this stage
// — every behavior branch was gated on eventType === 'Tournament' instead,
// so the create-form's Individual/Team toggle had zero functional effect and
// was frequently left on its default regardless of the event's real shape.
// Verified against the dev DB: most existing eventType='Tournament' rows
// have registrationMode='individual'. Now that registrationMode is the real
// driver (see src/lib/event-type.ts and its call sites), this backfill is
// required, not optional, or existing tournaments' team registration/tabs
// silently break.
//
//
// Stage 4 adds hasCompetitionSchedule (decouples "has a Schedule/Results/
// Standings games structure" from registrationMode) and recurrenceRule
// (nullable JSONB — "every Monday, Sept 21-Dec 7" instead of manually
// adding N agendaItems). Existing eventType='Tournament' rows are
// backfilled hasCompetitionSchedule=true so their tabs render identically
// to today; recurrenceRule stays null for all existing rows (purely
// additive, opt-in going forward).
import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
const DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
const PROD_DATABASE_URL = env.match(/^PROD_DATABASE_URL=(.+)$/m)?.[1].trim();
if (!DATABASE_URL) { console.error("DATABASE_URL not found in .env.local"); process.exit(1); }

async function run(label, url) {
  const pool = new Pool({ connectionString: url });
  console.log(`\n[${label}] Running event-generalization migration...`);

  const result = await pool.query(
    `UPDATE "event" SET "registrationMode" = 'team' WHERE "eventType" = 'Tournament' AND "registrationMode" != 'team'`
  );
  console.log(`[${label}] ✓ backfilled registrationMode='team' on ${result.rowCount} existing Tournament event(s)`);

  await pool.query(`ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "hasCompetitionSchedule" boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "recurrenceRule" JSONB`);
  const scheduleResult = await pool.query(
    `UPDATE "event" SET "hasCompetitionSchedule" = true WHERE "eventType" = 'Tournament' AND "hasCompetitionSchedule" = false`
  );
  console.log(`[${label}] ✓ hasCompetitionSchedule/recurrenceRule columns; backfilled hasCompetitionSchedule=true on ${scheduleResult.rowCount} existing Tournament event(s)`);

  await pool.end();
}

await run("stage", DATABASE_URL);
if (PROD_DATABASE_URL) await run("prod", PROD_DATABASE_URL);
else console.log("\n(Skipping prod — PROD_DATABASE_URL not set in .env.local)");

console.log("\nDone.");
