"use server";

// Organization profile "Media" tab (/organizations/[slug]?tab=media) —
// photos and videos an org posts, the org counterpart of "user_media"
// (athlete.ts). Self-creating via ensureOrganizationMediaTable(), same as
// user_media, so it needs no manual migration in any environment. Reads are
// public for published orgs (the page itself is public); writes need
// MANAGE_ORGANIZATION_PROFILE in *that* org — checked against the given
// organizationId rather than the active-org cookie, because the editor
// lives on the public page, which may not be the org the cookie points at.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { hasPermission } from "@/lib/organizer-permissions";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getUserOrganizations } from "./organization";
import type { UserMediaItem } from "./athlete";

let ensureOrganizationMediaPromise: Promise<void> | null = null;
function ensureOrganizationMediaTable() {
  if (!ensureOrganizationMediaPromise) {
    ensureOrganizationMediaPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS "organization_media" (
          id TEXT PRIMARY KEY,
          "organizationId" TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'image',
          "uploadedBy" TEXT,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      .then(() =>
        pool.query(
          `CREATE INDEX IF NOT EXISTS "organization_media_org_idx" ON "organization_media" ("organizationId", "createdAt" DESC)`
        )
      )
      .then(() => undefined)
      .catch((err) => {
        ensureOrganizationMediaPromise = null;
        throw err;
      });
  }
  return ensureOrganizationMediaPromise;
}

async function requireMediaEditor(organizationId: string): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ForbiddenError("Not signed in");
  const membership = (await getUserOrganizations()).find((org) => org.id === organizationId);
  if (!membership || !hasPermission(membership.role, "MANAGE_ORGANIZATION_PROFILE")) {
    throw new ForbiddenError("Forbidden");
  }
  return session.user.id;
}

export async function getOrganizationMedia(organizationId: string): Promise<UserMediaItem[]> {
  await ensureOrganizationMediaTable();
  const result = await pool.query(
    `SELECT m.id, m.url, m.type
     FROM "organization_media" m
     JOIN "organization" o ON o.id = m."organizationId"
     WHERE m."organizationId" = $1 AND o."publicationStatus" = 'published'
     ORDER BY m."createdAt" DESC`,
    [organizationId]
  );
  return result.rows as UserMediaItem[];
}

export async function addOrganizationMedia(
  organizationId: string,
  items: { url: string; type: string }[]
): Promise<UserMediaItem[]> {
  const userId = await requireMediaEditor(organizationId);
  await ensureOrganizationMediaTable();

  const results: UserMediaItem[] = [];
  for (const item of items) {
    const id = crypto.randomUUID();
    const type = item.type === "video" ? "video" : "image";
    await pool.query(
      `INSERT INTO "organization_media" (id, "organizationId", url, type, "uploadedBy") VALUES ($1, $2, $3, $4, $5)`,
      [id, organizationId, item.url, type, userId]
    );
    results.push({ id, url: item.url, type });
  }
  return results;
}

export async function deleteOrganizationMedia(organizationId: string, id: string): Promise<void> {
  await requireMediaEditor(organizationId);
  await pool.query(`DELETE FROM "organization_media" WHERE id = $1 AND "organizationId" = $2`, [id, organizationId]);
}
