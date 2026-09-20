"use server";

// The biggest file in the app: event CRUD, join/leave (both free and paid —
// wallet-funded and Stripe direct-checkout), custom registration form fields,
// cancel/postpone with refund + notification emails, and all the read queries
// that back the public discover page, the athlete dashboard, and the
// organizer dashboard's event lists.
//
// Two things to know before editing this file:
// 1. Events are either "legacy" (organizerId only, organizationId IS NULL —
//    a small fixed set of pre-existing rows from before orgs were required)
//    or org-owned. `createEvent` only ever produces org-owned events now; the
//    legacy branch exists purely to keep old rows working. Money for an
//    org-owned event's payments goes to the org's wallet (organizer-wallet.ts);
//    for a legacy event it goes to the creator's personal wallet (wallet.ts).
// 2. `authorizeEventManagement()` below is the shared gate for update/cancel/
//    postpone — authorized if you're the creator OR you hold MANAGE_EVENTS in
//    the event's org. Reuse it rather than re-deriving authorization.
//
// The trickiest logic (payment completion, the refund sweep) already has
// detailed comments in place at each function — read those before changing
// money-movement code.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "@neondatabase/serverless";
import { auth } from "@/lib/auth";
import { pool, withTransaction } from "@/lib/db";
import { sendEventJoinedEmail, sendNewParticipantEmail, sendEventFullEmail, sendPaymentReceiptEmail, sendEventCancelledEmail, sendEventPostponedEmail } from "@/lib/emails";
import { resend, FROM, layout, ctaButton, BASE_URL } from "@/lib/emails/_shared";
import { ensureTournamentTables } from "@/lib/tournament-tables";
import { requireOrganizationPermission } from "./organization";
import { hasPermission, type OrgRole } from "@/lib/organizer-permissions";
import { serializeEvent } from "@/lib/serialize-event";

let eventParticipantsTablePromise: Promise<void> | null = null;

export async function ensureEventParticipantsTable() {
  eventParticipantsTablePromise ??= (async () => {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "event_participant" (
        "id"        text PRIMARY KEY,
        "eventId"   text NOT NULL REFERENCES "event"("id") ON DELETE CASCADE,
        "userId"    text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "joinedAt"  timestamp NOT NULL DEFAULT NOW()
      )`
    );
    // Drop the old bad single-column constraint if it still exists (one-time migration)
    await pool.query(`
      ALTER TABLE "event_participant"
        DROP CONSTRAINT IF EXISTS "event_participant_eventId_key";
    `);
    // Add the correct composite constraint idempotently — safe across concurrent serverless instances
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'event_participant_eventId_userId_key'
        ) THEN
          ALTER TABLE "event_participant"
            ADD CONSTRAINT "event_participant_eventId_userId_key" UNIQUE ("eventId", "userId");
        END IF;
      END $$;
    `);
  })();
  await eventParticipantsTablePromise;
}

let formTablesReady: Promise<void> | null = null;

