// Small lookups for link-preview metadata (generateMetadata) on shareable
// pages. Kept out of the "use server" action files so they aren't exposed
// as callable endpoints, and limited to what those pages already show
// publicly.
import { pool } from "@/lib/db";

export async function getAthleteShareInfo(userId: string, mediaId?: string) {
  const [userRes, mediaRes] = await Promise.all([
    pool.query(`SELECT name, image, bio, tagline, "mainSport" FROM "user" WHERE id = $1`, [userId]),
    mediaId
      ? pool.query(`SELECT url, type FROM "user_media" WHERE id = $1 AND "userId" = $2`, [mediaId, userId])
      : null,
  ]);
  const user = userRes.rows[0];
  if (!user) return null;
  const media = mediaRes?.rows[0] as { url: string; type: string } | undefined;
  return {
    name: user.name as string,
    image: (user.image as string | null) ?? null,
    description: (user.tagline || user.bio || user.mainSport || null) as string | null,
    media: media ?? null,
  };
}

export async function getOrganizationShareInfo(slug: string, mediaId?: string) {
  const res = await pool.query(
    `SELECT id, name, "logoUrl", "coverImageUrl", "shortDescription", slogan, city
     FROM "organization" WHERE slug = $1 AND "publicationStatus" = 'published'`,
    [slug]
  );
  const org = res.rows[0];
  if (!org) return null;
  // organization_media self-creates on first use (organization-media.ts), so
  // it may not exist yet — a missing table just means no media preview.
  const mediaRes = mediaId
    ? await pool
        .query(`SELECT url, type FROM "organization_media" WHERE id = $1 AND "organizationId" = $2`, [mediaId, org.id])
        .catch(() => null)
    : null;
  const media = mediaRes?.rows[0] as { url: string; type: string } | undefined;
  return {
    name: org.name as string,
    image: (org.coverImageUrl || org.logoUrl || null) as string | null,
    description: (org.shortDescription || org.slogan || org.city || null) as string | null,
    media: media ?? null,
  };
}

export async function getTeamShareInfo(teamId: string) {
  const res = await pool.query(`SELECT name, sport, location, bio, "logoUrl", "coverImageUrl" FROM "team" WHERE id = $1`, [teamId]);
  const team = res.rows[0];
  if (!team) return null;
  return {
    name: team.name as string,
    image: (team.coverImageUrl || team.logoUrl || null) as string | null,
    description: (team.bio || [team.sport, team.location].filter(Boolean).join(" · ") || null) as string | null,
  };
}
