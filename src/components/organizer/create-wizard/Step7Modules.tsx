"use client";

// Modules toggle-card list — originally wizard step 7 of 10, now reused by
// the new 4-step wizard's Step2Manage.tsx (which passes `visibleKeys` to
// restrict the list to Events/Teams/Partners and overrides the step-label/
// title/subtitle) rather than forking this component. See
// src/lib/organization-modules.ts for the canonical module list and which
// ones are always-on.
import { useTranslations } from "next-intl";
import { ORGANIZATION_MODULES, type OrganizationModuleKey } from "@/lib/organization-modules";
import type { StepProps } from "./types";

export default function Step7Modules({
  state,
  update,
  visibleKeys,
  stepCurrent = 7,
  stepTotal = 10,
  titleKey = "wizardModulesTitle",
  subtitleKey = "wizardModulesSubtitle",
}: StepProps & {
  visibleKeys?: OrganizationModuleKey[];
  stepCurrent?: number;
  stepTotal?: number;
  titleKey?: string;
  subtitleKey?: string;
}) {
  const t = useTranslations("Organizer");

  function toggle(key: string, alwaysOn?: boolean) {
    if (alwaysOn) return;
    update({
      enabledModules: state.enabledModules.includes(key)
        ? state.enabledModules.filter((m) => m !== key)
        : [...state.enabledModules, key],
    });
  }

  const modules = visibleKeys
    ? ORGANIZATION_MODULES.filter((m) => visibleKeys.includes(m.key))
    : ORGANIZATION_MODULES;

  return (
    <div>
      <p className="text-xs font-bold tracking-wide uppercase text-[#e21d12] mb-2">
        {t("wizardStepLabel", { current: stepCurrent, total: stepTotal })}
      </p>
      <h2 className="text-2xl font-extrabold text-zinc-900 mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
        {t(titleKey)}
      </h2>
      <p className="text-sm text-zinc-500 mb-8 max-w-md">{t(subtitleKey)}</p>

      <div className="flex flex-col gap-3 max-w-xl">
        {modules.map(({ key, alwaysOn, recommended }) => {
          const enabled = alwaysOn || state.enabledModules.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key, alwaysOn)}
              disabled={alwaysOn}
              className={`flex items-center justify-between text-left p-4 rounded-xl border-2 transition-colors ${
                enabled ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white hover:border-zinc-300"
              } ${alwaysOn ? "cursor-default" : ""}`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`size-5 rounded flex items-center justify-center shrink-0 ${
                    enabled ? "bg-[#e21d12]" : "bg-white border border-zinc-300"
                  }`}
                >
                  {enabled && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span>
                  <span className="block text-sm font-bold text-zinc-900">{t(`module_${key}Label`)}</span>
                  <span className="block text-xs text-zinc-500 mt-0.5">{t(`module_${key}Desc`)}</span>
                </span>
              </span>
              {alwaysOn && (
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold shrink-0">
                  {t("wizardAlwaysOn")}
                </span>
              )}
              {!alwaysOn && recommended && (
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold shrink-0">
                  {t("wizardRecommended")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
