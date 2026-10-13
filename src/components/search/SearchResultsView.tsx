"use client";

// Body of the /search page: a search box (submits back to /search), tabs
// per result type, and the grouped results.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import type { SearchResults, SearchType } from "@/lib/search";
import { flattenResults, ResultLink, SearchIcon } from "@/components/search/search-ui";

export default function SearchResultsView({
  query,
  type,
  results,
}: {
  query: string;
  type: SearchType | null;
  results: SearchResults | null;
}) {
  const t = useTranslations("Search");
  const router = useRouter();
  const [value, setValue] = useState(query);

  const tabs: { key: SearchType | null; label: string }[] = [
    { key: null, label: t("tabAll") },
    { key: "athletes", label: t("groupAthletes") },
    { key: "organizations", label: t("groupOrganizations") },
    { key: "events", label: t("groupEvents") },
  ];
  const groups: { key: SearchType; label: string }[] = [
    { key: "athletes", label: t("groupAthletes") },
    { key: "organizations", label: t("groupOrganizations") },
    { key: "events", label: t("groupEvents") },
  ];
  const flat = results ? flattenResults(results) : [];

  function href(key: SearchType | null) {
    const params = new URLSearchParams({ q: query });
    if (key) params.set("type", key);
    return `/search?${params.toString()}`;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-extrabold text-zinc-900 mb-6" style={{ fontFamily: "var(--font-playfair)" }}>
        {query ? t("pageResultsFor", { q: query }) : t("pageTitle")}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams({ q: value.trim() });
          if (type) params.set("type", type);
          router.push(`/search?${params.toString()}`);
        }}
        className="flex items-center gap-3 h-12 px-4 rounded-xl border border-zinc-200 focus-within:border-zinc-400 bg-white mb-6"
      >
        <span className="text-zinc-400"><SearchIcon /></span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="flex-1 min-w-0 outline-none text-base bg-transparent"
          autoComplete="off"
        />
        <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#e21d12] text-white text-sm font-semibold hover:bg-[#d41810]">
          {t("button")}
        </button>
      </form>

      {query && (
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map(({ key, label }) => (
            <Link
              key={label}
              href={href(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${
                type === key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {!results ? (
        <p className="text-sm text-zinc-500">{query ? t("hint") : t("pageEmpty")}</p>
      ) : flat.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("noResults", { q: query })}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ key, label }) => {
            const items = flat.filter((f) => f.kind === key);
            if (!items.length) return null;
            return (
              <section key={key}>
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 mb-2">{label}</h2>
                <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                  {items.map((item) => (
                    <ResultLink key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
