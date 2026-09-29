// Organizer console's event list — org-scoped, requires MANAGE_EVENTS (via
// getOrganizationEventsFull); ForbiddenError renders a permission-denied
// ComingSoonPanel instead of a hard error.
import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getOrganizationEventsFull } from "@/app/actions/organizer-events";
import type { EventItem } from "@/app/actions/event";
import ComingSoonPanel from "@/components/organizer/ComingSoonPanel";
import CreateEventButton from "@/components/events/CreateEventButton";
import EventCard from "@/components/events/EventCard";

export default async function OrganizerEventsPage() {
  const [t, tEvents] = await Promise.all([
    getTranslations("Organizer"),
    getTranslations("DashboardEvents"),
  ]);

  let events: EventItem[];
  try {
    events = await getOrganizationEventsFull();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <ComingSoonPanel
          eyebrow={t("navEvents")}
          title={t("eventsPermissionDeniedTitle")}
          badge={t("eventsPermissionDeniedBadge")}
          description={t("eventsPermissionDeniedDescription")}
        />
      );
    }
    throw error;
  }

  const joinedLabel = (event: EventItem) => {
    const isTournament = event.registrationMode === "team";
    if (isTournament) {
      return event.capacity
        ? tEvents("teamsProgress", { joined: event.participantCount, capacity: event.capacity })
        : tEvents("teamsCount", { count: event.participantCount });
    }
    return event.capacity
      ? tEvents("joinedProgress", { joined: event.participantCount, capacity: event.capacity })
      : tEvents("joinedCount", { count: event.participantCount });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("navEvents")}</p>
          <h1 className="text-3xl font-extrabold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
            {t("navEvents")}
          </h1>
        </div>
        <CreateEventButton label={tEvents("createButton")} />
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 flex flex-col items-center justify-center text-center gap-3">
          <span className="text-4xl">📅</span>
          <p className="text-zinc-500 text-sm">{t("eventsEmptyDescription")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              freeLabel={tEvents("free")}
              endedLabel={tEvents("eventEnded")}
              joinedLabel={joinedLabel(event)}
              organizerLabel={tEvents("organizedBy")}
              href={`/organizer/events/${event.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
