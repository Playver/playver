// node scripts/migrate-payment-fees.mjs
//
// Runs against DATABASE_URL only (dev, or staging via
// run-staging-migrations.mjs). Unlike older migrate-*.mjs scripts it never
// touches PROD_DATABASE_URL — prod gets the same idempotent SQL applied
// deliberately at release time (see SQL below; safe to paste as-is).
//
// Organizer fees + reliable payouts (see src/lib/payment-fees.ts and
// src/lib/payouts.ts):
// - event_payment / tournament_team_payment: the fee split taken at payment
//   time (Stripe 2.9% + $0.30, Playver 5%) and the net the organization was
//   credited. NULL on rows from before fees existed — those were credited
//   gross, and refunds/holds fall back to `amount` for them.
// - tournament_team_payment.organizationId: which org wallet was credited.
//   Team payments used to land in the organizer's personal wallet even for
//   org tournaments; NULL marks those legacy rows so refunds keep debiting
//   the wallet that actually received the money.
// - wallet_withdrawal: transfer -> payout tracking.
// - refund_fee_absorption: one row per refund where Playver absorbed fees,
//   so repeat cancellations by the same org can be detected and curbed.
//   owedCents: a fee the org should have paid but its wallet couldn't cover
//   at refund time — collected from its next withdrawal.
// - organization.refundFeeFlaggedAt: set when an org crosses that threshold.
import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
const DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
if (!DATABASE_URL) { console.error("DATABASE_URL not found in .env.local"); process.exit(1); }

export const SQL = [
  `ALTER TABLE "event_payment" ADD COLUMN IF NOT EXISTS "stripeFeeCents" integer`,
  `ALTER TABLE "event_payment" ADD COLUMN IF NOT EXISTS "platformFeeCents" integer`,
  `ALTER TABLE "event_payment" ADD COLUMN IF NOT EXISTS "netCents" integer`,
  `ALTER TABLE "tournament_team_payment" ADD COLUMN IF NOT EXISTS "stripeFeeCents" integer`,
  `ALTER TABLE "tournament_team_payment" ADD COLUMN IF NOT EXISTS "platformFeeCents" integer`,
  `ALTER TABLE "tournament_team_payment" ADD COLUMN IF NOT EXISTS "netCents" integer`,
  `ALTER TABLE "tournament_team_payment" ADD COLUMN IF NOT EXISTS "organizationId" text REFERENCES "organization"("id") ON DELETE SET NULL`,
  `ALTER TABLE "wallet_withdrawal" ADD COLUMN IF NOT EXISTS "stripePayoutId" text`,
  `ALTER TABLE "wallet_withdrawal" ADD COLUMN IF NOT EXISTS "payoutStatus" text`,
  `ALTER TABLE "wallet_withdrawal" ADD COLUMN IF NOT EXISTS "payoutArrivalDate" timestamptz`,
  `ALTER TABLE "wallet_withdrawal" ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0`,
  `ALTER TABLE "wallet_withdrawal" ADD COLUMN IF NOT EXISTS "lastAttemptAt" timestamptz`,
  `ALTER TABLE "wallet_withdrawal" ADD COLUMN IF NOT EXISTS "lastError" text`,
  `CREATE INDEX IF NOT EXISTS "wallet_withdrawal_stripePayoutId_idx" ON "wallet_withdrawal"("stripePayoutId")`,
  `CREATE TABLE IF NOT EXISTS "refund_fee_absorption" (
    "id"                text PRIMARY KEY,
    "organizationId"    text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
    "eventId"           text,
    "teamId"            text,
    "payerId"           text,
    "grossCents"        integer NOT NULL,
    "stripeFeeCents"    integer NOT NULL,
    "platformFeeCents"  integer NOT NULL,
    "chargedToOrgCents" integer NOT NULL DEFAULT 0,
    "owedCents"         integer NOT NULL DEFAULT 0,
    "createdAt"         timestamptz NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "refund_fee_absorption" ADD COLUMN IF NOT EXISTS "owedCents" integer NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS "refund_fee_absorption_org_created_idx" ON "refund_fee_absorption"("organizationId", "createdAt")`,
  `ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "refundFeeFlaggedAt" timestamptz`,
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  console.log("Running payment fees + payouts migration against DATABASE_URL...");
  for (const statement of SQL) await pool.query(statement);
  await pool.end();
  console.log("✓ Done.");
}
