// Full search results (/search?q=...&type=...): the "See all results" target
// of the site-wide search window. Server-rendered from the same search()
// as the window, with more results per group and a tab per type.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LoggedInPageShell from "@/components/layout/LoggedInPageShell";
import SearchResultsView from "@/components/search/SearchResultsView";
import { auth } from "@/lib/auth";
import { search, normalizeQuery, SEARCH_MIN_LENGTH, type SearchType } from "@/lib/search";
import { getUserOrganizations } from "@/app/actions/organization";

const TYPES: SearchType[] = ["athletes", "organizations", "events"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Search");
  return { title: t("pageTitle"), robots: { index: false } };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const params = await searchParams;
  const q = normalizeQuery(params.q);
  const type = TYPES.includes(params.type as SearchType) ? (params.type as SearchType) : null;
  const [results, session] = await Promise.all([
    q.length >= SEARCH_MIN_LENGTH ? search(q, { limit: type ? 50 : 20, types: type ? [type] : TYPES }) : null,
    auth.api.getSession({ headers: await headers() }),
  ]);

  const body = <SearchResultsView query={q} type={type} results={results} />;

  if (session) {
    const viewerOrganizations = await getUserOrganizations();
    return (
      <LoggedInPageShell
        user={{ id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }}
        hasOrganization={viewerOrganizations.some((org) => org.publicationStatus === "published")}
      >
        {body}
      </LoggedInPageShell>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">{body}</main>
      <Footer />
    </>
  );
}
