"use client";

// Full-height left slide-over opened from the home feed (bottom-left profile
// block + top-right avatar in HomeFeedShell). Closes on Escape or backdrop
// click, following the outside-click pattern already used by
// OrganizerUserMenu/OrganizerSwitcher, adapted for a full panel instead of a
// small dropdown.
import { useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useSignOut } from "@/lib/use-sign-out";

const IconProfile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconSparkle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z" />
  </svg>
);
const IconOrganizations = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconSignOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function ProfileSlideOver({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string; image: string | null; id: string };
}) {
  const t = useTranslations("ProfileMenu");
  const handleSignOut = useSignOut();
  const initial = (user.name.split(" ")[0]?.[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const profileHref = `/athletes/${user.id}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 left-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
        <div className="bg-zinc-900 text-white px-6 pt-5 pb-6 flex flex-col gap-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="self-end text-zinc-400 hover:text-white transition-colors"
          >
            <IconClose />
          </button>

          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-full bg-[#e21d12] flex items-center justify-center text-white text-xl font-bold shrink-0 overflow-hidden">
              {user.image ? (
                <Image src={user.image} alt="" width={56} height={56} className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold truncate">{user.name}</p>
              <p className="text-sm text-zinc-400 truncate">{user.email}</p>
            </div>
          </div>

          <Link
            href={profileHref}
            onClick={onClose}
            className="w-full text-center py-2.5 rounded-lg bg-white text-zinc-900 text-sm font-bold hover:bg-zinc-100 transition-colors"
          >
            {t("viewProfile")}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-3 px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <span className="text-zinc-400"><IconProfile /></span>
            {t("viewDashboard")}
          </Link>

          <span
            title={t("comingSoon")}
            className="flex items-center gap-3 px-6 py-3.5 text-sm font-medium text-zinc-300 cursor-not-allowed"
          >
            <IconSparkle />
            {t("myPlayver")}
            <span className="ml-auto px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-400 text-[10px] font-bold uppercase tracking-wide">
              {t("comingSoon")}
            </span>
          </span>

          <Link
            href="/dashboard/organizations"
            onClick={onClose}
            className="flex items-center gap-3 px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <span className="text-zinc-400"><IconOrganizations /></span>
            {t("manageOrganizations")}
          </Link>

          <Link
            href="/dashboard/settings"
            onClick={onClose}
            className="flex items-center gap-3 px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <span className="text-zinc-400"><IconSettings /></span>
            {t("settingsAndPrivacy")}
          </Link>
        </nav>

        <div className="border-t border-zinc-100 py-2 shrink-0">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-6 py-3.5 text-sm font-bold text-[#e21d12] hover:bg-red-50 transition-colors text-left"
          >
            <IconSignOut />
            {t("logOut")}
          </button>
        </div>
      </aside>
    </>
  );
}
