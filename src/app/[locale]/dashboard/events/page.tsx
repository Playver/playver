// /dashboard/events: events the signed-in user created (legacy, non-org
// events only — see event.ts's legacy-vs-org-owned distinction) plus events
// they've joined.
import { getTranslations } from "next-intl/server";
import EventCard from "@/components/events/EventCard";
import { getJoinedEvents, getMyLegacyEvents } from "@/app/actions/event";

export default async function DashboardEventsPage() {
  const t = await getTranslations("DashboardEvents");
  const [myEvents, joinedEvents] = await Promise.all([getMyLegacyEvents(), getJoinedEvents()]);
  const joinedLabel = (event: (typeof myEvents)[number]) => {
    const isTournament = event.registrationMode === "team";
    if (isTournament) {
      return event.capacity
        ? t("teamsProgress", { joined: event.participantCount, capacity: event.capacity })
        : t("teamsCount", { count: event.participantCount });
    }
    return event.capacity
      ? t("joinedProgress", { joined: event.participantCount, capacity: event.capacity })
      : t("joinedCount", { count: event.participantCount });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
          {t("title")}
        </h1>
      </div>

      {myEvents.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-bold text-zinc-700 mb-4">{t("myEventsTitle")}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {myEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                freeLabel={t("free")}
                endedLabel={t("eventEnded")}
                joinedLabel={joinedLabel(event)}
                organizerLabel={t("organizedBy")}
                href={`/events/${event.id}`}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-bold text-zinc-700 mb-4">{t("joinedEventsTitle")}</h2>
        {joinedEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 flex flex-col items-center justify-center text-center gap-3">
            <span className="text-4xl">🏃</span>
            <p className="text-zinc-500 text-sm">{t("emptyJoinedEvents")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {joinedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                freeLabel={t("free")}
                endedLabel={t("eventEnded")}
                joinedLabel={joinedLabel(event)}
                organizerLabel={t("organizedBy")}
                href={`/events/${event.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
