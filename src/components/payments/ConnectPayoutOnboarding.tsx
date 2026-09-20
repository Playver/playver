"use client";

// Playver-branded wrapper around Stripe Connect's embedded onboarding
// component. Renders the same KYC/bank-account flow Stripe's hosted
// connect.stripe.com page used to handle, but inline on our own page and
// restyled to match Playver (brand red, Inter, our own rounded/shadow
// language) instead of looking like a third-party redirect. Used by
// WalletClient.tsx, OrganizerPaymentsClient.tsx, and the org creation
// wizard's Step9Payments.tsx — the only three places that onboard a Connect
// account.
import { useMemo } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js";

export default function ConnectPayoutOnboarding({
  fetchClientSecret,
  onExit,
  onLoadError,
}: {
  fetchClientSecret: () => Promise<string>;
  onExit: () => void;
  onLoadError?: () => void;
}) {
  // useMemo (not useState) so a re-render never creates a second instance,
  // but a genuinely new fetchClientSecret identity (shouldn't happen in
  // practice — callers memoize it) would still get picked up.
  const instance = useMemo(
    () =>
      loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
        fetchClientSecret,
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" }],
        appearance: {
          overlays: "dialog",
          variables: {
            colorPrimary: "#e21d12",
            colorBackground: "#ffffff",
            colorText: "#18181b",
            colorDanger: "#dc2626",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            fontSizeBase: "14px",
            spacingUnit: "10px",
            borderRadius: "10px",
          },
        },
      }),
    [fetchClientSecret]
  );

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <ConnectComponentsProvider connectInstance={instance}>
      <ConnectAccountOnboarding
        onExit={onExit}
        onLoadError={onLoadError}
        recipientTermsOfServiceUrl={`${baseUrl}/legal/terms`}
        privacyPolicyUrl={`${baseUrl}/legal/privacy`}
      />
    </ConnectComponentsProvider>
  );
}
