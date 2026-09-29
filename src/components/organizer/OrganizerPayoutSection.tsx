"use client";

// Stripe Connect payout onboarding, re-hosted from the old wizard's
// Step9Payments (now dropped from the wizard) onto the org Settings page —
// same ConnectPayoutOnboarding component OrganizerPaymentsClient.tsx and
// WalletClient.tsx already use, just a narrower "are we onboarded yet"
// panel rather than the full balance/withdrawal UI (that stays on
// /organizer/payments).
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createOrganizationConnectAccountSession, getOrganizationWalletOverview } from "@/app/actions/organizer-wallet";
import ConnectPayoutOnboarding from "@/components/payments/ConnectPayoutOnboarding";

export default function OrganizerPayoutSection({ connectOnboarded }: { connectOnboarded: boolean }) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [onboarded, setOnboarded] = useState(connectOnboarded);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [error, setError] = useState("");

  const fetchConnectClientSecret = useCallback(async () => {
    const result = await createOrganizationConnectAccountSession();
    if (!result.clientSecret) throw new Error(result.error ?? "Failed to start onboarding");
    return result.clientSecret;
  }, []);

  function handleOnboardingExit() {
    setShowOnboarding(false);
    getOrganizationWalletOverview()
      .then((overview) => {
        setOnboarded(overview.connectOnboarded);
        router.refresh();
      })
      .catch(() => {});
  }

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
      <h2 className="text-base font-bold text-zinc-900 mb-1">{t("settingsPayoutTitle")}</h2>
      <p className="text-sm text-zinc-500 mb-4">{t("settingsPayoutSubtitle")}</p>

      {onboarded ? (
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
          className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-lg bg-[#e21d12] text-white text-sm font-semibold hover:bg-[#d41810] transition-colors"
        >
          {t("wizardConnectButton")}
        </button>
      )}
      {error && <p className="text-sm text-red-500 font-medium mt-3">{error}</p>}
    </section>
  );
}
