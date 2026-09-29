"use server";

// An organization's sponsor/partner directory (/organizer/partners) — see
// scripts/migrate-organization-partners.mjs for the "organization_partner"
// table (migration-owned, same as its parent "organization" table). Follows
// organizer-people.ts's shape: resolve session -> requireOrganizationPermission()
// -> query, all gated on the single MANAGE_PARTNERS permission (no separate
// read-only tier, same precedent as MANAGE_PEOPLE).

import { pool } from "@/lib/db";
import { requireOrganizationPermission } from "./organization";

export type PartnerRow = {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  createdAt: string;
};

export type PartnerInput = {
  name: string;
  description: string;
  website: string;
  logoUrl: string | null;
};

export async function getOrganizationPartners(): Promise<PartnerRow[]> {
  const { organization } = await requireOrganizationPermission("MANAGE_PARTNERS");

  const result = await pool.query(
    `SELECT id, name, description, website, "logoUrl", "createdAt"
     FROM "organization_partner"
     WHERE "organizationId" = $1
     ORDER BY "createdAt" ASC`,
    [organization.id]
  );

  return result.rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
  })) as PartnerRow[];
}

export async function createPartner(input: PartnerInput): Promise<{ error?: string; id?: string }> {
  const { organization } = await requireOrganizationPermission("MANAGE_PARTNERS");

  const name = input.name.trim();
  if (!name) return { error: "Partner name is required" };

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "organization_partner" (id, "organizationId", name, description, website, "logoUrl")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      organization.id,
      name,
      input.description.trim() || null,
      input.website.trim() || null,
      input.logoUrl,
    ]
  );

  return { id };
}

export async function updatePartner(
  id: string,
  input: PartnerInput
): Promise<{ error?: string }> {
  const { organization } = await requireOrganizationPermission("MANAGE_PARTNERS");

  const name = input.name.trim();
  if (!name) return { error: "Partner name is required" };

  const result = await pool.query(
    `UPDATE "organization_partner"
     SET name = $1, description = $2, website = $3, "logoUrl" = $4
     WHERE id = $5 AND "organizationId" = $6`,
    [name, input.description.trim() || null, input.website.trim() || null, input.logoUrl, id, organization.id]
  );
  if (result.rowCount === 0) return { error: "Partner not found" };

  return {};
}

export async function deletePartner(id: string): Promise<{ error?: string }> {
  const { organization } = await requireOrganizationPermission("MANAGE_PARTNERS");

  const result = await pool.query(
    `DELETE FROM "organization_partner" WHERE id = $1 AND "organizationId" = $2`,
    [id, organization.id]
  );
  if (result.rowCount === 0) return { error: "Partner not found" };

  return {};
}

// ---------------------------------------------------------------------------
// Public read (organization public profile, /organizations/[slug]) —
// deliberately the one read in this file with NO session/permission check,
// same reasoning as getPublicOrganizationProfile in organization.ts: the
// caller (the public page) has already verified the organization is
// published via getPublicOrganizationProfile() before ever calling this.
// Unlike Teams, Partners is a real opt-in module (see
// src/lib/organization-modules.ts) — the caller must additionally check that
// "partners" is in that org's enabledModules before showing anything backed
// by this read.
// ---------------------------------------------------------------------------

export async function getPublicOrganizationPartners(organizationId: string): Promise<PartnerRow[]> {
  const result = await pool.query(
    `SELECT id, name, description, website, "logoUrl", "createdAt"
     FROM "organization_partner"
     WHERE "organizationId" = $1
     ORDER BY "createdAt" ASC`,
    [organizationId]
  );

  return result.rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
  })) as PartnerRow[];
}
