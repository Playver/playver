"use client";

// Profile "Media" tab — photos and videos (useUploadThing("profileMedia") +
// addUserMedia/deleteUserMedia, no confirmation modal on delete), gated by
// isOwnProfile so other visitors see a read-only grid instead of
// upload/delete controls. Clicking an item opens a full-screen viewer with
// its own Share button; a shared link (/athletes/<id>?media=<mediaId>)
// opens straight on that item (openMediaId).
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useUploadThing } from "@/lib/uploadthing";
import { addUserMedia, deleteUserMedia } from "@/app/actions/athlete";
import type { UserMediaItem } from "@/app/actions/athlete";
import ShareButton from "@/components/share/ShareButton";

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url);
}

function isVideo(item: UserMediaItem) {
  return item.type.toLowerCase() === "video" || isVideoUrl(item.url);
}

export default function AthleteGallerySection({
  isOwnProfile,
  initialMedia,
  ownerId,
  ownerName,
  openMediaId = null,
}: {
  isOwnProfile: boolean;
  initialMedia: UserMediaItem[];
  ownerId: string;
  ownerName: string;
  openMediaId?: string | null;
}) {
  const t = useTranslations("AthleteProfile");
  const [media, setMedia] = useState<UserMediaItem[]>(initialMedia);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [viewing, setViewing] = useState<number | null>(() => {
    const i = openMediaId ? initialMedia.findIndex((m) => m.id === openMediaId) : -1;
    return i >= 0 ? i : null;
  });
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: uploadMedia } = useUploadThing("profileMedia", {
    onClientUploadComplete: async (res) => {
      // UploadThing URLs have no file extension, so the MIME type is what
      // tells a video from a photo.
      const items = (res ?? []).map((f) => ({
        url: f.ufsUrl ?? f.url,
        type: f.type?.startsWith("video/") || isVideoUrl(f.name ?? "") ? "video" : "image",
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
        ) : (
          <p className="text-sm text-zinc-500">{t("noMedia")}</p>
        )
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((item, i) => (
            <MediaTile
              key={item.id}
              item={item}
              isOwnProfile={isOwnProfile}
              onDelete={handleDeleteMedia}
              onOpen={() => setViewing(i)}
              sharePath={`/athletes/${ownerId}?media=${item.id}`}
              ownerName={ownerName}
            />
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

      {viewing !== null && media[viewing] && (
        <MediaViewer
          media={media}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          ownerId={ownerId}
          ownerName={ownerName}
        />
      )}
    </section>
  );
}

function MediaTile({
  item,
  isOwnProfile,
  onDelete,
  onOpen,
  sharePath,
  ownerName,
}: {
  item: UserMediaItem;
  isOwnProfile: boolean;
  onDelete: (id: string) => Promise<void>;
  onOpen: () => void;
  sharePath: string;
  ownerName: string;
}) {
  const tShare = useTranslations("Share");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    await onDelete(item.id);
  }

  return (
    <div className={`relative group aspect-video rounded-xl overflow-hidden bg-zinc-100 transition-opacity ${deleting ? "opacity-40" : ""}`}>
      <button type="button" onClick={onOpen} className="absolute inset-0 w-full h-full" aria-label={tShare("shareMedia")}>
        <MediaPreview item={item} />
      </button>
      <ShareButton
        path={sharePath}
        title={ownerName}
        text={tShare("mediaText", { name: ownerName })}
        label={tShare("shareMedia")}
        variant="overlay"
        className="absolute top-1.5 left-1.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
      />
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

// Grid thumbnail. Items saved before uploads recorded their real type may
// be videos marked "image" (UploadThing URLs have no extension), so a
// thumbnail that fails to load as an image falls back to a video element.
function MediaPreview({ item }: { item: UserMediaItem }) {
  const [asVideo, setAsVideo] = useState(isVideo(item));
  if (asVideo) {
    return (
      <>
        <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="size-10 rounded-full bg-black/50 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </span>
        </span>
      </>
    );
  }
  return <Image src={item.url} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" onError={() => setAsVideo(true)} />;
}

function MediaViewer({
  media,
  index,
  onIndex,
  onClose,
  ownerId,
  ownerName,
}: {
  media: UserMediaItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  ownerId: string;
  ownerName: string;
}) {
  const tShare = useTranslations("Share");
  const item = media[index];
  const [asVideo, setAsVideo] = useState(isVideo(item));
  const [shownId, setShownId] = useState(item.id);
  if (shownId !== item.id) {
    setShownId(item.id);
    setAsVideo(isVideo(item));
  }

  const prev = useCallback(() => onIndex((index - 1 + media.length) % media.length), [index, media.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % media.length), [index, media.length, onIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ShareButton
          path={`/athletes/${ownerId}?media=${item.id}`}
          title={ownerName}
          text={tShare("mediaText", { name: ownerName })}
          label={tShare("shareMedia")}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={tShare("close")}
          className="w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-lg"
        >
          ✕
        </button>
      </div>

      {media.length > 1 && (
        <>
          <button type="button" onClick={prev} aria-label={tShare("previous")} className="absolute left-3 sm:left-6 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button type="button" onClick={next} aria-label={tShare("next")} className="absolute right-3 sm:right-6 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </>
      )}

      <div className="relative w-[92vw] h-[78vh] sm:w-[80vw]">
        {asVideo ? (
          <video key={item.id} src={item.url} controls autoPlay playsInline className="w-full h-full object-contain" />
        ) : (
          <Image key={item.id} src={item.url} alt="" fill sizes="90vw" className="object-contain" onError={() => setAsVideo(true)} />
        )}
      </div>

      {media.length > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-semibold text-white/70">
          {index + 1} / {media.length}
        </p>
      )}
    </div>
  );
}
