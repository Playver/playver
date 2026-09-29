"use client";

// Legal panel (legalName/registrationNumber/organizationStatus/insurance +
// the three policy documents) — same fields/UI the old wizard's Step6Legal
// collected, ported to an independently-saving EditableSection-style panel.
// Policy PDF uploads write into the in-progress edit value immediately
// (via setValueRef, since useUploadThing's callback is set up outside of
// renderEdit's own closure) but aren't persisted to the DB until Save is
// clicked, same as the original wizard step's behavior.
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { useUploadThing } from "@/lib/uploadthing";
import OrganizerEditableSection from "@/components/organizer/OrganizerEditableSection";
import { updateOrganizationDraft } from "@/app/actions/organization";
import { ORG_STATUS_OPTIONS, type PolicyMode } from "@/components/organizer/create-wizard/types";

type LegalValue = {
  legalName: string;
  registrationNumber: string;
  organizationStatus: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  refundPolicyMode: PolicyMode;
  refundPolicyUrl: string;
  refundPolicyText: string;
  privacyPolicyMode: PolicyMode;
  privacyPolicyUrl: string;
  privacyPolicyText: string;
  codeOfConductMode: PolicyMode;
  codeOfConductUrl: string;
  codeOfConductText: string;
};

const inputClass =
  "w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 placeholder:text-zinc-400 text-zinc-800";
const labelClass = "text-sm font-semibold text-zinc-700";

type PolicyKey = "refund" | "privacy" | "codeOfConduct";

function PolicyRow({
  title,
  mode,
  url,
  text,
  uploading,
  onModeChange,
  onTextChange,
  onPick,
}: {
  title: string;
  mode: PolicyMode;
  url: string;
  text: string;
  uploading: boolean;
  onModeChange: (mode: PolicyMode) => void;
  onTextChange: (text: string) => void;
  onPick: () => void;
}) {
  const t = useTranslations("Organizer");

  return (
    <div className="rounded-lg border border-zinc-200 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800">{title}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPick}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              mode === "upload" ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
            }`}
          >
            {uploading ? "…" : t("wizardUploadPdf")}
          </button>
          <button
            type="button"
            onClick={() => onModeChange("write")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              mode === "write" ? "bg-[#e21d12] border-[#e21d12] text-white" : "border-zinc-200 text-[#e21d12] hover:border-red-300"
            }`}
          >
            {t("wizardWriteOnline")}
          </button>
        </div>
      </div>
      {mode === "upload" ? (
        url && <p className="text-xs text-zinc-500 truncate">{url}</p>
      ) : (
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={3}
          placeholder={t("wizardPolicyPlaceholder")}
          className={`${inputClass} resize-none`}
        />
      )}
    </div>
  );
}

