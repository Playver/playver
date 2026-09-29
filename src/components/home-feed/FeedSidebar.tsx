"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import { useState } from "react";
import CreateOrganizationLauncher from "@/components/organizer/create-wizard/CreateOrganizationLauncher";
import CreateChooserModal from "@/components/home-feed/CreateChooserModal";
import CreateEventButton from "@/components/events/CreateEventButton";
import { setActiveOrganization } from "@/app/actions/organization";
import { useSignOut } from "@/lib/use-sign-out";

const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconDiscover = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);
const IconCreate = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconOrganizer = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3 6 6.5 1-4.7 4.5 1.1 6.5L12 17l-5.9 3 1.1-6.5L2.5 9 9 8z" />
  </svg>
);
const IconSignOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
export type FeedView = "home" | "events";

// Real routes each view maps to when this sidebar is used standalone (no
// onNavigate/activeView — see below) outside HomeFeedShell's client-side
// view-switching, e.g. on a page like the public org profile.
const VIEW_HREF: Record<FeedView, string> = { home: "/", events: "/events" };

export default function FeedSidebar({
  user,
  activeView,
  onNavigate,
  hasOrganization,
  onOpenProfile,
  createVariant = "chooser",
  showOrganizerLink = true,
}: {
  user: { name: string; email: string };
  // Both omitted -> Home/Explore render as real links (to VIEW_HREF) instead
  // of calling onNavigate, and "active" is derived from the current
  // pathname. This lets the same sidebar be reused on pages that aren't
  // HomeFeedShell's client-side "home"|"events" view-switcher, without
  // duplicating its markup/icons/CreateChooserModal wiring elsewhere.
  activeView?: FeedView;
  onNavigate?: (view: FeedView) => void;
  hasOrganization: boolean;
  onOpenProfile: () => void;
  // "chooser" (default): Create Event vs. Create Organization, via
  // CreateChooserModal. "event": skips the chooser and goes straight into
  // CreateEventButton's own flow — used inside the organizer console
  // (OrganizerAppShell), where you're already inside an org so "create an
  // organization" from here doesn't fit, but "create an event" still does.
  // "hidden": no Create button at all.
  createVariant?: "chooser" | "event" | "hidden";
  // Off inside the organizer console too — an "Organizer Dashboard" link
  // pointing at /organizer is meaningless when you're already inside it.
  showOrganizerLink?: boolean;
}) {
  const t = useTranslations("HomeFeed");
  const router = useRouter();
  const pathname = usePathname();
  const handleSignOut = useSignOut();
  const firstName = user.name.split(" ")[0] || user.name;
  const initial = firstName[0]?.toUpperCase() ?? "?";
  const [createOpen, setCreateOpen] = useState(false);

  async function handleOrgPublished(organizationId: string) {
    await setActiveOrganization(organizationId);
    router.refresh();
  }

  // Trimmed to Home / Explore / Create per the redesign — Home and Explore
  // both drive HomeFeedShell's "home"|"events" view-switcher (Explore reuses
  // the "events" view rather than being a separate route, so the sidebar
  // stays mounted). "My Profile" moved into the ProfileSlideOver (see the
  // bottom block below), and the other former placeholders (Challenges/
  // Organizations/Perks/Athletes/Notifications) were dropped entirely
  // rather than kept as disabled rows. Create itself is rendered separately
  // below (see createVariant) since its two variants need different
  // trigger wiring (a plain onClick vs. CreateEventButton's renderTrigger).
  const navItems: { kind: "view"; view: FeedView; label: string; icon: React.ReactNode }[] = [
    { kind: "view", view: "home", label: t("navHome"), icon: <IconHome /> },
    { kind: "view", view: "events", label: t("navExplore"), icon: <IconDiscover /> },
  ];

  const createPillClassName = "flex items-center gap-2.5 mt-1 px-4 py-2.5 rounded-full text-sm font-bold text-white bg-[#e21d12] hover:bg-[#d41810] transition-colors disabled:opacity-60";

  return (
    <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-zinc-200 flex-col sticky top-0 h-screen">
      <div className="px-5 pt-5 pb-4">
        {onNavigate ? (
          <button type="button" onClick={() => onNavigate("home")} className="flex items-center gap-2">
            <Image src="/logo.png" alt="Playver" width={110} height={44} priority className="object-contain" />
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Playver" width={110} height={44} priority className="object-contain" />
          </Link>
        )}
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          if (!onNavigate) {
            const href = VIEW_HREF[item.view];
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={item.view}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  active ? "bg-red-50 text-[#e21d12]" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span className={active ? "text-[#e21d12]" : "text-zinc-400"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          }
          const active = activeView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors text-left ${
                active ? "bg-red-50 text-[#e21d12]" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <span className={active ? "text-[#e21d12]" : "text-zinc-400"}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}

        {createVariant === "chooser" && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={createPillClassName}
          >
            <IconCreate />
            {t("navCreate")}
          </button>
        )}

        {createVariant === "event" && (
          <CreateEventButton
            label={t("navCreate")}
            renderTrigger={(onClick, disabled) => (
              <button type="button" onClick={onClick} disabled={disabled} className={createPillClassName}>
                <IconCreate />
                {t("navCreate")}
              </button>
            )}
          />
        )}
      </nav>

      {showOrganizerLink && (
      <div className="px-3 pb-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
        {hasOrganization ? (
          <Link
            href="/organizer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-[#e21d12] rounded-lg border border-[#e21d12] hover:bg-red-50 transition-colors"
          >
            <IconOrganizer />
            {t("organizerDashboard")}
          </Link>
        ) : (
          <CreateOrganizationLauncher
            onPublished={handleOrgPublished}
            trigger={(open) => (
              <button
                type="button"
                onClick={open}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-[#e21d12] rounded-lg border border-[#e21d12] hover:bg-red-50 transition-colors"
              >
                <IconOrganizer />
                {t("becomeOrganizer")}
              </button>
            )}
          />
        )}
      </div>
      )}

      <div className="px-3 pb-4 border-t border-zinc-100 pt-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 px-2 pb-3 text-left rounded-lg hover:bg-zinc-50 transition-colors"
        >
          <span className="w-9 h-9 rounded-full bg-[#e21d12] flex items-center justify-center text-white text-sm font-bold shrink-0">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">{user.name}</p>
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
          </div>
        </button>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
        >
          <IconSignOut />
          {t("signOut")}
        </button>
      </div>

      <CreateChooserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </aside>
  );
}
