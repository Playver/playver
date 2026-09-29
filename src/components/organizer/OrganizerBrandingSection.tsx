"use client";

// Cover image + brand color — the part of the old wizard's Step3Branding
// that didn't move into the wizard's new Step1Profile (the profile-picture
// half did). Both fields persist immediately on change, matching Stage B's
// established upload-persistence convention (see AthleteAvatarEditor.tsx)
// rather than going through a pencil/Save/Cancel cycle — there's no "typed"
// value here to cancel out of.
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useUploadThing } from "@/lib/uploadthing";
import { updateOrganizationDraft } from "@/app/actions/organization";
import { BRAND_COLOR_OPTIONS } from "@/components/organizer/create-wizard/types";

export default function OrganizerBrandingSection({
  coverImageUrl,
  brandColor,
}: {
  coverImageUrl: string | null;
  brandColor: string;
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [cover, setCover] = useState(coverImageUrl);
  const [color, setColor] = useState(brandColor);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("organizationCover", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
      if (url) {
        setCover(url);
        startTransition(async () => {
          await updateOrganizationDraft({ coverImageUrl: url });
          router.refresh();
        });
      }
      setUploading(false);
    },
    onUploadError: () => setUploading(false),
  });

  function handlePickColor(next: string) {
    setColor(next);
    startTransition(async () => {
      await updateOrganizationDraft({ brandColor: next });
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
      <h2 className="text-base font-bold text-zinc-900 mb-4">{t("profileBrandingTitle")}</h2>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-zinc-700">{t("wizardCoverLabel")}</label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-xl border-2 border-dashed border-zinc-200 hover:border-red-300 transition-colors overflow-hidden disabled:opacity-60"
          >
            {cover ? (
              <div className="relative w-full h-40">
                <Image src={cover} alt="" fill className="object-cover" sizes="600px" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 px-4">
                <p className="text-sm font-semibold text-zinc-600">{uploading ? "…" : t("wizardCoverDropLabel")}</p>
                <p className="text-xs text-zinc-400">{t("wizardCoverHint")}</p>
              </div>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              startUpload([file]);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-700">{t("wizardBrandColorLabel")}</label>
          <div className="flex items-center gap-2.5">
            {BRAND_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handlePickColor(c)}
                style={{ backgroundColor: c }}
                className={`size-8 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-zinc-400 scale-105" : ""}`}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
