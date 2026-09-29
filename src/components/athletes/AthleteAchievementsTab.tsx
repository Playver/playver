"use client";

// "Achievements" tab content — its own trophies/certifications sub-tab,
// independent of the top-level About/Achievements tab state in
// AthleteProfileTabs. Achievement rows are their own normalized table, so
// add/edit/delete persist immediately like Experience/Education.
// "verified" is intentionally not exposed in the add/edit form — it's not
// self-settable (would defeat the point of a verified badge); it stays
// false until set through a future admin/organizer verification flow.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { AthleteAchievement } from "@/app/actions/athlete";
import { addAchievement, updateAchievement, deleteAchievement } from "@/app/actions/athlete";

const ACHIEVEMENT_TYPES = ["trophy", "medal", "award", "certification"] as const;
type AchievementType = (typeof ACHIEVEMENT_TYPES)[number];

type AchievementFormValue = { title: string; eventName: string | null; achievedAt: string | null; type: string };

function typeIcon(type: string) {
  switch (type) {
    case "medal":
      return "🥇";
    case "award":
      return "🎖️";
    case "certification":
      return "📜";
    default:
      return "🏆";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

export default function AthleteAchievementsTab({
  isOwnProfile,
  achievements,
}: {
  isOwnProfile: boolean;
  achievements: AthleteAchievement[];
}) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [subTab, setSubTab] = useState<"trophies" | "certifications">("trophies");
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const trophies = achievements.filter((a) => a.type !== "certification");
  const certifications = achievements.filter((a) => a.type === "certification");
  const visible = subTab === "trophies" ? trophies : certifications;

  function handleAdd(value: AchievementFormValue) {
    startTransition(async () => {
      await addAchievement(value);
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 rounded-full bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab("trophies")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              subTab === "trophies" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            {t("subTabTrophies")}
          </button>
          <button
            type="button"
            onClick={() => setSubTab("certifications")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              subTab === "certifications" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            {t("subTabCertifications")}
          </button>
        </div>
        {isOwnProfile && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors"
          >
            {t("addAchievement")}
          </button>
        )}
      </div>

      {adding && (
        <AchievementForm
          defaultType={subTab === "certifications" ? "certification" : "trophy"}
          onCancel={() => setAdding(false)}
          onSubmit={handleAdd}
          saving={pending}
          saveLabel={t("save")}
          cancelLabel={t("cancel")}
        />
      )}

      {visible.length === 0 && !adding ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
          {isOwnProfile ? t("noAchievementsOwn") : t("noAchievements")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} isOwnProfile={isOwnProfile} />
          ))}
        </div>
      )}
    </div>
  );
}

function AchievementCard({ achievement, isOwnProfile }: { achievement: AthleteAchievement; isOwnProfile: boolean }) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUpdate(value: AchievementFormValue) {
    startTransition(async () => {
      await updateAchievement(achievement.id, value);
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteAchievement(achievement.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="sm:col-span-2">
        <AchievementForm
          initial={achievement}
          onCancel={() => setEditing(false)}
          onSubmit={handleUpdate}
          saving={pending}
          saveLabel={t("save")}
          cancelLabel={t("cancel")}
        />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e21d12]/8 text-xl">
        {typeIcon(achievement.type)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold text-zinc-900 text-sm">{achievement.title}</p>
          {achievement.verified && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">
              {t("verifiedBadge")}
            </span>
          )}
        </div>
        {achievement.eventName && <p className="text-xs text-zinc-500 truncate">{achievement.eventName}</p>}
        {achievement.achievedAt && <p className="text-xs text-zinc-400 mt-0.5">{formatDate(achievement.achievedAt)}</p>}
      </div>
      {isOwnProfile && (
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setEditing(true)} aria-label={t("edit")} className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <PencilIcon />
          </button>
          <button type="button" onClick={handleDelete} disabled={pending} aria-label={t("delete")} className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50">
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function AchievementForm({
  initial,
  defaultType = "trophy",
  onCancel,
  onSubmit,
  saving,
  saveLabel,
  cancelLabel,
}: {
  initial?: AthleteAchievement;
  defaultType?: AchievementType;
  onCancel: () => void;
  onSubmit: (value: AchievementFormValue) => void;
  saving: boolean;
  saveLabel: string;
  cancelLabel: string;
}) {
  const t = useTranslations("AthleteProfile");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [eventName, setEventName] = useState(initial?.eventName ?? "");
  const [achievedAt, setAchievedAt] = useState(initial?.achievedAt ?? "");
  const [type, setType] = useState<string>(initial?.type ?? defaultType);

  const typeLabels: Record<AchievementType, string> = {
    trophy: t("achievementTypeTrophy"),
    medal: t("achievementTypeMedal"),
    award: t("achievementTypeAward"),
    certification: t("achievementTypeCertification"),
  };

  return (
    <div className="sm:col-span-2 flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("achievementTitlePlaceholder")}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
      />
      <input
        type="text"
        value={eventName}
        onChange={(e) => setEventName(e.target.value)}
        placeholder={t("achievementEventPlaceholder")}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={achievedAt}
          onChange={(e) => setAchievedAt(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
        >
          {ACHIEVEMENT_TYPES.map((t2) => (
            <option key={t2} value={t2}>
              {typeLabels[t2]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() =>
            title.trim() &&
            onSubmit({ title: title.trim(), eventName: eventName.trim() || null, achievedAt: achievedAt || null, type })
          }
          disabled={saving || !title.trim()}
          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
