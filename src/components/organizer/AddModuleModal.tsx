"use client";

// "+ Add to Manage" modal opened from OrganizerSidebar's MANAGE section.
// Shows toggle cards (visual pattern borrowed from the wizard's
// Step7Modules.tsx) for opt-in modules the org hasn't enabled yet, and
// batches confirmed selections through enableOrganizationModule(). Excludes
// `alwaysOn` modules (never toggleable), `programs` (being removed from the
// product entirely, not just the wizard), and `memberships` (removed from
// the organizer dashboard per explicit user request) — see
// organization-modules.ts.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { enableOrganizationModule } from "@/app/actions/organization";
import { ORGANIZATION_MODULES, type OrganizationModuleKey } from "@/lib/organization-modules";

export default function AddModuleModal({
  enabledModules,
  onClose,
  onSuccess,
}: {
  enabledModules: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("Organizer");
  const [selected, setSelected] = useState<Set<OrganizationModuleKey>>(new Set());
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const available = ORGANIZATION_MODULES.filter(
    (m) => !m.alwaysOn && m.key !== "programs" && m.key !== "memberships" && !enabledModules.includes(m.key)
  );

  function toggle(key: OrganizationModuleKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleConfirm() {
    if (selected.size === 0) {
      onClose();
      return;
    }
    setError("");
    startTransition(async () => {
      for (const key of selected) {
        const result = await enableOrganizationModule(key);
        if (result.error) {
          setError(result.error);
          return;
        }
      }
      onSuccess();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
            {t("addModuleTitle")}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-5">
          <p className="text-sm text-zinc-500">{t("addModuleSubtitle")}</p>

          {available.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">{t("addModuleEmptyState")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {available.map(({ key }) => {
                const enabled = selected.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className={`flex items-center justify-between text-left p-4 rounded-xl border-2 transition-colors ${
                      enabled ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
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
                  </button>
                );
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              {t("addModuleCancel")}
            </button>
            {available.length > 0 && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending || selected.size === 0}
                className="flex-1 py-3 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60 transition-colors shadow-sm"
              >
                {isPending ? t("addModuleConfirming") : t("addModuleConfirm")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
