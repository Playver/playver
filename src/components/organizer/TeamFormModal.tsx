"use client";

// Create/edit modal for an organization_team row, opened from TeamsList.
// Mirrors PartnerFormModal's exact shell/pattern; logo upload follows the
// same UploadBox pattern against the "organizationTeamLogo" uploader
// (distinct from the pre-existing captain-team "teamLogo" uploader).
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useUploadThing } from "@/lib/uploadthing";
import { createTeam, updateTeam, type TeamRow } from "@/app/actions/organizer-teams";

const inputClass =
  "w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400 text-zinc-800";
const labelClass = "text-sm font-semibold text-zinc-700";

export default function TeamFormModal({
  team,
  onClose,
  onSuccess,
}: {
  team: TeamRow | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("Organizer");
  const [name, setName] = useState(team?.name ?? "");
  const [sport, setSport] = useState(team?.sport ?? "");
  const [coachName, setCoachName] = useState(team?.coachName ?? "");
  const [memberCount, setMemberCount] = useState(team?.memberCount != null ? String(team.memberCount) : "");
  const [logoUrl, setLogoUrl] = useState<string | null>(team?.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: uploadLogo } = useUploadThing("organizationTeamLogo", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
      if (url) setLogoUrl(url);
      setLogoUploading(false);
    },
    onUploadError: () => setLogoUploading(false),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("teamNameRequired"));
      return;
    }
    setError("");
    startTransition(async () => {
      const parsedMemberCount = memberCount.trim() === "" ? null : Number(memberCount);
      const input = {
        name: name.trim(),
        sport,
        coachName,
        memberCount: parsedMemberCount !== null && Number.isFinite(parsedMemberCount) ? parsedMemberCount : null,
        logoUrl,
      };
      const result = team ? await updateTeam(team.id, input) : await createTeam(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
            {team ? t("teamFormTitleEdit") : t("teamFormTitleCreate")}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("teamLogoLabel")}</label>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="w-full rounded-xl border-2 border-dashed border-zinc-200 hover:border-red-300 transition-colors overflow-hidden disabled:opacity-60"
            >
              {logoUrl ? (
                <div className="relative w-full h-28">
                  <Image src={logoUrl} alt="" fill className="object-contain" sizes="400px" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 py-6 px-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-sm font-semibold text-zinc-600">{logoUploading ? "…" : t("teamLogoDropLabel")}</p>
                  <p className="text-xs text-zinc-400">{t("teamLogoHint")}</p>
                </div>
              )}
            </button>
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
            <label className={labelClass}>{t("teamNameLabel")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("teamNamePlaceholder")}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("teamSportLabel")}</label>
            <input
              type="text"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              placeholder={t("teamSportPlaceholder")}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("teamCoachNameLabel")}</label>
            <input
              type="text"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder={t("teamCoachNamePlaceholder")}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("teamMemberCountLabel")}</label>
            <input
              type="number"
              min={0}
              value={memberCount}
              onChange={(e) => setMemberCount(e.target.value)}
              placeholder={t("teamMemberCountPlaceholder")}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              {t("teamFormCancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60 transition-colors shadow-sm"
            >
              {isPending ? t("teamFormSubmitting") : t("teamFormSubmit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
