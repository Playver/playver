// node scripts/migrate-demo-events.mjs
//
// Runs against DATABASE_URL only (dev, or staging via
// run-staging-migrations.mjs) — never PROD_DATABASE_URL. Prod gets the same
// idempotent SQL applied deliberately at release time (see SQL below).
//
// event."isDemoDefault": marks the curated demo events every staging visitor
// sees. On staging, everything else is limited to the viewer's own
// organizations (src/lib/event-visibility.ts). Unused outside staging.
import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
const DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
if (!DATABASE_URL) { console.error("DATABASE_URL not found in .env.local"); process.exit(1); }

export const SQL = [
  `ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "isDemoDefault" boolean NOT NULL DEFAULT false`,
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  console.log("Running demo events migration against DATABASE_URL...");
  for (const statement of SQL) await pool.query(statement);
  await pool.end();
  console.log("✓ Done.");
}
