"use client";

// Wizard step 9 of 10: payout account onboarding, optional at this stage
// (the org can publish and connect payments later from /organizer/payments
// — see OrganizerPaymentsClient.tsx, which uses the same embedded
// ConnectPayoutOnboarding component this step does).
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createOrganizationConnectAccountSession, getOrganizationWalletOverview } from "@/app/actions/organizer-wallet";
import ConnectPayoutOnboarding from "@/components/payments/ConnectPayoutOnboarding";
import type { StepProps } from "./types";

export default function Step9Payments({ state, update }: StepProps) {
  const t = useTranslations("Organizer");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getOrganizationWalletOverview()
      .then((overview) => update({ connectAccountId: overview.connectAccountId, connectOnboarded: overview.connectOnboarded }))
      .catch(() => {});
    // Only needs to run once when this step mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchConnectClientSecret = useCallback(async () => {
    const result = await createOrganizationConnectAccountSession();
    if (!result.clientSecret) throw new Error(result.error ?? "Failed to start onboarding");
    return result.clientSecret;
  }, []);

  function handleOnboardingExit() {
    setShowOnboarding(false);
    getOrganizationWalletOverview()
      .then((overview) => update({ connectAccountId: overview.connectAccountId, connectOnboarded: overview.connectOnboarded }))
      .catch(() => {});
  }

  return (
    <div>
      <p className="text-xs font-bold tracking-wide uppercase text-[#e21d12] mb-2">
        {t("wizardStepLabel", { current: 9, total: 10 })}
      </p>
      <h2 className="text-2xl font-extrabold text-zinc-900 mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
        {t("wizardPaymentsTitle")}
      </h2>
      <p className="text-sm text-zinc-500 mb-8 max-w-md">{t("wizardPaymentsSubtitle")}</p>

      <div className="max-w-xl flex flex-col gap-5">
        {state.connectOnboarded ? (
          <div className="rounded-lg border border-zinc-200 px-5 py-4 flex items-center gap-3">
            <span className="size-8 rounded-full bg-[#e21d12] flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-zinc-800">{t("wizardConnected")}</p>
          </div>
        ) : showOnboarding ? (
          <div className="rounded-lg border border-zinc-200 overflow-hidden">
            <ConnectPayoutOnboarding
              fetchClientSecret={fetchConnectClientSecret}
              onExit={handleOnboardingExit}
              onLoadError={() => {
                setError(t("wizardPaymentsError"));
                setShowOnboarding(false);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError("");
              setShowOnboarding(true);
            }}
            className="flex items-center justify-center gap-2 py-3.5 rounded-lg bg-[#e21d12] text-white text-sm font-semibold hover:bg-[#d41810] transition-colors"
          >
            {t("wizardConnectButton")}
          </button>
        )}
        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

        <ul className="flex flex-col gap-2">
          {["wizardPaymentsFeature1", "wizardPaymentsFeature2", "wizardPaymentsFeature3", "wizardPaymentsFeature4", "wizardPaymentsFeature5"].map((key) => (
            <li key={key} className="flex items-center gap-2 text-sm text-zinc-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e21d12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
