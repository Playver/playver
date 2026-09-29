"use client";

// Entry point for creating an org: caller supplies its own `trigger` button
// (render-prop, so this can be embedded anywhere — sidebar, top nav, empty
// state). On open, checks for existing unpublished drafts and offers to
// resume one before falling through to a fresh CreateOrganizationWizard.
import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  getDraftOrganizations,
  getOrganizationDraftState,
  type DraftOrganizationSummary,
} from "@/app/actions/organization";
import CreateOrganizationWizard from "./CreateOrganizationWizard";
import { wizardStateFromDraft, type WizardState } from "./types";

type Mode = { view: "idle" } | { view: "choosing"; drafts: DraftOrganizationSummary[] } | { view: "wizard"; resume?: WizardState };

export default function CreateOrganizationLauncher({
  trigger,
  onPublished,
  onSaveDraft,
}: {
  trigger: (open: () => void) => React.ReactNode;
  onPublished: (organizationId: string) => void;
  onSaveDraft?: () => void;
}) {
  const t = useTranslations("Organizer");
  const [mode, setMode] = useState<Mode>({ view: "idle" });
  const [loading, setLoading] = useState(false);
  const [resumeError, setResumeError] = useState("");

  async function open() {
    setLoading(true);
    const drafts = await getDraftOrganizations();
    setLoading(false);
    if (drafts.length === 0) {
      setMode({ view: "wizard" });
    } else {
      setMode({ view: "choosing", drafts });
    }
  }

  async function resumeDraft(id: string) {
    setResumeError("");
    setLoading(true);
    const result = await getOrganizationDraftState(id);
    setLoading(false);
    if (result.error || !result.draft) {
      setResumeError(result.error ?? t("wizardResumeError"));
      return;
    }
    setMode({ view: "wizard", resume: wizardStateFromDraft(result.draft) });
  }

  function close() {
    setMode({ view: "idle" });
  }

  return (
    <>
      {trigger(open)}

      {mode.view === "choosing" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
                {t("wizardResumeTitle")}
              </h2>
              <button onClick={close} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-3">
              {resumeError && <p className="text-sm font-semibold text-red-500">{resumeError}</p>}

              {mode.drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  disabled={loading}
                  onClick={() => resumeDraft(draft.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 hover:border-red-300 hover:bg-red-50/50 transition-colors text-left disabled:opacity-60"
                >
                  <span className="size-10 rounded-lg bg-[#e21d12] flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                    {draft.logoUrl ? (
                      <Image src={draft.logoUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      draft.name.slice(0, 2).toUpperCase() || "??"
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-900 truncate">{draft.name || t("wizardUntitled")}</span>
                    {/* Old drafts may carry a wizardStep from the 10-step
                        scheme (up to 10) — clamp for display since the
                        wizard itself always resumes at step 1 regardless. */}
                    <span className="block text-xs text-zinc-500">{t("wizardStepLabel", { current: Math.min(draft.wizardStep, 4), total: 4 })}</span>
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setMode({ view: "wizard" })}
                className="mt-1 py-3 rounded-xl border-2 border-dashed border-zinc-200 text-sm font-semibold text-zinc-500 hover:border-red-300 hover:text-[#e21d12] transition-colors"
              >
                + {t("wizardStartNew")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mode.view === "wizard" && (
        <CreateOrganizationWizard
          initialState={mode.resume}
          onClose={close}
          onSaveDraft={onSaveDraft}
          onPublished={(organizationId) => {
            close();
            onPublished(organizationId);
          }}
        />
      )}
    </>
  );
}
