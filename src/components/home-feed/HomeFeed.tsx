import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import HomeFeedShell from "@/components/home-feed/HomeFeedShell";
import DiscoverSearch from "@/components/events/DiscoverSearch";
import EventsDiscoverContent from "@/components/events/EventsDiscoverContent";
import { auth } from "@/lib/auth";
import { getEventParticipationMap, getEvents } from "@/app/actions/event";
import { getUserOrganizations } from "@/app/actions/organization";

export default async function HomeFeed({ user }: { user: { name: string; email: string } }) {
  const [session, events, organizations, t] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getEvents(),
    getUserOrganizations(),
    getTranslations("HomeFeed"),
  ]);
  const joinedEventIds = session
    ? Array.from(await getEventParticipationMap(events.map((event) => event.id)))
    : [];
  // A draft (unpublished) org doesn't count as "already an organizer" — the
  // sidebar should still offer the wizard until they've actually published one.
  const hasOrganization = organizations.some((org) => org.publicationStatus === "published");

  // The slide-over links to /athletes/[id] and shows the avatar image, which
  // the `user` prop (built from page.tsx's own session read) doesn't carry —
  // this file already fetches its own `session` above, so pull id/image
  // from there instead of widening page.tsx's prop.
  const fullUser = {
    id: session?.user?.id ?? "",
    name: user.name,
    email: user.email,
    image: session?.user?.image ?? null,
  };

  return (
    <HomeFeedShell
      user={fullUser}
      hasOrganization={hasOrganization}
      homeContent={
        <DiscoverSearch
          events={events}
          currentUserId={session?.user?.id ?? null}
          joinedEventIds={joinedEventIds}
          showSortDropdown={false}
          showFilterRow={false}
          showViewToggle={false}
          showPagination={false}
          initialLocation={t("defaultLocation")}
          sectionTitle={t("happeningSoonTitle")}
          showCta
          topMarginClassName=""
        />
      }
      eventsContent={
        <EventsDiscoverContent
          events={events}
          currentUserId={session?.user?.id ?? null}
          joinedEventIds={joinedEventIds}
          showCreateButton
        />
      }
    />
  );
}
