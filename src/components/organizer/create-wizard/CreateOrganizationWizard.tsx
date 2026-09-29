"use client";

// The 4-step create-organization wizard shell: owns `state`/`currentStep`,
// validates and persists one step at a time (see persistStep below), and
// renders the matching Step*.tsx for `currentStep`. Step 1 is special — it's
// the step that actually creates the draft organization row (there's nothing
// to save before that). Step 3 (Agreement) publishes the draft to a real,
// published org via publishOrganization() and advances to Step 4 (Done) — a
// terminal success screen with no form of its own.
//
// Rebuilt from the original 10-step wizard down to 4 steps; always starts at
// step 1 regardless of any resumed draft's old step position (see
// wizardStateFromDraft's furthestStep reset in types.ts) since there are no
// real in-flight drafts under the old 10-step scheme worth preserving a
// resume position for — only the resumed draft's field DATA still matters.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  createOrganizationDraft,
  publishOrganization,
  updateOrganizationDraft,
} from "@/app/actions/organization";
import { ORGANIZATION_MODULES } from "@/lib/organization-modules";
import { createInitialWizardState, type WizardState } from "./types";
import Step1Profile from "./Step1Profile";
import Step2Manage from "./Step2Manage";
import Step3Agreement from "./Step3Agreement";
import Step4Done from "./Step4Done";

const STEP_KEYS = [
  "wizardSidebarProfile",
  "wizardSidebarManage",
  "wizardSidebarAgreement",
  "wizardSidebarDone",
];

const ALWAYS_ON_MODULE_KEYS = ORGANIZATION_MODULES.filter((m) => m.alwaysOn).map((m) => m.key);

