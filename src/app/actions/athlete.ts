"use server";

// Athlete profiles: the merged public/own /athletes/[userId] page —
// getAthleteProfile() aggregates identity fields, teams, events, gallery
// media, game history, and the newer "extended profile" content (experience,
// education, achievements, interests, social links). isOwnProfile (computed
// by the page from session.user.id === userId) gates which mutating actions
// below make sense to call — every mutating action here is self-only by
// construction: each independently re-checks the session and writes only
// session.user.id's own row(s), never a passed-in target id.
// "mainSport"/"bio"/tagline/location/hometown/dateOfBirth/socialLinks/
// interests/user_media/athlete_experience(_role)/athlete_education/
// athlete_achievement are all bolted onto (or alongside) the base Better
// Auth "user" table via lazy DDL below rather than a separate profile table.

import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAthleteGameHistory, type AthleteGameHistoryItem } from "@/app/actions/game";

// ── lazy DDL ────────────────────────────────────────────────────────────────

let ensureProfileColumnsPromise: Promise<void> | null = null;
function ensureUserProfileColumns() {
  if (!ensureProfileColumnsPromise) {
    ensureProfileColumnsPromise = Promise.all([
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS bio TEXT`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mainSport" TEXT`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "coverImage" TEXT`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS tagline TEXT`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS location TEXT`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS hometown TEXT`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "socialLinks" JSONB DEFAULT '{}'`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}'`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "sportRoles" TEXT[] DEFAULT '{}'`),
      pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "secondarySports" TEXT[] DEFAULT '{}'`),
    ]).then(() => undefined);
  }
  return ensureProfileColumnsPromise;
}

