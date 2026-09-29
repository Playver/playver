// Public /events browse page: fetches all events + (if signed in) which
// ones the user has joined, then hands everything to the client-side
// DiscoverSearch for filtering. `?created=event` shows a success toast
// after CreateEventButton's form redirects back here.
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LoggedInPageShell from "@/components/layout/LoggedInPageShell";
import EventsDiscoverContent from "@/components/events/EventsDiscoverContent";
import SuccessToast from "@/components/ui/SuccessToast";
import { auth } from "@/lib/auth";
import { getEventParticipationMap, getEvents } from "@/app/actions/event";
import { getUserOrganizations } from "@/app/actions/organization";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const t = await getTranslations("Discover");
  const params = await searchParams;
  const [events, session] = await Promise.all([
    getEvents(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  const joinedEventIds = session
    ? Array.from(await getEventParticipationMap(events.map((event) => event.id)))
    : [];

  const body = (
    <>
      {params.created === "event" && <SuccessToast message={t("eventCreated")} />}
      <EventsDiscoverContent
        events={events}
        currentUserId={session?.user?.id ?? null}
        joinedEventIds={joinedEventIds}
        showCreateButton={Boolean(session)}
      />
    </>
  );

  if (session) {
    const viewerOrganizations = await getUserOrganizations();
    const viewerHasOrganization = viewerOrganizations.some((org) => org.publicationStatus === "published");
    return (
      <LoggedInPageShell
        user={{ id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }}
        hasOrganization={viewerHasOrganization}
      >
        {body}
      </LoggedInPageShell>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">{body}</main>
      <Footer />
    </>
  );
}
