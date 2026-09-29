"use client";

// The org-switcher for OrganizerSidebar's header block (avatar + name +
// "Owner · Name") — a bigger-format dropdown than OrganizerSwitcher.tsx's
// compact pill (that one is a separate, still-used component: the
// "Creating for: [switcher]" picker inside CreateEventButton.tsx's modal —
// do not merge into or repurpose that one, it has a different caller/shape).
// This one also folds in "+ New Organization" (previously its own button in
// OrganizerTopNav) as the last row of the same dropdown, since switching
// orgs and creating a new one are the same mental action ("which org am I
// managing") and don't need two separate controls in the chrome.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { setActiveOrganization } from "@/app/actions/organization";
import type { OrganizationSummary } from "@/app/actions/organization";
import type { OrgRole } from "@/lib/organizer-permissions";
import CreateOrganizationLauncher from "@/components/organizer/create-wizard/CreateOrganizationLauncher";

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function OrganizerSidebarSwitcher({
  organizations,
  activeOrganizationId,
  organizationName,
  organizationLogoUrl,
  role,
  userName,
}: {
  organizations: OrganizationSummary[];
  activeOrganizationId: string;
  organizationName: string;
  organizationLogoUrl: string | null;
  role: OrgRole;
  userName: string;
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
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

  async function handleSelect(organizationId: string) {
    if (organizationId === activeOrganizationId) {
      setOpen(false);
      return;
    }
    setIsSwitching(true);
    const result = await setActiveOrganization(organizationId);
    setIsSwitching(false);
    setOpen(false);
    if (!result.error) router.refresh();
  }

  async function handlePublished(organizationId: string) {
    setOpen(false);
    await setActiveOrganization(organizationId);
    router.refresh();
  }

  const orgInitial = organizationName[0]?.toUpperCase() ?? "?";

  return (
    <div ref={containerRef} className="relative px-4 py-4 border-b border-zinc-100">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-lg text-left hover:bg-zinc-50 transition-colors"
      >
        <span className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
          {organizationLogoUrl ? (
            <Image src={organizationLogoUrl} alt="" width={36} height={36} className="w-full h-full object-cover" />
          ) : (
            orgInitial
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 truncate">{organizationName}</p>
          <p className="text-xs text-zinc-400 truncate">
            {t(`role_${role}`)} · {userName}
          </p>
        </div>
        <span className="shrink-0 text-zinc-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Always mounted (visibility toggled via CSS, not conditional
          rendering) — CreateOrganizationLauncher owns its own wizard-open
          state internally, so unmounting this panel the instant "New
          Organization" is clicked (which also closes this dropdown) would
          destroy that state before the wizard ever showed. Same fix as
          CreateChooserModal.tsx's identical bug. */}
      <div className={`absolute left-4 right-4 mt-1.5 py-1.5 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto ${open ? "" : "hidden"}`}>
        <ul role="listbox" aria-label={t("switcherLabel")}>
          {organizations.map((org) => (
            <li key={org.id} role="option" aria-selected={org.id === activeOrganizationId}>
              <button
                type="button"
                disabled={isSwitching}
                onClick={() => handleSelect(org.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                  org.id === activeOrganizationId ? "bg-red-50 text-[#e21d12] font-semibold" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span className="truncate">{org.name}</span>
                {org.publicationStatus !== "published" && (
                  <span className="shrink-0 ml-auto px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                    {t("draftBadge")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-zinc-100 mt-1 pt-1">
          <CreateOrganizationLauncher
            onPublished={handlePublished}
            trigger={(openWizard) => (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openWizard();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-semibold text-[#e21d12] hover:bg-red-50 transition-colors"
              >
                <IconPlus />
                {t("newOrganization")}
              </button>
            )}
          />
        </div>
      </div>
    </div>
  );
}
