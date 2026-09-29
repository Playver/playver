"use client";

// Client-side search/filter UI for the public /events (and /tournaments,
// via linkTo="tournaments") list — all filtering happens in-browser over
// the full `events` array passed in, no server round-trip per keystroke.
// Also tracks "recently viewed" event IDs in localStorage (RECENT_KEY).
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import EventCard from "@/components/events/EventCard";
import EventListRow from "@/components/events/EventListRow";
import type { EventItem } from "@/app/actions/event";

type EventType = "all" | "league" | "tournament" | "activity" | "tryouts" | "camps" | "community" | "galas";
type Sport =
  | "all" | "soccer" | "basketball" | "volleyball" | "pickleball"
  | "tennis" | "hockey" | "baseball" | "cricket" | "rugby" | "other";
type SortBy = "featured" | "date" | "popular";
type ViewMode = "grid" | "list";

const RECENT_KEY = "playver:recent-events";

function eventMatchesType(eventType: string, activeType: EventType) {
  if (activeType === "all") return true;
  const normalized = eventType.toLowerCase();
  if (activeType === "activity") return normalized.includes("activity") || normalized.includes("training") || normalized.includes("practice");
  return normalized.includes(activeType);
}

export default function DiscoverSearch({
  events,
  hideTypeFilter = false,
  linkTo = "events",
  showSearchBar = true,
  showSortDropdown = true,
  showFilterRow = true,
  showViewToggle = true,
  showPagination = true,
  initialUpcomingOnly = false,
  initialLocation = "",
  sectionTitle,
  showCta = false,
  // /events and /tournaments render this right below Navbar with no other
  // top spacing of their own, so it needs its own mt-10. The home feed's
  // compact mode sits inside HomeFeedShell's top bar (which already has its
  // own vertical padding), so the two stack into an oversized gap — callers
  // with their own spacing pass "" here instead.
  topMarginClassName = "mt-10",
}: {
  events: EventItem[];
  currentUserId: string | null;
  joinedEventIds: string[];
  hideTypeFilter?: boolean;
  linkTo?: "events" | "tournaments";
  // Visibility props — all default to true so existing callers (/events,
  // /tournaments, the home feed's "Events" tab via EventsDiscoverContent) are
  // unaffected. The homepage's compact "Happening Soon" grid turns most of
  // these off to show just the location/search row + category-pill row +
  // grid. showFilterRow (sport dropdown + upcoming-only toggle) and
  // initialUpcomingOnly/initialLocation/sectionTitle/showCta are additive
  // beyond the literal spec, added to actually achieve a minimal-chrome
  // compact mode.
  showSearchBar?: boolean;
  showSortDropdown?: boolean;
  showFilterRow?: boolean;
  showViewToggle?: boolean;
  showPagination?: boolean;
  initialUpcomingOnly?: boolean;
  initialLocation?: string;
  sectionTitle?: string;
  showCta?: boolean;
  topMarginClassName?: string;
}) {
  const t = useTranslations("Discover");

  const [search, setSearch] = useState("");
  const [location, setLocation] = useState(initialLocation);
  const [activeType, setActiveType] = useState<EventType>("all");
  const [sport, setSport] = useState<Sport>("all");
  const [upcomingOnly, setUpcomingOnly] = useState(initialUpcomingOnly);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      if (Array.isArray(stored) && stored.length > 0) setRecentIds(stored);
    } catch {
      // ignore corrupt data
    }
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, location, activeType, sport, upcomingOnly, sortBy]);

  const eventTypes: { key: EventType; label: string }[] = [
    { key: "all", label: t("typeAll") },
    { key: "tournament", label: t("typeTournament") },
    { key: "league", label: t("typeLeague") },
    { key: "activity", label: t("typeActivity") },
    { key: "tryouts", label: t("typeTryouts") },
    { key: "camps", label: t("typeCamps") },
    { key: "community", label: t("typeCommunity") },
    { key: "galas", label: t("typeGalas") },
  ];

  const sports: { key: Sport; label: string }[] = [
    { key: "all", label: t("sportAll") },
    { key: "soccer", label: t("sportSoccer") },
    { key: "basketball", label: t("sportBasketball") },
    { key: "volleyball", label: t("sportVolleyball") },
    { key: "pickleball", label: t("sportPickleball") },
    { key: "tennis", label: t("sportTennis") },
    { key: "hockey", label: t("sportHockey") },
    { key: "baseball", label: t("sportBaseball") },
    { key: "cricket", label: t("sportCricket") },
    { key: "rugby", label: t("sportRugby") },
    { key: "other", label: t("sportOther") },
  ];

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSearch = !query || [
        event.title,
        event.sport,
        event.eventType,
        event.location,
        event.description ?? "",
        event.organizerName,
      ].some((value) => value.toLowerCase().includes(query));
      const matchesSport = sport === "all" || event.sport.toLowerCase() === sport;
      const matchesUpcoming = !upcomingOnly || new Date(event.startDateTime) >= new Date();
      return matchesSearch && matchesSport && matchesUpcoming && eventMatchesType(event.eventType, activeType);
    });
    // Note: the location input above is intentionally decorative for now —
    // it's not applied as a filter (see the user-facing decision to drop
    // location filtering rather than fight free-form location text; the
    // field stays visible/typeable, just inert, until a real location
    // feature is scoped).
  }, [activeType, events, search, sport, upcomingOnly]);

  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents];
    if (sortBy === "date") {
      list.sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
    } else if (sortBy === "popular") {
      list.sort((a, b) => b.participantCount - a.participantCount);
    }
    // "featured" keeps the server's default order (upcoming-soonest-first)
    return list;
  }, [filteredEvents, sortBy]);

  const recentlyViewed = recentIds
    .map((id) => events.find((event) => event.id === id))
    .filter((event): event is EventItem => Boolean(event));

  function rememberEvent(event: EventItem) {
    const next = [event.id, ...recentIds.filter((id) => id !== event.id)].slice(0, 4);
    setRecentIds(next);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  const PAGE_SIZE = 6;
  const hasActiveSearch = search.trim() || location.trim() || activeType !== "all" || sport !== "all" || upcomingOnly;
  const joinedLabel = (event: EventItem) => {
    if (event.eventType === "Tournament") {
      return event.capacity
        ? `${event.participantCount} / ${event.capacity} teams`
        : `${event.participantCount} team${event.participantCount !== 1 ? "s" : ""}`;
    }
    return event.capacity
      ? t("joinedProgress", { joined: event.participantCount, capacity: event.capacity })
      : t("joinedCount", { count: event.participantCount });
  };
  const totalPages = Math.ceil(sortedEvents.length / PAGE_SIZE);
  const visibleEvents = sortedEvents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={`${topMarginClassName} flex flex-col gap-8`}>
      <form onSubmit={(event) => event.preventDefault()} className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 flex flex-col gap-4">
        {(showSearchBar || showSortDropdown) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {showSearchBar && (
              <div className="relative sm:w-48 shrink-0">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("locationPlaceholder")}
                  className="w-full pl-11 pr-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400 text-zinc-800"
                />
              </div>
            )}

            {showSearchBar && (
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full pl-11 pr-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400 text-zinc-800"
                />
              </div>
            )}

            {showSortDropdown && (
              <div className="relative sm:w-48 shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full appearance-none pl-4 pr-9 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-700 outline-none focus:ring-2 focus:ring-red-200 cursor-pointer hover:border-zinc-400 transition-colors"
                >
                  <option value="featured">{t("sortFeatured")}</option>
                  <option value="date">{t("sortDate")}</option>
                  <option value="popular">{t("sortPopular")}</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>
            )}
          </div>
        )}

        {!hideTypeFilter && (
          <div className="flex flex-wrap gap-2">
            {eventTypes.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveType(key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  activeType === key
                    ? "bg-[#e21d12] text-white border-[#e21d12]"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {showFilterRow && (
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-zinc-100">
            <div className="relative">
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as Sport)}
                className="appearance-none pl-4 pr-9 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-700 outline-none focus:ring-2 focus:ring-red-200 cursor-pointer hover:border-zinc-400 transition-colors"
              >
                {sports.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setUpcomingOnly((value) => !value)}
                className={`relative w-10 h-5 rounded-full transition-colors ${upcomingOnly ? "bg-[#e21d12]" : "bg-zinc-200"}`}
                aria-pressed={upcomingOnly}
              >
                <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${upcomingOnly ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm text-zinc-600 font-medium">{t("upcomingOnly")}</span>
            </label>
          </div>
        )}

        {showViewToggle && (
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
            <p className="text-sm text-zinc-500">{t("eventsFound", { count: sortedEvents.length })}</p>
            <div className="flex items-center rounded-full border border-zinc-200 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  viewMode === "grid" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {t("gridView")}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  viewMode === "list" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {t("listView")}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Recently Viewed — commented out for now
      {recentlyViewed.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-zinc-700 mb-4">{t("recentlyViewed")}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {recentlyViewed.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                freeLabel={t("free")}
                endedLabel={t("eventEnded")}
                joinedLabel={joinedLabel(event)}
                organizerLabel={t("organizedBy")}
                href={`/${linkTo}/${event.id}`}
                onViewed={rememberEvent}
              />
            ))}
          </div>
        </section>
      )}
      */}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-zinc-700">
            {sectionTitle ?? (hasActiveSearch ? t("searchResults") : t("popularEvents"))}
          </h2>
          {showPagination && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="text-sm text-zinc-500 font-medium tabular-nums">{page + 1} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages - 1}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <span className="text-5xl">🔍</span>
            <p className="text-zinc-500 text-base">{t("noEvents")}</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                freeLabel={t("free")}
                endedLabel={t("eventEnded")}
                joinedLabel={joinedLabel(event)}
                organizerLabel={t("organizedBy")}
                todayLabel={t("todayBadge")}
                tomorrowLabel={t("tomorrowBadge")}
                href={`/${linkTo}/${event.id}`}
                onViewed={rememberEvent}
                ctaLabel={showCta ? (event.price > 0 ? t("ctaRegister") : t("ctaRsvp")) : undefined}
                ctaHref={showCta ? `/${linkTo}/${event.id}` : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleEvents.map((event) => (
              <EventListRow
                key={event.id}
                event={event}
                freeLabel={t("free")}
                endedLabel={t("eventEnded")}
                joinedLabel={joinedLabel(event)}
                organizerLabel={t("organizedBy")}
                todayLabel={t("todayBadge")}
                tomorrowLabel={t("tomorrowBadge")}
                href={`/${linkTo}/${event.id}`}
                onViewed={rememberEvent}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
