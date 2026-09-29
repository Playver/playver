"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import CreateEventButton from "@/components/events/CreateEventButton";
import type { FeedView } from "@/components/home-feed/FeedSidebar";

const IconHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconEvents = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconProfile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const itemClass = "flex-1 flex flex-col items-center justify-center gap-0.5 py-1";

export default function HomeFeedMobileNav({
  activeView,
  onNavigate,
  profileHref = "/dashboard/profile",
}: {
  // Both omitted -> Home/Events render as real links (to "/"/"/events")
  // instead of calling onNavigate — see FeedSidebar's identical standalone
  // mode, which this mirrors for the mobile bottom bar.
  activeView?: FeedView;
  onNavigate?: (view: FeedView) => void;
  profileHref?: string;
}) {
  const t = useTranslations("HomeFeed");
  const pathname = usePathname();

  function isLinkActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200">
      <div className="flex items-stretch h-16">
        {onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className={`${itemClass} ${activeView === "home" ? "text-[#e21d12]" : "text-zinc-400"}`}
          >
            <IconHome />
            <span className="text-[10px] font-semibold leading-none">{t("navHome")}</span>
          </button>
        ) : (
          <Link href="/" className={`${itemClass} ${isLinkActive("/") ? "text-[#e21d12]" : "text-zinc-400"}`}>
            <IconHome />
            <span className="text-[10px] font-semibold leading-none">{t("navHome")}</span>
          </Link>
        )}
        {onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate("events")}
            className={`${itemClass} ${activeView === "events" ? "text-[#e21d12]" : "text-zinc-400"}`}
          >
            <IconEvents />
            <span className="text-[10px] font-semibold leading-none">{t("navEvents")}</span>
          </button>
        ) : (
          <Link href="/events" className={`${itemClass} ${isLinkActive("/events") ? "text-[#e21d12]" : "text-zinc-400"}`}>
            <IconEvents />
            <span className="text-[10px] font-semibold leading-none">{t("navEvents")}</span>
          </Link>
        )}
        <CreateEventButton
          label={t("createButton")}
          icon={<IconPlus />}
          className={`${itemClass} text-[#e21d12] text-[10px] font-semibold leading-none`}
        />
        <Link href={profileHref} className={`${itemClass} ${isLinkActive(profileHref) ? "text-[#e21d12]" : "text-zinc-400"}`}>
          <IconProfile />
          <span className="text-[10px] font-semibold leading-none">{t("navProfile")}</span>
        </Link>
      </div>
    </nav>
  );
}
