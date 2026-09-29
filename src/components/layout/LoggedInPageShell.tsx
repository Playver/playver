"use client";

// Reusable app chrome for logged-in-only pages that aren't the home feed
// (HomeFeedShell owns that one, with its client-side "home"|"events" view
// switching) — same left sidebar (FeedSidebar in its standalone/real-link
// mode), same top-right avatar opening ProfileSlideOver, same mobile bottom
// bar, wrapping arbitrary page content instead of the feed's specific
// home/events views. First use: the public org profile page
// (/organizations/[slug]) for a logged-in viewer, replacing the old
// Navbar/Footer chrome those pages used before this redesign reached them.
import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import FeedSidebar from "@/components/home-feed/FeedSidebar";
import HomeFeedMobileNav from "@/components/home-feed/HomeFeedMobileNav";
import ProfileSlideOver from "@/components/layout/ProfileSlideOver";
import LanguageToggle from "@/components/layout/LanguageToggle";
import MobileLogoBar from "@/components/layout/MobileLogoBar";

export default function LoggedInPageShell({
  user,
  hasOrganization,
  topBarExtra,
  children,
}: {
  user: { id: string; name: string; email: string; image: string | null };
  hasOrganization: boolean;
  // Optional page-specific control rendered before the language toggle
  // (e.g. the Public/Admin switch on the org public page, for a viewer who
  // admins that org) — kept generic here rather than baking org-specific
  // logic into a shell every logged-in non-home page reuses.
  topBarExtra?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("HomeFeed");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const initial = (user.name.split(" ")[0]?.[0] ?? "?").toUpperCase();

  return (
    <div className="flex flex-1 bg-white min-h-screen">
      <FeedSidebar user={user} hasOrganization={hasOrganization} onOpenProfile={() => setIsProfileOpen(true)} />

      <main className="flex-1 min-w-0 bg-white pb-20 lg:pb-8">
        <MobileLogoBar />
        <div className="flex justify-end items-center gap-3 px-4 md:px-8 py-4">
          {topBarExtra}
          <LanguageToggle />
          <button
            type="button"
            disabled
            title={t("comingSoon")}
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 bg-white border border-zinc-200 cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="w-9 h-9 rounded-full bg-[#e21d12] flex items-center justify-center text-white text-sm font-bold overflow-hidden"
          >
            {user.image ? (
              <Image src={user.image} alt="" width={36} height={36} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </button>
        </div>

        {children}
      </main>

      <HomeFeedMobileNav profileHref={`/athletes/${user.id}`} />

      <ProfileSlideOver open={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} />
    </div>
  );
}
