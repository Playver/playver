"use client";

// Consolidated "Edit Profile" modal — the single entry point for every field
// in the profile header identity block (name, headline, bio, location,
// hometown, sport roles, main sport, date of birth, social links). The page
// renders all of these as flat, read-only rows (see athletes/[userId]/
// page.tsx) — this modal is the only way to change them. Interests keeps its
// own separate editor since it's About-tab content, not header identity.
//
// Only ever mounted while `open` is true (conditionally rendered by the
// parent, not always-mounted), so createPortal's document.body reference
// never runs during SSR — no need for CreateChooserModal's mounted-guard.
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { updateUserProfile, updateAthleteExtendedProfile, updateAthleteDateOfBirth } from "@/app/actions/athlete";

const SPORTS = ["Soccer", "Basketball", "Volleyball", "Pickleball", "Tennis", "Hockey", "Baseball", "Cricket", "Rugby", "Other"];
const SPORT_ROLES = ["player", "coach", "referee", "organizer", "recruiter", "fan"] as const;
const SOCIAL_PLATFORMS = ["instagram", "tiktok", "x", "website"] as const;

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function AthleteEditProfileModal({
  open,
  onClose,
  name,
  bio,
  mainSport,
  secondarySports,
  tagline,
  location,
  hometown,
  sportRoles,
  socialLinks,
  interests,
  dateOfBirth,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  bio: string;
  mainSport: string | null;
  secondarySports: string[];
  tagline: string;
  location: string;
  hometown: string;
  sportRoles: string[];
  socialLinks: Record<string, string>;
  interests: string[];
  dateOfBirth: string | null;
}) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name,
    mainSport,
    secondarySports,
    tagline,
    location,
    hometown,
    sportRoles,
    socialLinks,
    dateOfBirth: dateOfBirth ?? "",
  });

  if (!open) return null;

  function setMainSport(sport: string) {
    setForm((f) => ({
      ...f,
      mainSport: f.mainSport === sport ? null : sport,
      // A sport can't be both main and secondary at once.
      secondarySports: f.secondarySports.filter((s) => s !== sport),
    }));
  }

  function toggleSecondarySport(sport: string) {
    setForm((f) => {
      if (f.secondarySports.includes(sport)) {
        return { ...f, secondarySports: f.secondarySports.filter((s) => s !== sport) };
      }
      if (f.secondarySports.length >= 2) return f;
      return { ...f, secondarySports: [...f.secondarySports, sport] };
    });
  }

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      sportRoles: f.sportRoles.includes(role) ? f.sportRoles.filter((r) => r !== role) : [...f.sportRoles, role],
    }));
  }

  function setSocialUrl(platform: string, url: string) {
    setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [platform]: url } }));
  }

  function handleSave() {
    setError("");
    startSaving(async () => {
      try {
        await updateUserProfile({
          name: form.name.trim() || name,
          bio,
          mainSport: form.mainSport,
          secondarySports: form.secondarySports,
        });
        await updateAthleteExtendedProfile({
          tagline: form.tagline,
          location: form.location,
          hometown: form.hometown,
          socialLinks: form.socialLinks,
          interests,
          sportRoles: form.sportRoles,
        });
        await updateAthleteDateOfBirth(form.dateOfBirth || null);
        onClose();
        router.refresh();
      } catch {
        setError(t("saveError"));
      }
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-zinc-900">{t("editProfileModalTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors shrink-0"
          >
            <IconClose />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-zinc-700">{t("fullNameLabel")}</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-zinc-700">{t("headlineLabel")}</label>
          <input
            type="text"
            value={form.tagline}
            placeholder={t("headlinePlaceholder")}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className="w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-zinc-700">{t("locationLabel")}</label>
            <input
              type="text"
              value={form.location}
              placeholder={t("locationPlaceholder")}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-zinc-700">{t("hometownLabel")}</label>
            <input
              type="text"
              value={form.hometown}
              placeholder={t("hometownPlaceholder")}
              onChange={(e) => setForm({ ...form, hometown: e.target.value })}
              className="w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
            />
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-zinc-400">{t("sportRolesLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {SPORT_ROLES.map((role) => {
              const active = form.sportRoles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    active ? "bg-[#e21d12]/10 border-[#e21d12] text-[#e21d12]" : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {active ? "✓ " : ""}{t(`sportRole${role.charAt(0).toUpperCase()}${role.slice(1)}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-zinc-400">{t("mainSportSectionLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() => setMainSport(sport)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  form.mainSport === sport ? "bg-[#e21d12] border-[#e21d12] text-white" : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-400"
                }`}
              >
                {sport}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-zinc-400">{t("secondarySportsLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {SPORTS.filter((sport) => sport !== form.mainSport).map((sport) => {
              const active = form.secondarySports.includes(sport);
              const disabled = !active && form.secondarySports.length >= 2;
              return (
                <button
                  key={sport}
                  type="button"
                  onClick={() => toggleSecondarySport(sport)}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors disabled:opacity-40 ${
                    active ? "bg-[#e21d12]/10 border-[#e21d12] text-[#e21d12]" : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {active ? "✓ " : ""}{sport}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-zinc-700">{t("dobTitle")}</label>
          <p className="text-xs text-zinc-400">{t("dobPrivacyNote")}</p>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            className="w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
          />
        </div>

        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-zinc-400">{t("socialMediaTitle")}</p>
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm font-semibold text-zinc-700 capitalize">{platform}</span>
              <input
                type="url"
                value={form.socialLinks[platform] ?? ""}
                onChange={(e) => setSocialUrl(platform, e.target.value)}
                placeholder={t("socialUrlPlaceholder")}
                className="flex-1 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1 border-t border-zinc-100 mt-1">
          <button
            type="button"
            onClick={onClose}
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
            {saving ? t("saving") : t("saveChanges")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
