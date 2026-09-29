"use client";

// Inline name edit — a small pencil next to the <h1> in the profile header.
// Shares updateUserProfile() with AthleteMainSportEditor/AthleteBiographySection
// (the base identity row); each sends the other two fields back unchanged.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { updateUserProfile } from "@/app/actions/athlete";

export default function AthleteNameEditor({
  isOwnProfile,
  name,
  bio,
  mainSport,
}: {
  isOwnProfile: boolean;
  name: string;
  bio: string;
  mainSport: string | null;
}) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, startSaving] = useTransition();

  if (!isOwnProfile) {
    return (
      <h1 className="text-2xl font-extrabold text-zinc-950" style={{ fontFamily: "var(--font-playfair)" }}>
        {name}
      </h1>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-xl font-extrabold text-zinc-950 border border-zinc-200 rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-red-200"
          style={{ fontFamily: "var(--font-playfair)" }}
        />
        <button
          type="button"
          disabled={saving || !value.trim()}
          onClick={() =>
            startSaving(async () => {
              await updateUserProfile({ name: value.trim(), bio, mainSport });
              setEditing(false);
              router.refresh();
            })
          }
          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setValue(name);
            setEditing(false);
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-extrabold text-zinc-950" style={{ fontFamily: "var(--font-playfair)" }}>
        {name}
      </h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={t("edit")}
        className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>
    </div>
  );
}
