"use client";

// "About" tab — Interests tag list. Batches into the same
// updateAthleteExtendedProfile() call as Basic Info / Social Links (see
// AthleteBasicInfoSection's note on why sending sibling fields back
// unchanged is safe here). Editing happens in a popup (not an inline
// expand) so the preset suggestion grid has room to breathe.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { updateAthleteExtendedProfile } from "@/app/actions/athlete";

const PRESET_INTERESTS = [
  "Basketball", "Soccer", "Football", "Hockey", "Running",
  "Youth Development", "Sports Business", "Sports Technology",
  "Fitness", "Content Creation", "Community Development",
  "Coaching", "Nutrition", "Mental Performance", "Recruiting",
];

function presetKey(label: string) {
  return `interestPreset${label.replace(/[^a-zA-Z]/g, "")}`;
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function AthleteInterestsSection({
  isOwnProfile,
  tagline,
  location,
  hometown,
  socialLinks,
  interests,
}: {
  isOwnProfile: boolean;
  tagline: string;
  location: string;
  hometown: string;
  socialLinks: Record<string, string>;
  interests: string[];
}) {
  const t = useTranslations("AthleteProfile");
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-zinc-900">{t("interestsTitle")}</h2>
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("edit")}
            className="flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors shrink-0"
          >
            <PencilIcon />
          </button>
        )}
      </div>

      {interests.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {interests.map((interest) => (
            <span key={interest} className="px-3 py-1 rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
              {interest}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">{isOwnProfile ? t("noInterestsOwn") : t("noInterests")}</p>
      )}

      <AthleteInterestsModal
        open={open}
        onClose={() => setOpen(false)}
        interests={interests}
        tagline={tagline}
        location={location}
        hometown={hometown}
        socialLinks={socialLinks}
      />
    </section>
  );
}

function AthleteInterestsModal({
  open,
  onClose,
  interests,
  tagline,
  location,
  hometown,
  socialLinks,
}: {
  open: boolean;
  onClose: () => void;
  interests: string[];
  tagline: string;
  location: string;
  hometown: string;
  socialLinks: Record<string, string>;
}) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [selected, setSelected] = useState(interests);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  // Preset chips plus any already-saved interests that aren't in the preset
  // list (e.g. a previously typed custom one) — both stay toggleable.
  const options = [...PRESET_INTERESTS, ...selected.filter((i) => !PRESET_INTERESTS.includes(i))];

  function toggle(interest: string) {
    setSelected((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]));
  }

  function addCustom() {
    const trimmed = draft.trim();
    if (trimmed && !selected.includes(trimmed)) setSelected((prev) => [...prev, trimmed]);
    setDraft("");
  }

  function handleClose() {
    setSelected(interests);
    setDraft("");
    onClose();
  }

  function handleSave() {
    setSaving(true);
    updateAthleteExtendedProfile({ tagline, location, hometown, socialLinks, interests: selected })
      .then(() => {
        onClose();
        router.refresh();
      })
      .finally(() => setSaving(false));
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-zinc-900">{t("interestsTitle")}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex size-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors shrink-0"
          >
            <IconClose />
          </button>
        </div>

        <p className="text-sm text-zinc-500">{t("interestsSubtitle")}</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder={t("interestsPlaceholder")}
            className="flex-1 px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
          />
          <button
            type="button"
            onClick={addCustom}
            className="px-5 py-2.5 text-sm font-bold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors"
          >
            {t("addInterest")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {options.map((interest) => {
            const active = selected.includes(interest);
            const label = PRESET_INTERESTS.includes(interest) ? t(presetKey(interest)) : interest;
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggle(interest)}
                className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  active ? "bg-[#e21d12]/10 border-[#e21d12] text-[#e21d12]" : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-400"
                }`}
              >
                {active ? "✓ " : ""}{label}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-zinc-100 mt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-bold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors disabled:opacity-60"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
