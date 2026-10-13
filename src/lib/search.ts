// Site-wide search across athletes, organizations and events — used by the
// search window (via /api/search) and the /search results page. Plain
// ILIKE matching on the main name fields (no trigram/full-text index yet;
// fine at Playver's current size). Events go through the same staging
// visibility rules as every other event list.
import { pool } from "@/lib/db";
import { eventVisibilitySql, getEventViewer } from "@/lib/event-visibility";

export type SearchAthlete = { id: string; name: string; image: string | null; mainSport: string | null; location: string | null };
export type SearchOrganization = { id: string; slug: string; name: string; logoUrl: string | null; city: string | null; sports: string[] };
export type SearchEvent = {
  id: string;
  title: string;
  sport: string | null;
  location: string | null;
  startDateTime: string;
  coverImageUrl: string | null;
  isTeamEvent: boolean;
  organizerName: string | null;
  upcoming: boolean;
};
export type SearchResults = { athletes: SearchAthlete[]; organizations: SearchOrganization[]; events: SearchEvent[] };
export type SearchType = keyof SearchResults;

export const SEARCH_MIN_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

// Escapes LIKE wildcards so "100%" or "a_b" match literally.
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function normalizeQuery(raw: string | null | undefined) {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

export async function search(
  rawQuery: string,
  { limit = 5, types = ["athletes", "organizations", "events"] }: { limit?: number; types?: SearchType[] } = {}
): Promise<SearchResults> {
  const q = normalizeQuery(rawQuery);
  const empty: SearchResults = { athletes: [], organizations: [], events: [] };
  if (q.length < SEARCH_MIN_LENGTH) return empty;
  const pattern = likePattern(q);
  // Exact/prefix matches rank above matches in the middle of a word.
  const prefix = `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const [athletes, organizations, events] = await Promise.all([
    types.includes("athletes")
      ? pool.query(
          `SELECT id, name, image, "mainSport", location FROM "user"
           WHERE name ILIKE $1
           ORDER BY (name ILIKE $2) DESC, name ASC
           LIMIT $3`,
          [pattern, prefix, limit]
        )
      : null,
    types.includes("organizations")
      ? pool.query(
          `SELECT id, slug, name, "logoUrl", city, sports FROM "organization"
           WHERE "publicationStatus" = 'published'
             AND (name ILIKE $1 OR slug ILIKE $1 OR city ILIKE $1 OR array_to_string(sports, ' ') ILIKE $1)
           ORDER BY (name ILIKE $2) DESC, name ASC
           LIMIT $3`,
          [pattern, prefix, limit]
        )
      : null,
    types.includes("events") ? searchEvents(pattern, prefix, limit) : null,
  ]);

  return {
    athletes: (athletes?.rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      image: r.image ?? null,
      mainSport: r.mainSport ?? null,
      location: r.location ?? null,
    })),
    organizations: (organizations?.rows ?? []).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      logoUrl: r.logoUrl ?? null,
      city: r.city ?? null,
      sports: r.sports ?? [],
    })),
    events: events ?? [],
  };
}

async function searchEvents(pattern: string, prefix: string, limit: number): Promise<SearchEvent[]> {
  const viewer = await getEventViewer();
  const params: unknown[] = [pattern, prefix, limit];
  const visible = eventVisibilitySql(viewer, "e", params);
  const res = await pool.query(
    `SELECT e.id, e.title, e.sport, e.location, e."startDateTime", e."coverImageUrl", e."registrationMode",
       COALESCE(o.name, u.name) AS "organizerName",
       (e.status = 'active' AND e."endDateTime" >= NOW()) AS upcoming
     FROM "event" e
     JOIN "user" u ON u.id = e."organizerId"
     LEFT JOIN "organization" o ON o.id = e."organizationId"
     WHERE (e.title ILIKE $1 OR e.sport ILIKE $1 OR e.location ILIKE $1 OR o.name ILIKE $1)
       AND ${visible}
     ORDER BY upcoming DESC, (e.title ILIKE $2) DESC,
       CASE WHEN e.status = 'active' AND e."endDateTime" >= NOW() THEN e."startDateTime" END ASC NULLS LAST,
       e."startDateTime" DESC
     LIMIT $3`,
    params
  );
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    sport: r.sport ?? null,
    location: r.location ?? null,
    startDateTime: new Date(r.startDateTime).toISOString(),
    coverImageUrl: r.coverImageUrl ?? null,
    isTeamEvent: r.registrationMode === "team",
    organizerName: r.organizerName ?? null,
    upcoming: Boolean(r.upcoming),
  }));
}
