"use server";

// The organizer's view of who has registered for their events/tournaments —
// participant counts, rosters, and export-style summaries for the
// /organizer/registrations page. Read-only; actual join/leave/payment logic
// lives in event.ts and tournament.ts.

import { pool } from "@/lib/db";
import { requireOrganizationPermission } from "./organization";
import { hasPermission } from "@/lib/organizer-permissions";
import { ensureTournamentTables } from "@/lib/tournament-tables";

export type OrganizerEventSummary = {
  id: string;
  title: string;
  eventType: string;
  startDateTime: string;
  endDateTime: string;
  participantCount: number;
};

function mapEventSummary(row: {
  id: string;
  title: string;
  eventType: string;
  startDateTime: Date | string;
  endDateTime: Date | string;
  participantCount: string | number;
}): OrganizerEventSummary {
  return {
    id: row.id,
    title: row.title,
    eventType: row.eventType,
    startDateTime: new Date(row.startDateTime).toISOString(),
    endDateTime: new Date(row.endDateTime).toISOString(),
    participantCount: Number(row.participantCount ?? 0),
  };
}

// Gates the whole Registrations page. Thrown (not returned) so the page can
// use the same try/catch -> ComingSoonPanel pattern as the People page.
export async function getOrganizationEvents(): Promise<OrganizerEventSummary[]> {
  const { organization } = await requireOrganizationPermission("MANAGE_REGISTRATIONS");

  const result = await pool.query(
    `SELECT e.id, e.title, e."eventType", e."startDateTime", e."endDateTime",
       CASE WHEN e."eventType" = 'Tournament'
         THEN (SELECT COUNT(*) FROM "tournament_team" tt WHERE tt."tournamentId" = e.id)
         ELSE (SELECT COUNT(*) FROM "event_participant" ep WHERE ep."eventId" = e.id)
       END AS "participantCount"
     FROM "event" e
     WHERE e."organizationId" = $1
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`,
    [organization.id]
  );

  return result.rows.map(mapEventSummary);
}

export type RegistrantRow = {
  id: string;
  name: string;
  image: string | null;
  joinedAt: string;
  // null means "redacted" (viewer lacks VIEW_SENSITIVE_PARTICIPANT_DATA), not "unknown".
  email: string | null;
  customFields: { label: string; value: string | null }[];
  // null means either redacted (no VIEW_PAYMENTS) or nothing to show (free event).
  payment: { amountCents: number; status: string } | null;
  // null for individual (non-tournament) events. For tournaments, every row
  // belongs to a team — the captain gets their own row (isCaptain: true) plus
  // one row per accepted/pending teammate.
  team: { name: string; isCaptain: boolean; pending: boolean } | null;
};

export type EventRegistrants =
  | { error: string }
  | {
      event: OrganizerEventSummary;
      canViewContactInfo: boolean;
      canViewPayments: boolean;
      // Individual (non-tournament) events only — see refundEventParticipant
      // in event.ts. Tournament team payments are refunded by cancelling the
      // tournament, not per-member.
      canIssueRefunds: boolean;
      registrants: RegistrantRow[];
    };

// Called imperatively from the client when an organizer picks an event, so it
// returns { error } instead of throwing — a bad eventId or a permission edge
// case (role downgraded mid-session, event unlinked from the org) should just
// surface inline, not blow up the whole page.
export async function getEventRegistrants(eventId: string): Promise<EventRegistrants> {
  let organization, role;
  try {
    ({ organization, role } = await requireOrganizationPermission("MANAGE_REGISTRATIONS"));
  } catch {
    return { error: "Forbidden" };
  }

  const eventResult = await pool.query(
    `SELECT id, title, "eventType", "startDateTime", "endDateTime", price, "customFormEnabled"
     FROM "event" WHERE id = $1 AND "organizationId" = $2`,
    [eventId, organization.id]
  );
  const eventRow = eventResult.rows[0];
  if (!eventRow) return { error: "Event not found" };

  const canViewContactInfo = hasPermission(role, "VIEW_SENSITIVE_PARTICIPANT_DATA");
  const canViewPayments = hasPermission(role, "VIEW_PAYMENTS");
  const canIssueRefunds = eventRow.eventType !== "Tournament" && hasPermission(role, "ISSUE_REFUNDS");

  const registrants: RegistrantRow[] =
    eventRow.eventType === "Tournament"
      ? await getTournamentRegistrants(eventId, eventRow.price, canViewContactInfo, canViewPayments)
      : await getIndividualRegistrants(eventId, eventRow.price, eventRow.customFormEnabled, canViewContactInfo, canViewPayments);

  return {
    event: mapEventSummary({ ...eventRow, participantCount: registrants.length }),
    canViewContactInfo,
    canViewPayments,
    canIssueRefunds,
    registrants,
  };
}

