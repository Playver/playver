"use client";

// Fixed bottom tab bar shown on small screens (Navbar renders this and
// hides its own links below the md breakpoint).
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconTournaments() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h2a2 2 0 0 1 2 2 4 4 0 0 1-4 4" /><path d="M7 5H5a2 2 0 0 0-2 2 4 4 0 0 0 4 4" /><path d="M8 21h8" /><path d="M12 17v4" />
    </svg>
  );
}

function IconEvents() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// Pages below already provide their own contextual mobile nav (in-page sections,
// or — for /dashboard — the dashboard sidebar's own bottom nav), so this generic
// site-wide nav stays out of their way.
function hasOwnMobileNav(pathname: string) {
  if (pathname.startsWith("/dashboard")) return true;
  if (pathname.startsWith("/organizer")) return true;
  if (/^\/events\/[^/]+/.test(pathname)) return true;
  if (/^\/athletes\/[^/]+/.test(pathname)) return true;
  if (/^\/teams\/[^/]+/.test(pathname)) return true;
  return false;
}

export default function MobileBottomNav({ hideTournaments = false }: { hideTournaments?: boolean } = {}) {
  const t = useTranslations("Navbar");
  const pathname = usePathname();
  const { data: session } = useSession();

  if (hasOwnMobileNav(pathname)) return null;

  const items = [
    ...(session && !hideTournaments ? [{ href: "/tournaments" as const, label: t("tournaments"), icon: <IconTournaments /> }] : []),
    { href: "/events" as const, label: t("discover"), icon: <IconEvents /> },
    session
      ? { href: "/dashboard/profile" as const, label: t("profile"), icon: <IconProfile /> }
      : { href: "/auth/signin" as const, label: t("login"), icon: <IconProfile /> },
  ];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white">
      <div className="flex items-stretch h-16">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
              isActive(item.href) ? "text-[#e21d12]" : "text-zinc-400"
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-semibold leading-none">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
