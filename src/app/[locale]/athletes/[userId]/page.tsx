// Merged public/own athlete profile (/athletes/[userId]) — Stage B of the
// frontend redesign. Used to be a read-only public view with a fully
// separate /dashboard/profile editor; now isOwnProfile (session.user.id ===
// userId) gates every edit affordance on this single page instead. See
// athlete.ts's getAthleteProfile() for the data shape and this page's
// section components under src/components/athletes/ for the edit UI.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LoggedInPageShell from "@/components/layout/LoggedInPageShell";
import ProfileDashboardToggle from "@/components/layout/ProfileDashboardToggle";
import { getAthleteProfile } from "@/app/actions/athlete";
import { getUserOrganizations } from "@/app/actions/organization";
import AthleteGameHistory from "@/components/athletes/AthleteGameHistory";
import AthleteAvatarEditor from "@/components/athletes/AthleteAvatarEditor";
import AthleteCoverEditor from "@/components/athletes/AthleteCoverEditor";
import AthleteNameEditor from "@/components/athletes/AthleteNameEditor";
import AthleteMainSportEditor from "@/components/athletes/AthleteMainSportEditor";
import AthleteEditProfileButton from "@/components/athletes/AthleteEditProfileButton";
import AthleteGallerySection from "@/components/athletes/AthleteGallerySection";
import AthleteProfileTabs from "@/components/athletes/AthleteProfileTabs";
import AthleteBiographySection from "@/components/athletes/AthleteBiographySection";
import AthleteExperienceSection from "@/components/athletes/AthleteExperienceSection";
import AthleteEducationSection from "@/components/athletes/AthleteEducationSection";
import AthleteInterestsSection from "@/components/athletes/AthleteInterestsSection";
import AthleteAchievementsTab from "@/components/athletes/AthleteAchievementsTab";

function formatMonth(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(iso));
}

function formatFullDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

