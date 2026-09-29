"use client";

// "Edit Cover" button overlaid on the athlete profile's cover photo — same
// upload-persists-immediately pattern as AthleteAvatarEditor/
// OrganizationCoverEditor. Only rendered when isOwnProfile.
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useUploadThing } from "@/lib/uploadthing";
import { updateAthleteCoverImage } from "@/app/actions/athlete";

const IconCamera = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export default function AthleteCoverEditor() {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("profileCover", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
      setUploading(false);
      if (url) {
        startTransition(async () => {
          await updateAthleteCoverImage(url);
          router.refresh();
        });
      }
    },
    onUploadError: () => setUploading(false),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-60"
      >
        <IconCamera />
        {uploading ? t("editCoverUploading") : t("editCover")}
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
    </>
  );
}
