"use client";

// Wizard step 1 of 4: name, org type, org size, city/province/country,
// tagline (DB column `slogan` — see types.ts), profile picture. Replaces the
// old Step1Type + Step2Identity + Step3Branding's photo half. Still the step
// that creates the draft organization row (see CreateOrganizationWizard's
// persistStep, case 1) — sports/shortDescription/primaryLanguage are no
// longer collected here (dropped from the wizard per the redesign) but are
// still sent through with their WizardState defaults since
// createOrganizationDraft()'s input still requires them.
import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useUploadThing } from "@/lib/uploadthing";
import { COUNTRY_OPTIONS, ORG_SIZE_OPTIONS, type StepProps } from "./types";

const ORG_TYPES = [
  { key: "ACADEMY", icon: "🏆" },
  { key: "CLUB", icon: "🚩" },
  { key: "LEAGUE", icon: "🏢" },
  { key: "SCHOOL_ATHLETICS", icon: "🏫" },
  { key: "TOURNAMENT_ORGANIZER", icon: "📅" },
  { key: "FEDERATION", icon: "🌐" },
  { key: "FACILITY", icon: "🏟️" },
  { key: "COMMUNITY_PROGRAM", icon: "👥" },
] as const;

const inputClass =
  "w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 placeholder:text-zinc-400 text-zinc-800";
const labelClass = "text-sm font-semibold text-zinc-700";

export default function Step1Profile({ state, update }: StepProps) {
  const t = useTranslations("Organizer");
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: uploadLogo } = useUploadThing("organizationLogo", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
      if (url) update({ logoUrl: url });
      setLogoUploading(false);
    },
    onUploadError: () => setLogoUploading(false),
  });

  return (
    <div>
      <p className="text-xs font-bold tracking-wide uppercase text-[#e21d12] mb-2">
        {t("wizardStepLabel", { current: 1, total: 4 })}
      </p>
      <h2 className="text-2xl font-extrabold text-zinc-900 mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
        {t("wizardProfileTitle")}
      </h2>
      <p className="text-sm text-zinc-500 mb-8 max-w-md">{t("wizardProfileSubtitle")}</p>

      <div className="flex flex-col gap-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            className="size-20 rounded-2xl border-2 border-dashed border-zinc-200 hover:border-red-300 transition-colors overflow-hidden shrink-0 flex items-center justify-center bg-zinc-50 disabled:opacity-60"
          >
            {state.logoUrl ? (
              <Image src={state.logoUrl} alt="" width={80} height={80} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-semibold text-zinc-400 text-center px-1">
                {logoUploading ? "…" : t("wizardLogoDropLabel")}
              </span>
            )}
          </button>
          <div>
            <p className={labelClass}>{t("wizardLogoLabel")}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{t("wizardLogoHint")}</p>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLogoUploading(true);
              uploadLogo([file]);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>{t("wizardOrgNameLabel")} *</label>
          <input
            type="text"
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={t("wizardOrgNamePlaceholder")}
            maxLength={200}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className={labelClass}>{t("wizardTypeFieldLabel")} *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ORG_TYPES.map(({ key, icon }) => {
              const selected = state.organizationType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ organizationType: key })}
                  className={`flex flex-col items-center gap-1.5 text-center p-3 rounded-xl border-2 transition-colors ${
                    selected ? "border-[#e21d12] bg-red-50" : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className="text-xl leading-none">{icon}</span>
                  <span className="text-xs font-bold text-zinc-900">{t(`wizardType_${key}_label`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>{t("wizardOrgSizeLabel")}</label>
          <select
            value={state.organizationSize}
            onChange={(e) => update({ organizationSize: e.target.value })}
            className={inputClass}
          >
            <option value="">{t("wizardOrgSizePlaceholder")}</option>
            {ORG_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardCityLabel")} *</label>
            <input
              type="text"
              value={state.city}
              onChange={(e) => update({ city: e.target.value })}
              placeholder={t("wizardCityPlaceholder")}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardProvinceLabel")} *</label>
            <input
              type="text"
              value={state.province}
              onChange={(e) => update({ province: e.target.value })}
              placeholder={t("wizardProvincePlaceholder")}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardCountryLabel")} *</label>
            <select value={state.country} onChange={(e) => update({ country: e.target.value })} className={inputClass}>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>{t("wizardTaglineLabel")}</label>
          <input
            type="text"
            value={state.slogan}
            onChange={(e) => update({ slogan: e.target.value })}
            placeholder={t("wizardTaglinePlaceholder")}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
