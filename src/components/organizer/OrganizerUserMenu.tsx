"use client";

// Avatar dropdown in OrganizerTopNav: shows the org role badge, a link back
// to the athlete /dashboard, and sign-out.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useSignOut } from "@/lib/use-sign-out";
import type { OrgRole } from "@/lib/organizer-permissions";

const IconSignOut = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconPlayerDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

export default function OrganizerUserMenu({
  userName,
  userEmail,
  userImage,
  role,
}: {
  userName: string;
  userEmail: string;
  userImage: string | null;
  role: OrgRole;
}) {
  const t = useTranslations("Organizer");
  const handleSignOut = useSignOut();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const initial = userName[0]?.toUpperCase() ?? "?";

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-[#e21d12] flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden"
      >
        {userImage ? (
          <Image src={userImage} alt="" width={36} height={36} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 py-1.5 bg-white border border-zinc-200 rounded-lg shadow-lg z-50"
        >
          <div className="px-4 py-2.5 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-900 truncate">{userName}</p>
            <p className="text-xs text-zinc-400 truncate">{userEmail}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{t(`role_${role}`)}</p>
          </div>
          <Link
            href="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors text-left"
          >
            <IconPlayerDashboard />
            {t("playerDashboard")}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors text-left"
          >
            <IconSignOut />
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