async function ensureFormTables() {
  formTablesReady ??= (async () => {
    await pool.query(`ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "customFormEnabled" boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "galleryItems" JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "agendaItems" JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "event_form_field" (
        "id"        text PRIMARY KEY,
        "eventId"   text NOT NULL REFERENCES "event"("id") ON DELETE CASCADE,
        "label"     text NOT NULL,
        "fieldType" text NOT NULL,
        "required"  boolean NOT NULL DEFAULT false,
        "options"   text[] NOT NULL DEFAULT '{}',
        "order"     integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "event_form_response" (
        "id"        text PRIMARY KEY,
        "eventId"   text NOT NULL REFERENCES "event"("id") ON DELETE CASCADE,
        "userId"    text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "fieldId"   text NOT NULL REFERENCES "event_form_field"("id") ON DELETE CASCADE,
        "value"     text,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);
  })();
  await formTablesReady;
}

export type GalleryItem = { url: string; type: "image" | "video" };
export type AgendaItem = { title: string; date?: string; startTime: string; endTime: string; description?: string };

export type FormFieldType = 'text' | 'number' | 'dropdown' | 'checkbox' | 'file';

export type FormField = {
  id: string;
  eventId: string;
  label: string;
  fieldType: FormFieldType;
  required: boolean;
  options: string[];
  order: number;
};

export type FormResponseInput = {
  fieldId: string;
  value: string;
};

export type EventItem = ReturnType<typeof serializeEvent>;
// Public-facing shape only — deliberately excludes email. This is rendered on
// the public event page, which any visitor (including logged-out ones) can
// load, so no contact info belongs here. Organizers get full contact details
// through getEventRegistrants in organizer-registrations.ts instead, which is
// permission-gated.
export type EventParticipant = {
  id: string;
  name: string;
  image: string | null;
  joinedAt: string;
};

// Shared gate for update/cancel/postpone: authorized if you're the event's
// creator (covers legacy pre-org events, where organizationId is null) OR
// you hold MANAGE_EVENTS in the event's organization — so an org admin can
// manage a colleague's event, not just their own.
async function authorizeEventManagement(
  eventId: string,
  userId: string
): Promise<
  | { error: "Event not found" | "Forbidden" }
  | { event: { organizerId: string; organizationId: string | null; eventType: string; title: string; sport: string; location: string; startDateTime: Date | string } }
> {
  const [existing, roleRow] = await Promise.all([
    pool.query(
      `SELECT "organizerId", "organizationId", "eventType", title, sport, location, "startDateTime" FROM "event" WHERE id = $1`,
      [eventId]
    ),
    pool.query(`SELECT role FROM "user" WHERE id = $1`, [userId]),
  ]);
  const row = existing.rows[0];
  if (!row) return { error: "Event not found" };

  const isSuperAdmin = roleRow.rows[0]?.role === "super_admin";
  let authorized = row.organizerId === userId || isSuperAdmin;
  if (!authorized && row.organizationId) {
    const membership = await pool.query(
      `SELECT role FROM "organization_membership" WHERE "userId" = $1 AND "organizationId" = $2 AND status = 'active'`,
      [userId, row.organizationId]
    );
    const orgRole = membership.rows[0]?.role as OrgRole | undefined;
    authorized = orgRole ? hasPermission(orgRole, "MANAGE_EVENTS") : false;
  }

  return authorized ? { event: row } : { error: "Forbidden" };
}

export async function createEvent(data: {
  title: string;
  sport: string;
  eventType: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  coverImageUrl?: string;
  galleryItems?: GalleryItem[];
  agendaItems?: AgendaItem[];
  registrationMode: string;
  capacity?: number;
  maxPlayersPerTeam?: number;
  description?: string;
  rules?: string;
  customFormEnabled?: boolean;
  price?: number;
  formFields?: Array<{
    label: string;
    fieldType: string;
    required: boolean;
    options: string[];
    order: number;
  }>;
}) {
  // Event creation requires an active organization — every event is now
  // organization-owned. Legacy events with organizationId null predate this
  // requirement and are left as-is; this path can no longer produce one.
  const { userId, organization } = await requireOrganizationPermission("MANAGE_EVENTS");

  await ensureFormTables();

  const galleryItems = data.galleryItems ?? [];
  const galleryUrls = galleryItems.map(i => i.url);
  const agendaItems = data.agendaItems ?? [];

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "event" (
       id, title, sport, "eventType", location,
       "startDateTime", "endDateTime", "coverImageUrl", "galleryUrls", "galleryItems",
       "registrationMode", capacity, "maxPlayersPerTeam",
       description, rules, "organizerId", "organizationId", "customFormEnabled", price, "agendaItems", "createdAt", "updatedAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,NOW(),NOW())`,
    [
      id, data.title, data.sport, data.eventType, data.location,
      data.startDateTime, data.endDateTime, data.coverImageUrl ?? null,
      galleryUrls, JSON.stringify(galleryItems),
      data.registrationMode, data.capacity ?? null, data.maxPlayersPerTeam ?? null,
      data.description ?? null, data.rules ?? null, userId,
      organization.id,
      data.customFormEnabled ?? false, data.price ?? 0,
      JSON.stringify(agendaItems),
    ]
  );

  revalidatePath("/organizer/events");

  if (data.customFormEnabled && data.formFields?.length) {
    for (const field of data.formFields) {
      await pool.query(
        `INSERT INTO "event_form_field" (id, "eventId", label, "fieldType", required, options, "order")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), id, field.label, field.fieldType, field.required, field.options, field.order]
      );
    }
  }

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");
  return { id };
}

export async function getEvents() {
  await ensureEventParticipantsTable();
  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName",
       CASE WHEN e."eventType" = 'Tournament'
         THEN (SELECT COUNT(*) FROM "tournament_team" tt WHERE tt."tournamentId" = e.id AND tt.status = 'active')
         ELSE COUNT(ep.id)
       END as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     LEFT JOIN "event_participant" ep ON ep."eventId" = e.id
     GROUP BY e.id, u.name, o.name
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`
  );
  return result.rows.map(serializeEvent);
}

export async function getTournamentEvents() {
  await ensureTournamentTables();
  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName", COUNT(tt.id) as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     LEFT JOIN "tournament_team" tt ON tt."tournamentId" = e.id AND tt.status = 'active'
     WHERE e."eventType" = 'Tournament'
     GROUP BY e.id, u.name, o.name
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`
  );
  return result.rows.map(serializeEvent);
}

// Legacy-only (organizationId null), same reasoning as getMyLegacyEvents —
// tournaments belonging to an org show up in /organizer/events instead.
export async function getMyTournaments() {
  await ensureTournamentTables();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];
  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName", COUNT(tt.id) as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     LEFT JOIN "tournament_team" tt ON tt."tournamentId" = e.id AND tt.status = 'active'
     WHERE e."organizerId" = $1 AND e."eventType" = 'Tournament' AND e."organizationId" IS NULL
     GROUP BY e.id, u.name, o.name
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`,
    [session.user.id]
  );
  return result.rows.map(serializeEvent);
}

export async function getJoinedTournaments() {
  await ensureTournamentTables();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];
  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName", COUNT(all_tt.id) as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     JOIN "tournament_team" my_tt ON my_tt."tournamentId" = e.id
       AND (
         my_tt."captainId" = $1
         OR EXISTS (
           SELECT 1 FROM "tournament_team_member" ttm
           WHERE ttm."teamId" = my_tt.id AND ttm."userId" = $1
         )
       )
     LEFT JOIN "tournament_team" all_tt ON all_tt."tournamentId" = e.id AND all_tt.status = 'active'
     WHERE e."organizerId" <> $1 AND e."eventType" = 'Tournament'
     GROUP BY e.id, u.name, o.name
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`,
    [session.user.id]
  );
  return result.rows.map(serializeEvent);
}

export async function getEventById(eventId: string) {
  await ensureEventParticipantsTable();
  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName",
       CASE WHEN e."eventType" = 'Tournament'
         THEN (SELECT COUNT(*) FROM "tournament_team" tt WHERE tt."tournamentId" = e.id AND tt.status = 'active')
         ELSE COUNT(ep.id)
       END as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     LEFT JOIN "event_participant" ep ON ep."eventId" = e.id
     WHERE e.id = $1
     GROUP BY e.id, u.name, o.name`,
    [eventId]
  );
  return result.rows[0] ? serializeEvent(result.rows[0]) : null;
}

export async function getMyEvents() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];
  await ensureEventParticipantsTable();

  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName",
       CASE WHEN e."eventType" = 'Tournament'
         THEN (SELECT COUNT(*) FROM "tournament_team" tt WHERE tt."tournamentId" = e.id AND tt.status = 'active')
         ELSE COUNT(ep.id)
       END as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     LEFT JOIN "event_participant" ep ON ep."eventId" = e.id
     WHERE e."organizerId" = $1
     GROUP BY e.id, u.name, o.name
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`,
    [session.user.id]
  );
  return result.rows.map(serializeEvent);
}

// Legacy (pre-organization) events this user created directly — organizationId
// is null. New events always require an org (see createEvent), so this can
// only ever surface pre-existing rows; used solely by the trimmed "My Events"
// section on /dashboard/events. Deliberately separate from getMyEvents, which
// the main /dashboard overview still uses to include org-owned events in an
// organizer's own upcoming-events/games-played stats.
export async function getMyLegacyEvents() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];
  await ensureEventParticipantsTable();

  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName",
       CASE WHEN e."eventType" = 'Tournament'
         THEN (SELECT COUNT(*) FROM "tournament_team" tt WHERE tt."tournamentId" = e.id AND tt.status = 'active')
         ELSE COUNT(ep.id)
       END as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     LEFT JOIN "event_participant" ep ON ep."eventId" = e.id
     WHERE e."organizerId" = $1 AND e."organizationId" IS NULL
     GROUP BY e.id, u.name, o.name
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`,
    [session.user.id]
  );
  return result.rows.map(serializeEvent);
}

