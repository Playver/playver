"use client";

// Playver-branded wrapper around Stripe Connect's embedded onboarding
// component. Renders the same KYC/bank-account flow Stripe's hosted
// connect.stripe.com page used to handle, but inline on our own page and
// restyled to match Playver (brand red, Inter, our own rounded/shadow
// language) instead of looking like a third-party redirect. Used by
// WalletClient.tsx, OrganizerPaymentsClient.tsx, and the organizer Settings
// page's OrganizerPayoutSection.tsx (the org creation wizard dropped its own
// Connect-onboarding step — payouts are set up post-creation from Settings
// now) — the only three places that onboard a Connect account.
import { useRef } from "react";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
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
  // A ref-guarded singleton, not useMemo: loadConnectAndInitialize() isn't a
  // pure computation — it injects Stripe's embed script and kicks off real
  // network/DOM setup — and useMemo's callback runs twice per render under
  // React Strict Mode (dev only), which silently created two competing
  // Stripe Connect instances racing each other. That raced instance is what
  // caused "Cannot update a component (Router) while rendering
  // ConnectPayoutOnboarding" and, worse, the onboarding panel sometimes
  // never appearing at all. `connect-js` exposes no destroy/dispose method,
  // so there's no clean useEffect-cleanup story either — a ref checked once
  // is the standard workaround for one-time impure setup that must survive
  // Strict Mode's double-invoke.
  const instanceRef = useRef<StripeConnectInstance | null>(null);
  if (!instanceRef.current) {
    instanceRef.current = loadConnectAndInitialize({
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
    });
  }
  const instance = instanceRef.current;

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
