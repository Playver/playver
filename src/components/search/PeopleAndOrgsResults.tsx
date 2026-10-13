"use client";

// Athletes + organizations matching an events-page search box query, shown
// above the (client-filtered) event results so every search on the site
// covers people and organizations too, not only events.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { SearchResults } from "@/lib/search";
import { flattenResults, ResultLink, type FlatResult } from "@/components/search/search-ui";
import { Link } from "@/i18n/routing";

export default function PeopleAndOrgsResults({ query }: { query: string }) {
  const t = useTranslations("Search");
  // Results are tagged with the query they belong to, so stale ones from an
  // earlier query are never shown.
  const [found, setFound] = useState<{ q: string; items: FlatResult[] }>({ q: "", items: [] });
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?types=athletes,organizations&q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as SearchResults;
        setFound({ q, items: flattenResults(data) });
      } catch {
        // Aborted or offline — the event results below still work.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const items = found.q === q ? found.items : [];
  if (q.length < 2 || items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">{t("peopleAndOrgs")}</h2>
        <Link href={`/search?q=${encodeURIComponent(q)}`} className="text-xs font-semibold text-[#e21d12] hover:underline">
          {t("seeAll", { q })}
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 rounded-xl border border-zinc-200 overflow-hidden divide-y sm:divide-y-0 divide-zinc-100 bg-white">
        {items.slice(0, 6).map((item) => (
          <ResultLink key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}