async function getIndividualRegistrants(
  eventId: string,
  price: number,
  customFormEnabled: boolean,
  canViewContactInfo: boolean,
  canViewPayments: boolean
): Promise<RegistrantRow[]> {
  const participantsResult = await pool.query(
    `SELECT u.id, u.name, u.email, u.image, ep."joinedAt"
     FROM "event_participant" ep
     JOIN "user" u ON u.id = ep."userId"
     WHERE ep."eventId" = $1
     ORDER BY ep."joinedAt" ASC`,
    [eventId]
  );
  const participantIds: string[] = participantsResult.rows.map((r) => r.id);

  const [formFieldsResult, formResponsesResult, paymentsResult] = await Promise.all([
    customFormEnabled
      ? pool.query(`SELECT id, label FROM "event_form_field" WHERE "eventId" = $1 ORDER BY "order" ASC`, [eventId])
      : Promise.resolve({ rows: [] as { id: string; label: string }[] }),
    customFormEnabled && participantIds.length > 0
      ? pool.query(`SELECT "userId", "fieldId", value FROM "event_form_response" WHERE "eventId" = $1`, [eventId])
      : Promise.resolve({ rows: [] as { userId: string; fieldId: string; value: string | null }[] }),
    price > 0 && participantIds.length > 0
      ? pool.query(
          `SELECT "userId", amount, status FROM "event_payment" WHERE "eventId" = $1 AND status <> 'refunded'`,
          [eventId]
        )
      : Promise.resolve({ rows: [] as { userId: string; amount: number; status: string }[] }),
  ]);

  const fieldLabels = new Map(formFieldsResult.rows.map((f) => [f.id, f.label]));
  const responsesByUser = new Map<string, { label: string; value: string | null }[]>();
  for (const r of formResponsesResult.rows) {
    const label = fieldLabels.get(r.fieldId);
    if (!label) continue;
    const list = responsesByUser.get(r.userId) ?? [];
    list.push({ label, value: r.value });
    responsesByUser.set(r.userId, list);
  }
  const paymentByUser = new Map(
    paymentsResult.rows.map((p) => [p.userId, { amountCents: Number(p.amount), status: p.status }])
  );

  return participantsResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    image: row.image,
    joinedAt: new Date(row.joinedAt).toISOString(),
    email: canViewContactInfo ? row.email : null,
    customFields: canViewContactInfo ? responsesByUser.get(row.id) ?? [] : [],
    payment: canViewPayments ? paymentByUser.get(row.id) ?? null : null,
    team: null,
  }));
}

async function getTournamentRegistrants(
  tournamentId: string,
  price: number,
  canViewContactInfo: boolean,
  canViewPayments: boolean
): Promise<RegistrantRow[]> {
  await ensureTournamentTables();

  const teamsResult = await pool.query(
    `SELECT tt.id, tt.name, tt."captainId", tt."createdAt",
       u.name AS "captainName", u.email AS "captainEmail", u.image AS "captainImage"
     FROM "tournament_team" tt
     JOIN "user" u ON u.id = tt."captainId"
     WHERE tt."tournamentId" = $1
     ORDER BY tt."createdAt" ASC`,
    [tournamentId]
  );
  const teamIds: string[] = teamsResult.rows.map((t) => t.id);
  if (teamIds.length === 0) return [];

  const [membersResult, paymentsResult] = await Promise.all([
    pool.query(
      `SELECT ttm."teamId", ttm."userId", ttm."joinedAt", ttm."confirmationStatus", u.name, u.email, u.image
       FROM "tournament_team_member" ttm
       JOIN "user" u ON u.id = ttm."userId"
       WHERE ttm."teamId" = ANY($1) AND ttm."confirmationStatus" <> 'declined'
       ORDER BY ttm."joinedAt" ASC`,
      [teamIds]
    ),
    price > 0
      ? pool.query(
          `SELECT "teamId", amount FROM "tournament_team_payment" WHERE "teamId" = ANY($1) AND "refundedAt" IS NULL`,
          [teamIds]
        )
      : Promise.resolve({ rows: [] as { teamId: string; amount: number }[] }),
  ]);

  const membersByTeam = new Map<string, typeof membersResult.rows>();
  for (const m of membersResult.rows) {
    const list = membersByTeam.get(m.teamId) ?? [];
    list.push(m);
    membersByTeam.set(m.teamId, list);
  }
  const paymentByTeam = new Map(
    paymentsResult.rows.map((p) => [p.teamId, { amountCents: Number(p.amount), status: "completed" }])
  );

  const rows: RegistrantRow[] = [];
  for (const t of teamsResult.rows) {
    const payment = canViewPayments ? paymentByTeam.get(t.id) ?? null : null;

    rows.push({
      id: t.captainId,
      name: t.captainName,
      image: t.captainImage,
      joinedAt: new Date(t.createdAt).toISOString(),
      email: canViewContactInfo ? t.captainEmail : null,
      customFields: [],
      payment,
      team: { name: t.name, isCaptain: true, pending: false },
    });

    for (const m of membersByTeam.get(t.id) ?? []) {
      rows.push({
        id: m.userId,
        name: m.name,
        image: m.image,
        joinedAt: new Date(m.joinedAt).toISOString(),
        email: canViewContactInfo ? m.email : null,
        customFields: [],
        payment,
        team: { name: t.name, isCaptain: false, pending: m.confirmationStatus === "pending" },
      });
    }
  }
  return rows;
}
