"use client";

// About panel (mission/vision/history/yearFounded/ageGroups/values/
// affiliations) — same fields the old wizard's Step4About collected,
// re-hosted here as an independently-saving EditableSection-style panel.
import { useTranslations } from "next-intl";
import OrganizerEditableSection from "@/components/organizer/OrganizerEditableSection";
import { updateOrganizationDraft } from "@/app/actions/organization";

type AboutValue = {
  mission: string;
  vision: string;
  history: string;
  yearFounded: string;
  ageGroups: string;
  values: string;
  affiliations: string;
};

function splitCsv(value: string): string[] {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

const inputClass =
  "w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 placeholder:text-zinc-400 text-zinc-800";
const labelClass = "text-sm font-semibold text-zinc-700";

export default function OrganizerAboutSection(props: AboutValue) {
  const t = useTranslations("Organizer");

  return (
    <OrganizerEditableSection<AboutValue>
      title={t("profileAboutTitle")}
      initialValue={props}
      onSave={(v) =>
        updateOrganizationDraft({
          mission: v.mission,
          vision: v.vision,
          history: v.history,
          yearFounded: v.yearFounded ? Number(v.yearFounded) : null,
          ageGroups: v.ageGroups.trim() ? [v.ageGroups.trim()] : [],
          values: splitCsv(v.values),
          affiliations: splitCsv(v.affiliations),
        })
      }
      renderView={(v) =>
        v.mission || v.vision || v.history ? (
          <div className="flex flex-col gap-3 text-sm">
            {v.mission && (
              <p><span className="font-semibold text-zinc-700">{t("wizardMissionLabel")}: </span><span className="text-zinc-600">{v.mission}</span></p>
            )}
            {v.vision && (
              <p><span className="font-semibold text-zinc-700">{t("wizardVisionLabel")}: </span><span className="text-zinc-600">{v.vision}</span></p>
            )}
            {v.history && (
              <p><span className="font-semibold text-zinc-700">{t("wizardHistoryLabel")}: </span><span className="text-zinc-600">{v.history}</span></p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-500">
              {v.yearFounded && <span>{t("wizardYearFoundedLabel")}: {v.yearFounded}</span>}
              {v.ageGroups && <span>{t("wizardAgeGroupsLabel")}: {v.ageGroups}</span>}
            </div>
            {v.values && <p className="text-zinc-500">{t("wizardValuesLabel")}: {v.values}</p>}
            {v.affiliations && <p className="text-zinc-500">{t("wizardAffiliationsLabel")}: {v.affiliations}</p>}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">{t("profileAboutEmpty")}</p>
        )
      }
      renderEdit={(v, setV) => (
        <>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardMissionLabel")}</label>
            <textarea
              value={v.mission}
              onChange={(e) => setV({ ...v, mission: e.target.value })}
              rows={3}
              placeholder={t("wizardMissionPlaceholder")}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardVisionLabel")}</label>
            <textarea
              value={v.vision}
              onChange={(e) => setV({ ...v, vision: e.target.value })}
              rows={3}
              placeholder={t("wizardVisionPlaceholder")}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardHistoryLabel")}</label>
            <textarea
              value={v.history}
              onChange={(e) => setV({ ...v, history: e.target.value })}
              rows={3}
              placeholder={t("wizardHistoryPlaceholder")}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t("wizardYearFoundedLabel")}</label>
              <input
                type="number"
                value={v.yearFounded}
                onChange={(e) => setV({ ...v, yearFounded: e.target.value })}
                placeholder="2009"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t("wizardAgeGroupsLabel")}</label>
              <input
                type="text"
                value={v.ageGroups}
                onChange={(e) => setV({ ...v, ageGroups: e.target.value })}
                placeholder="U8-U18"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardValuesLabel")}</label>
            <input
              type="text"
              value={v.values}
              onChange={(e) => setV({ ...v, values: e.target.value })}
              placeholder={t("wizardValuesPlaceholder")}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t("wizardAffiliationsLabel")}</label>
            <input
              type="text"
              value={v.affiliations}
              onChange={(e) => setV({ ...v, affiliations: e.target.value })}
              placeholder={t("wizardAffiliationsPlaceholder")}
              className={inputClass}
            />
          </div>
        </>
      )}
    />
  );
}
