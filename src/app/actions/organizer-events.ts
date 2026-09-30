"use server";

// Thin organizer-scoped read layer over event.ts, for the /organizer/events
// list and detail page. Doesn't own event data itself — just adds the org
// membership/permission checks that the public event.ts queries don't do.

import { pool } from "@/lib/db";
import { requireOrganizationPermission } from "./organization";
import { hasPermission, type OrgRole } from "@/lib/organizer-permissions";
import { serializeEvent } from "@/lib/serialize-event";
import {
  ensureEventParticipantsTable,
  getEventById,
  getEventFormFields,
  getEventCategories,
  getEventPricingTiers,
  type EventItem,
  type FormField,
  type EventCategory,
  type EventPricingTier,
} from "./event";

// EventCard-compatible superset of getOrganizationEvents (organizer-registrations.ts,
// which only returns a thin summary for the Registrations picker). This backs
// the /organizer/events list, so it needs the same fields getMyEvents returns.
export async function getOrganizationEventsFull(): Promise<EventItem[]> {
  const { organization } = await requireOrganizationPermission("MANAGE_EVENTS");
  await ensureEventParticipantsTable();

  const result = await pool.query(
    `SELECT e.*, COALESCE(o.name, u.name) as "organizerName", o.slug as "organizationSlug", o."logoUrl" as "organizationLogo",
       CASE WHEN e."registrationMode" = 'team'
         THEN (SELECT COUNT(*) FROM "tournament_team" tt WHERE tt."tournamentId" = e.id AND tt.status = 'active')
         ELSE COUNT(ep.id)
       END as "participantCount"
     FROM "event" e
     JOIN "user" u ON e."organizerId" = u.id
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     LEFT JOIN "event_participant" ep ON ep."eventId" = e.id
     WHERE e."organizationId" = $1
     GROUP BY e.id, u.name, o.name, o.slug, o."logoUrl"
     ORDER BY
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN 0 ELSE 1 END ASC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       CASE WHEN NOT (e.status = 'active' AND e."endDateTime" >= NOW()) THEN e."startDateTime" END DESC NULLS LAST`,
    [organization.id]
  );
  return result.rows.map(serializeEvent);
}

export type OrganizerEventDetail =
  | { error: string }
  | { event: EventItem; formFields: FormField[]; categories: EventCategory[]; pricingTiers: EventPricingTier[] };

// Powers /organizer/events/[eventId]. Verifies the event actually belongs to
// the caller's active org — without this, any org member could load another
// org's event by guessing its id, since getEventById itself has no org check.
export async function getOrganizerEventDetail(eventId: string): Promise<OrganizerEventDetail> {
  const { organization } = await requireOrganizationPermission("MANAGE_EVENTS");

  const event = await getEventById(eventId);
  if (!event || event.organizationId !== organization.id) return { error: "Event not found" };

  const [formFields, categories, pricingTiers] = await Promise.all([
    getEventFormFields(eventId),
    getEventCategories(eventId),
    getEventPricingTiers(eventId),
  ]);
  return { event, formFields, categories, pricingTiers };
}

// Whether `userId` can manage an event belonging to `organizationId` —
// checked against that *specific* org's membership, not the caller's
// currently-active org (unlike requireOrganizationPermission). Used by the
// public event page, where the viewer may not have this org active/switched.
export async function canManageOrgEvent(organizationId: string, userId: string): Promise<boolean> {
  const membership = await pool.query(
    `SELECT role FROM "organization_membership" WHERE "userId" = $1 AND "organizationId" = $2 AND status = 'active'`,
    [userId, organizationId]
  );
  const role = membership.rows[0]?.role as OrgRole | undefined;
  return role ? hasPermission(role, "MANAGE_EVENTS") : false;
}
