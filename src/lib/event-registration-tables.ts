// Lazy schema: these tables self-create on first use rather than requiring a
// migration script to have run in every environment. See ARCHITECTURE.md §5
// for when to use this pattern vs. a scripts/migrate-*.mjs file — same
// bucket as event_form_field/event_form_response, added after the fact.
//
// event_category is one concept doing double duty (see the event-flow-
// redesign plan): tournament divisions (e.g. basketball's "Mini Masculin",
// "Benjamin Cadet Juvénile Masculin D4") for team events, or age-tiered
// session slots (e.g. karate's two time slots) for individual events —
// startTime/endTime only matter for the latter case.
//
// event_pricing_tier is orthogonal to category — resident/non-resident-style
// price variants a registrant picks regardless of which category they're in
// (e.g. karate/yoga's "Résidents $140 / Non-résidents $150").
import { pool } from "@/lib/db";

let registrationTablesReady: Promise<void> | null = null;

export async function ensureEventRegistrationTables() {
  registrationTablesReady ??= (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "event_category" (
        "id"                text PRIMARY KEY,
        "eventId"           text NOT NULL REFERENCES "event"("id") ON DELETE CASCADE,
        "name"              text NOT NULL,
        "description"       text,
        "capacity"          integer,
        "maxPlayersPerTeam" integer,
        "price"             integer,
        "startTime"         text,
        "endTime"           text,
        "sortOrder"         integer NOT NULL DEFAULT 0,
        "createdAt"         timestamp NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "event_category_eventId_idx" ON "event_category" ("eventId")`);
    await pool.query(`ALTER TABLE "tournament_team" ADD COLUMN IF NOT EXISTS "categoryId" text REFERENCES "event_category"("id") ON DELETE SET NULL`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "event_pricing_tier" (
        "id"        text PRIMARY KEY,
        "eventId"   text NOT NULL REFERENCES "event"("id") ON DELETE CASCADE,
        "label"     text NOT NULL,
        "price"     integer NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "event_pricing_tier_eventId_idx" ON "event_pricing_tier" ("eventId")`);
    await pool.query(`ALTER TABLE "event_participant" ADD COLUMN IF NOT EXISTS "categoryId" text REFERENCES "event_category"("id") ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE "event_participant" ADD COLUMN IF NOT EXISTS "pricingTierId" text REFERENCES "event_pricing_tier"("id") ON DELETE SET NULL`);
  })();
  await registrationTablesReady;
}

// The one place category/tier-vs-event price precedence is decided — a
// category price override wins if set, then a pricing tier, then the
// event's own flat price. Verified against all 4 event-flow-redesign
// flyers: none needs both a category override AND a tier applied to the
// same registration (karate/yoga use tiers with no category price
// override; basketball/volleyball use category overrides with no tiers),
// so this precedence order — not a combined matrix — is sufficient.
export function resolveRegistrationPrice(
  event: { price: number },
  category: { price: number | null } | null | undefined,
  tier?: { price: number } | null
): number {
  if (category?.price != null) return category.price;
  if (tier) return tier.price;
  return event.price;
}
