"use client";

// Lighter organizer-specific counterpart to
// src/components/athletes/EditableSection.tsx — same pencil -> edit ->
// Save/Cancel card primitive, but without that component's "AthleteProfile"
// namespace and isOwnProfile gating (not applicable here: every viewer who
// reaches an organizer Settings/Profile page already passed a
// requireOrganizationPermission("MANAGE_ORGANIZATION_PROFILE") check at the
// page level, so the pencil is always shown rather than conditionally on
// "is this my own profile"). Also, unlike EditableSection, `onSave` may
// return an { error } instead of throwing, so callers that batch multiple
// server actions (e.g. Contact's updateOrganizationDraft +
// setOrganizationLocations) can surface a partial failure inline. `setValue`
// is the raw useState dispatch (supports functional updates), which
// sections whose renderEdit contains an upload-and-persist-immediately field
// rely on to write into the in-progress edit value from an upload
// completion callback set up outside of renderEdit's own closure.
import { useState, useTransition, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export default function OrganizerEditableSection<T>({
  title,
  initialValue,
  onSave,
  renderView,
  renderEdit,
  className = "",
}: {
  title: string;
  initialValue: T;
  onSave: (value: T) => Promise<{ error?: string } | void>;
  renderView: (value: T) => ReactNode;
  renderEdit: (value: T, setValue: Dispatch<SetStateAction<T>>) => ReactNode;
  className?: string;
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<T>(initialValue);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");

  function handleCancel() {
    setValue(initialValue);
    setError("");
    setEditing(false);
  }

  function handleSave() {
    setError("");
    startSaving(async () => {
      try {
        const res = await onSave(value);
        if (res && "error" in res && res.error) {
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

  return (
    <section className={`bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-zinc-900">{title}</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("sectionEdit")}
            className="flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors shrink-0"
          >
            <PencilIcon />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-4">
          {renderEdit(value, setValue)}
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              {t("sectionCancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors disabled:opacity-60"
            >
              {saving ? t("sectionSaving") : t("sectionSave")}
            </button>
          </div>
        </div>
      ) : (
        renderView(value)
      )}
    </section>
  );
}
