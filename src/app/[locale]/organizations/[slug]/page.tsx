// Public organization profile page (/organizations/[slug]) — reachable
// without a session, linked from the organizer console's "Public" button
// (see OrganizerTopNav.tsx). Built with ONLY real, already-existing org data:
// name, logo, cover image, tagline (slogan), organization type, sports,
// city/province/country, social links, real upcoming events. Deliberately
// out of scope: Follow/Followers (no organization_follower table, no
// follow/unfollow action) and an Announcement banner (no schema concept for
// org-authored announcements) — see getPublicOrganizationProfile's comment
// in src/app/actions/organization.ts for why draft orgs 404 here.
//
// Chrome: a logged-in visitor gets the redesigned app shell
// (LoggedInPageShell — same sidebar/slide-over as the home feed), not the
// pre-redesign Navbar/Footer, which is reserved for anonymous visitors only
// (this page has no session requirement, so most real-world visitors will
// hit it logged out).
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LoggedInPageShell from "@/components/layout/LoggedInPageShell";
import PublicAdminToggle from "@/components/organizer/PublicAdminToggle";
import OrganizationCoverEditor from "@/components/organizations/OrganizationCoverEditor";
import { hasPermission } from "@/lib/organizer-permissions";
import { getPublicOrganizationProfile, getUserOrganizations } from "@/app/actions/organization";
import { getEventsByOrganization } from "@/app/actions/event";
import type { EventItem } from "@/app/actions/event";
import { getPublicOrganizationTeams, type TeamRow } from "@/app/actions/organizer-teams";
import { getPublicOrganizationPartners, type PartnerRow } from "@/app/actions/organizer-partners";
import EventCard from "@/components/events/EventCard";
import DiscoverSearch from "@/components/events/DiscoverSearch";
import OrganizationPublicProfileTabs from "@/components/organizations/OrganizationPublicProfileTabs";
import OrganizationExploreSubTabs from "@/components/organizations/OrganizationExploreSubTabs";

// Mirrors Step1Profile.tsx's ORG_TYPES keys — used to guard which
// organizationType values have a translated label (Organizer.wizardType_*)
// vs. falling back to the raw stored value.
const ORG_TYPE_KEYS = [
  "ACADEMY",
  "CLUB",
  "LEAGUE",
  "SCHOOL_ATHLETICS",
  "TOURNAMENT_ORGANIZER",
  "FEDERATION",
  "FACILITY",
  "COMMUNITY_PROGRAM",
];

// Same initials-in-a-circle convention as AthleteSocialLinksSection.tsx —
// there's no dedicated Instagram/TikTok/X SVG icon set anywhere in this
// codebase to copy, so this matches the one real precedent instead of
// inventing new iconography.
function platformInitial(platform: string) {
  return platform === "x" ? "X" : platform[0]?.toUpperCase() ?? "?";
}

// Small inline icons for the Location & Contact / Contact Information rows —
// same stroke-based convention as EventCard's CalendarIcon/LocationIcon
// (strokeWidth 2.2, currentColor), just added here for the icon shapes this
// page didn't need before (email/phone/website).
function LocationPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

