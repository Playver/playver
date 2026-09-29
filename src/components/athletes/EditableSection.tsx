"use client";

// Shared edit-in-place primitive for the athlete profile: a card with a
// pencil trigger (only rendered when isOwnProfile) that swaps the card's
// content into an inline form. Save calls the passed-in server action and
// refreshes the page (matches the router.refresh()-after-server-action
// convention already used by ProfileEditor.tsx / EventCancelPostponeButton);
// Cancel discards local edits. File uploads (avatar/gallery) don't go
// through this component — they persist immediately on upload completion,
// per Stage B's persistence rule.
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export default function EditableSection<T>({
  title,
  isOwnProfile,
  initialValue,
  onSave,
  renderView,
  renderEdit,
  className = "",
  emptyState,
}: {
  title?: string;
  isOwnProfile: boolean;
  initialValue: T;
  onSave: (value: T) => Promise<void>;
  renderView: (value: T) => ReactNode;
  renderEdit: (value: T, setValue: (v: T) => void) => ReactNode;
  className?: string;
  emptyState?: ReactNode;
}) {
  const t = useTranslations("AthleteProfile");
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
        await onSave(value);
        setEditing(false);
        router.refresh();
      } catch {
        setError(t("saveError"));
      }
    });
  }

  return (
    <section className={`bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 ${className}`}>
      {(title || (isOwnProfile && !editing)) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-base font-bold text-zinc-900">{title}</h2>}
          {isOwnProfile && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t("edit")}
              className="flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors shrink-0"
            >
              <PencilIcon />
            </button>
          )}
        </div>
      )}

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
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors disabled:opacity-60"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      ) : (
        renderView(value) ?? emptyState
      )}
    </section>
  );
}
