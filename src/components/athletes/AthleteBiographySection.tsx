"use client";

// "About" tab — Biography (the bio textarea). Shares updateUserProfile()
// with AthleteNameEditor/AthleteMainSportEditor in the header.
import { useTranslations } from "next-intl";
import EditableSection from "@/components/athletes/EditableSection";
import { updateUserProfile } from "@/app/actions/athlete";

export default function AthleteBiographySection({
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

  return (
    <EditableSection<string>
      title={t("biographyTitle")}
      isOwnProfile={isOwnProfile}
      initialValue={bio}
      onSave={(v) => updateUserProfile({ name, bio: v, mainSport })}
      renderView={(v) =>
        v ? (
          <p className="text-sm leading-6 text-zinc-600 whitespace-pre-wrap">{v}</p>
        ) : (
          <p className="text-sm text-zinc-400">{isOwnProfile ? t("noBioOwn") : t("noBio")}</p>
        )
      }
      renderEdit={(v, setV) => (
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          rows={5}
          placeholder={t("bioPlaceholder")}
          className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 resize-none placeholder:text-zinc-400"
        />
      )}
    />
  );
}
