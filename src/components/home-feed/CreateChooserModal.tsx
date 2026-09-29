"use client";

// "+ Create" popup from FeedSidebar — lets the user pick between creating an
// event and creating an organization, then hands off to whichever existing
// flow already owns that (CreateEventButton's own org-check+form modal,
// CreateOrganizationLauncher's wizard) rather than reimplementing either.
//
// Important: CreateEventButton/CreateOrganizationLauncher must stay mounted
// even after this picker closes — their own in-progress flow (e.g. the
// CreateEventForm modal) lives in THEIR state, not this component's, so
// unmounting them the instant a row is clicked would kill that flow before
// it ever showed. The picker chrome below is hidden via CSS when `open` is
// false rather than conditionally rendered, so nothing under it unmounts.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import CreateEventButton from "@/components/events/CreateEventButton";
import CreateOrganizationLauncher from "@/components/organizer/create-wizard/CreateOrganizationLauncher";
import { setActiveOrganization } from "@/app/actions/organization";

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconOrganization() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChooserRow({ icon, label, description, onClick }: { icon: React.ReactNode; label: string; description: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-50 transition-colors text-left"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-bold text-zinc-900">{label}</span>
        <span className="block text-sm text-zinc-500">{description}</span>
      </span>
    </button>
  );
}

export default function CreateChooserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("HomeFeed");
  const router = useRouter();
  // createPortal needs document.body, which doesn't exist during SSR — this
  // component is always mounted (see the note above), so without this guard
  // Next.js's server render of the page crashes with "document is not
  // defined". Deferring the portal to after the first client-side effect
  // flush is the standard fix; it doesn't fight the "stay mounted" rule above
  // since nothing here ever unmounts once mounted is true.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function handleOrgPublished(organizationId: string) {
    await setActiveOrganization(organizationId);
    router.refresh();
  }

  if (!mounted) return null;

  return createPortal(
    <div className={open ? "fixed inset-0 z-50 flex items-center justify-center p-4" : "hidden"}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-xl font-extrabold text-zinc-900">{t("createModalTitle")}</h2>
            <p className="text-sm text-zinc-500 mt-0.5">{t("createModalSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors shrink-0"
          >
            <IconClose />
          </button>
        </div>

        <div className="flex flex-col mt-3">
          <CreateEventButton
            label={t("createModalEventLabel")}
            renderTrigger={(onClick, disabled) => (
              <ChooserRow
                icon={<IconCalendar />}
                label={t("createModalEventLabel")}
                description={t("createModalEventDesc")}
                onClick={disabled ? undefined : () => { onClick(); onClose(); }}
              />
            )}
          />
          <CreateOrganizationLauncher
            onPublished={handleOrgPublished}
            trigger={(openLauncher) => (
              <ChooserRow
                icon={<IconOrganization />}
                label={t("createModalOrgLabel")}
                description={t("createModalOrgDesc")}
                onClick={() => { openLauncher(); onClose(); }}
              />
            )}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
