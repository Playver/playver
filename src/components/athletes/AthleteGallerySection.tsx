"use client";

// Gameplay gallery — migrated from ProfileEditor.tsx unchanged (same
// useUploadThing("profileMedia") + addUserMedia/deleteUserMedia calls, no
// confirmation modal on delete), now gated by isOwnProfile so other
// visitors see a read-only grid instead of upload/delete controls.
import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useUploadThing } from "@/lib/uploadthing";
import { addUserMedia, deleteUserMedia } from "@/app/actions/athlete";
import type { UserMediaItem } from "@/app/actions/athlete";

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url);
}

export default function AthleteGallerySection({
  isOwnProfile,
  initialMedia,
}: {
  isOwnProfile: boolean;
  initialMedia: UserMediaItem[];
}) {
  const t = useTranslations("AthleteProfile");
  const [media, setMedia] = useState<UserMediaItem[]>(initialMedia);
  const [mediaUploading, setMediaUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: uploadMedia } = useUploadThing("profileMedia", {
    onClientUploadComplete: async (res) => {
      const items = (res ?? []).map((f) => ({
        url: f.ufsUrl ?? f.url,
        type: isVideoUrl(f.ufsUrl ?? f.url) ? "video" : "image",
      }));
      const newMedia = await addUserMedia(items);
      setMedia((prev) => [...newMedia, ...prev]);
      setMediaUploading(false);
    },
    onUploadError: () => setMediaUploading(false),
  });

  function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setMediaUploading(true);
    uploadMedia(files);
    e.target.value = "";
  }

  async function handleDeleteMedia(id: string) {
    await deleteUserMedia(id);
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  if (!isOwnProfile && media.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-zinc-900">{t("galleryTitle")}</h2>
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            disabled={mediaUploading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#e21d12] text-white hover:bg-[#d41810] transition-colors disabled:opacity-50 shrink-0"
          >
            {mediaUploading ? t("mediaUploading") : t("addMedia")}
          </button>
        )}
      </div>
      {isOwnProfile && (
        <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaChange} />
      )}

      {media.length === 0 ? (
        isOwnProfile ? (
          <div
            onClick={() => mediaInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 py-16 cursor-pointer hover:border-zinc-400 transition-colors gap-3"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <div className="text-center">
              <p className="text-sm font-semibold text-zinc-500">{t("emptyGallery")}</p>
              <p className="text-xs text-zinc-400 mt-1">{t("emptyGalleryHint")}</p>
            </div>
          </div>
        ) : null
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((item) => (
            <MediaTile key={item.id} item={item} isOwnProfile={isOwnProfile} onDelete={handleDeleteMedia} />
          ))}
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              disabled={mediaUploading}
              className="aspect-video rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-zinc-400 transition-colors text-zinc-400 disabled:opacity-50"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span className="text-xs font-semibold">{t("addMore")}</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function MediaTile({
  item,
  isOwnProfile,
  onDelete,
}: {
  item: UserMediaItem;
  isOwnProfile: boolean;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    await onDelete(item.id);
  }

  const isVideo = item.type === "video" || isVideoUrl(item.url);

  return (
    <div className={`relative group aspect-video rounded-xl overflow-hidden bg-zinc-100 transition-opacity ${deleting ? "opacity-40" : ""}`}>
      {isVideo ? (
        <>
          <video src={item.url} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-10 rounded-full bg-black/50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
        </>
      ) : (
        <Image src={item.url} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />
      )}
      {isOwnProfile && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 size-7 bg-black/60 rounded-full flex items-center justify-center text-white transition-opacity hover:bg-black/80 text-xs font-bold"
        >
          ✕
        </button>
      )}
    </div>
  );
}
