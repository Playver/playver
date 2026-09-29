// /dashboard overview: upcoming events (owned + joined) and team count for
// the signed-in athlete. dashboard/layout.tsx already guarantees a session
// exists, hence the non-null `session!.user` below.
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getJoinedEvents, getMyEvents } from "@/app/actions/event";
import { getJoinedTeams, getMyTeams } from "@/app/actions/team";

// Sized via 1em so each usage just sets a Tailwind text-size class on its
// wrapping element (badge vs. large empty-state icon) rather than needing a
// size prop per icon.
function IconCalendar() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconMedal() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" /><path d="m9 10-3-6" /><path d="m15 10 3-6" />
      <path d="M11.5 12.5 10 15l1.5 1L12 18l.5-2 1.5-1-1.5-2.5Z" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const t = await getTranslations("Dashboard");
  const user = session!.user;
  const [myEvents, joinedEvents, myTeams, joinedTeams] = await Promise.all([
    getMyEvents(),
    getJoinedEvents(),
    getMyTeams(),
    getJoinedTeams(),
  ]);
  const uniqueTeamIds = new Set([...myTeams, ...joinedTeams].map((team) => team.id));
  const allEvents = [...myEvents, ...joinedEvents];
  const now = new Date();
  const upcomingEvents = allEvents
    .filter((event) => event.status === "active" && new Date(event.startDateTime) >= now)
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  const gamesPlayed = allEvents.filter((event) => event.status === "active" && new Date(event.endDateTime) < now).length;

  const stats = [
    { label: t("statUpcoming"), value: String(upcomingEvents.length), icon: <IconCalendar /> },
    { label: t("statTeams"), value: String(uniqueTeamIds.size), icon: <IconUsers /> },
    { label: t("statPlayed"), value: String(gamesPlayed), icon: <IconMedal /> },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">
          {t("eyebrow")}
        </p>
        <h1
          className="text-3xl sm:text-4xl font-bold text-zinc-900"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {t("greeting", { name: user.name?.split(" ")[0] ?? t("defaultName") })}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 flex items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e21d12]/10 text-xl text-[#e21d12]">{icon}</span>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{value}</p>
              <p className="text-sm text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Upcoming Events */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-900">{t("upcomingEvents")}</h2>
            <Link href="/events" className="text-xs font-semibold text-[#e21d12] hover:underline">
              {t("browseEvents")}
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <span className="text-4xl text-zinc-300"><IconSearch /></span>
              <p className="text-sm text-zinc-500">{t("noUpcoming")}</p>
              <Link
                href="/dashboard/events"
                className="mt-2 px-5 py-2 text-xs font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors"
              >
                {t("findEvent")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-sm font-bold text-zinc-900">{event.title}</p>
                  <p className="text-xs text-zinc-500">{event.sport} · {formatDate(event.startDateTime)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Teams */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-900">{t("myTeams")}</h2>
            <Link href="/teams" className="text-xs font-semibold text-[#e21d12] hover:underline">
              {t("browseTeams")}
            </Link>
          </div>
          {uniqueTeamIds.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <span className="text-4xl text-zinc-300"><IconUsers /></span>
              <p className="text-sm text-zinc-500">{t("noTeams")}</p>
              <Link
                href="/dashboard/teams"
                className="mt-2 px-5 py-2 text-xs font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors"
              >
                {t("joinTeam")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[...myTeams, ...joinedTeams].slice(0, 4).map((team) => (
                <div key={team.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-sm font-bold text-zinc-900">{team.name}</p>
                  <p className="text-xs text-zinc-500">{team.sport} · {team.location}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
