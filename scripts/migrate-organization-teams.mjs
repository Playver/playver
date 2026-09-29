// node scripts/migrate-organization-teams.mjs
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
  console.log(`\n[${label}] Running organization teams migration...`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "organization_team" (
      "id"              text PRIMARY KEY,
      "organizationId"  text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
      "name"            text NOT NULL,
      "sport"           text,
      "coachName"       text,
      "memberCount"     int,
      "logoUrl"         text,
      "createdAt"       timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "organization_team_org_idx"
      ON "organization_team" ("organizationId")
  `);
  console.log(`[${label}] ✓ organization_team`);

  await pool.end();
}

await run("stage", DATABASE_URL);
if (PROD_DATABASE_URL) await run("prod", PROD_DATABASE_URL);
else console.log("\n(Skipping prod — PROD_DATABASE_URL not set in .env.local)");

console.log("\nDone.");
