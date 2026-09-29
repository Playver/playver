"use client";

// Shown by organizer/layout.tsx when the active organization exists but is
// still a draft (publicationStatus !== "published") — a draft org's admin
// console isn't accessible until it's actually published (see the layout's
// own comment for why), so this screen sends them straight back into the
// wizard to finish it, resuming the draft they already have rather than
// making them pick it again from CreateOrganizationLauncher's draft chooser.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { getOrganizationDraftState, setActiveOrganization } from "@/app/actions/organization";
import CreateOrganizationWizard from "@/components/organizer/create-wizard/CreateOrganizationWizard";
import { wizardStateFromDraft, type WizardState } from "@/components/organizer/create-wizard/types";

export default function EmptyStateResumeDraft({ organizationId }: { organizationId: string }) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleResume() {
    setLoading(true);
    setError("");
    const result = await getOrganizationDraftState(organizationId);
    setLoading(false);
    if (result.error || !result.draft) {
      setError(result.error ?? t("wizardResumeError"));
      return;
    }
    setWizardState(wizardStateFromDraft(result.draft));
  }

  async function handlePublished(id: string) {
    await setActiveOrganization(id);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleResume}
        disabled={loading}
        className="px-6 py-3 text-sm font-semibold text-white rounded-full bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm disabled:opacity-60"
      >
        {loading ? t("wizardResuming") : t("wizardContinueSetup")}
      </button>
      {error && <p className="text-sm font-semibold text-red-500 mt-3">{error}</p>}
      {wizardState && (
        <CreateOrganizationWizard
          initialState={wizardState}
          onClose={() => setWizardState(null)}
          onPublished={(id) => {
            setWizardState(null);
            handlePublished(id);
          }}
        />
      )}
    </>
  );
}
