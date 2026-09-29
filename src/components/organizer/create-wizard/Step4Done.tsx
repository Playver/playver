"use client";

// Wizard step 4 of 4: terminal success screen, no form/`update` — reads
// `state` read-only. "Manage Organization ->" calls the wizard's
// onManageOrganization prop, which CreateOrganizationWizard wires to the
// same onPublished(organizationId) callback handlePublish used to call
// immediately before this step existed. Creator name comes from the same
// client-side useSession() hook Navbar.tsx already uses (cheap — the session
// is already fetched/cached elsewhere in the app) rather than threading a
// new prop through CreateOrganizationLauncher/FeedSidebar/etc.; role is
// hardcoded to OWNER since the account creating a brand-new organization is
// always inserted as its OWNER (see createOrganizationDraft). Per the
// product decision, there's no "View Public Page" button — no public org
// route exists in the app yet.
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import type { WizardState } from "./types";

export default function Step4Done({
  state,
  onManageOrganization,
}: {
  state: WizardState;
  onManageOrganization: () => void;
}) {
  const t = useTranslations("Organizer");
  const { data: session } = useSession();
  const creatorName = session?.user?.name ?? "";

  return (
    <div className="max-w-xl mx-auto flex flex-col items-center text-center pt-8">
      <span className="size-14 rounded-full bg-[#e21d12] flex items-center justify-center text-white mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <p className="text-xs font-bold tracking-wide uppercase text-[#e21d12] mb-2">{t("wizardDoneEyebrow")}</p>
      <h2 className="text-2xl font-extrabold text-zinc-900 mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
        {t("wizardDoneTitle")}
      </h2>
      <p className="text-sm text-zinc-500 mb-8 max-w-sm">{t("wizardDoneSubtitle")}</p>

      <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col items-center gap-1 mb-4">
        <div className="size-16 rounded-xl bg-[#e21d12] flex items-center justify-center text-white font-bold overflow-hidden shadow-sm shrink-0">
          {state.logoUrl ? (
            <Image src={state.logoUrl} alt="" width={64} height={64} className="w-full h-full object-cover" />
          ) : (
            state.name.slice(0, 2).toUpperCase() || "??"
          )}
        </div>
        <p className="font-bold text-zinc-900 mt-2">{state.name || t("wizardUntitled")}</p>
        {state.slogan && <p className="text-sm text-zinc-500">{state.slogan}</p>}
        {state.slug && <p className="text-xs text-zinc-400">playver.com/{state.slug}</p>}
      </div>

      {creatorName && (
        <div className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex items-center gap-3 mb-8">
          <span className="size-9 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {creatorName.slice(0, 1).toUpperCase()}
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-900">{creatorName}</p>
            <p className="text-xs text-zinc-500">{t("role_OWNER")}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onManageOrganization}
        className="px-8 py-3 rounded-full bg-[#e21d12] text-white text-sm font-bold hover:bg-[#d41810] transition-colors shadow-sm"
      >
        {t("wizardDoneManageButton")} →
      </button>
    </div>
  );
}
