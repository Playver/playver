import { NextResponse } from "next/server";
import { search, type SearchType } from "@/lib/search";
import { stagingAuthOk } from "@/lib/staging-auth";

// Backs the site-wide search window (GlobalSearch). Public: athletes,
// published organizations and visible events are all public pages anyway.
// ?types=athletes,organizations limits which groups are searched (the
// /events page search box only adds people and organizations to its own
// event results).
const TYPES: SearchType[] = ["athletes", "organizations", "events"];

export async function GET(request: Request) {
  if (!stagingAuthOk(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const requested = (url.searchParams.get("types") ?? "").split(",").filter((t): t is SearchType => TYPES.includes(t as SearchType));
  const results = await search(q, { limit: 5, types: requested.length ? requested : TYPES });
  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
