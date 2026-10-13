// node scripts/seed-demo-events.mjs            (dev: DATABASE_URL)
// node scripts/seed-demo-events.mjs --staging  (STAGING_DATABASE_URL)
//
// Creates (or refreshes) the curated demo events every staging visitor sees
// — see src/lib/event-visibility.ts. They belong to a "Playver Demo"
// organization owned by the owner of the "playver" org (or --owner-email
// <email>). Safe to re-run: rows have fixed ids, so a re-run updates them
// in place and moves their dates forward again so they stay upcoming. Never
// touches PROD_DATABASE_URL; refuses to run if the target equals it.
// Requires scripts/migrate-demo-events.mjs to have run on the target.
import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1].trim().replace(/^"|"$/g, "");

const args = process.argv.slice(2);
const useStaging = args.includes("--staging");
const ownerEmail = args.includes("--owner-email") ? args[args.indexOf("--owner-email") + 1] : null;
const url = useStaging ? get("STAGING_DATABASE_URL") : get("DATABASE_URL");
if (!url) { console.error(`${useStaging ? "STAGING_DATABASE_URL" : "DATABASE_URL"} not found in .env.local`); process.exit(1); }
const prod = get("PROD_DATABASE_URL");
if (prod && new URL(prod).host === new URL(url).host) { console.error("Target database is production — refusing."); process.exit(1); }

const ORG_ID = "playver-demo-org";
const ORG_SLUG = "playver-demo";

// Neutral cover photos (Unsplash, hotlinked as Unsplash asks; the host is
// allowed in next.config.ts) — no text or dates on them that could
// contradict the event details.
const unsplash = (id) => `https://images.unsplash.com/${id}?w=1600&q=80&auto=format&fit=crop`;
const IMG = {
  hoop: unsplash("photo-1546519638-68e109498ffc"),
  arena: unsplash("photo-1504450758481-7338eba7524a"),
  volleyball: unsplash("photo-1612872087720-bb876e2e67d1"),
  yoga: unsplash("photo-1544367567-0f2fcb009e0b"),
  karate: unsplash("photo-1555597673-b21d5c935865"),
};

// Event times are stored as Montréal wall-clock time ("timestamp without
// time zone"), the same way CreateEventForm sends them ("2026-11-21T08:30").
function montreal(date, hhmm) {
  return `${date.toISOString().slice(0, 10)}T${hhmm}`;
}
function nextWeekday(from, weekday, minDaysAhead) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + minDaysAhead));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const addDays = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
const ymd = (d) => d.toISOString().slice(0, 10);

const now = new Date();
const pickupDay = nextWeekday(now, 6, 14);   // a Saturday 2+ weeks out
const yogaDay = nextWeekday(now, 0, 10);     // a Sunday 10+ days out
const leagueStart = nextWeekday(now, 2, 21); // a Tuesday 3+ weeks out
const tournamentDay = nextWeekday(now, 6, 35);
const campDay = nextWeekday(now, 1, 42);     // a Monday 6+ weeks out

