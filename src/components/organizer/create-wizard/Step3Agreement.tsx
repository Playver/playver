"use client";

// Wizard step 3 of 4: authorized-representative certification + ToS/Privacy
// links + the required confirm checkbox that gates publishing. Replaces
// Step6Legal + Step9Payments + old Step10Review's checkbox for wizard
// purposes — those forms' fields move to the org Settings/Profile pages
// instead (see src/app/[locale]/organizer/{settings,profile}/page.tsx).
// Reuses the confirmed/onConfirmedChange state already owned by
// CreateOrganizationWizard rather than inventing new state.
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { WizardState } from "./types";

export default function Step3Agreement({
  state,
  confirmed,
  onConfirmedChange,
}: {
  state: WizardState;
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
}) {
  const t = useTranslations("Organizer");

  return (
    <div>
      <p className="text-xs font-bold tracking-wide uppercase text-[#e21d12] mb-2">
        {t("wizardStepLabel", { current: 3, total: 4 })}
      </p>
      <h2 className="text-2xl font-extrabold text-zinc-900 mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
        {t("wizardAgreementTitle")}
      </h2>
      <p className="text-sm text-zinc-500 mb-8 max-w-md">{t("wizardAgreementSubtitle")}</p>

      <div className="max-w-xl flex flex-col gap-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="size-10 rounded-lg bg-[#e21d12] text-white flex items-center justify-center font-bold overflow-hidden shrink-0">
              {state.name.slice(0, 2).toUpperCase() || "??"}
            </span>
            <div>
              <p className="text-sm font-bold text-zinc-900">{state.name || t("wizardUntitled")}</p>
              {state.slug && <p className="text-xs text-zinc-400">playver.com/{state.slug}</p>}
            </div>
          </div>
          <p className="text-sm text-zinc-600">{t("wizardAgreementCertification")}</p>
        </div>

        <p className="text-sm text-zinc-500">
          {t("wizardAgreementLegalIntro")}{" "}
          <Link href="/legal/terms" target="_blank" className="font-semibold text-[#e21d12] hover:underline">
            {t("wizardAgreementTermsLink")}
          </Link>{" "}
          {t("wizardAgreementAnd")}{" "}
          <Link href="/legal/privacy" target="_blank" className="font-semibold text-[#e21d12] hover:underline">
            {t("wizardAgreementPrivacyLink")}
          </Link>
          .
        </p>

        <label className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => onConfirmedChange(e.target.checked)}
            className="mt-0.5 size-4 accent-[#e21d12]"
          />
          <span className="text-sm text-zinc-600">{t("wizardConfirmAuthorized")}</span>
        </label>
      </div>
    </div>
  );
}