export default function CreateOrganizationWizard({
  initialState,
  onClose,
  onPublished,
  onSaveDraft,
}: {
  initialState?: WizardState;
  onClose: () => void;
  onPublished: (organizationId: string) => void;
  onSaveDraft?: () => void;
}) {
  const t = useTranslations("Organizer");
  const [state, setState] = useState<WizardState>(initialState ?? createInitialWizardState());
  // Always 1 — see the module comment above and wizardStateFromDraft's
  // furthestStep reset in types.ts.
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function update(patch: Partial<WizardState>) {
    setState((s) => ({ ...s, ...patch }));
  }

  function validateStep(step: number): string | null {
    switch (step) {
      case 1:
        if (!state.organizationType) return t("wizardErrorType");
        if (!state.name.trim()) return t("wizardErrorName");
        if (!state.city.trim() || !state.province.trim() || !state.country.trim()) return t("wizardErrorLocation");
        return null;
      default:
        return null;
    }
  }

  // Persists whatever the current step owns. Returns an error message, or
  // null on success (including "nothing to do yet", e.g. before the draft
  // row exists). Saves the given step's fields to the draft (or creates it,
  // on step 1) and, if `advanceTo` is given, advances the draft's stored
  // wizardStep — this is what makes "resume where I left off" work from
  // CreateOrganizationLauncher's draft picker.
  async function persistStep(step: number, advanceTo?: number): Promise<string | null> {
    switch (step) {
      case 1: {
        if (!state.organizationId) {
          const createRes = await createOrganizationDraft({
            organizationType: state.organizationType,
            name: state.name,
            city: state.city,
            province: state.province,
            country: state.country,
            primaryLanguage: state.primaryLanguage,
            sports: state.sports,
            shortDescription: state.shortDescription,
            organizationSize: state.organizationSize,
          });
          if (createRes.error) return createRes.error;
          const organizationId = createRes.organizationId;
          setState((s) => ({ ...s, organizationId: organizationId ?? s.organizationId, slug: createRes.slug ?? s.slug }));
          if (!organizationId) return null;
          const updateRes = await updateOrganizationDraft({ logoUrl: state.logoUrl, slogan: state.slogan }, advanceTo);
          return updateRes.error ?? null;
        }
        const res = await updateOrganizationDraft(
          {
            organizationType: state.organizationType,
            name: state.name,
            city: state.city,
            province: state.province,
            country: state.country,
            organizationSize: state.organizationSize,
            logoUrl: state.logoUrl,
            slogan: state.slogan,
          },
          advanceTo
        );
        return res.error ?? null;
      }
      case 2: {
        if (!state.organizationId) return null;
        // Events/Teams are `alwaysOn` (organization-modules.ts) — make sure
        // they end up in the persisted array regardless of what Step2Manage's
        // UI did, since they're not real toggles there.
        const merged = Array.from(new Set([...ALWAYS_ON_MODULE_KEYS, ...state.enabledModules]));
        const res = await updateOrganizationDraft({ enabledModules: merged }, advanceTo);
        return res.error ?? null;
      }
      case 3: {
        if (!state.organizationId) return null;
        if (advanceTo !== undefined) await updateOrganizationDraft({}, advanceTo);
        return null;
      }
      default:
        return null;
    }
  }

  async function handleContinue() {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSaving(true);
    const nextStep = currentStep + 1;
    const persistError = await persistStep(currentStep, nextStep);
    setSaving(false);
    if (persistError) {
      setError(persistError);
      return;
    }
    setState((s) => ({ ...s, furthestStep: Math.max(s.furthestStep, nextStep) }));
    setCurrentStep(nextStep);
  }

  async function handleSaveDraft() {
    setSaving(true);
    await persistStep(currentStep, undefined);
    setSaving(false);
    onSaveDraft?.();
    onClose();
  }

  async function handlePublish() {
    if (!confirmed || !state.organizationId) return;
    setError("");
    setSaving(true);
    const res = await publishOrganization();
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setState((s) => ({ ...s, furthestStep: Math.max(s.furthestStep, 4) }));
    setCurrentStep(4);
  }

  function goToStep(step: number) {
    if (step > state.furthestStep) return;
    setError("");
    setCurrentStep(step);
  }

  const StepComponent = [Step1Profile, Step2Manage][currentStep - 1];

  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white text-zinc-900 border-r border-zinc-200 flex flex-col overflow-y-auto">
        <div className="px-6 pt-6 pb-5 flex items-center justify-between">
          <div>
            <p className="text-lg font-black tracking-tight text-[#e21d12]">PLAYVER</p>
            <p className="text-xs text-zinc-500 mt-0.5">{t("wizardChromeTitle")}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 pb-6 flex flex-col gap-1">
          {STEP_KEYS.map((key, index) => {
            const step = index + 1;
            const isCurrent = step === currentStep;
            const reachable = step <= state.furthestStep;
            return (
              <button
                key={key}
                type="button"
                onClick={() => goToStep(step)}
                disabled={!reachable}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors text-left ${
                  isCurrent ? "bg-red-50 text-[#e21d12]" : reachable ? "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900" : "text-zinc-300 cursor-not-allowed"
                }`}
              >
                <span
                  className={`size-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    isCurrent ? "bg-[#e21d12] text-white" : step < state.furthestStep ? "bg-[#e21d12] text-white" : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  {step < state.furthestStep && !isCurrent ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    step
                  )}
                </span>
                {t(key)}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-end px-6 pt-5">
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 md:px-12 pt-4 pb-10">
          {currentStep === 3 ? (
            <Step3Agreement state={state} confirmed={confirmed} onConfirmedChange={setConfirmed} />
          ) : currentStep === 4 ? (
            <Step4Done
              state={state}
              onManageOrganization={() => state.organizationId && onPublished(state.organizationId)}
            />
          ) : (
            StepComponent && <StepComponent state={state} update={update} />
          )}
        </div>

        {currentStep !== 4 && (
          <div className="border-t border-zinc-100 px-6 md:px-12 py-4 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
              disabled={currentStep === 1}
              className="px-4 py-2.5 text-sm font-semibold text-zinc-600 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              {t("wizardBack")}
            </button>

            <div className="flex items-center gap-4">
              {error && <p className="text-sm font-semibold text-red-500 max-w-sm text-right">{error}</p>}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="text-sm font-semibold text-zinc-500 hover:text-zinc-700 transition-colors disabled:opacity-50"
              >
                {t("wizardSaveDraft")}
              </button>
              {currentStep === 3 ? (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={saving || !confirmed}
                  className="px-6 py-2.5 text-sm font-semibold text-white rounded-full bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm disabled:opacity-50"
                >
                  {t("wizardPublishOrganization")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={saving}
                  className="px-6 py-2.5 text-sm font-semibold text-white rounded-full bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm disabled:opacity-60"
                >
                  {saving ? t("wizardSaving") : t("wizardContinue")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
