"use client";

// Shared pieces of the search UI — result rows, links, icon — used by the
// search window (GlobalSearch) and the /search results page.
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { SearchAthlete, SearchEvent, SearchOrganization, SearchResults } from "@/lib/search";

export type FlatResult =
  | ({ kind: "athletes" } & SearchAthlete)
  | ({ kind: "organizations" } & SearchOrganization)
  | ({ kind: "events" } & SearchEvent);

export function flattenResults(r: SearchResults): FlatResult[] {
  return [
    ...r.athletes.map((a) => ({ kind: "athletes" as const, ...a })),
    ...r.organizations.map((o) => ({ kind: "organizations" as const, ...o })),
    ...r.events.map((e) => ({ kind: "events" as const, ...e })),
  ];
}

export function resultHref(item: FlatResult): string {
  if (item.kind === "athletes") return `/athletes/${item.id}`;
  if (item.kind === "organizations") return `/organizations/${item.slug}`;
  return `/events/${item.id}`;
}

export function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function Thumb({ src, label, rounded }: { src: string | null; label: string; rounded: "full" | "lg" }) {
  const shape = rounded === "full" ? "rounded-full" : "rounded-lg";
  if (src) {
    // unoptimized: avatars/logos can come from any host a user signed in with.
    return <Image src={src} alt="" width={40} height={40} unoptimized className={`w-10 h-10 ${shape} object-cover bg-zinc-100 shrink-0`} />;
  }
  return (
    <span className={`w-10 h-10 ${shape} bg-[#e21d12]/10 text-[#e21d12] flex items-center justify-center text-sm font-bold shrink-0`}>
      {label.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export function formatEventDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function resultTitle(item: FlatResult) {
  return item.kind === "events" ? item.title : item.name;
}

export function resultSubtitle(item: FlatResult, locale: string) {
  if (item.kind === "athletes") return [item.mainSport, item.location].filter(Boolean).join(" · ");
  if (item.kind === "organizations") return [item.city, item.sports.slice(0, 3).join(", ")].filter(Boolean).join(" · ");
  return [formatEventDate(item.startDateTime, locale), item.location, item.organizerName].filter(Boolean).join(" · ");
}

function Badges({ item }: { item: FlatResult }) {
  const t = useTranslations("Search");
  if (item.kind !== "events") return null;
  return (
    <>
      {item.isTeamEvent && (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700">{t("badgeTournament")}</span>
      )}
      {!item.upcoming && (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 text-zinc-500">{t("badgePast")}</span>
      )}
    </>
  );
}

function thumbOf(item: FlatResult) {
  return item.kind === "athletes" ? item.image : item.kind === "organizations" ? item.logoUrl : item.coverImageUrl;
}

// A result as a real link — for the /search page, where rows should be
// openable in a new tab.
export function ResultLink({ item }: { item: FlatResult }) {
  const locale = useLocale();
  const title = resultTitle(item);
  const subtitle = resultSubtitle(item, locale);
  return (
    <Link href={resultHref(item)} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors">
      <Thumb src={thumbOf(item)} label={title} rounded={item.kind === "athletes" ? "full" : "lg"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900 truncate">{title}</span>
          <Badges item={item} />
        </span>
        {subtitle && <span className="block text-xs text-zinc-500 truncate">{subtitle}</span>}
      </span>
    </Link>
  );
}

export function ResultRow({
  id,
  dataIndex,
  item,
  active,
  locale,
  onHover,
  onSelect,
}: {
  id?: string;
  dataIndex?: number;
  item: FlatResult;
  active: boolean;
  locale: string;
  onHover?: () => void;
  onSelect: () => void;
}) {
  const title = resultTitle(item);
  const subtitle = resultSubtitle(item, locale);

  return (
    <button
      type="button"
      id={id}
      data-index={dataIndex}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
    >
      <Thumb src={thumbOf(item)} label={title} rounded={item.kind === "athletes" ? "full" : "lg"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900 truncate">{title}</span>
          <Badges item={item} />
        </span>
        {subtitle && <span className="block text-xs text-zinc-500 truncate">{subtitle}</span>}
      </span>
    </button>
  );
}
