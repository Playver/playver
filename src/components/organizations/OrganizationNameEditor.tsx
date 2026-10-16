"use client";

// Organization name heading on the public org page, with an inline rename
// for viewers allowed to change it: members with MANAGE_ORGANIZATION_PROFILE
// and site super admins (renameOrganization re-checks this server-side).
// The slug stays the same, so the page URL doesn't change on rename.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { renameOrganization } from "@/app/actions/organization";

export default function OrganizationNameEditor({
  organizationId,
  name,
  canEdit,
}: {
  organizationId: string;
  name: string;
  canEdit: boolean;
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const heading = (
    <h1 className="text-2xl font-extrabold text-zinc-900 break-words" style={{ fontFamily: "var(--font-playfair)" }}>
      {name}
    </h1>
  );
  if (!canEdit) return heading;

  function save() {
    if (!value.trim()) {
      setError(t("wizardErrorName"));
      return;
    }
    setError("");
    startSaving(async () => {
      try {
        const res = await renameOrganization(organizationId, value);
        if (res.error) {
          setError(res.error);
          return;
        }
        setEditing(false);
        router.refresh();
      } catch {
        setError(t("sectionSaveError"));
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        {heading}
        <button
          type="button"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          aria-label={t("renameOrganization")}
          title={t("renameOrganization")}
          className="shrink-0 size-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-w-xl">
      <label className="text-sm font-semibold text-zinc-700" htmlFor="org-name-input">
        {t("wizardOrgNameLabel")}
      </label>
      <input
        id="org-name-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        maxLength={200}
        autoFocus
        className="w-full px-4 py-2.5 text-base font-bold bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 text-zinc-900"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#e21d12] text-white hover:bg-[#d41810] transition-colors disabled:opacity-50"
        >
          {saving ? t("sectionSaving") : t("sectionSave")}
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
          {t("sectionCancel")}
        </button>
      </div>
    </div>
  );
}
