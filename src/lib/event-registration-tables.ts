// Lazy schema: these tables self-create on first use rather than requiring a
// migration script to have run in every environment. See ARCHITECTURE.md §5
// for when to use this pattern vs. a scripts/migrate-*.mjs file — same
// bucket as event_form_field/event_form_response, added after the fact.
//
// event_category is one concept doing double duty (see the event-flow-
// redesign plan): tournament divisions (e.g. basketball's "Mini Masculin",
// "Benjamin Cadet Juvénile Masculin D4") for team events, or age-tiered
// session slots (e.g. karate's two time slots) for individual/recurring
// events — startTime/endTime only matter for the latter case.
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
  })();
  await registrationTablesReady;
}

// The one place category-vs-event price precedence is decided — a category
// price override always wins over the event's own flat price (verified
// against all 4 event-flow-redesign flyers; none needs a combined matrix).
// Stage 3 extends this to also take a pricing tier, one step below category.
export function resolveRegistrationPrice(
  event: { price: number },
  category: { price: number | null } | null | undefined
): number {
  if (category?.price != null) return category.price;
  return event.price;
}
