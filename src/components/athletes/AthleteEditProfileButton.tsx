"use client";

// Top-right header control pair (owner-only): a disabled "My Playver"
// coming-soon pill (same treatment as its ProfileSlideOver counterpart) and
// the "Edit Profile" button that opens the single consolidated edit modal
// for the whole header/about identity block.
import { useState } from "react";
import { useTranslations } from "next-intl";
import AthleteEditProfileModal from "@/components/athletes/AthleteEditProfileModal";

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export default function AthleteEditProfileButton({
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled
          title={t("comingSoon")}
          className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-400 cursor-not-allowed"
        >
          <IconGrid /> {t("myPlayverButton")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-[#e21d12] px-4 py-2 text-sm font-bold text-white hover:bg-[#d41810] transition-colors"
        >
          <IconPencil /> {t("editProfileButton")}
        </button>
      </div>

      <AthleteEditProfileModal
        open={open}
        onClose={() => setOpen(false)}
        name={name}
        bio={bio}
        mainSport={mainSport}
        secondarySports={secondarySports}
        tagline={tagline}
        location={location}
        hometown={hometown}
        sportRoles={sportRoles}
        socialLinks={socialLinks}
        interests={interests}
        dateOfBirth={dateOfBirth}
      />
    </>
  );
}
