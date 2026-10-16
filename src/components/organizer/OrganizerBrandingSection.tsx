"use client";

// Cover image — the part of the old wizard's Step3Branding that didn't move
// into the wizard's new Step1Profile (the profile-picture half did). Brand
// color was removed; public org pages use Playver's own red. The cover
// persists immediately on upload, matching Stage B's established
// upload-persistence convention (see AthleteAvatarEditor.tsx) rather than
// going through a pencil/Save/Cancel cycle — there's no "typed" value here
// to cancel out of.
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useUploadThing } from "@/lib/uploadthing";
import { updateOrganizationDraft } from "@/app/actions/organization";

export default function OrganizerBrandingSection({ coverImageUrl }: { coverImageUrl: string | null }) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [cover, setCover] = useState(coverImageUrl);
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
      </div>
    </section>
  );
}
