"use client";

// "Create Event" entry point used on the public /events page and elsewhere.
// On click, checks the user's active organization first: no org -> prompts
// to become an organizer (via CreateOrganizationLauncher); has one (or
// more) -> opens CreateEventForm directly, letting them switch which org
// they're creating for via OrganizerSwitcher.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import CreateEventForm from "@/components/events/CreateEventForm";
import SuccessToast from "@/components/ui/SuccessToast";
import CreateOrganizationLauncher from "@/components/organizer/create-wizard/CreateOrganizationLauncher";
import OrganizerSwitcher from "@/components/organizer/OrganizerSwitcher";
import { getActiveOrganization, setActiveOrganization, getUserOrganizations } from "@/app/actions/organization";
import type { OrganizationSummary } from "@/app/actions/organization";

type View = "closed" | "checking" | "noOrg" | "createEvent";

export default function CreateEventButton({
  label,
  icon,
  className,
  renderTrigger,
}: {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  // Lets a caller (e.g. CreateChooserModal) render its own trigger element
  // instead of the default button, while still reusing this component's
  // org-check + form-modal flow below.
  renderTrigger?: (onClick: () => void, disabled: boolean) => React.ReactNode;
}) {
  const [view, setView] = useState<View>("closed");
  const [toastKey, setToastKey] = useState(0);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const t = useTranslations("CreateEvent");
  const router = useRouter();

  async function handleClick() {
    setView("checking");
    const active = await getActiveOrganization();
    if (!active) {
      setView("noOrg");
      return;
    }
    const orgs = await getUserOrganizations();
    setActiveOrgId(active.organization.id);
    setOrganizations(orgs);
    setView("createEvent");
  }

  async function handleOrgPublished(organizationId: string) {
    // Creating an event requires this org to be the active one (createEvent
    // resolves the creator's org via the active_org_id cookie), so switch to
    // it before continuing straight into the event form — no extra click.
    await setActiveOrganization(organizationId);
    const orgs = await getUserOrganizations();
    setActiveOrgId(organizationId);
    setOrganizations(orgs);
    setView("createEvent");
  }

  function handleSuccess() {
    setView("closed");
    setToastKey((key) => key + 1);
    router.refresh();
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(handleClick, view === "checking")
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={view === "checking"}
          className={
            className ??
            "px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm disabled:opacity-60"
          }
        >
          {view === "checking" ? "..." : (
            <>
              {icon}
              {label}
            </>
          )}
        </button>
      )}

      {view === "noOrg" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setView("closed")} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-center">
            <h2 className="text-xl font-bold text-zinc-900 mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
              {t("noOrgTitle")}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">{t("noOrgDescription")}</p>
            <div className="flex flex-col gap-2">
              <CreateOrganizationLauncher
                onPublished={handleOrgPublished}
                onSaveDraft={() => setView("closed")}
                trigger={(open) => (
                  <button
                    type="button"
                    onClick={open}
                    className="w-full px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm"
                  >
                    {t("noOrgCreateButton")}
                  </button>
                )}
              />
              <button
                type="button"
                onClick={() => setView("closed")}
                className="w-full px-5 py-2.5 text-sm font-semibold text-zinc-600 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                {t("noOrgCancelButton")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {view === "createEvent" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setView("closed")} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-50 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
              <h2 className="text-xl font-bold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
                {t("modalTitle")}
              </h2>
              <button onClick={() => setView("closed")} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {activeOrgId && (
              <div className="px-6 pt-4 flex items-center gap-2.5">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide shrink-0">
                  {t("creatingFor")}
                </span>
                {organizations.length > 1 ? (
                  <div className="w-56">
                    <OrganizerSwitcher
                      organizations={organizations}
                      activeOrganizationId={activeOrgId}
                      onSwitched={setActiveOrgId}
                    />
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-zinc-900">
                    {organizations.find((o) => o.id === activeOrgId)?.name}
                  </span>
                )}
              </div>
            )}
            <div className="p-6">
              <CreateEventForm onSuccess={handleSuccess} onCancel={() => setView("closed")} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {toastKey > 0 && <SuccessToast key={toastKey} message={t("success")} />}
    </>
  );
}