let ensureUserMediaPromise: Promise<void> | null = null;
function ensureUserMediaTable() {
  if (!ensureUserMediaPromise) {
    ensureUserMediaPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS "user_media" (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          url TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'image',
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      .then(() => undefined);
  }
  return ensureUserMediaPromise;
}

let ensureAthleteExperiencePromise: Promise<void> | null = null;
function ensureAthleteExperienceTables() {
  if (!ensureAthleteExperiencePromise) {
    ensureAthleteExperiencePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS "athlete_experience" (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "orgName" TEXT NOT NULL,
          location TEXT,
          "sortOrder" INT DEFAULT 0,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      .then(() =>
        pool.query(`
          CREATE TABLE IF NOT EXISTS "athlete_experience_role" (
            id TEXT PRIMARY KEY,
            "experienceId" TEXT NOT NULL REFERENCES "athlete_experience"(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            "startDate" DATE,
            "endDate" DATE,
            "isCurrent" BOOLEAN DEFAULT FALSE,
            "sortOrder" INT DEFAULT 0
          )
        `)
      )
      .then(() => undefined);
  }
  return ensureAthleteExperiencePromise;
}

let ensureAthleteEducationPromise: Promise<void> | null = null;
function ensureAthleteEducationTable() {
  if (!ensureAthleteEducationPromise) {
    ensureAthleteEducationPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS "athlete_education" (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          institution TEXT NOT NULL,
          degree TEXT,
          sport TEXT,
          "startDate" DATE,
          "endDate" DATE,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      .then(() => undefined);
  }
  return ensureAthleteEducationPromise;
}

let ensureAthleteAchievementPromise: Promise<void> | null = null;
function ensureAthleteAchievementTable() {
  if (!ensureAthleteAchievementPromise) {
    ensureAthleteAchievementPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS "athlete_achievement" (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          title TEXT NOT NULL,
          "eventName" TEXT,
          "achievedAt" DATE,
          type TEXT NOT NULL DEFAULT 'trophy',
          verified BOOLEAN DEFAULT FALSE,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `)
      .then(() => undefined);
  }
  return ensureAthleteAchievementPromise;
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

// ── Public profile (athlete page) ───────────────────────────────────────────

export type AthleteUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  coverImage: string | null;
  createdAt: string;
  bio: string;
  mainSport: string | null;
  tagline: string;
  location: string;
  hometown: string;
  dateOfBirth: string | null;
  socialLinks: Record<string, string>;
  interests: string[];
  sportRoles: string[];
  secondarySports: string[];
};

export type AthleteTeam = {
  id: string;
  name: string;
  sport: string;
  location: string;
  logoUrl: string | null;
  isCaptain: boolean;
};

export type AthleteEvent = {
  id: string;
  title: string;
  sport: string;
  eventType: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  coverImageUrl: string | null;
  role: "organizer" | "participant";
  status: "active" | "cancelled";
};

export type UserMediaItem = {
  id: string;
  url: string;
  type: string;
};

export type AthleteExperienceRole = {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  sortOrder: number;
};

export type AthleteExperience = {
  id: string;
  orgName: string;
  location: string | null;
  sortOrder: number;
  roles: AthleteExperienceRole[];
};

export type AthleteEducation = {
  id: string;
  institution: string;
  degree: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type AthleteAchievement = {
  id: string;
  title: string;
  eventName: string | null;
  achievedAt: string | null;
  type: string;
  verified: boolean;
};

export type AthleteProfile = {
  user: AthleteUser;
  teams: AthleteTeam[];
  events: AthleteEvent[];
  sports: string[];
  media: UserMediaItem[];
  games: AthleteGameHistoryItem[];
  experience: AthleteExperience[];
  education: AthleteEducation[];
  achievements: AthleteAchievement[];
};

const toDateOnly = (v: Date | string | null) => (v ? new Date(v).toISOString().slice(0, 10) : null);

export async function getAthleteProfile(userId: string): Promise<AthleteProfile | null> {
  await Promise.all([
    ensureUserProfileColumns(),
    ensureUserMediaTable(),
    ensureAthleteExperienceTables(),
    ensureAthleteEducationTable(),
    ensureAthleteAchievementTable(),
  ]);

  const [
    userResult,
    teamsResult,
    eventsResult,
    mediaResult,
    experienceResult,
    roleResult,
    educationResult,
    achievementResult,
    games,
  ] = await Promise.all([
    pool.query(
      `SELECT id, name, email, image, "coverImage", "createdAt", COALESCE(bio, '') AS bio, "mainSport",
              COALESCE(tagline, '') AS tagline, COALESCE(location, '') AS location,
              COALESCE(hometown, '') AS hometown, "dateOfBirth",
              COALESCE("socialLinks", '{}'::jsonb) AS "socialLinks",
              COALESCE(interests, '{}') AS interests,
              COALESCE("sportRoles", '{}') AS "sportRoles",
              COALESCE("secondarySports", '{}') AS "secondarySports"
       FROM "user" WHERE id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT t.id, t.name, t.sport, t.location, t."logoUrl",
              (t."captainId" = $1) AS "isCaptain"
       FROM "team" t
       JOIN "team_member" tm ON tm."teamId" = t.id
       WHERE tm."userId" = $1
       ORDER BY "isCaptain" DESC, tm."joinedAt" ASC`,
      [userId]
    ),
    pool.query(
      `SELECT e.id, e.title, e.sport, e."eventType", e.location,
              e."startDateTime", e."endDateTime", e."coverImageUrl", e.status,
              CASE WHEN e."organizerId" = $1 THEN 'organizer' ELSE 'participant' END AS role
       FROM "event" e
       WHERE e."organizerId" = $1
          OR e.id IN (SELECT "eventId" FROM "event_participant" WHERE "userId" = $1)
       ORDER BY e."startDateTime" DESC`,
      [userId]
    ),
    pool.query(
      `SELECT id, url, type FROM "user_media" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId]
    ),
    pool.query(
      `SELECT id, "orgName", location, "sortOrder" FROM "athlete_experience"
       WHERE "userId" = $1 ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      [userId]
    ),
    pool.query(
      `SELECT r.id, r."experienceId", r.title, r."startDate", r."endDate", r."isCurrent", r."sortOrder"
       FROM "athlete_experience_role" r
       JOIN "athlete_experience" e ON e.id = r."experienceId"
       WHERE e."userId" = $1
       ORDER BY r."sortOrder" ASC`,
      [userId]
    ),
    pool.query(
      `SELECT id, institution, degree, "startDate", "endDate" FROM "athlete_education"
       WHERE "userId" = $1 ORDER BY "startDate" DESC NULLS LAST, "createdAt" DESC`,
      [userId]
    ),
    pool.query(
      `SELECT id, title, "eventName", "achievedAt", type, verified FROM "athlete_achievement"
       WHERE "userId" = $1 ORDER BY "achievedAt" DESC NULLS LAST, "createdAt" DESC`,
      [userId]
    ),
    getAthleteGameHistory(userId),
  ]);

  if (!userResult.rows[0]) return null;

  const user = userResult.rows[0];
  const teams: AthleteTeam[] = teamsResult.rows.map((r: AthleteTeam & { isCaptain: boolean }) => ({
    id: r.id,
    name: r.name,
    sport: r.sport,
    location: r.location,
    logoUrl: r.logoUrl,
    isCaptain: Boolean(r.isCaptain),
  }));

  const events: AthleteEvent[] = eventsResult.rows.map(
    (r: AthleteEvent & { startDateTime: Date | string; endDateTime: Date | string }) => ({
      id: r.id,
      title: r.title,
      sport: r.sport,
      eventType: r.eventType,
      location: r.location,
      startDateTime: new Date(r.startDateTime).toISOString(),
      endDateTime: new Date(r.endDateTime).toISOString(),
      coverImageUrl: r.coverImageUrl,
      role: r.role as "organizer" | "participant",
      status: r.status,
    })
  );

  const sports = [...new Set([...teams.map((t) => t.sport), ...events.map((e) => e.sport)])];

  const rolesByExperience = new Map<string, AthleteExperienceRole[]>();
  for (const r of roleResult.rows as (AthleteExperienceRole & { experienceId: string })[]) {
    const list = rolesByExperience.get(r.experienceId) ?? [];
    list.push({
      id: r.id,
      title: r.title,
      startDate: toDateOnly(r.startDate as unknown as string | Date | null),
      endDate: toDateOnly(r.endDate as unknown as string | Date | null),
      isCurrent: Boolean(r.isCurrent),
      sortOrder: r.sortOrder,
    });
    rolesByExperience.set(r.experienceId, list);
  }

  const experience: AthleteExperience[] = experienceResult.rows.map(
    (r: { id: string; orgName: string; location: string | null; sortOrder: number }) => ({
      id: r.id,
      orgName: r.orgName,
      location: r.location,
      sortOrder: r.sortOrder,
      roles: rolesByExperience.get(r.id) ?? [],
    })
  );

  const education: AthleteEducation[] = educationResult.rows.map(
    (r: {
      id: string;
      institution: string;
      degree: string | null;
      startDate: Date | string | null;
      endDate: Date | string | null;
    }) => ({
      id: r.id,
      institution: r.institution,
      degree: r.degree,
      startDate: toDateOnly(r.startDate),
      endDate: toDateOnly(r.endDate),
    })
  );

  const achievements: AthleteAchievement[] = achievementResult.rows.map(
    (r: {
      id: string;
      title: string;
      eventName: string | null;
      achievedAt: Date | string | null;
      type: string;
      verified: boolean;
    }) => ({
      id: r.id,
      title: r.title,
      eventName: r.eventName,
      achievedAt: toDateOnly(r.achievedAt),
      type: r.type,
      verified: Boolean(r.verified),
    })
  );

  return {
    user: {
      ...user,
      createdAt: new Date(user.createdAt).toISOString(),
      image: user.image ?? null,
      coverImage: user.coverImage ?? null,
      bio: user.bio ?? "",
      mainSport: user.mainSport ?? null,
      tagline: user.tagline ?? "",
      location: user.location ?? "",
      hometown: user.hometown ?? "",
      dateOfBirth: toDateOnly(user.dateOfBirth),
      socialLinks: (user.socialLinks ?? {}) as Record<string, string>,
      interests: (user.interests ?? []) as string[],
      sportRoles: (user.sportRoles ?? []) as string[],
      secondarySports: (user.secondarySports ?? []) as string[],
    },
    teams,
    events,
    sports,
    media: mediaResult.rows as UserMediaItem[],
    games,
    experience,
    education,
    achievements,
  };
}

// ── Core identity + media (unchanged behavior, reused as-is) ───────────────

export async function updateUserProfile(data: {
  name: string;
  bio: string;
  mainSport: string | null;
  imageUrl?: string;
  // Optional and left untouched (via COALESCE) when omitted, since most
  // callers (avatar upload, name edit, bio edit) don't carry this field —
  // only the Edit Profile modal, which owns it, passes it explicitly.
  secondarySports?: string[];
}): Promise<void> {
  await ensureUserProfileColumns();
  const session = await requireSession();
  const secondarySports = data.secondarySports ?? null;

  if (data.imageUrl) {
    await pool.query(
      `UPDATE "user" SET name = $1, bio = $2, "mainSport" = $3, image = $4,
              "secondarySports" = COALESCE($5, "secondarySports"), "updatedAt" = NOW() WHERE id = $6`,
      [data.name, data.bio, data.mainSport, data.imageUrl, secondarySports, session.user.id]
    );
  } else {
    await pool.query(
      `UPDATE "user" SET name = $1, bio = $2, "mainSport" = $3,
              "secondarySports" = COALESCE($4, "secondarySports"), "updatedAt" = NOW() WHERE id = $5`,
      [data.name, data.bio, data.mainSport, secondarySports, session.user.id]
    );
  }
}

export async function addUserMedia(items: { url: string; type: string }[]): Promise<UserMediaItem[]> {
  await ensureUserMediaTable();
  const session = await requireSession();

  const results: UserMediaItem[] = [];
  for (const item of items) {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "user_media" (id, "userId", url, type) VALUES ($1, $2, $3, $4)`,
      [id, session.user.id, item.url, item.type]
    );
    results.push({ id, url: item.url, type: item.type });
  }
  return results;
}

export async function deleteUserMedia(id: string): Promise<void> {
  const session = await requireSession();
  await pool.query(
    `DELETE FROM "user_media" WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
}

// ── Extended profile fields ──────────────────────────────────────────────

export async function updateAthleteExtendedProfile(data: {
  tagline: string;
  location: string;
  hometown: string;
  socialLinks: Record<string, string>;
  interests: string[];
  sportRoles?: string[];
}): Promise<void> {
  await ensureUserProfileColumns();
  const session = await requireSession();
  await pool.query(
    `UPDATE "user" SET tagline = $1, location = $2, hometown = $3, "socialLinks" = $4, interests = $5, "sportRoles" = $6, "updatedAt" = NOW()
     WHERE id = $7`,
    [
      data.tagline,
      data.location,
      data.hometown,
      JSON.stringify(data.socialLinks ?? {}),
      data.interests ?? [],
      data.sportRoles ?? [],
      session.user.id,
    ]
  );
}

// Kept separate from updateAthleteExtendedProfile — privacy-sensitive, only
// ever invoked from the DOB card, which only renders when isOwnProfile. The
// action itself needs no extra ownership check beyond the session-id-only
// write pattern already used everywhere else in this file, since it can only
// ever write session.user.id's own row.
export async function updateAthleteDateOfBirth(dateOfBirth: string | null): Promise<void> {
  await ensureUserProfileColumns();
  const session = await requireSession();
  await pool.query(
    `UPDATE "user" SET "dateOfBirth" = $1, "updatedAt" = NOW() WHERE id = $2`,
    [dateOfBirth, session.user.id]
  );
}

export async function updateAthleteCoverImage(coverImage: string): Promise<void> {
  await ensureUserProfileColumns();
  const session = await requireSession();
  await pool.query(
    `UPDATE "user" SET "coverImage" = $1, "updatedAt" = NOW() WHERE id = $2`,
    [coverImage, session.user.id]
  );
}

// ── Experience ("My Journey") + nested roles ────────────────────────────────

export async function addExperience(data: { orgName: string; location: string | null }): Promise<{ id: string }> {
  await ensureAthleteExperienceTables();
  const session = await requireSession();
  const id = crypto.randomUUID();
  const nextOrder = await pool.query(
    `SELECT COALESCE(MAX("sortOrder"), -1) + 1 AS next FROM "athlete_experience" WHERE "userId" = $1`,
    [session.user.id]
  );
  await pool.query(
    `INSERT INTO "athlete_experience" (id, "userId", "orgName", location, "sortOrder") VALUES ($1, $2, $3, $4, $5)`,
    [id, session.user.id, data.orgName, data.location, nextOrder.rows[0].next]
  );
  return { id };
}

export async function updateExperience(id: string, data: { orgName: string; location: string | null }): Promise<void> {
  await ensureAthleteExperienceTables();
  const session = await requireSession();
  await pool.query(
    `UPDATE "athlete_experience" SET "orgName" = $1, location = $2 WHERE id = $3 AND "userId" = $4`,
    [data.orgName, data.location, id, session.user.id]
  );
}

export async function deleteExperience(id: string): Promise<void> {
  await ensureAthleteExperienceTables();
  const session = await requireSession();
  await pool.query(`DELETE FROM "athlete_experience" WHERE id = $1 AND "userId" = $2`, [id, session.user.id]);
}

export async function addExperienceRole(
  experienceId: string,
  data: { title: string; startDate: string | null; endDate: string | null; isCurrent: boolean }
): Promise<void> {
  await ensureAthleteExperienceTables();
  const session = await requireSession();

  const owns = await pool.query(
    `SELECT 1 FROM "athlete_experience" WHERE id = $1 AND "userId" = $2`,
    [experienceId, session.user.id]
  );
  if (!owns.rows[0]) throw new Error("Unauthorized");

  const id = crypto.randomUUID();
  const nextOrder = await pool.query(
    `SELECT COALESCE(MAX("sortOrder"), -1) + 1 AS next FROM "athlete_experience_role" WHERE "experienceId" = $1`,
    [experienceId]
  );
  await pool.query(
    `INSERT INTO "athlete_experience_role" (id, "experienceId", title, "startDate", "endDate", "isCurrent", "sortOrder")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, experienceId, data.title, data.startDate, data.endDate, data.isCurrent, nextOrder.rows[0].next]
  );
}

export async function updateExperienceRole(
  id: string,
  data: { title: string; startDate: string | null; endDate: string | null; isCurrent: boolean }
): Promise<void> {
  await ensureAthleteExperienceTables();
  const session = await requireSession();
  await pool.query(
    `UPDATE "athlete_experience_role" AS r
     SET title = $1, "startDate" = $2, "endDate" = $3, "isCurrent" = $4
     FROM "athlete_experience" AS e
     WHERE r.id = $5 AND r."experienceId" = e.id AND e."userId" = $6`,
    [data.title, data.startDate, data.endDate, data.isCurrent, id, session.user.id]
  );
}

export async function deleteExperienceRole(id: string): Promise<void> {
  await ensureAthleteExperienceTables();
  const session = await requireSession();
  await pool.query(
    `DELETE FROM "athlete_experience_role" AS r
     USING "athlete_experience" AS e
     WHERE r.id = $1 AND r."experienceId" = e.id AND e."userId" = $2`,
    [id, session.user.id]
  );
}

// ── Education ───────────────────────────────────────────────────────────────

export async function addEducation(data: {
  institution: string;
  degree: string | null;
  startDate: string | null;
  endDate: string | null;
}): Promise<void> {
  await ensureAthleteEducationTable();
  const session = await requireSession();
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "athlete_education" (id, "userId", institution, degree, "startDate", "endDate")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, session.user.id, data.institution, data.degree, data.startDate, data.endDate]
  );
}

