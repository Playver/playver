"use client";

// Organization profile "Media" tab — MediaGallery wired to this org's
// organization_media rows (src/app/actions/organization-media.ts).
import MediaGallery from "@/components/media/MediaGallery";
import { addOrganizationMedia, deleteOrganizationMedia } from "@/app/actions/organization-media";
import type { UserMediaItem } from "@/app/actions/athlete";

export default function OrganizationMediaSection({
  organizationId,
  slug,
  name,
  canEdit,
  initialMedia,
  openMediaId = null,
}: {
  organizationId: string;
  slug: string;
  name: string;
  canEdit: boolean;
  initialMedia: UserMediaItem[];
  openMediaId?: string | null;
}) {
  return (
    <MediaGallery
      canEdit={canEdit}
      initialMedia={initialMedia}
      sharePath={`/organizations/${slug}`}
      ownerName={name}
      openMediaId={openMediaId}
      addMedia={(items) => addOrganizationMedia(organizationId, items)}
      deleteMedia={(id) => deleteOrganizationMedia(organizationId, id)}
    />
  );
}
