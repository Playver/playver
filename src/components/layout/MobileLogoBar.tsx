import Image from "next/image";
import { Link } from "@/i18n/routing";

// Persistent Playver-logo-links-home bar for mobile viewports, where
// FeedSidebar (which owns the logo on desktop) is hidden (`hidden lg:flex`).
// Used at the top of every logged-in app shell (HomeFeedShell,
// LoggedInPageShell, OrganizerAppShell) so mobile users always have a way
// back to home, not just via the bottom nav's Home tab.
// Fixed h-16 (not padding-driven) so callers with their own sticky bar right
// after this one (e.g. OrganizerAppShell's OrganizerTopNav) can stack below
// it with a matching `top-16` offset instead of both fighting over top-0.
export default function MobileLogoBar() {
  return (
    <div className="lg:hidden sticky top-0 z-30 h-16 flex items-center bg-white border-b border-zinc-200 px-4">
      <Link href="/" className="inline-flex items-center gap-2">
        <Image src="/logo.png" alt="Playver" width={100} height={40} priority className="object-contain" />
      </Link>
    </div>
  );
}
