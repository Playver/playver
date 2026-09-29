"use client";

// Main-sport + other-sport-tags row from the profile header. "sports" (union
// of team/event sports) stays read-only/derived — only "mainSport" itself is
// user-editable here, via the same SPORTS list ProfileEditor.tsx used.
// Shares updateUserProfile() with AthleteNameEditor/AthleteBiographySection.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { updateUserProfile } from "@/app/actions/athlete";

const SPORTS = ["Soccer", "Basketball", "Volleyball", "Pickleball", "Tennis", "Hockey", "Baseball", "Cricket", "Rugby", "Other"];

function sportEmoji(sport: string): string {
  const map: Record<string, string> = {
    Soccer: "⚽", Basketball: "🏀", Volleyball: "🏐", Pickleball: "🏓",
    Tennis: "🎾", Hockey: "🏒", Baseball: "⚾", Cricket: "🏏", Rugby: "🏉",
  };
  return map[sport] ?? "🏅";
}

export default function AthleteMainSportEditor({
  isOwnProfile,
  name,
  bio,
  mainSport,
  sports,
}: {
  isOwnProfile: boolean;
  name: string;
  bio: string;
  mainSport: string | null;
  sports: string[];
}) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();

  if (!isOwnProfile && sports.length === 0 && !mainSport) return null;

  function save(next: string | null) {
    startSaving(async () => {
      await updateUserProfile({ name, bio, mainSport: next });
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((sport) => (
            <button
              key={sport}
              type="button"
              disabled={saving}
              onClick={() => save(mainSport === sport ? null : sport)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 ${
                mainSport === sport ? "bg-[#e21d12] border-[#e21d12] text-white shadow-sm" : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-400"
              }`}
            >
              {sportEmoji(sport)} {sport}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="self-start text-xs font-semibold text-zinc-500 hover:underline">
          {t("done")}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {mainSport && (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e21d12] text-xs font-bold text-white">
          {sportEmoji(mainSport)} {mainSport}
          <span className="ml-0.5 text-[9px] font-extrabold uppercase tracking-wide opacity-80">{t("mainSportLabel")}</span>
        </span>
      )}
      {sports
        .filter((s) => s !== mainSport)
        .map((sport) => (
          <span key={sport} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
            {sportEmoji(sport)} {sport}
          </span>
        ))}
      {isOwnProfile && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t("edit")}
          className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
