"use client";

// Playver-branded wrapper around Stripe Connect's embedded components —
// payout onboarding (and, in "management" mode, editing bank/payout details
// afterwards) inline on our own page, restyled to match Playver instead of a
// third-party redirect. Used by OrganizerPaymentsClient.tsx and the organizer
// Settings page's OrganizerPayoutSection.tsx.
import { useEffect, useRef, useState } from "react";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import { ConnectComponentsProvider, ConnectAccountOnboarding, ConnectAccountManagement } from "@stripe/react-connect-js";

export default function ConnectPayoutOnboarding({
  fetchClientSecret,
  onExit,
  onLoadError,
  mode = "onboarding",
}: {
  fetchClientSecret: () => Promise<string>;
  onExit: () => void;
  // Called with a readable reason when the panel can't start (our server
  // couldn't create the Stripe session, or Stripe's component failed to
  // load) — so the page shows an error instead of an empty box.
  onLoadError?: (message?: string) => void;
  // "management" = post-onboarding edits (bank account, personal details).
  mode?: "onboarding" | "management";
}) {
  const callbacks = useRef({ fetchClientSecret, onLoadError });
  useEffect(() => {
    callbacks.current = { fetchClientSecret, onLoadError };
  });

  // The reason our server gave, kept so Stripe's own (detail-less) load
  // error that follows doesn't replace it.
  const lastError = useRef<string | undefined>(undefined);

  // loadConnectAndInitialize() injects Stripe's script and starts network
  // setup, so it runs once after mount rather than during render (calling it
  // in render is what triggered "Cannot update a component (Router) while
  // rendering ConnectPayoutOnboarding"). The ref guard survives React Strict
  // Mode's dev-only double effect run — connect-js has no dispose method.
  const started = useRef(false);
  const [instance, setInstance] = useState<StripeConnectInstance | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error("[ConnectPayoutOnboarding] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
      callbacks.current.onLoadError?.("Payout setup isn't configured (missing Stripe publishable key).");
      return;
    }
    setInstance(
      loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          try {
            return await callbacks.current.fetchClientSecret();
          } catch (e) {
            const message = e instanceof Error ? e.message : undefined;
            lastError.current = message;
            console.error("[ConnectPayoutOnboarding] couldn't start Stripe session", e);
            queueMicrotask(() => callbacks.current.onLoadError?.(message));
            throw e;
          }
        },
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
      })
    );
  }, []);

  if (!instance) return <div className="h-40 animate-pulse bg-zinc-50" />;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const handleLoadError = () => queueMicrotask(() => callbacks.current.onLoadError?.(lastError.current));

  return (
    <ConnectComponentsProvider connectInstance={instance}>
      {mode === "management" ? (
        <ConnectAccountManagement onLoadError={handleLoadError} />
      ) : (
        <ConnectAccountOnboarding
          onExit={onExit}
          onLoadError={handleLoadError}
          recipientTermsOfServiceUrl={`${baseUrl}/legal/terms`}
          privacyPolicyUrl={`${baseUrl}/legal/privacy`}
        />
      )}
    </ConnectComponentsProvider>
  );
}