export async function getJoinedEvents() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];
  await ensureEventParticipantsTable();

  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName",
       CASE WHEN e."eventType" = 'Tournament'
         THEN (SELECT COUNT(*) FROM "tournament_team" tt WHERE tt."tournamentId" = e.id AND tt.status = 'active')
         ELSE (SELECT COUNT(*) FROM "event_participant" all_ep WHERE all_ep."eventId" = e.id)
       END as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     WHERE e."organizerId" <> $1
       AND (
         EXISTS (SELECT 1 FROM "event_participant" ep WHERE ep."eventId" = e.id AND ep."userId" = $1)
         OR EXISTS (SELECT 1 FROM "tournament_team" tt WHERE tt."tournamentId" = e.id AND tt."captainId" = $1)
         OR EXISTS (SELECT 1 FROM "tournament_team" tt
                    JOIN "tournament_team_member" ttm ON ttm."teamId" = tt.id
                    WHERE tt."tournamentId" = e.id AND ttm."userId" = $1)
       )
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`,
    [session.user.id]
  );
  return result.rows.map(serializeEvent);
}

export async function getEventParticipationMap(eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Set();
  await ensureEventParticipantsTable();

  const result = await pool.query(
    `SELECT "eventId" FROM "event_participant" WHERE "eventId" = ANY($1) AND "userId" = $2`,
    [eventIds, session.user.id]
  );
  return new Set(result.rows.map((row: { eventId: string }) => row.eventId));
}

export async function getEventParticipants(eventId: string): Promise<EventParticipant[]> {
  await ensureEventParticipantsTable();
  const result = await pool.query(
    `SELECT u.id, u.name, u.image, ep."joinedAt"
     FROM "event_participant" ep
     JOIN "user" u ON u.id = ep."userId"
     WHERE ep."eventId" = $1
     ORDER BY ep."joinedAt" ASC`,
    [eventId]
  );
  return result.rows.map((row: EventParticipant & { joinedAt: Date | string }) => ({
    ...row,
    joinedAt: new Date(row.joinedAt).toISOString(),
  }));
}

export async function getTeamEvents(teamId: string): Promise<EventItem[]> {
  await ensureEventParticipantsTable();
  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName",
       CASE WHEN e."eventType" = 'Tournament'
         THEN (SELECT COUNT(*) FROM "tournament_team" tt WHERE tt."tournamentId" = e.id AND tt.status = 'active')
         ELSE (SELECT COUNT(*) FROM "event_participant" all_ep WHERE all_ep."eventId" = e.id)
       END as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     WHERE e.id IN (
       -- Regular events: any team member is a participant
       SELECT ep."eventId"
       FROM "event_participant" ep
       JOIN "team_member" tm ON tm."userId" = ep."userId"
       WHERE tm."teamId" = $1
       UNION
       -- Tournament events: team is registered via linkedTeamId
       SELECT tt."tournamentId"
       FROM "tournament_team" tt
       WHERE tt."linkedTeamId" = $1
     )
     GROUP BY e.id, u.name, o.name
     ORDER BY e."startDateTime" ASC`,
    [teamId]
  );
  return result.rows.map(serializeEvent);
}

async function fireJoinEmails(
  userId: string,
  eventId: string,
  eventRow: { title: string; sport: string; location: string; startDateTime: Date | string; organizerId: string; capacity: number | null }
) {
  const [userRow, organizerRow] = await Promise.all([
    pool.query(`SELECT name, email FROM "user" WHERE id = $1`, [userId]),
    pool.query(`SELECT name, email FROM "user" WHERE id = $1`, [eventRow.organizerId]),
  ]);
  const u = userRow.rows[0];
  const org = organizerRow.rows[0];
  const emailData = {
    eventTitle: eventRow.title,
    sport: eventRow.sport,
    location: eventRow.location,
    startDateTime: new Date(eventRow.startDateTime).toISOString(),
    eventId,
  };
  if (u?.email) sendEventJoinedEmail(u.email, { userName: u.name ?? "Athlete", ...emailData }).catch(() => {});
  const isOrganizerJoining = userId === eventRow.organizerId;
  if (!isOrganizerJoining && org?.email) {
    let participantCount = 1;
    let isFull = false;
    if (eventRow.capacity) {
      const countRes = await pool.query(`SELECT COUNT(*) FROM "event_participant" WHERE "eventId" = $1`, [eventId]);
      participantCount = Number(countRes.rows[0].count);
      isFull = participantCount >= Number(eventRow.capacity);
    }
    sendNewParticipantEmail(org.email, {
      organizerName: org.name ?? "Organizer",
      participantName: u?.name ?? "Athlete",
      participantCount,
      capacity: eventRow.capacity ? Number(eventRow.capacity) : null,
      ...emailData,
    }).catch(() => {});
    if (isFull) {
      sendEventFullEmail(org.email, {
        organizerName: org.name ?? "Organizer",
        eventTitle: eventRow.title,
        eventId,
        capacity: Number(eventRow.capacity),
      }).catch(() => {});
    }
  }
}

