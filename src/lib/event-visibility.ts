// Staging-only event visibility ("demo restrictions"). On staging, testers
// from different organizations share one database, and a half-built test
// event from one org shouldn't show up for everyone else. So on staging a
// viewer only sees:
//   - the curated demo events (event."isDemoDefault" = true), and
//   - events of organizations they're an active member of (or legacy events
//     they organize themselves).
// Super admins see everything. Outside staging (prod, previews, local dev)
// nothing is restricted and none of this touches the query.
//
// Lists, search and organization pages are filtered with eventVisibilitySql;
// a single event page checks canViewEvent. Players who already registered
// for an event (e.g. a tester's second account paying for their own org's
// event via a shared link) can still open it.
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getAppEnv } from "@/lib/env";

export type EventViewer =
  | { restricted: false }
  | { restricted: true; userId: string | null; organizationIds: string[] };

// Opening an event by its link (e.g. one shared by its organizer) still
// works on staging; it's only hidden from browsing, search and other orgs'
// pages. Set to false to make other orgs' events 404 by link as well.
const ALLOW_DIRECT_LINKS = true;

export const getEventViewer = cache(async (): Promise<EventViewer> => {
  if (getAppEnv() !== "staging") return { restricted: false };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { restricted: true, userId: null, organizationIds: [] };
  const [roleRes, orgRes] = await Promise.all([
    pool.query(`SELECT role FROM "user" WHERE id = $1`, [session.user.id]),
    pool.query(
      `SELECT "organizationId" FROM "organization_membership" WHERE "userId" = $1 AND status = 'active'`,
      [session.user.id]
    ),
  ]);
  if (roleRes.rows[0]?.role === "super_admin") return { restricted: false };
  return {
    restricted: true,
    userId: session.user.id,
    organizationIds: orgRes.rows.map((r) => r.organizationId as string),
  };
});

// SQL condition for "this viewer may see event <alias>" — appends its
// parameters to `params` and returns a fragment using their positions.
// Returns "TRUE" when unrestricted so callers can always AND it in.
export function eventVisibilitySql(viewer: EventViewer, alias: string, params: unknown[]): string {
  if (!viewer.restricted) return "TRUE";
  params.push(viewer.organizationIds);
  const orgParam = params.length;
  params.push(viewer.userId);
  const userParam = params.length;
  return `(${alias}."isDemoDefault" = true
    OR ${alias}."organizationId" = ANY($${orgParam}::text[])
    OR (${alias}."organizationId" IS NULL AND ${alias}."organizerId" = $${userParam}))`;
}

// Whether the viewer may open one event's page.
export async function canViewEvent(
  viewer: EventViewer,
  event: { id: string; organizationId: string | null; organizerId: string }
): Promise<boolean> {
  if (!viewer.restricted || ALLOW_DIRECT_LINKS) return true;
  const params: unknown[] = [event.id];
  const res = await pool.query(
    `SELECT 1 FROM "event" e WHERE e.id = $1 AND (${eventVisibilitySql(viewer, "e", params)}
       OR EXISTS (SELECT 1 FROM "event_participant" ep WHERE ep."eventId" = e.id AND ep."userId" = $${params.push(viewer.userId)})
       OR EXISTS (
         SELECT 1 FROM "tournament_team" tt
         LEFT JOIN "tournament_team_member" ttm ON ttm."teamId" = tt.id
         WHERE tt."tournamentId" = e.id AND (tt."captainId" = $${params.length} OR ttm."userId" = $${params.length})
       ))`,
    params
  );
  return res.rows.length > 0;
}