function socialPlatformIcon(platform: string) {
  switch (platform) {
    case "instagram":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 2h-3v13.5a2.5 2.5 0 1 1-2.5-2.5c.17 0 .34.01.5.04V9.96a5.98 5.98 0 0 0-.5-.02A6 6 0 1 0 17 15.94V8.6a8.17 8.17 0 0 0 4.5 1.35v-3a5.16 5.16 0 0 1-5-4.95z" />
        </svg>
      );
    case "x":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.9L4.4 22H1.3l8.1-9.3L1 2h7l4.9 6.3L18.9 2zm-1.2 18h1.9L7.3 4H5.3l12.4 16z" />
        </svg>
      );
    case "website":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    default:
      return <span className="text-xs font-extrabold">{platform[0]?.toUpperCase() ?? "?"}</span>;
  }
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function sportRoleColor(role: string): string {
  const map: Record<string, string> = {
    player: "bg-red-50 text-red-600",
    coach: "bg-blue-50 text-blue-600",
    referee: "bg-amber-50 text-amber-700",
    organizer: "bg-emerald-50 text-emerald-700",
    recruiter: "bg-purple-50 text-purple-700",
    fan: "bg-zinc-100 text-zinc-600",
  };
  return map[role] ?? "bg-zinc-100 text-zinc-600";
}

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [profile, t, session] = await Promise.all([
    getAthleteProfile(userId),
    getTranslations("AthleteProfile"),
    auth.api.getSession({ headers: await headers() }),
  ]);

  if (!profile) notFound();

  const isOwnProfile = session?.user?.id === userId;
  const { user, media, games, experience, education, achievements } = profile;

  const viewerOrganizations = session ? await getUserOrganizations() : [];
  const viewerHasOrganization = viewerOrganizations.some((org) => org.publicationStatus === "published");

  const aboutContent = (
    <>
      <AthleteBiographySection isOwnProfile={isOwnProfile} name={user.name} bio={user.bio} mainSport={user.mainSport} />
      <AthleteExperienceSection isOwnProfile={isOwnProfile} experience={experience} />
      <AthleteEducationSection isOwnProfile={isOwnProfile} education={education} />
      <AthleteInterestsSection
        isOwnProfile={isOwnProfile}
        tagline={user.tagline}
        location={user.location}
        hometown={user.hometown}
        socialLinks={user.socialLinks}
        interests={user.interests}
      />
    </>
  );

  const achievementsContent = <AthleteAchievementsTab isOwnProfile={isOwnProfile} achievements={achievements} />;

  const body = (
    <div className="bg-zinc-50 min-h-full">

      {/* Full-bleed cover — no card border/rounding/max-width, matches the
          organization public page's cover treatment. */}
      <div className="relative h-48 md:h-64 bg-white">
        {user.coverImage ? (
          <Image src={user.coverImage} alt="" fill className="object-cover" priority />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#e21d12]/15 via-[#e21d12]/5 to-transparent" />
        )}
        {isOwnProfile && <AthleteCoverEditor />}
      </div>

      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 md:px-8 pb-8">
        <div className="flex items-start justify-between gap-4">
          {/* Only the avatar overlaps the cover (negative margin scoped to
              just this element) — the name/info block below it renders in
              normal flow, fully below the cover, so nothing sits underneath
              the cover's paint area and gets visually hidden by it. */}
          <div className="-mt-14">
            <AthleteAvatarEditor isOwnProfile={isOwnProfile} name={user.name} bio={user.bio} mainSport={user.mainSport} image={user.image} />
          </div>
          {isOwnProfile && (
            <div className="pt-4">
              <AthleteEditProfileButton
                name={user.name}
                bio={user.bio}
                mainSport={user.mainSport}
                secondarySports={user.secondarySports}
                tagline={user.tagline}
                location={user.location}
                hometown={user.hometown}
                sportRoles={user.sportRoles}
                socialLinks={user.socialLinks}
                interests={user.interests}
                dateOfBirth={user.dateOfBirth}
              />
            </div>
          )}
        </div>

        <div className="mb-4">
          <AthleteNameEditor isOwnProfile={false} name={user.name} bio={user.bio} mainSport={user.mainSport} />
          <p className="text-sm text-zinc-500">{t("memberSince")} {formatMonth(user.createdAt)}</p>
          {user.tagline && <p className="text-sm italic font-semibold text-zinc-600 mt-0.5">{user.tagline}</p>}
        </div>

        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-zinc-400">{t("sportsLabel")}</p>
        <AthleteMainSportEditor isOwnProfile={false} name={user.name} bio={user.bio} mainSport={user.mainSport} sports={user.secondarySports} />

        {user.sportRoles.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {user.sportRoles.map((role) => (
              <span key={role} className={`px-3 py-1 rounded-full text-xs font-bold ${sportRoleColor(role)}`}>
                {t(`sportRole${role.charAt(0).toUpperCase()}${role.slice(1)}`)}
              </span>
            ))}
          </div>
        )}

        {/* Flat identity rows — icon + label + value, no card/box, matching
            the reference design. Editing for all of these lives in the
            single Edit Profile modal above, not per-row. */}
        <div className="flex flex-col gap-4 mb-6">
          {user.location && (
            <div className="flex items-start gap-3 text-zinc-500">
              <span className="mt-0.5 shrink-0"><PinIcon /></span>
              <div>
                <p className="text-sm font-bold text-zinc-900">{t("locationLabel")}</p>
                <p className="text-sm">{user.location}</p>
              </div>
            </div>
          )}
          {user.hometown && (
            <div className="flex items-start gap-3 text-zinc-500">
              <span className="mt-0.5 shrink-0"><HomeIcon /></span>
              <div>
                <p className="text-sm font-bold text-zinc-900">{t("hometownLabel")}</p>
                <p className="text-sm">{user.hometown}</p>
              </div>
            </div>
          )}
          {isOwnProfile && (
            <div className="flex items-start gap-3 text-zinc-500">
              <span className="mt-0.5 shrink-0"><CalendarIcon /></span>
              <div>
                <p className="text-sm font-bold text-zinc-900">{t("dobTitle")}</p>
                <p className="text-sm">
                  {user.dateOfBirth ? formatFullDate(user.dateOfBirth) : t("dobEmpty")}
                  <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wide text-zinc-400">{t("privateLabel")}</span>
                </p>
              </div>
            </div>
          )}
          {Object.entries(user.socialLinks).filter(([, url]) => url).length > 0 && (
            <div className="flex items-center gap-2">
              {Object.entries(user.socialLinks).filter(([, url]) => url).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title={platform}
                  className="flex size-8 items-center justify-center rounded-full bg-[#e21d12]/10 text-[#e21d12] hover:bg-[#e21d12]/20 transition-colors"
                >
                  {socialPlatformIcon(platform)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-8 py-8">

      {/* About / Achievements tabs */}
      <AthleteProfileTabs aboutContent={aboutContent} achievementsContent={achievementsContent} />

      {/* Game History */}
      <AthleteGameHistory games={games} />

      {/* Gameplay Gallery */}
      <div className="mb-6">
        <AthleteGallerySection isOwnProfile={isOwnProfile} initialMedia={media} />
      </div>

      </div>
    </div>
  );

  if (session) {
    return (
      <LoggedInPageShell
        user={{ id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }}
        hasOrganization={viewerHasOrganization}
        topBarExtra={isOwnProfile ? <ProfileDashboardToggle mode="profile" userId={user.id} /> : undefined}
      >
        {body}
      </LoggedInPageShell>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-zinc-50">{body}</main>
      <Footer />
    </>
  );
}