export async function updateEducation(
  id: string,
  data: { institution: string; degree: string | null; startDate: string | null; endDate: string | null }
): Promise<void> {
  await ensureAthleteEducationTable();
  const session = await requireSession();
  await pool.query(
    `UPDATE "athlete_education" SET institution = $1, degree = $2, "startDate" = $3, "endDate" = $4
     WHERE id = $5 AND "userId" = $6`,
    [data.institution, data.degree, data.startDate, data.endDate, id, session.user.id]
  );
}

export async function deleteEducation(id: string): Promise<void> {
  await ensureAthleteEducationTable();
  const session = await requireSession();
  await pool.query(`DELETE FROM "athlete_education" WHERE id = $1 AND "userId" = $2`, [id, session.user.id]);
}

// ── Achievements ─────────────────────────────────────────────────────────────

export async function addAchievement(data: {
  title: string;
  eventName: string | null;
  achievedAt: string | null;
  type: string;
}): Promise<void> {
  await ensureAthleteAchievementTable();
  const session = await requireSession();
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "athlete_achievement" (id, "userId", title, "eventName", "achievedAt", type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, session.user.id, data.title, data.eventName, data.achievedAt, data.type]
  );
}

export async function updateAchievement(
  id: string,
  data: { title: string; eventName: string | null; achievedAt: string | null; type: string }
): Promise<void> {
  await ensureAthleteAchievementTable();
  const session = await requireSession();
  await pool.query(
    `UPDATE "athlete_achievement" SET title = $1, "eventName" = $2, "achievedAt" = $3, type = $4
     WHERE id = $5 AND "userId" = $6`,
    [data.title, data.eventName, data.achievedAt, data.type, id, session.user.id]
  );
}

export async function deleteAchievement(id: string): Promise<void> {
  await ensureAthleteAchievementTable();
  const session = await requireSession();
  await pool.query(`DELETE FROM "athlete_achievement" WHERE id = $1 AND "userId" = $2`, [id, session.user.id]);
}
