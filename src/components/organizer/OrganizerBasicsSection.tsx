"use client";

// Organization name, short description + sports covered — the name is set
// in the create wizard, the other two were required fields in the old
// 10-step wizard (Step2Identity) that the 4-step rebuild no longer collects
// up front. Re-hosted here, independently saving, so they all have an
// editable home instead of being permanently stuck at their initial values.
import { useTranslations } from "next-intl";
import OrganizerEditableSection from "@/components/organizer/OrganizerEditableSection";
import { updateOrganizationDraft } from "@/app/actions/organization";
import { SPORTS_OPTIONS } from "@/components/organizer/create-wizard/types";

type BasicsValue = {
  name: string;
  shortDescription: string;
  sports: string[];
};

const inputClass =
  "w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 placeholder:text-zinc-400 text-zinc-800";
const labelClass = "text-sm font-semibold text-zinc-700";

export default function OrganizerBasicsSection(props: BasicsValue) {
  const t = useTranslations("Organizer");

  function toggleSport(value: string[], sport: string): string[] {
    return value.includes(sport) ? value.filter((s) => s !== sport) : [...value, sport];
  }

  return (
    <OrganizerEditableSection<BasicsValue>
      title={t("profileBasicsTitle")}
      initialValue={props}
      onSave={(v) => {
        if (!v.name.trim()) return Promise.resolve({ error: t("wizardErrorName") });
        return updateOrganizationDraft({
          name: v.name,
          shortDescription: v.shortDescription,
          sports: v.sports,
        });
      }}
      renderView={(v) => (
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("wizardOrgNameLabel")}</p>
            <p className="font-bold text-zinc-900">{v.name}</p>
          </div>
          {v.shortDescription || v.sports.length > 0 ? (
          <div className="flex flex-col gap-3 text-sm">
            {v.shortDescription && <p className="text-zinc-600">{v.shortDescription}</p>}
            {v.sports.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {v.sports.map((sport) => (
                  <span key={sport} className="px-2.5 py-1 rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                    {sport}
                  </span>
                ))}
              </div>
            )}
          </div>
          ) : (
            <p className="text-sm text-zinc-400">{t("profileBasicsEmpty")}</p>
          )}
        </div>
      )}
      renderEdit={(v, setV) => (
        <>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardOrgNameLabel")}</label>
            <input
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
              maxLength={200}
              placeholder={t("wizardOrgNamePlaceholder")}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardShortDescLabel")}</label>
            <textarea
              value={v.shortDescription}
              onChange={(e) => setV({ ...v, shortDescription: e.target.value })}
              rows={2}
              placeholder={t("wizardShortDescPlaceholder")}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardSportsLabel")}</label>
            <div className="flex flex-wrap gap-2">
              {SPORTS_OPTIONS.map((sport) => {
                const active = v.sports.includes(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => setV({ ...v, sports: toggleSport(v.sports, sport) })}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                      active ? "bg-[#e21d12] text-white border-[#e21d12]" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {sport}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    />
  );
}