export async function joinEvent(eventId: string): Promise<{ error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Unauthorized" };
    await ensureEventParticipantsTable();

    const event = await pool.query(
      `SELECT id, title, sport, location, "organizerId", capacity, status, "endDateTime", "startDateTime" FROM "event" WHERE id = $1`,
      [eventId]
    );
    if (event.rows.length === 0) return { error: "Event not found" };
    if (event.rows[0].status === "cancelled") return { error: "This event has been cancelled" };
    if (new Date(event.rows[0].endDateTime) < new Date()) return { error: "Event has ended" };

    if (event.rows[0].capacity) {
      const participants = await pool.query(
        `SELECT COUNT(*) FROM "event_participant" WHERE "eventId" = $1`,
        [eventId]
      );
      if (Number(participants.rows[0].count) >= Number(event.rows[0].capacity)) {
        return { error: "Event is full" };
      }
    }

    await pool.query(
      `INSERT INTO "event_participant" (id, "eventId", "userId")
       VALUES ($1, $2, $3)
       ON CONFLICT ("eventId", "userId") DO NOTHING`,
      [crypto.randomUUID(), eventId, session.user.id]
    );

    fireJoinEmails(session.user.id, eventId, event.rows[0]).catch(() => {});

    revalidatePath("/events");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/events");
    return {};
  } catch (e) {
    console.error("[joinEvent]", e);
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

class InsufficientFundsError extends Error {}

async function firePaymentEmails(
  payerId: string,
  eventId: string,
  eventRow: { title: string; sport: string; location: string; startDateTime: Date | string; organizerId: string; capacity: number | null },
  amountCents: number
) {
  const [payerRow, organizerRow] = await Promise.all([
    pool.query(`SELECT name, email FROM "user" WHERE id = $1`, [payerId]),
    pool.query(`SELECT name, email FROM "user" WHERE id = $1`, [eventRow.organizerId]),
  ]);
  const payer = payerRow.rows[0];
  const org = organizerRow.rows[0];
  const emailData = {
    eventTitle: eventRow.title,
    sport: eventRow.sport,
    location: eventRow.location,
    startDateTime: new Date(eventRow.startDateTime).toISOString(),
    eventId,
  };
  if (payer?.email) {
    sendPaymentReceiptEmail(payer.email, {
      userName: payer.name ?? "Athlete",
      amountCents,
      currency: "cad",
      ...emailData,
    }).catch(() => {});
  }
  if (org?.email) {
    let participantCount = 1;
    let isFull = false;
    if (eventRow.capacity) {
      const countRes = await pool.query(`SELECT COUNT(*) FROM "event_participant" WHERE "eventId" = $1`, [eventId]);
      participantCount = Number(countRes.rows[0].count);
      isFull = participantCount >= Number(eventRow.capacity);
    }
    sendNewParticipantEmail(org.email, {
      organizerName: org.name ?? "Organizer",
      participantName: payer?.name ?? "Athlete",
      participantCount,
      capacity: eventRow.capacity ? Number(eventRow.capacity) : null,
      ...emailData,
    }).catch(() => {});
    if (isFull) {
      sendEventFullEmail(org.email, {
        organizerName: org.name ?? "Organizer",
        eventTitle: eventRow.title,
        eventId,
        capacity: Number(eventRow.capacity),
      }).catch(() => {});
    }
  }
}

export async function payForEventWithWallet(eventId: string): Promise<{ error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Unauthorized" };
    await ensureEventParticipantsTable();

    const eventRes = await pool.query(
      `SELECT id, title, sport, location, "organizerId", "organizationId", capacity, price, status, "endDateTime", "startDateTime" FROM "event" WHERE id = $1`,
      [eventId]
    );
    const event = eventRes.rows[0];
    if (!event) return { error: "Event not found" };
    if (event.status === "cancelled") return { error: "This event has been cancelled" };
    if (!event.price) return { error: "Event is free" };
    if (new Date(event.endDateTime) < new Date()) return { error: "Event has ended" };

    if (event.capacity) {
      const participants = await pool.query(`SELECT COUNT(*) FROM "event_participant" WHERE "eventId" = $1`, [eventId]);
      if (Number(participants.rows[0].count) >= Number(event.capacity)) return { error: "Event is full" };
    }

    const price = Number(event.price);
    const payerId = session.user.id;
    const organizerId = event.organizerId as string;
    const organizationId = event.organizationId as string | null;
    if (payerId === organizerId) return { error: "You can't pay to join your own event" };

    let alreadyJoined = false;
    try {
      await withTransaction(async (client) => {
        const insertRes = await client.query(
          `INSERT INTO "event_participant" (id, "eventId", "userId") VALUES ($1, $2, $3)
           ON CONFLICT ("eventId", "userId") DO NOTHING RETURNING id`,
          [crypto.randomUUID(), eventId, payerId]
        );
        if (insertRes.rowCount === 0) {
          alreadyJoined = true;
          return;
        }

        let payerBalanceAfter = 0;
        if (organizationId) {
          // Crediting a different table (organization) than the payer (user)
          // removes the same-table deadlock risk the sorted-lock-order trick
          // below exists for — two independent statements are enough.
          const debit = await client.query(
            `UPDATE "user" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 AND "walletBalance" >= $1 RETURNING "walletBalance"`,
            [price, payerId]
          );
          if (debit.rowCount === 0) throw new InsufficientFundsError();
          payerBalanceAfter = Number(debit.rows[0].walletBalance);

          const orgBalanceRes = await client.query(
            `UPDATE "organization" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2 RETURNING "walletBalance"`,
            [price, organizationId]
          );
          await client.query(
            `INSERT INTO "wallet_transaction" (id, "organizationId", type, amount, "balanceAfter", "eventId")
             VALUES ($1, $2, 'event_payment_received', $3, $4, $5)`,
            [crypto.randomUUID(), organizationId, price, orgBalanceRes.rows[0].walletBalance, eventId]
          );
        } else {
          // Touch the two user rows in a fixed (sorted) order across every payment,
          // regardless of who's paying whom, so concurrent transfers between the same
          // pair of users can't deadlock by locking rows in opposite order.
          const orderedIds = [payerId, organizerId].sort();
          for (const id of orderedIds) {
            if (id === payerId) {
              const debit = await client.query(
                `UPDATE "user" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 AND "walletBalance" >= $1 RETURNING "walletBalance"`,
                [price, payerId]
              );
              if (debit.rowCount === 0) throw new InsufficientFundsError();
              payerBalanceAfter = Number(debit.rows[0].walletBalance);
            } else {
              await client.query(`UPDATE "user" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2`, [price, organizerId]);
            }
          }
          const organizerBalanceRes = await client.query(`SELECT "walletBalance" FROM "user" WHERE id = $1`, [organizerId]);
          await client.query(
            `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "eventId")
             VALUES ($1, $2, 'event_payment_received', $3, $4, $5)`,
            [crypto.randomUUID(), organizerId, price, organizerBalanceRes.rows[0].walletBalance, eventId]
          );
        }

        await client.query(
          `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "eventId")
           VALUES ($1, $2, 'event_payment_sent', $3, $4, $5)`,
          [crypto.randomUUID(), payerId, -price, payerBalanceAfter, eventId]
        );

        await client.query(
          `INSERT INTO "event_payment" (id, "eventId", "userId", amount, currency, status, method)
           VALUES ($1, $2, $3, $4, 'cad', 'completed', 'wallet')`,
          [crypto.randomUUID(), eventId, payerId, price]
        );
      });
    } catch (e) {
      if (e instanceof InsufficientFundsError) return { error: "Insufficient wallet balance" };
      throw e;
    }

    if (alreadyJoined) return {};

    firePaymentEmails(payerId, eventId, event, price).catch(() => {});

    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    revalidatePath("/dashboard");
    return {};
  } catch (e) {
    console.error("[payForEventWithWallet]", e);
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// Called from the Stripe webhook once a direct-checkout event payment
// (method 'stripe_direct') has actually been captured. remainderCents is what
// Stripe actually charged the card; walletCreditCents is the wallet-credit
// portion computed (optimistically, against the payer's balance at checkout
// time) in /api/stripe/event-checkout — DoorDash-style "apply my balance,
// charge the rest to my card". The payer's wallet is only debited now, at
// completion, not at checkout time, so an abandoned checkout never leaves
// anything reserved/stuck. The organizer's wallet is credited the full price
// exactly as if it were a wallet transfer, so refunds can still auto-reverse
// through the wallet ledger (see runEventRefundSweep) instead of requiring a
// real Stripe refund.
export async function completeEventStripePayment(
  eventId: string,
  payerId: string,
  remainderCents: number,
  walletCreditCents: number,
  stripeSessionId: string
): Promise<void> {
  await ensureEventParticipantsTable();

  const eventRes = await pool.query(
    `SELECT id, title, sport, location, "organizerId", "organizationId", capacity, status, "endDateTime", "startDateTime" FROM "event" WHERE id = $1`,
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event) return;
  const organizerId = event.organizerId as string;
  const organizationId = event.organizationId as string | null;
  const priceCents = remainderCents + walletCreditCents;
  // The card was already charged by the time this webhook fires — Stripe
  // Checkout sessions can sit open for a while, so the event may have been
  // cancelled or ended out from under the payer in the meantime. The money
  // still has to land somewhere accounted-for (the organizer's wallet, same
  // as any other event payment), but runEventRefundSweep already ran (or
  // never will, since the event already ended) and won't pick this row up —
  // so flag it for manual review instead of leaving it silently unrefundable.
  const eventInvalid = event.status === "cancelled" || new Date(event.endDateTime) < new Date();

  let alreadyProcessed = false;
  let alreadyJoined = false;
  let creditShortfallCents = 0;
  await withTransaction(async (client) => {
    // Idempotency gate: a Stripe webhook can be delivered more than once for
    // the same checkout session, and must never double-credit the organizer.
    const paymentInsert = await client.query(
      `INSERT INTO "event_payment" (id, "eventId", "userId", "stripeSessionId", amount, currency, status, method)
       VALUES ($1, $2, $3, $4, $5, 'cad', 'completed', 'stripe_direct')
       ON CONFLICT ("stripeSessionId") DO NOTHING RETURNING id`,
      [crypto.randomUUID(), eventId, payerId, stripeSessionId, priceCents]
    );
    if (paymentInsert.rowCount === 0) {
      alreadyProcessed = true;
      return;
    }

    const participantInsert = await client.query(
      `INSERT INTO "event_participant" (id, "eventId", "userId") VALUES ($1, $2, $3)
       ON CONFLICT ("eventId", "userId") DO NOTHING RETURNING id`,
      [crypto.randomUUID(), eventId, payerId]
    );
    alreadyJoined = participantInsert.rowCount === 0;

    // Best-effort: apply the wallet credit that was computed at checkout
    // time. The only way this can fail is if the payer spent that same
    // balance elsewhere in the (usually short) window between opening
    // Stripe Checkout and completing payment — rare, since nothing is
    // reserved up front. If it does, we don't block the registration (the
    // card was already charged); we just credit the organizer less than the
    // full price and flag the gap below instead of eating the loss silently.
    let creditApplied = 0;
    if (walletCreditCents > 0) {
      const debit = await client.query(
        `UPDATE "user" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 AND "walletBalance" >= $1 RETURNING "walletBalance"`,
        [walletCreditCents, payerId]
      );
      if (debit.rowCount && debit.rowCount > 0) {
        creditApplied = walletCreditCents;
        // stripeSessionId is left null here: wallet_transaction has a table-wide
        // UNIQUE index on that column (not scoped per user), and the organizer's
        // credit row below already carries it — idempotency for the whole
        // operation is gated by event_payment's own unique stripeSessionId
        // constraint further up, so this row doesn't need to carry it too.
        await client.query(
          `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "eventId")
           VALUES ($1, $2, 'event_payment_sent', $3, $4, $5)`,
          [crypto.randomUUID(), payerId, -walletCreditCents, debit.rows[0].walletBalance, eventId]
        );
      } else {
        creditShortfallCents = walletCreditCents;
      }
    }

    const organizerCreditCents = remainderCents + creditApplied;
    if (organizationId) {
      const orgBalanceRes = await client.query(
        `UPDATE "organization" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2 RETURNING "walletBalance"`,
        [organizerCreditCents, organizationId]
      );
      await client.query(
        `INSERT INTO "wallet_transaction" (id, "organizationId", type, amount, "balanceAfter", "eventId", "stripeSessionId")
         VALUES ($1, $2, 'event_payment_received', $3, $4, $5, $6)`,
        [crypto.randomUUID(), organizationId, organizerCreditCents, orgBalanceRes.rows[0].walletBalance, eventId, stripeSessionId]
      );
    } else {
      const organizerBalanceRes = await client.query(
        `UPDATE "user" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2 RETURNING "walletBalance"`,
        [organizerCreditCents, organizerId]
      );
      await client.query(
        `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "eventId", "stripeSessionId")
         VALUES ($1, $2, 'event_payment_received', $3, $4, $5, $6)`,
        [crypto.randomUUID(), organizerId, organizerCreditCents, organizerBalanceRes.rows[0].walletBalance, eventId, stripeSessionId]
      );
    }
  });

  if (alreadyProcessed) return;

  if (eventInvalid || creditShortfallCents > 0) {
    const payerRow = await pool.query(`SELECT name FROM "user" WHERE id = $1`, [payerId]);
    const reasons: string[] = [];
    if (event.status === "cancelled") reasons.push("paid via Stripe after the event was cancelled");
    else if (eventInvalid) reasons.push("paid via Stripe after the event had already ended");
    if (creditShortfallCents > 0) {
      reasons.push(
        `wallet credit of $${(creditShortfallCents / 100).toFixed(2)} could not be applied (balance changed before checkout completed) — organizer was credited $${(creditShortfallCents / 100).toFixed(2)} short`
      );
    }
    notifyAdminsOfRefundIssues(event.title, eventId, [
      { payerName: payerRow.rows[0]?.name ?? null, amountCents: priceCents, reason: reasons.join("; ") + " — needs manual review" },
    ]).catch(() => {});
  } else if (!alreadyJoined) {
    firePaymentEmails(payerId, eventId, event, priceCents).catch(() => {});
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/dashboard");
}

export async function leaveEvent(eventId: string): Promise<{ error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Unauthorized" };
    await ensureEventParticipantsTable();

    await pool.query(
      `DELETE FROM "event_participant" WHERE "eventId" = $1 AND "userId" = $2`,
      [eventId, session.user.id]
    );

    revalidatePath("/events");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/events");
    return {};
  } catch (e) {
    console.error("[leaveEvent]", e);
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateEvent(eventId: string, data: {
  title: string;
  sport: string;
  eventType: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  coverImageUrl?: string;
  galleryItems?: GalleryItem[];
  agendaItems?: AgendaItem[];
  registrationMode: string;
  capacity?: number;
  maxPlayersPerTeam?: number;
  description?: string;
  rules?: string;
  customFormEnabled?: boolean;
  price?: number;
  formFields?: Array<{
    label: string;
    fieldType: string;
    required: boolean;
    options: string[];
    order: number;
  }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  await ensureFormTables();

  const authResult = await authorizeEventManagement(eventId, session.user.id);
  if ("error" in authResult) throw new Error(authResult.error);

  const galleryItems = data.galleryItems ?? [];
  const galleryUrls = galleryItems.map(i => i.url);
  const agendaItems = data.agendaItems ?? [];

  await pool.query(
    `UPDATE "event" SET
      title=$1, sport=$2, "eventType"=$3, location=$4,
      "startDateTime"=$5, "endDateTime"=$6, "coverImageUrl"=$7,
      "galleryUrls"=$8, "galleryItems"=$9::jsonb,
      "registrationMode"=$10, capacity=$11, "maxPlayersPerTeam"=$12,
      description=$13, rules=$14, "customFormEnabled"=$15, price=$16,
      "agendaItems"=$17::jsonb,
      "updatedAt"=NOW()
    WHERE id=$18`,
    [
      data.title, data.sport, data.eventType, data.location,
      data.startDateTime, data.endDateTime, data.coverImageUrl ?? null,
      galleryUrls, JSON.stringify(galleryItems),
      data.registrationMode, data.capacity ?? null, data.maxPlayersPerTeam ?? null,
      data.description ?? null, data.rules ?? null,
      data.customFormEnabled ?? false, data.price ?? 0,
      JSON.stringify(agendaItems),
      eventId,
    ]
  );

  await pool.query(`DELETE FROM "event_form_field" WHERE "eventId" = $1`, [eventId]);
  if (data.customFormEnabled && data.formFields?.length) {
    for (const field of data.formFields) {
      await pool.query(
        `INSERT INTO "event_form_field" (id, "eventId", label, "fieldType", required, options, "order")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), eventId, field.label, field.fieldType, field.required, field.options, field.order]
      );
    }
  }

  revalidatePath("/", "layout");
}

async function getEventSignupRecipients(
  eventId: string,
  isTournament: boolean
): Promise<{ userId: string; name: string | null; email: string }[]> {
  if (isTournament) {
    const result = await pool.query(
      `SELECT DISTINCT u.id as "userId", u.name, u.email FROM (
         SELECT "captainId" as "userId" FROM "tournament_team" WHERE "tournamentId" = $1
         UNION
         SELECT ttm."userId" FROM "tournament_team_member" ttm
         JOIN "tournament_team" tt ON tt.id = ttm."teamId"
         WHERE tt."tournamentId" = $1
       ) participants
       JOIN "user" u ON u.id = participants."userId"
       WHERE u.email IS NOT NULL`,
      [eventId]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT DISTINCT u.id as "userId", u.name, u.email FROM "event_participant" ep
     JOIN "user" u ON u.id = ep."userId"
     WHERE ep."eventId" = $1 AND u.email IS NOT NULL`,
    [eventId]
  );
  return result.rows;
}

async function notifyAdminsOfRefundIssues(
  eventTitle: string,
  eventId: string,
  failures: { payerName: string | null; amountCents: number; reason: string }[]
) {
  const admins = await pool.query(`SELECT email FROM "user" WHERE role = 'super_admin' AND email IS NOT NULL`);
  if (admins.rows.length === 0) return;

  const failureRows = failures
    .map(
      (f) =>
        `<li>${f.payerName ?? "Unknown"} — ${f.amountCents > 0 ? `${(f.amountCents / 100).toFixed(2)} CAD — ` : ""}${f.reason}</li>`
    )
    .join("");

  const html = layout(`
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#e21d12;">Refunds need review</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:900;color:#18181b;">Cancelling "${eventTitle}" left some payments unrefunded</h1>
    <ul style="font-size:14px;color:#52525b;line-height:1.8;">${failureRows}</ul>
    <center>${ctaButton(`${BASE_URL}/events/${eventId}`, "View event →")}</center>
  `);

  await Promise.all(
    admins.rows.map((row: { email: string }) =>
      resend.emails
        .send({ from: FROM, to: row.email, subject: `Action needed: refunds for "${eventTitle}"`, html })
        .catch(() => {})
    )
  );
}

// The reverse of payForEventWithWallet/payForTeamWithWallet's transfer:
// organizer (or org) debited, payer credited, in one transaction. Shared by
// runEventRefundSweep (the bulk cancel-time sweep, below) and
// refundEventParticipant (a single manual refund, further below) — the two
// callers differ only in which rows they look up and mark refunded, not in
// how the money moves.
async function reverseWalletPayment({
  organizerId,
  organizationId,
  payerId,
  amount,
  refKind,
  refId,
  markRefunded,
}: {
  organizerId: string;
  organizationId: string | null;
  payerId: string;
  amount: number;
  refKind: "eventId" | "teamId";
  refId: string;
  markRefunded: (client: PoolClient) => Promise<void>;
}) {
  await withTransaction(async (client) => {
    let organizerBalanceAfter = 0;
    if (organizationId) {
      // Crediting a different table (organization) than the payer (user)
      // removes the same-table deadlock risk the sorted-lock-order trick
      // in the legacy branch below exists for.
      const debit = await client.query(
        `UPDATE "organization" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 AND "walletBalance" >= $1 RETURNING "walletBalance"`,
        [amount, organizationId]
      );
      if (debit.rowCount === 0) throw new Error("Organization balance too low to refund");
      organizerBalanceAfter = Number(debit.rows[0].walletBalance);
      await client.query(`UPDATE "user" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2`, [amount, payerId]);
    } else {
      // Fixed sorted lock order, same invariant as payForEventWithWallet/payForTeamWithWallet —
      // but direction is REVERSED here: organizer is debited, payer is credited.
      const orderedIds = [organizerId, payerId].sort();
      for (const id of orderedIds) {
        if (id === organizerId) {
          const debit = await client.query(
            `UPDATE "user" SET "walletBalance" = "walletBalance" - $1 WHERE id = $2 AND "walletBalance" >= $1 RETURNING "walletBalance"`,
            [amount, organizerId]
          );
          if (debit.rowCount === 0) throw new Error("Organizer balance too low to refund");
          organizerBalanceAfter = Number(debit.rows[0].walletBalance);
        } else {
          await client.query(`UPDATE "user" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2`, [amount, payerId]);
        }
      }
    }
    const payerBalanceRes = await client.query(`SELECT "walletBalance" FROM "user" WHERE id = $1`, [payerId]);

    if (organizationId) {
      await client.query(
        `INSERT INTO "wallet_transaction" (id, "organizationId", type, amount, "balanceAfter", "${refKind}")
         VALUES ($1, $2, 'refund_sent', $3, $4, $5)`,
        [crypto.randomUUID(), organizationId, -amount, organizerBalanceAfter, refId]
      );
    } else {
      await client.query(
        `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "${refKind}")
         VALUES ($1, $2, 'refund_sent', $3, $4, $5)`,
        [crypto.randomUUID(), organizerId, -amount, organizerBalanceAfter, refId]
      );
    }
    await client.query(
      `INSERT INTO "wallet_transaction" (id, "userId", type, amount, "balanceAfter", "${refKind}")
       VALUES ($1, $2, 'refund_received', $3, $4, $5)`,
      [crypto.randomUUID(), payerId, amount, payerBalanceRes.rows[0].walletBalance, refId]
    );
    await markRefunded(client);
  });
}

// Refunds every still-unrefunded wallet-funded payment for this event/tournament,
// reversing the original payForEventWithWallet/payForTeamWithWallet transfer
// (organizer debited, payer credited). Gated purely on refundedAt IS NULL — not on
// event.status — so it's safe to call again later if a run is interrupted partway.
// Sequential on purpose: the shared Pool is capped at max:10, so refunding a large
// tournament's teams concurrently would starve every other in-flight request.
export async function runEventRefundSweep(
  eventId: string
): Promise<{ refunded: Map<string, number>; pendingReview: Set<string> }> {
  const refunded = new Map<string, number>();
  const pendingReview = new Set<string>();
  const failures: { payerName: string | null; amountCents: number; reason: string }[] = [];

  const eventRes = await pool.query(`SELECT title, "eventType", "organizerId", "organizationId" FROM "event" WHERE id = $1`, [eventId]);
  const event = eventRes.rows[0];
  if (!event) return { refunded, pendingReview };
  const isTournament = event.eventType === "Tournament";
  const organizerId = event.organizerId as string;
  const organizationId = event.organizationId as string | null;

  async function refundOne(
    payerId: string,
    amount: number,
    refKind: "eventId" | "teamId",
    refId: string,
    markRefunded: (client: PoolClient) => Promise<void>
  ) {
    await reverseWalletPayment({ organizerId, organizationId, payerId, amount, refKind, refId, markRefunded });
  }

  if (isTournament) {
    const rows = await pool.query(
      `SELECT ttp.id, ttp."teamId", ttp."userId", ttp.amount, u.name as "payerName"
       FROM "tournament_team_payment" ttp
       JOIN "tournament_team" tt ON tt.id = ttp."teamId"
       JOIN "user" u ON u.id = ttp."userId"
       WHERE tt."tournamentId" = $1 AND ttp."refundedAt" IS NULL
       ORDER BY ttp."createdAt" ASC`,
      [eventId]
    );
    for (const row of rows.rows) {
      const payerId = row.userId as string;
      const amount = Number(row.amount);
      try {
        await refundOne(payerId, amount, "teamId", row.teamId, (client) =>
          client.query(`UPDATE "tournament_team_payment" SET "refundedAt" = NOW() WHERE id = $1`, [row.id]).then(() => {})
        );
        refunded.set(payerId, amount);
      } catch (e) {
        pendingReview.add(payerId);
        failures.push({ payerName: row.payerName, amountCents: amount, reason: e instanceof Error ? e.message : "Unknown error" });
      }
    }
  } else {
    const rows = await pool.query(
      `SELECT ep.id, ep."userId", ep.amount, u.name as "payerName"
       FROM "event_payment" ep
       JOIN "user" u ON u.id = ep."userId"
       WHERE ep."eventId" = $1 AND ep.status = 'completed' AND ep.method IN ('wallet', 'stripe_direct') AND ep."refundedAt" IS NULL
       ORDER BY ep."createdAt" ASC`,
      [eventId]
    );
    for (const row of rows.rows) {
      const payerId = row.userId as string;
      const amount = Number(row.amount);
      try {
        await refundOne(payerId, amount, "eventId", eventId, (client) =>
          client
            .query(`UPDATE "event_payment" SET status = 'refunded', "refundedAt" = NOW() WHERE id = $1`, [row.id])
            .then(() => {})
        );
        refunded.set(payerId, amount);
      } catch (e) {
        pendingReview.add(payerId);
        failures.push({ payerName: row.payerName, amountCents: amount, reason: e instanceof Error ? e.message : "Unknown error" });
      }
    }

    // Pre-wallet-system payments — a real Stripe charge, not a wallet transfer.
    // Refunding these needs stripe.refunds.create against the original charge, which
    // is a materially different (and riskier) operation than a wallet reversal, so
    // they're flagged for manual review instead of auto-refunded.
    const legacyRows = await pool.query(
      `SELECT ep."userId", u.name as "payerName" FROM "event_payment" ep
       JOIN "user" u ON u.id = ep."userId"
       WHERE ep."eventId" = $1 AND ep.status = 'completed' AND ep.method = 'stripe'`,
      [eventId]
    );
    for (const row of legacyRows.rows) {
      pendingReview.add(row.userId);
      failures.push({ payerName: row.payerName, amountCents: 0, reason: "legacy Stripe payment — needs manual refund" });
    }
  }

  if (failures.length > 0) {
    await notifyAdminsOfRefundIssues(event.title, eventId, failures).catch(() => {});
  }

  return { refunded, pendingReview };
}

// Read-only preview shown in the cancel-confirmation modal before an
// organizer commits — "this will refund N participants a total of $X" —
// computed the same way runEventRefundSweep selects rows, but without
// touching anything.
export async function getEventRefundPreview(
  eventId: string
): Promise<{ error?: string; count?: number; totalCents?: number }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const authResult = await authorizeEventManagement(eventId, session.user.id);
  if ("error" in authResult) return { error: authResult.error };

  const isTournament = authResult.event.eventType === "Tournament";
  const result = isTournament
    ? await pool.query(
        `SELECT COUNT(*)::int as count, COALESCE(SUM(ttp.amount), 0)::bigint as total
         FROM "tournament_team_payment" ttp
         JOIN "tournament_team" tt ON tt.id = ttp."teamId"
         WHERE tt."tournamentId" = $1 AND ttp."refundedAt" IS NULL`,
        [eventId]
      )
    : await pool.query(
        `SELECT COUNT(*)::int as count, COALESCE(SUM(amount), 0)::bigint as total
         FROM "event_payment"
         WHERE "eventId" = $1 AND status = 'completed' AND method IN ('wallet', 'stripe_direct') AND "refundedAt" IS NULL`,
        [eventId]
      );

  return { count: Number(result.rows[0].count), totalCents: Number(result.rows[0].total) };
}

export async function cancelEvent(
  eventId: string
): Promise<{ error?: string; refundedCount?: number; refundedTotalCents?: number; pendingReviewCount?: number }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Unauthorized" };

    const authResult = await authorizeEventManagement(eventId, session.user.id);
    if ("error" in authResult) return { error: authResult.error };

    const flip = await pool.query(
      `UPDATE "event" SET status = 'cancelled', "updatedAt" = NOW() WHERE id = $1 AND status = 'active' RETURNING id`,
      [eventId]
    );
    if (flip.rowCount === 0) return { error: "Event already cancelled" };

    const { refunded, pendingReview } = await runEventRefundSweep(eventId);

    const eventRow = authResult.event;
    const isTournament = eventRow.eventType === "Tournament";
    const recipients = await getEventSignupRecipients(eventId, isTournament);

    for (const recipient of recipients) {
      const refundedAmount = refunded.get(recipient.userId);
      sendEventCancelledEmail(recipient.email, {
        userName: recipient.name ?? "Athlete",
        eventTitle: eventRow.title,
        sport: eventRow.sport,
        location: eventRow.location,
        startDateTime: new Date(eventRow.startDateTime).toISOString(),
        refund:
          refundedAmount !== undefined
            ? { amountCents: refundedAmount, currency: "cad" }
            : pendingReview.has(recipient.userId)
            ? "pending_review"
            : undefined,
      }).catch(() => {});
    }

    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    revalidatePath("/dashboard");

    const refundedTotalCents = Array.from(refunded.values()).reduce((sum, amount) => sum + amount, 0);
    return { refundedCount: refunded.size, refundedTotalCents, pendingReviewCount: pendingReview.size };
  } catch (e) {
    console.error("[cancelEvent]", e);
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function sendIndividualRefundEmail(
  to: string,
  data: { userName: string; eventTitle: string; amountCents: number; eventId: string }
) {
  const html = layout(`
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#e21d12;">Refund issued</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#18181b;">You've been refunded for "${data.eventTitle}"</h1>
    <p style="font-size:14px;color:#52525b;line-height:1.7;">Hi ${data.userName}, the organizer has refunded your registration for "${data.eventTitle}" and removed you from the event. ${(data.amountCents / 100).toFixed(2)} CAD has been credited to your Playver wallet.</p>
    <center>${ctaButton(`${BASE_URL}/dashboard/wallet`, "View your wallet →")}</center>
  `);
  await resend.emails
    .send({ from: FROM, to, subject: `You've been refunded for "${data.eventTitle}"`, html })
    .catch(() => {});
}

// Manual, single-participant refund — for when something goes wrong for one
// specific signup (an injury, a duplicate registration, a seat the organizer
// needs to free up) without cancelling the whole event. Reuses
// reverseWalletPayment, the same reversal reverseWalletPayment/
// runEventRefundSweep uses for a full cancellation, but targets exactly one
// event_payment row instead of every unrefunded one. Also removes the
// participant — a refunded seat isn't an occupied seat, and this keeps
// capacity-limited events correct.
export async function refundEventParticipant(eventId: string, userId: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const eventRes = await pool.query(
    `SELECT id, title, "eventType", "organizerId", "organizationId" FROM "event" WHERE id = $1`,
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event) return { error: "Event not found" };
  if (event.eventType === "Tournament") {
    return { error: "Tournament team payments are refunded by cancelling the tournament" };
  }

  const organizerId = event.organizerId as string;
  const organizationId = event.organizationId as string | null;

  if (organizationId) {
    try {
      await requireOrganizationPermission("ISSUE_REFUNDS");
    } catch {
      return { error: "You don't have permission to issue refunds" };
    }
  } else if (session.user.id !== organizerId) {
    return { error: "Unauthorized" };
  }

  const paymentRes = await pool.query(
    `SELECT id, amount FROM "event_payment"
     WHERE "eventId" = $1 AND "userId" = $2 AND status = 'completed' AND method IN ('wallet', 'stripe_direct') AND "refundedAt" IS NULL`,
    [eventId, userId]
  );
  const payment = paymentRes.rows[0];
  if (!payment) return { error: "No refundable payment found for this participant" };
  const amount = Number(payment.amount);

  try {
    await reverseWalletPayment({
      organizerId,
      organizationId,
      payerId: userId,
      amount,
      refKind: "eventId",
      refId: eventId,
      markRefunded: async (client) => {
        await client.query(`UPDATE "event_payment" SET status = 'refunded', "refundedAt" = NOW() WHERE id = $1`, [payment.id]);
        await client.query(`DELETE FROM "event_participant" WHERE "eventId" = $1 AND "userId" = $2`, [eventId, userId]);
      },
    });
  } catch (e) {
    console.error("[refundEventParticipant]", e);
    return { error: e instanceof Error ? e.message : "Something went wrong — please try again" };
  }

  const userRow = await pool.query(`SELECT name, email FROM "user" WHERE id = $1`, [userId]);
  const u = userRow.rows[0];
  if (u?.email) {
    sendIndividualRefundEmail(u.email, { userName: u.name ?? "Athlete", eventTitle: event.title, amountCents: amount, eventId }).catch(() => {});
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/organizer/registrations");
  revalidatePath("/dashboard");
  return {};
}

export async function postponeEvent(
  eventId: string,
  newStartDateTime: string,
  newEndDateTime: string
): Promise<{ error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Unauthorized" };

    const authResult = await authorizeEventManagement(eventId, session.user.id);
    if ("error" in authResult) return { error: authResult.error };

    if (new Date(newEndDateTime) <= new Date(newStartDateTime)) return { error: "End date must be after start date" };
    if (new Date(newStartDateTime) < new Date()) return { error: "New date must be in the future" };

    const eventRow = authResult.event;
    const oldStartDateTime = new Date(eventRow.startDateTime).toISOString();

    const flip = await pool.query(
      `UPDATE "event" SET "startDateTime" = $2, "endDateTime" = $3, "updatedAt" = NOW() WHERE id = $1 AND status = 'active' RETURNING id`,
      [eventId, newStartDateTime, newEndDateTime]
    );
    if (flip.rowCount === 0) return { error: "Event is cancelled and can't be rescheduled" };

    const isTournament = eventRow.eventType === "Tournament";
    const recipients = await getEventSignupRecipients(eventId, isTournament);
    for (const recipient of recipients) {
      sendEventPostponedEmail(recipient.email, {
        userName: recipient.name ?? "Athlete",
        eventTitle: eventRow.title,
        sport: eventRow.sport,
        location: eventRow.location,
        oldStartDateTime,
        newStartDateTime: new Date(newStartDateTime).toISOString(),
        eventId,
      }).catch(() => {});
    }

    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    revalidatePath("/dashboard");
    return {};
  } catch (e) {
    console.error("[postponeEvent]", e);
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function getEventFormFields(eventId: string): Promise<FormField[]> {
  await ensureFormTables();
  const result = await pool.query(
    `SELECT id, "eventId", label, "fieldType", required, options, "order"
     FROM "event_form_field"
     WHERE "eventId" = $1
     ORDER BY "order" ASC`,
    [eventId]
  );
  return result.rows.map((row: {
    id: string; eventId: string; label: string;
    fieldType: string; required: boolean; options: string[]; order: number;
  }) => ({
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    fieldType: row.fieldType as FormFieldType,
    required: row.required,
    options: row.options ?? [],
    order: row.order,
  }));
}

export async function joinEventWithForm(
  eventId: string,
  responses: FormResponseInput[]
): Promise<{ error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Unauthorized" };
    await ensureEventParticipantsTable();
    await ensureFormTables();

    const event = await pool.query(
      `SELECT id, title, sport, location, "organizerId", capacity, status, "endDateTime", "startDateTime" FROM "event" WHERE id = $1`,
      [eventId]
    );
    if (event.rows.length === 0) return { error: "Event not found" };
    if (event.rows[0].status === "cancelled") return { error: "This event has been cancelled" };
    if (new Date(event.rows[0].endDateTime) < new Date()) return { error: "Event has ended" };

    if (event.rows[0].capacity) {
      const participants = await pool.query(
        `SELECT COUNT(*) FROM "event_participant" WHERE "eventId" = $1`,
        [eventId]
      );
      if (Number(participants.rows[0].count) >= Number(event.rows[0].capacity)) {
        return { error: "Event is full" };
      }
    }

    await pool.query(
      `INSERT INTO "event_participant" (id, "eventId", "userId")
       VALUES ($1, $2, $3)
       ON CONFLICT ("eventId", "userId") DO NOTHING`,
      [crypto.randomUUID(), eventId, session.user.id]
    );

    fireJoinEmails(session.user.id, eventId, event.rows[0]).catch(() => {});

    for (const response of responses) {
      if (response.value !== undefined && response.value !== "") {
        await pool.query(
          `INSERT INTO "event_form_response" (id, "eventId", "userId", "fieldId", value)
           VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), eventId, session.user.id, response.fieldId, response.value]
        );
      }
    }

    revalidatePath("/events");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/events");
    return {};
  } catch (e) {
    console.error("[joinEventWithForm]", e);
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