// Reused by both the Home tab's Teams section and the Explore tab's Teams
// pill (same data, same card) — real fields only (name, sport, coach name,
// member count); no win/loss record concept exists here by design.
function TeamsGrid({
  teams,
  t,
}: {
  teams: TeamRow[];
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
        {t("teamsEmpty")}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {teams.map((team) => (
        <div key={team.id} className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 font-bold text-zinc-500">
              {team.logoUrl ? (
                <Image src={team.logoUrl} alt={team.name} width={44} height={44} className="size-11 object-cover" />
              ) : (
                team.name[0]?.toUpperCase() ?? "?"
              )}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-zinc-900 text-sm truncate">{team.name}</p>
              {team.sport && <p className="text-xs text-zinc-500 truncate">{team.sport}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-0.5 text-xs text-zinc-500">
            {team.coachName && <p>{t("teamCoachLabel", { name: team.coachName })}</p>}
            {team.memberCount != null && <p>{t("teamMembersLabel", { count: team.memberCount })}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Reused by both the Home tab's Our Partners section and the Explore tab's
// Partners pill — same initials-circle convention as PartnersList.tsx's
// admin-console row (logo-or-initials circle + name), a closer visual fit
// here than the header's platformInitial social-icon convention.
function PartnersGrid({
  partners,
  t,
}: {
  partners: PartnerRow[];
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (partners.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
        {t("partnersEmpty")}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {partners.map((partner) => (
        <div key={partner.id} className="flex items-center gap-3 bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 font-bold text-zinc-500">
            {partner.logoUrl ? (
              <Image src={partner.logoUrl} alt={partner.name} width={44} height={44} className="size-11 object-cover" />
            ) : (
              partner.name[0]?.toUpperCase() ?? "?"
            )}
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-zinc-900 text-sm truncate">{partner.name}</p>
            {partner.website && (
              <a
                href={partner.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#e21d12] hover:underline truncate block"
              >
                {partner.website}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function OrganizationPublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicOrganizationProfile(slug);
  if (!profile) notFound();

  // Teams is an "alwaysOn" module (src/lib/organization-modules.ts) — every
  // org effectively has it enabled, so its public visibility is governed by
  // whether the org actually has any team rows, not by enabledModules.
  // Partners, by contrast, is a real opt-in module — only fetch/show it when
  // the org actually turned it on.
  const partnersEnabled = profile.enabledModules.includes("partners");

  const [events, teams, partners, t, tDiscover, tOrganizer, session] = await Promise.all([
    getEventsByOrganization(profile.id),
    getPublicOrganizationTeams(profile.id),
    partnersEnabled ? getPublicOrganizationPartners(profile.id) : Promise.resolve<PartnerRow[]>([]),
    getTranslations("OrganizationPublicProfile"),
    getTranslations("Discover"),
    getTranslations("Organizer"),
    auth.api.getSession({ headers: await headers() }),
  ]);
  const viewerOrganizations = session ? await getUserOrganizations() : [];
  const viewerHasOrganization = viewerOrganizations.some((org) => org.publicationStatus === "published");
  // Only a viewer who's actually a member of THIS org gets the Public/Admin
  // toggle here — otherwise clicking "Public" from the organizer console
  // would strand any admin on this page with no way back (see
  // PublicAdminToggle's own comment for the full Public<->Admin story).
  const viewerMembership = viewerOrganizations.find((org) => org.id === profile.id);
  const viewerIsOrgMember = Boolean(viewerMembership);
  // The "Edit Cover" button only shows for a role that can actually save
  // the change — updateOrganizationDraft() enforces this same permission
  // server-side regardless, but showing the button to e.g. a STAFF/
  // READ_ONLY member would just be a button that silently fails.
  const canEditCover = Boolean(viewerMembership && hasPermission(viewerMembership.role, "MANAGE_ORGANIZATION_PROFILE"));

  const now = new Date();
  const upcomingEvents = events.filter((e) => e.status === "active" && new Date(e.startDateTime) >= now);
  const previewEvents = upcomingEvents.slice(0, 4);

  const accentColor = profile.brandColor || "#e21d12";
  const locationLabel = [profile.city, profile.province].filter(Boolean).join(", ");
  const orgTypeLabel =
    profile.organizationType && ORG_TYPE_KEYS.includes(profile.organizationType)
      ? tOrganizer(`wizardType_${profile.organizationType}_label`)
      : profile.organizationType;
  const primarySport = profile.sports[0];
  const socialEntries = Object.entries(profile.socialLinks ?? {}).filter(([, url]) => url);

  function joinedLabel(event: EventItem) {
    return event.capacity
      ? tDiscover("joinedProgress", { joined: event.participantCount, capacity: event.capacity })
      : tDiscover("joinedCount", { count: event.participantCount });
  }

  const hasLocationOrContact =
    Boolean(locationLabel || profile.country || profile.locations.length > 0 || profile.publicEmail || profile.phone || profile.website);
  const hasAddressOrContact = Boolean(locationLabel || profile.country || profile.publicEmail || profile.phone || profile.website);

  const homeContent = (
    <>
      <section>
        <h2 className="text-lg font-extrabold text-zinc-900 mb-3">{t("overviewTitle")}</h2>
        <p className="text-sm text-zinc-600 leading-relaxed">{profile.shortDescription || t("noDescription")}</p>
      </section>
      <section>
        <h2 className="text-lg font-extrabold text-zinc-900 mb-4">{t("upcomingEventsTitle")}</h2>
        {previewEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
            {t("noUpcomingEvents")}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {previewEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                freeLabel={tDiscover("free")}
                endedLabel={tDiscover("eventEnded")}
                joinedLabel={joinedLabel(event)}
                organizerLabel={tDiscover("organizedBy")}
                todayLabel={tDiscover("todayBadge")}
                tomorrowLabel={tDiscover("tomorrowBadge")}
                href={`/events/${event.id}`}
              />
            ))}
          </div>
        )}
      </section>
      {teams.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold text-zinc-900 mb-4">{t("teamsTitle")}</h2>
          <TeamsGrid teams={teams} t={t} />
        </section>
      )}
      {partnersEnabled && partners.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold text-zinc-900 mb-4">{t("partnersTitle")}</h2>
          <PartnersGrid partners={partners} t={t} />
        </section>
      )}
      {hasLocationOrContact && (
        <section>
          <h2 className="text-lg font-extrabold text-zinc-900 mb-4">{t("locationContactTitle")}</h2>
          <div className="grid gap-6">
            <div className="flex flex-col gap-3 text-sm text-zinc-600">
              {(locationLabel || profile.country) && (
                <div className="flex items-start gap-2">
                  <LocationPinIcon />
                  <span>{[locationLabel, profile.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {profile.locations.map((loc) => (
                <div key={loc.id} className="flex items-start gap-2 text-zinc-500">
                  <LocationPinIcon />
                  <span>
                    {loc.name ? `${loc.name} — ` : ""}
                    {[loc.streetAddress, loc.city, loc.province, loc.postalCode, loc.country].filter(Boolean).join(", ")}
                  </span>
                </div>
              ))}
              {profile.publicEmail && (
                <div className="flex items-center gap-2">
                  <EmailIcon />
                  <a href={`mailto:${profile.publicEmail}`} className="font-semibold text-[#e21d12] hover:underline">
                    {profile.publicEmail}
                  </a>
                </div>
              )}
              {profile.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon />
                  <span className="font-semibold text-zinc-800">{profile.phone}</span>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center gap-2">
                  <WebsiteIcon />
                  <a href={profile.website} target="_blank" rel="noreferrer" className="font-semibold text-[#e21d12] hover:underline">
                    {profile.website}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );

  const aboutContent = (
    <>
      <section>
        <div className="bg-white rounded-2xl border border-zinc-200 p-8">
          <h2 className="text-lg font-extrabold text-zinc-900 mb-3">{t("aboutUsTitle")}</h2>
          <p className="text-sm text-zinc-600 leading-relaxed">{profile.mission || t("noMission")}</p>
        </div>
      </section>
      <section>
        <div className="bg-white rounded-2xl border border-zinc-200 p-8">
          <h2 className="text-lg font-extrabold text-zinc-900 mb-4">{t("contactInformationTitle")}</h2>
          <div className="flex flex-col gap-3 text-sm text-zinc-600">
            {(locationLabel || profile.country) && (
              <div className="flex items-center gap-2">
                <LocationPinIcon />
                <span>{[locationLabel, profile.country].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {profile.publicEmail && (
              <div className="flex items-center gap-2">
                <EmailIcon />
                <a href={`mailto:${profile.publicEmail}`} className="font-semibold text-[#e21d12] hover:underline">
                  {profile.publicEmail}
                </a>
              </div>
            )}
            {profile.phone && (
              <div className="flex items-center gap-2">
                <PhoneIcon />
                <span className="font-semibold text-zinc-800">{profile.phone}</span>
              </div>
            )}
            {profile.website && (
              <div className="flex items-center gap-2">
                <WebsiteIcon />
                <a href={profile.website} target="_blank" rel="noreferrer" className="font-semibold text-[#e21d12] hover:underline">
                  {profile.website}
                </a>
              </div>
            )}
            {!hasAddressOrContact && <p className="text-zinc-400">{t("noContactInfo")}</p>}
          </div>
        </div>
      </section>
    </>
  );

  const exploreEventsContent = (
    <DiscoverSearch events={events} currentUserId={null} joinedEventIds={[]} sectionTitle={profile.name} />
  );
  const exploreTeamsContent = <TeamsGrid teams={teams} t={t} />;
  const explorePartnersContent = partnersEnabled ? <PartnersGrid partners={partners} t={t} /> : undefined;

  const exploreContent = (
    <OrganizationExploreSubTabs
      eventsContent={exploreEventsContent}
      teamsContent={exploreTeamsContent}
      partnersContent={explorePartnersContent}
    />
  );

  const body = (
    <div className="bg-zinc-50 min-h-full">
      {/* Full-bleed cover — no card border/rounding/max-width, spans the
          entire content column so it reads as a banner, not a boxed
          profile card. */}
      <div className="relative h-48 md:h-64 bg-white">
        {profile.coverImageUrl ? (
          <Image src={profile.coverImageUrl} alt="" fill className="object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-100 to-zinc-200" />
        )}
        {canEditCover && <OrganizationCoverEditor />}
      </div>

      <div className="bg-white border-b border-zinc-200 px-4 md:px-8 pb-8">
        {/* Logo sits fully below the cover — no negative margin, no
            straddling the boundary, so there is no overlap at all
            regardless of cover height, logo size, or viewport width. */}
        <div className="pt-4 mb-4">
          <div className="size-28 rounded-2xl border-4 border-white shadow-sm overflow-hidden shrink-0 bg-zinc-100 flex items-center justify-center">
            {profile.logoUrl ? (
              <Image src={profile.logoUrl} alt={profile.name} width={112} height={112} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-extrabold text-zinc-400">{profile.name[0]?.toUpperCase()}</span>
            )}
          </div>
        </div>
        <div className="mb-4 flex items-start gap-5">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
              {profile.name}
            </h1>
            {profile.slogan && <p className="text-sm font-semibold text-zinc-600 mt-0.5">{profile.slogan}</p>}
          </div>
          {profile.publicEmail && (
            <a
              href={`mailto:${profile.publicEmail}`}
              className="shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              {t("contactButton")}
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {orgTypeLabel && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#c32722]">
              {orgTypeLabel}
            </span>
          )}
          {primarySport && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">{primarySport}</span>
          )}
          {locationLabel && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">{locationLabel}</span>
          )}
        </div>

        {socialEntries.length > 0 && (
          <div className="flex items-center gap-2">
            {socialEntries.map(([platform, url]) => (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noreferrer"
                title={platform}
                className="flex size-8 items-center justify-center rounded-full bg-[#e21d12]/10 text-xs font-extrabold text-[#e21d12] hover:bg-[#e21d12]/20 transition-colors"
              >
                {platformInitial(platform)}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 md:px-8 py-8">
        <OrganizationPublicProfileTabs homeContent={homeContent} aboutContent={aboutContent} exploreContent={exploreContent} />
      </div>
    </div>
  );

  if (session) {
    return (
      <LoggedInPageShell
        user={{ id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }}
        hasOrganization={viewerHasOrganization}
        topBarExtra={
          viewerIsOrgMember ? (
            <PublicAdminToggle mode="public" organizationId={profile.id} organizationSlug={profile.slug} />
          ) : undefined
        }
      >
        {body}
      </LoggedInPageShell>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">{body}</main>
      <Footer />
    </>
  );
}
