"use client";

// Outer app rail for the organizer console (/organizer/*) — the same
// Home/Explore/Create sidebar + bottom profile block used everywhere else
// in the redesign (FeedSidebar, standalone mode, same as LoggedInPageShell),
// wrapping OrganizerTopNav + OrganizerSidebar + page content rather than
// replacing them. Unlike LoggedInPageShell, this doesn't render its own
// top bar — OrganizerTopNav already covers that role for this section (its
// own language toggle/notification/org-role avatar menu), so adding a
// second one here would just duplicate it.
import { useState, type ReactNode } from "react";
import FeedSidebar from "@/components/home-feed/FeedSidebar";
import ProfileSlideOver from "@/components/layout/ProfileSlideOver";
import MobileLogoBar from "@/components/layout/MobileLogoBar";

export default function OrganizerAppShell({
  user,
  children,
}: {
  user: { id: string; name: string; email: string; image: string | null };
  children: ReactNode;
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="flex flex-1 bg-white min-h-screen">
      {/* hasOrganization is always true here — reaching this shell at all
          means organizer/layout.tsx already resolved a published active
          org. createVariant="event" skips the Create-Event-vs-Create-Org
          chooser used elsewhere — you're already inside an org here, so
          "create an event" is the only one that makes sense from this
          panel (CreateEventButton resolves the active org itself).
          showOrganizerLink is off: an "Organizer Dashboard" link pointing
          at /organizer is meaningless when you're already inside it. */}
      <FeedSidebar user={user} hasOrganization createVariant="event" showOrganizerLink={false} onOpenProfile={() => setIsProfileOpen(true)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileLogoBar />
        {children}
      </div>

      <ProfileSlideOver open={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} />
    </div>
  );
}
