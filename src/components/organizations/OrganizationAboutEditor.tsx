"use client";

// "About Us" card on the public org page's About tab, with a pencil for
// viewers allowed to edit it (members with MANAGE_ORGANIZATION_PROFILE and
// site super admins — updateOrganizationAbout re-checks this server-side).
// Same text as the About section of /organizer/profile (organization.mission).
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { updateOrganizationAbout } from "@/app/actions/organization";

export default function OrganizationAboutEditor({
  organizationId,
  mission,
  canEdit,
}: {
  organizationId: string;
  mission: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations("OrganizationPublicProfile");
  const tOrganizer = useTranslations("Organizer");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(mission ?? "");
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();
  // Show the just-saved text right away instead of the old prop while
  // router.refresh() re-renders the page; resync once the new prop arrives.
  const [shown, setShown] = useState(mission);
  const [lastProp, setLastProp] = useState(mission);
  if (lastProp !== mission) {
    setLastProp(mission);
    setShown(mission);
  }

  function save() {
    setError("");
    startSaving(async () => {
      try {
        const res = await updateOrganizationAbout(organizationId, value);
        if (res.error) {
          setError(res.error);
          return;
        }
        setShown(value.trim() || null);
        setEditing(false);
        router.refresh();
      } catch {
        setError(tOrganizer("sectionSaveError"));
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-extrabold text-zinc-900">{t("aboutUsTitle")}</h2>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setValue(shown ?? "");
              setEditing(true);
            }}
            aria-label={t("editAbout")}
            title={t("editAbout")}
            className="shrink-0 size-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            maxLength={5000}
            autoFocus
            placeholder={tOrganizer("wizardMissionPlaceholder")}
            className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 text-zinc-800 resize-y"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#e21d12] text-white hover:bg-[#d41810] transition-colors disabled:opacity-50"
            >
              {saving ? tOrganizer("sectionSaving") : tOrganizer("sectionSave")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              {tOrganizer("sectionCancel")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{shown || t("noMission")}</p>
      )}
    </div>
  );
}