export default function OrganizerLegalSection(props: LegalValue) {
  const t = useTranslations("Organizer");
  const [uploadingKey, setUploadingKey] = useState<PolicyKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingKeyRef = useRef<PolicyKey | null>(null);
  const setValueRef = useRef<Dispatch<SetStateAction<LegalValue>> | null>(null);

  const { startUpload } = useUploadThing("organizationPolicyDocument", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
      const key = pendingKeyRef.current;
      if (url && key && setValueRef.current) {
        setValueRef.current((prev) => {
          if (key === "refund") return { ...prev, refundPolicyUrl: url, refundPolicyMode: "upload" };
          if (key === "privacy") return { ...prev, privacyPolicyUrl: url, privacyPolicyMode: "upload" };
          return { ...prev, codeOfConductUrl: url, codeOfConductMode: "upload" };
        });
      }
      setUploadingKey(null);
    },
    onUploadError: () => setUploadingKey(null),
  });

  function pickFileFor(key: PolicyKey) {
    pendingKeyRef.current = key;
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingKeyRef.current) return;
    setUploadingKey(pendingKeyRef.current);
    startUpload([file]);
    e.target.value = "";
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      <OrganizerEditableSection<LegalValue>
        title={t("settingsLegalTitle")}
        initialValue={props}
        onSave={(v) =>
          updateOrganizationDraft({
            legalName: v.legalName,
            registrationNumber: v.registrationNumber,
            organizationStatus: v.organizationStatus,
            insuranceProvider: v.insuranceProvider,
            insurancePolicyNumber: v.insurancePolicyNumber,
            refundPolicyUrl: v.refundPolicyMode === "upload" ? v.refundPolicyUrl || null : null,
            refundPolicyText: v.refundPolicyMode === "write" ? v.refundPolicyText || null : null,
            privacyPolicyUrl: v.privacyPolicyMode === "upload" ? v.privacyPolicyUrl || null : null,
            privacyPolicyText: v.privacyPolicyMode === "write" ? v.privacyPolicyText || null : null,
            codeOfConductUrl: v.codeOfConductMode === "upload" ? v.codeOfConductUrl || null : null,
            codeOfConductText: v.codeOfConductMode === "write" ? v.codeOfConductText || null : null,
          })
        }
        renderView={(v) => (
          <div className="flex flex-col gap-2 text-sm">
            {v.legalName && <p className="text-zinc-600">{v.legalName}</p>}
            {v.registrationNumber && <p className="text-zinc-500">{t("wizardRegistrationNumberLabel")}: {v.registrationNumber}</p>}
            <p className="text-zinc-500">{t("wizardOrgStatusLabel")}: {v.organizationStatus}</p>
            {v.insuranceProvider && (
              <p className="text-zinc-500">{v.insuranceProvider}{v.insurancePolicyNumber ? ` · ${v.insurancePolicyNumber}` : ""}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { label: t("wizardRefundPolicy"), set: Boolean(v.refundPolicyUrl || v.refundPolicyText) },
                { label: t("wizardPrivacyPolicy"), set: Boolean(v.privacyPolicyUrl || v.privacyPolicyText) },
                { label: t("wizardCodeOfConduct"), set: Boolean(v.codeOfConductUrl || v.codeOfConductText) },
              ].map(({ label, set }) => (
                <span key={label} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${set ? "bg-red-50 text-[#e21d12]" : "bg-zinc-100 text-zinc-400"}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        renderEdit={(v, setV) => {
          setValueRef.current = setV;
          return (
            <>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-sm text-amber-800">{t("wizardLegalPrivateNotice")}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardLegalNameLabel")}</label>
                <input
                  type="text"
                  value={v.legalName}
                  onChange={(e) => setV({ ...v, legalName: e.target.value })}
                  placeholder={t("wizardLegalNamePlaceholder")}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>{t("wizardRegistrationNumberLabel")}</label>
                  <input
                    type="text"
                    value={v.registrationNumber}
                    onChange={(e) => setV({ ...v, registrationNumber: e.target.value })}
                    placeholder={t("wizardRegistrationNumberPlaceholder")}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>{t("wizardOrgStatusLabel")}</label>
                  <select value={v.organizationStatus} onChange={(e) => setV({ ...v, organizationStatus: e.target.value })} className={inputClass}>
                    {ORG_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardInsuranceProviderLabel")}</label>
                <input
                  type="text"
                  value={v.insuranceProvider}
                  onChange={(e) => setV({ ...v, insuranceProvider: e.target.value })}
                  placeholder={t("wizardInsuranceProviderPlaceholder")}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardInsurancePolicyNumberLabel")}</label>
                <input
                  type="text"
                  value={v.insurancePolicyNumber}
                  onChange={(e) => setV({ ...v, insurancePolicyNumber: e.target.value })}
                  placeholder={t("wizardInsurancePolicyNumberPlaceholder")}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-3">
                <label className={labelClass}>{t("wizardPoliciesLabel")}</label>
                <PolicyRow
                  title={t("wizardRefundPolicy")}
                  mode={v.refundPolicyMode}
                  url={v.refundPolicyUrl}
                  text={v.refundPolicyText}
                  uploading={uploadingKey === "refund"}
                  onModeChange={(mode) => setV({ ...v, refundPolicyMode: mode })}
                  onTextChange={(text) => setV({ ...v, refundPolicyText: text })}
                  onPick={() => pickFileFor("refund")}
                />
                <PolicyRow
                  title={t("wizardPrivacyPolicy")}
                  mode={v.privacyPolicyMode}
                  url={v.privacyPolicyUrl}
                  text={v.privacyPolicyText}
                  uploading={uploadingKey === "privacy"}
                  onModeChange={(mode) => setV({ ...v, privacyPolicyMode: mode })}
                  onTextChange={(text) => setV({ ...v, privacyPolicyText: text })}
                  onPick={() => pickFileFor("privacy")}
                />
                <PolicyRow
                  title={t("wizardCodeOfConduct")}
                  mode={v.codeOfConductMode}
                  url={v.codeOfConductUrl}
                  text={v.codeOfConductText}
                  uploading={uploadingKey === "codeOfConduct"}
                  onModeChange={(mode) => setV({ ...v, codeOfConductMode: mode })}
                  onTextChange={(text) => setV({ ...v, codeOfConductText: text })}
                  onPick={() => pickFileFor("codeOfConduct")}
                />
              </div>
            </>
          );
        }}
      />
    </>
  );
}
