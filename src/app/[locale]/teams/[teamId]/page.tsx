// Public standalone-team profile page: roster, upcoming events the team is
// in, and (for the captain) tournament registrations they can manage —
// also surfaces tournament_team panels via TournamentCaptainPanel/
// JoinOpenTeamButton for any tournament this team has been linked/imported
// into (see tournament.ts's linkedTeamId).
import { headers } from "next/headers";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LeaveTeamButton from "@/components/teams/LeaveTeamButton";
import RemoveTeamMemberButton from "@/components/teams/RemoveTeamMemberButton";
import { JoinOpenTeamButton, TournamentCaptainPanel } from "@/components/tournaments/TournamentCaptainPanel";
import BackButton from "@/components/layout/BackButton";
import ShareButton from "@/components/share/ShareButton";
import { shareMetadata } from "@/lib/share-metadata";
import { getTeamShareInfo } from "@/lib/share-info";
import MobileSectionNav from "@/components/layout/MobileSectionNav";
import { Link } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { getMembershipMap, getTeamById, getTeamMembers } from "@/app/actions/team";
import { getTeamEvents } from "@/app/actions/event";
import { getJoinableTournamentRegistrations, getCaptainedTournamentRegistrationsForLinkedTeam } from "@/app/actions/tournament";

const NAV_ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconAbout() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconRoster() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconEvents() {
  return (
    <svg {...NAV_ICON_PROPS}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatEventDate(value: string) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d) +
    " · " +
    new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(d);
}

function LocationIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function MetricCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-[18px] border border-zinc-200 bg-zinc-50 p-4 sm:p-6 ${className ?? ""}`}>
      <p className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-3 sm:mt-4 text-xl sm:text-2xl font-extrabold text-zinc-950 truncate">{value}</p>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ teamId: string }> }): Promise<Metadata> {
  const { teamId } = await params;
  const info = await getTeamShareInfo(teamId);
  if (!info) return {};
  return shareMetadata({ title: info.name, description: info.description, image: info.image, path: `/teams/${teamId}` });
}

export default async function TeamDetailsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const [{ teamId }, t, tShare, session] = await Promise.all([
    params,
    getTranslations("TeamDetails"),
    getTranslations("Share"),
    auth.api.getSession({ headers: await headers() }),
  ]);

  const team = await getTeamById(teamId);
  if (!team) notFound();

  const isCaptain = session?.user?.id === team.captainId;

  const [members, membershipSet, teamEvents, joinableRegistrations, captainedRegistrations] = await Promise.all([
    getTeamMembers(team.id),
    session ? getMembershipMap([team.id]) : Promise.resolve(new Set<string>()),
    getTeamEvents(team.id),
    session && !isCaptain ? getJoinableTournamentRegistrations(team.id) : Promise.resolve([]),
    isCaptain ? getCaptainedTournamentRegistrationsForLinkedTeam(team.id) : Promise.resolve([]),
  ]);

  // Captain always first
  const sortedMembers = [
    ...members.filter((m) => m.id === team.captainId),
    ...members.filter((m) => m.id !== team.captainId),
  ];

  const now = new Date();
  const upcomingEvents = teamEvents.filter((e) => e.status === "active" && new Date(e.startDateTime) >= now);
  const pastEvents = teamEvents.filter((e) => e.status !== "active" || new Date(e.startDateTime) < now);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 overflow-x-hidden">
          <BackButton label={t("back")} fallbackHref="/teams" />

          <section className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
            {/* Hero */}
            <div className="relative flex min-h-52 sm:min-h-72 items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12 bg-zinc-900">
              {team.coverImageUrl ? (
                <>
                  <Image src={team.coverImageUrl} alt={team.name} fill className="object-contain" />
                  <div className="absolute inset-0 bg-black/40" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-[#e21d12]/8" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(226,29,18,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(226,29,18,0.12),transparent_35%)]" />
                </>
              )}
              <ShareButton
                path={`/teams/${team.id}`}
                title={team.name}
                text={tShare("teamText", { name: team.name })}
                label={tShare("shareTeam")}
                variant="icon"
                className="absolute right-4 top-4 z-20"
              />
              <div className="relative z-10 flex flex-col items-center text-center max-w-full px-2">
                {team.logoUrl ? (
                  <Image src={team.logoUrl} alt={team.name} width={112} height={112} className="size-20 sm:size-28 rounded-full border-4 border-white object-cover shadow-md" />
                ) : (
                  <div className="flex size-20 sm:size-28 items-center justify-center rounded-full border-4 border-white bg-white text-3xl sm:text-4xl font-extrabold text-[#e21d12] shadow-md">
                    {team.name[0]?.toUpperCase()}
                  </div>
                )}
                <p className={`mt-3 sm:mt-5 text-xs sm:text-sm font-extrabold uppercase tracking-wide ${team.coverImageUrl ? "text-white/80" : "text-[#c32722]"}`}>{team.sport}</p>
                <h1 className={`mt-2 text-2xl sm:text-4xl font-extrabold leading-tight break-words w-full ${team.coverImageUrl ? "text-white" : "text-zinc-950"}`} style={{ fontFamily: "var(--font-playfair)" }}>
                  {team.name}
                </h1>
                <div className={`mt-3 sm:mt-4 flex items-center gap-2 text-sm sm:text-base font-semibold ${team.coverImageUrl ? "text-white/80" : "text-zinc-600"}`}>
                  <LocationIcon />
                  <span className="break-words">{team.location}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0 grid gap-4 sm:gap-6 order-last lg:order-first">
                {/* Stats */}
                <div className="min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
                  <MetricCard label={t("captain")} value={team.captainName} />
                  <MetricCard label={t("members")} value={String(team.memberCount)} />
                  <MetricCard label={t("created")} value={formatDate(team.createdAt)} className="col-span-2 sm:col-span-1" />
                </div>

                {/* About */}
                <section id="about" className="min-w-0 scroll-mt-20">
                  <h2 className="mb-3 text-xl font-extrabold text-zinc-950">{t("about")}</h2>
                  <p className="whitespace-pre-line break-words text-base leading-7 text-zinc-600">{team.bio || t("noBio")}</p>
                </section>

                {/* Roster */}
                <section id="roster" className="min-w-0 scroll-mt-20">
                  <h2 className="mb-4 text-xl font-extrabold text-zinc-950">{t("roster")}</h2>
                  {sortedMembers.length === 0 ? (
                    <div className="rounded-[18px] border-2 border-dashed border-zinc-200 py-16 text-center">
                      <p className="text-lg text-zinc-500">{t("noMembers")}</p>
                      <p className="mt-2 text-sm text-zinc-400">{t("firstMember")}</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sortedMembers.map((member) => {
                        const isTheCaptain = member.id === team.captainId;
                        return (
                          <div
                            key={member.id}
                            className={`min-w-0 group flex items-center gap-4 rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md ${
                              isTheCaptain
                                ? "border-[#e21d12]/40 ring-2 ring-[#e21d12]/20"
                                : "border-zinc-200"
                            }`}
                          >
                            <Link href={`/athletes/${member.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                              <div className={`flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold ${
                                isTheCaptain
                                  ? "bg-[#e21d12]/10 text-[#e21d12]"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}>
                                {member.image ? (
                                  <Image src={member.image} alt={member.name} width={48} height={48} className="size-12 object-cover" />
                                ) : (
                                  member.name[0]?.toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate font-extrabold text-zinc-950 group-hover:text-[#e21d12] transition-colors">
                                    {member.name}
                                  </p>
                                  {isTheCaptain && (
                                    <span className="shrink-0 rounded-full bg-[#e21d12] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                                      {t("captainBadge")}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-zinc-400">
                                  {isTheCaptain ? t("captain") : `${t("joined")} ${formatDate(member.joinedAt)}`}
                                </p>
                              </div>
                            </Link>
                            {isCaptain && !isTheCaptain && (
                              <RemoveTeamMemberButton teamId={team.id} memberId={member.id} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Events Attending */}
                <section id="events" className="min-w-0 scroll-mt-20">
                  <h2 className="mb-4 text-xl font-extrabold text-zinc-950">{t("eventsAttending")}</h2>

                  {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
                    <div className="rounded-[18px] border-2 border-dashed border-zinc-200 py-12 text-center">
                      <p className="text-zinc-500">{t("noTeamEvents")}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {upcomingEvents.length > 0 && (
                        <div>
                          <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-zinc-400">{t("upcoming")}</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {upcomingEvents.map((event) => (
                              <Link
                                key={event.id}
                                href={`/events/${event.id}`}
                                className="min-w-0 group flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-4 hover:shadow-md transition-shadow"
                              >
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e21d12]/8 text-xl">
                                  {sportEmoji(event.sport)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-zinc-900 group-hover:text-[#e21d12] transition-colors text-sm">{event.title}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5">{formatEventDate(event.startDateTime)}</p>
                                  <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {event.location}
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {pastEvents.length > 0 && (
                        <div>
                          <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-zinc-400">{t("past")}</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {pastEvents.map((event) => (
                              <Link
                                key={event.id}
                                href={`/events/${event.id}`}
                                className="min-w-0 group flex items-start gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 hover:shadow-md transition-shadow"
                              >
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-xl">
                                  {sportEmoji(event.sport)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-zinc-500 text-sm">{event.title}</p>
                                  <p className="text-xs text-zinc-400 mt-0.5">{formatEventDate(event.startDateTime)}</p>
                                  <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {event.location}
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* Sidebar */}
              <aside className="min-w-0 h-fit rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 order-first lg:order-last">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{t("membership")}</p>
                <p className="mt-3 text-xl font-extrabold text-zinc-950">{team.memberCount} {t("membersLower")}</p>
                <p className="mt-4 text-sm text-zinc-500">
                  {t("captain")}: <span className="font-semibold text-zinc-700">{team.captainName}</span>
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  {isCaptain ? (
                    captainedRegistrations.length > 0 ? (
                      <div className="flex flex-col gap-6">
                        {captainedRegistrations.map((reg) => (
                          <div key={reg.tournamentId}>
                            {captainedRegistrations.length > 1 && (
                              <Link
                                href={`/events/${reg.tournamentId}`}
                                className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-[#e21d12] transition-colors"
                              >
                                {t("forTournament", { title: reg.tournamentTitle })}
                              </Link>
                            )}
                            <TournamentCaptainPanel
                              team={reg.team}
                              pendingRequests={reg.pendingRequests}
                              tournamentId={reg.tournamentId}
                              price={reg.price}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="block rounded-lg bg-[#e21d12]/10 px-4 py-3 text-center text-sm font-bold text-[#e21d12]">
                        {t("yourTeam")}
                      </span>
                    )
                  ) : session && membershipSet.has(team.id) ? (
                    <LeaveTeamButton teamId={team.id} leaveLabel={t("leave")} />
                  ) : null}

                  {joinableRegistrations.map((reg) => (
                    <div key={reg.tournamentTeamId} className="rounded-lg border border-zinc-200 bg-white p-3">
                      <p className="mb-2 text-xs text-zinc-500">
                        {t("requestToJoinFor", { tournament: reg.tournamentTitle })}
                      </p>
                      <JoinOpenTeamButton teamId={reg.tournamentTeamId} tournamentId={reg.tournamentId} />
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <MobileSectionNav
        items={[
          { key: "about", label: t("about"), icon: <IconAbout /> },
          { key: "roster", label: t("roster"), icon: <IconRoster /> },
          { key: "events", label: t("eventsAttending"), icon: <IconEvents /> },
        ]}
      />
    </>
  );
}

function sportEmoji(sport: string): string {
  const map: Record<string, string> = {
    Soccer: "⚽", Basketball: "🏀", Volleyball: "🏐", Pickleball: "🏓",
    Tennis: "🎾", Hockey: "🏒", Baseball: "⚾", Cricket: "🏏", Rugby: "🏉",
  };
  return map[sport] ?? "🏅";
}