const EVENTS = [
  {
    id: "demo-event-pickup",
    title: "Saturday Morning 3x3 Pickup",
    sport: "Basketball",
    eventType: "Pickup Game",
    location: "Centre Pierre-Charbonneau, 3000 Rue Viau, Montréal, QC",
    start: montreal(pickupDay, "09:00"),
    end: montreal(pickupDay, "11:30"),
    cover: IMG.hoop,
    registrationMode: "individual",
    capacity: 24,
    price: 0,
    description:
      "Free, friendly 3x3 runs every Saturday morning. Show up solo — we'll balance the teams at the door so every game is competitive. All levels welcome; games to 21 or 10 minutes, winners stay on.",
    rules:
      "• Games to 21 (by 1s and 2s) or 10 minutes.\n• Winners stay on, max 3 games in a row.\n• Call your own fouls; disputes = check ball.\n• Non-marking shoes required on the court.",
    agenda: [
      { title: "Check-in & team draft", date: ymd(pickupDay), startTime: "09:00", endTime: "09:15" },
      { title: "Open runs", date: ymd(pickupDay), startTime: "09:15", endTime: "11:15" },
      { title: "King of the court final", date: ymd(pickupDay), startTime: "11:15", endTime: "11:30" },
    ],
  },
  {
    id: "demo-event-yoga",
    title: "Sunday Recovery Yoga for Athletes",
    sport: "Other",
    eventType: "Training / Practice",
    location: "Studio Mouvement, 4430 Rue Saint-Denis, Montréal, QC",
    start: montreal(yogaDay, "10:00"),
    end: montreal(yogaDay, "11:00"),
    cover: IMG.yoga,
    registrationMode: "individual",
    capacity: 25,
    price: 1500,
    description:
      "A 60-minute mobility and recovery session built for people who play. Hips, hamstrings, shoulders and breathing — the stuff that keeps you on the court all season. Mats provided.",
    rules: "• Arrive 10 minutes early.\n• Bring water and a towel.\n• Tell the coach about any injury before class.",
    agenda: [
      { title: "Breathing & warm-up", date: ymd(yogaDay), startTime: "10:00", endTime: "10:10" },
      { title: "Mobility flow", date: ymd(yogaDay), startTime: "10:10", endTime: "10:45" },
      { title: "Cool-down & stretching", date: ymd(yogaDay), startTime: "10:45", endTime: "11:00" },
    ],
  },
  {
    id: "demo-event-league",
    title: "Montréal Fall Volleyball League",
    sport: "Volleyball",
    eventType: "League",
    location: "Complexe sportif Claude-Robillard, 1000 Av. Émile-Journault, Montréal, QC",
    start: montreal(leagueStart, "19:00"),
    end: montreal(addDays(leagueStart, 49), "22:00"),
    cover: IMG.volleyball,
    registrationMode: "team",
    capacity: 12,
    maxPlayersPerTeam: 10,
    price: 45000,
    description:
      "Eight weeks of co-ed 6v6 indoor volleyball on Tuesday nights. Every team plays two matches a night, with playoffs in the final week. Price is per team; referees and balls included.",
    rules:
      "• Co-ed: at least 2 women on the court at all times.\n• Best of 3 sets to 25 (third set to 15).\n• Rosters up to 10 players, locked after week 3.\n• Forfeit if fewer than 4 players 10 minutes after start time.",
    agenda: [
      { title: "Week 1 — Opening night", date: ymd(leagueStart), startTime: "19:00", endTime: "22:00" },
      { title: "Weeks 2–7 — Regular season", date: ymd(addDays(leagueStart, 7)), startTime: "19:00", endTime: "22:00" },
      { title: "Week 8 — Playoffs & finals", date: ymd(addDays(leagueStart, 49)), startTime: "19:00", endTime: "22:00" },
    ],
  },
  {
    id: "demo-event-tournament",
    title: "Playver Invitational Basketball Tournament",
    sport: "Basketball",
    eventType: "Tournament",
    location: "Cégep du Vieux Montréal, 255 Rue Ontario E, Montréal, QC",
    start: montreal(tournamentDay, "08:30"),
    end: montreal(addDays(tournamentDay, 1), "18:00"),
    cover: IMG.arena,
    registrationMode: "team",
    capacity: 16,
    maxPlayersPerTeam: 12,
    price: 35000,
    hasCompetitionSchedule: true,
    description:
      "A two-day 5v5 tournament for 16 teams. Pool play on Saturday guarantees at least three games; the top two of each pool advance to Sunday's single-elimination bracket. Certified referees, scorekeepers and medals for the winners.",
    rules:
      "• FIBA rules, 4 × 10-minute quarters (running clock until the last 2 minutes).\n• Rosters up to 12 players, all registered on Playver before the first game.\n• Teams must be ready 15 minutes before tip-off.\n• Tiebreakers: head-to-head, then point differential.",
    agenda: [
      { title: "Check-in & captains' meeting", date: ymd(tournamentDay), startTime: "08:30", endTime: "09:00" },
      { title: "Pool play", date: ymd(tournamentDay), startTime: "09:00", endTime: "18:00" },
      { title: "Quarterfinals & semifinals", date: ymd(addDays(tournamentDay, 1)), startTime: "09:00", endTime: "15:00" },
      { title: "Championship game & awards", date: ymd(addDays(tournamentDay, 1)), startTime: "16:00", endTime: "18:00" },
    ],
  },
  {
    id: "demo-event-camp",
    title: "Youth Karate Skills Camp (Ages 8–14)",
    sport: "Karate",
    eventType: "Camps",
    location: "Dojo Shidokan, 7250 Rue Clark, Montréal, QC",
    start: montreal(campDay, "09:00"),
    end: montreal(addDays(campDay, 4), "15:00"),
    cover: IMG.karate,
    registrationMode: "individual",
    capacity: 30,
    price: 14000,
    description:
      "A five-day day camp for young athletes, beginners and up. Technique, footwork, discipline and lots of games, led by certified black-belt instructors. Ends with a friendly demonstration for parents on Friday afternoon.",
    rules:
      "• Ages 8 to 14; no experience needed.\n• Bring a lunch, water bottle and comfortable clothes (gi optional).\n• Drop-off from 8:45, pick-up by 15:15.",
    agenda: [
      { title: "Daily: warm-up & fundamentals", date: ymd(campDay), startTime: "09:00", endTime: "12:00" },
      { title: "Daily: games & sparring drills", date: ymd(campDay), startTime: "13:00", endTime: "15:00" },
      { title: "Friday: parents' demonstration", date: ymd(addDays(campDay, 4)), startTime: "14:00", endTime: "15:00" },
    ],
  },
];

