"use client";

// Athlete profile "Media" tab — MediaGallery wired to the user's own
// user_media rows (addUserMedia/deleteUserMedia).
import MediaGallery from "@/components/media/MediaGallery";
import { addUserMedia, deleteUserMedia } from "@/app/actions/athlete";
import type { UserMediaItem } from "@/app/actions/athlete";

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
  return (
    <MediaGallery
      canEdit={isOwnProfile}
      initialMedia={initialMedia}
      sharePath={`/athletes/${ownerId}`}
      ownerName={ownerName}
      openMediaId={openMediaId}
      addMedia={addUserMedia}
      deleteMedia={deleteUserMedia}
    />
  );
}
