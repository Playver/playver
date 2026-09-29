"use client";

// Top bar for every /organizer/* page (rendered by organizer/layout.tsx).
// The Playver logo, org switcher, and "New Organization" launcher that used
// to live here were removed — the logo is already in the outer app rail
// (OrganizerAppShell -> FeedSidebar), and switching/creating orgs now lives
// in OrganizerSidebar's own header (OrganizerSidebarSwitcher), so having
// them here too was pure duplication. What's left: language toggle,
// "Public" (navigates, same tab, to the org's public profile page —
// /organizations/[slug], see src/app/[locale]/organizations/[slug]/page.tsx
// — but only once the org is actually published: getPublicOrganizationProfile()
// 404s a draft org for anyone, by design, so a draft org's own owner needs an
// explicit reason the link is disabled here rather than just landing on a
// bare 404), notifications (still a permanently disabled placeholder, not
// wired to anything yet), and the org-role user menu.
import { useTranslations } from "next-intl";
import OrganizerUserMenu from "@/components/organizer/OrganizerUserMenu";
import PublicAdminToggle from "@/components/organizer/PublicAdminToggle";
import LanguageToggle from "@/components/layout/LanguageToggle";
import type { OrgRole } from "@/lib/organizer-permissions";

const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function OrganizerTopNav({
  organizationId,
  organizationSlug,
  organizationPublished,
  role,
  userName,
  userEmail,
  userImage,
}: {
  organizationId: string;
  organizationSlug: string;
  organizationPublished: boolean;
  role: OrgRole;
  userName: string;
  userEmail: string;
  userImage: string | null;
}) {
  const t = useTranslations("Organizer");

  return (
    <header className="sticky top-16 lg:top-0 z-40 w-full bg-white border-b border-zinc-200">
        <div className="h-16 px-4 md:px-6 flex items-center gap-3">
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <LanguageToggle />

            <div className="hidden lg:block">
              <PublicAdminToggle
                mode="admin"
                organizationId={organizationId}
                organizationSlug={organizationSlug}
                organizationPublished={organizationPublished}
              />
            </div>

            <button
              type="button"
              disabled
              title={t("notificationsComingSoon")}
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-300 cursor-not-allowed"
            >
              <IconBell />
            </button>

            <OrganizerUserMenu userName={userName} userEmail={userEmail} userImage={userImage} role={role} />
          </div>
      </div>
    </header>
  );
}