const pool = new Pool({ connectionString: url });
console.log(`Seeding demo events into ${useStaging ? "STAGING" : "DATABASE_URL"} (${new URL(url).host})...`);

const col = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'event' AND column_name = 'isDemoDefault'`);
if (!col.rows.length) { console.error('event."isDemoDefault" is missing — run scripts/migrate-demo-events.mjs first.'); process.exit(1); }

const owner = ownerEmail
  ? await pool.query(`SELECT id, email FROM "user" WHERE email = $1`, [ownerEmail])
  : await pool.query(
      `SELECT u.id, u.email FROM "organization_membership" om
       JOIN "organization" o ON o.id = om."organizationId" JOIN "user" u ON u.id = om."userId"
       WHERE o.slug = 'playver' AND om.role = 'OWNER' AND om.status = 'active' LIMIT 1`
    );
const ownerId = owner.rows[0]?.id;
if (!ownerId) { console.error("No owner found — pass --owner-email <email of an existing user>."); process.exit(1); }

const logo = (await pool.query(`SELECT "logoUrl" FROM "organization" WHERE slug = 'playver'`)).rows[0]?.logoUrl ?? null;

await pool.query(
  `INSERT INTO "organization" (id, name, slug, "organizationType", sports, "publicationStatus", "shortDescription", city, province, country, "logoUrl")
   VALUES ($1, 'Playver Demo', $2, 'CLUB', ARRAY['Basketball','Volleyball'], 'published',
           'Sample events showing what a complete Playver event looks like.', 'Montréal', 'QC', 'Canada', $3)
   ON CONFLICT (id) DO UPDATE SET "publicationStatus" = 'published', "logoUrl" = COALESCE("organization"."logoUrl", EXCLUDED."logoUrl")`,
  [ORG_ID, ORG_SLUG, logo]
);
await pool.query(
  `INSERT INTO "organization_membership" (id, "organizationId", "userId", role, status)
   SELECT gen_random_uuid()::text, $1, $2, 'OWNER', 'active'
   WHERE NOT EXISTS (SELECT 1 FROM "organization_membership" WHERE "organizationId" = $1 AND "userId" = $2)`,
  [ORG_ID, ownerId]
);

for (const e of EVENTS) {
  const gallery = [{ url: e.cover, type: "image" }];
  await pool.query(
    `INSERT INTO "event" (
       id, title, sport, "eventType", location, "startDateTime", "endDateTime", "coverImageUrl", "galleryUrls", "galleryItems",
       "registrationMode", capacity, "maxPlayersPerTeam", description, rules, "organizerId", "organizationId",
       "customFormEnabled", price, "agendaItems", "hasCompetitionSchedule", status, "isDemoDefault", "createdAt", "updatedAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,false,$18,$19::jsonb,$20,'active',true,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, sport = EXCLUDED.sport, "eventType" = EXCLUDED."eventType", location = EXCLUDED.location,
       "startDateTime" = EXCLUDED."startDateTime", "endDateTime" = EXCLUDED."endDateTime",
       "coverImageUrl" = EXCLUDED."coverImageUrl", "galleryUrls" = EXCLUDED."galleryUrls", "galleryItems" = EXCLUDED."galleryItems",
       "registrationMode" = EXCLUDED."registrationMode", capacity = EXCLUDED.capacity, "maxPlayersPerTeam" = EXCLUDED."maxPlayersPerTeam",
       description = EXCLUDED.description, rules = EXCLUDED.rules, price = EXCLUDED.price, "agendaItems" = EXCLUDED."agendaItems",
       "hasCompetitionSchedule" = EXCLUDED."hasCompetitionSchedule", status = 'active', "isDemoDefault" = true, "updatedAt" = NOW()`,
    [
      e.id, e.title, e.sport, e.eventType, e.location, e.start, e.end, e.cover,
      gallery.map((g) => g.url), JSON.stringify(gallery), e.registrationMode, e.capacity ?? null, e.maxPlayersPerTeam ?? null,
      e.description, e.rules, ownerId, ORG_ID, e.price, JSON.stringify(e.agenda), e.hasCompetitionSchedule ?? false,
    ]
  );
  console.log(`  ✓ ${e.title} — ${e.start.replace("T", " ")} (Montréal)`);
}

const flagged = await pool.query(`SELECT count(*)::int n FROM "event" WHERE "isDemoDefault" = true`);
console.log(`✓ Done. ${flagged.rows[0].n} events are marked as demo defaults.`);
await pool.end();
