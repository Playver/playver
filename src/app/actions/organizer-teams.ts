"use server";

// An organization's teams directory (/organizer/teams) — see
// scripts/migrate-organization-teams.mjs for the "organization_team"
// table (migration-owned, same as its parent "organization" table). Follows
// organizer-partners.ts's shape: resolve session -> requireOrganizationPermission()
// -> query, all gated on the single MANAGE_TEAMS permission (no separate
// read-only tier, same precedent as MANAGE_PARTNERS).
//
// This is deliberately a minimal, real version of organization-owned teams
// (name, sport, coach name, member count) — NOT the same concept as the
// existing captain-owned "team" table (individual-owned, no organization
// link, used for event registration). No win/loss record tracking here;
// that's a separate, out-of-scope stats feature.

import { pool } from "@/lib/db";
import { requireOrganizationPermission } from "./organization";

export type TeamRow = {
  id: string;
  name: string;
  sport: string | null;
  coachName: string | null;
  memberCount: number | null;
  logoUrl: string | null;
  createdAt: string;
};

export type TeamInput = {
  name: string;
  sport: string;
  coachName: string;
  memberCount: number | null;
  logoUrl: string | null;
};

export async function getOrganizationTeams(): Promise<TeamRow[]> {
  const { organization } = await requireOrganizationPermission("MANAGE_TEAMS");

  const result = await pool.query(
    `SELECT id, name, sport, "coachName", "memberCount", "logoUrl", "createdAt"
     FROM "organization_team"
     WHERE "organizationId" = $1
     ORDER BY "createdAt" ASC`,
    [organization.id]
  );

  return result.rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
  })) as TeamRow[];
}

export async function createTeam(input: TeamInput): Promise<{ error?: string; id?: string }> {
  const { organization } = await requireOrganizationPermission("MANAGE_TEAMS");

  const name = input.name.trim();
  if (!name) return { error: "Team name is required" };

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "organization_team" (id, "organizationId", name, sport, "coachName", "memberCount", "logoUrl")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      organization.id,
      name,
      input.sport.trim() || null,
      input.coachName.trim() || null,
      input.memberCount,
      input.logoUrl,
    ]
  );

  return { id };
}

export async function updateTeam(
  id: string,
  input: TeamInput
): Promise<{ error?: string }> {
  const { organization } = await requireOrganizationPermission("MANAGE_TEAMS");

  const name = input.name.trim();
  if (!name) return { error: "Team name is required" };

  const result = await pool.query(
    `UPDATE "organization_team"
     SET name = $1, sport = $2, "coachName" = $3, "memberCount" = $4, "logoUrl" = $5
     WHERE id = $6 AND "organizationId" = $7`,
    [name, input.sport.trim() || null, input.coachName.trim() || null, input.memberCount, input.logoUrl, id, organization.id]
  );
  if (result.rowCount === 0) return { error: "Team not found" };

  return {};
}

export async function deleteTeam(id: string): Promise<{ error?: string }> {
  const { organization } = await requireOrganizationPermission("MANAGE_TEAMS");

  const result = await pool.query(
    `DELETE FROM "organization_team" WHERE id = $1 AND "organizationId" = $2`,
    [id, organization.id]
  );
  if (result.rowCount === 0) return { error: "Team not found" };

  return {};
}

// ---------------------------------------------------------------------------
// Public read (organization public profile, /organizations/[slug]) —
// deliberately the one read in this file with NO session/permission check,
// same reasoning as getPublicOrganizationProfile in organization.ts: the
// caller (the public page) has already verified the organization is
// published via getPublicOrganizationProfile() before ever calling this, so
// there's nothing left to gate here. Teams are an "alwaysOn" module (see
// src/lib/organization-modules.ts) — every org effectively has Teams
// enabled, so visibility is governed by whether any teams exist, not by
// enabledModules.
// ---------------------------------------------------------------------------

export async function getPublicOrganizationTeams(organizationId: string): Promise<TeamRow[]> {
  const result = await pool.query(
    `SELECT id, name, sport, "coachName", "memberCount", "logoUrl", "createdAt"
     FROM "organization_team"
     WHERE "organizationId" = $1
     ORDER BY "createdAt" ASC`,
    [organizationId]
  );

  return result.rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
  })) as TeamRow[];
}
