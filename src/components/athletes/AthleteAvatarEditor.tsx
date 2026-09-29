"use client";

// Profile-photo upload, migrated from ProfileEditor.tsx unchanged (same
// useUploadThing("profileAvatar") call, persists immediately on upload
// completion per Stage B's persistence rule). Renders the avatar for every
// visitor; the hover camera overlay + hidden file input only mount when
// isOwnProfile.
import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useUploadThing } from "@/lib/uploadthing";
import { updateUserProfile } from "@/app/actions/athlete";

export default function AthleteAvatarEditor({
  isOwnProfile,
  name,
  bio,
  mainSport,
  image,
}: {
  isOwnProfile: boolean;
  name: string;
  bio: string;
  mainSport: string | null;
  image: string | null;
}) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(image);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("profileAvatar", {
    onClientUploadComplete: async (res) => {
      const url = res[0]?.ufsUrl ?? res[0]?.url;
      if (!url) {
        setUploading(false);
        return;
      }
      setImageUrl(url);
      await updateUserProfile({ name, bio, mainSport, imageUrl: url });
      setUploading(false);
      router.refresh();
    },
    onUploadError: () => setUploading(false),
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    startUpload([file]);
    e.target.value = "";
  }

  const avatar = imageUrl ? (
    <Image
      src={imageUrl}
      alt={name}
      width={80}
      height={80}
      className="size-20 rounded-full border-4 border-white object-cover shadow-md"
    />
  ) : (
    <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#e21d12] text-2xl font-extrabold text-white shadow-md">
      {name[0]?.toUpperCase()}
    </div>
  );

  if (!isOwnProfile) return avatar;

  return (
    <button type="button" onClick={() => inputRef.current?.click()} className="relative group shrink-0" disabled={uploading} aria-label={t("changePhoto")}>
      {avatar}
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
        {uploading ? (
          <span className="text-[9px] font-bold text-white">{t("avatarUploading")}</span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </button>
  );
}
