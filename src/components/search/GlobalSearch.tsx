"use client";

// Site-wide search window: athletes, organizations and events in one box,
// grouped, with keyboard navigation. Mounted once in the locale layout and
// opened from anywhere via openGlobalSearch() (the Search buttons in
// Navbar, FeedSidebar, MobileLogoBar) or the ⌘K / Ctrl+K / "/" shortcuts.
// "See all results" goes to the full /search page.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { SearchResults } from "@/lib/search";
import { SearchIcon, resultHref, type FlatResult, flattenResults, ResultRow } from "@/components/search/search-ui";

const OPEN_EVENT = "playver:open-search";
const MIN_LENGTH = 2;

export function openGlobalSearch(initialQuery?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { q: initialQuery ?? "" } }));
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export default function GlobalSearch() {
  const t = useTranslations("Search");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Tagged with the query they answer, so a stale response (or one for a
  // query that's since been cleared) is never shown.
  const [answer, setAnswer] = useState<{ q: string; results: SearchResults } | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setAnswer(null);
    setActive(0);
  }, []);

  useEffect(() => {
    function onOpen(e: Event) {
      const q = (e as CustomEvent<{ q: string }>).detail?.q ?? "";
      setQuery(q);
      setOpen(true);
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Debounced fetch; aborted when the query changes.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setAnswer({ q, results: await res.json() });
        setActive(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setAnswer({ q, results: { athletes: [], organizations: [], events: [] } });
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const trimmed = query.trim();
  const results = trimmed.length >= MIN_LENGTH && answer?.q === trimmed ? answer.results : null;
  const loading = trimmed.length >= MIN_LENGTH && !results;
  const flat = useMemo<FlatResult[]>(() => (results ? flattenResults(results) : []), [results]);
  // The last row is always "See all results" once there's a query.
  const rowCount = flat.length + (trimmed.length >= MIN_LENGTH ? 1 : 0);

  function go(index: number) {
    if (index === flat.length) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      const item = flat[index];
      if (!item) return;
      router.push(resultHref(item));
    }
    close();
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (rowCount ? (i + 1) % rowCount : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (rowCount ? (i - 1 + rowCount) % rowCount : 0));
    } else if (e.key === "Enter" && rowCount) {
      e.preventDefault();
      go(active);
    }
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const groups: { key: keyof SearchResults; label: string }[] = [
    { key: "athletes", label: t("groupAthletes") },
    { key: "organizations", label: t("groupOrganizations") },
    { key: "events", label: t("groupEvents") },
  ];
  let index = -1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-zinc-900/40 backdrop-blur-[2px] flex items-start justify-center sm:pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
    >
      <div className="w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[70vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-zinc-200 shrink-0">
          <span className="text-zinc-400"><SearchIcon /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={t("placeholder")}
            className="flex-1 min-w-0 text-base outline-none placeholder:text-zinc-400 bg-transparent"
            aria-label={t("placeholder")}
            role="combobox"
            aria-expanded={rowCount > 0}
            aria-controls="global-search-results"
            aria-activedescendant={rowCount ? `global-search-row-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="w-4 h-4 rounded-full border-2 border-zinc-200 border-t-[#e21d12] animate-spin" aria-hidden />}
          <button
            type="button"
            onClick={close}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded-md border border-zinc-200"
          >
            <span className="hidden sm:inline">Esc</span>
            <span className="sm:hidden">{t("close")}</span>
          </button>
        </div>

        <div ref={listRef} id="global-search-results" role="listbox" className="flex-1 overflow-y-auto py-2">
          {trimmed.length < MIN_LENGTH ? (
            <p className="px-4 py-8 text-sm text-zinc-500 text-center">{t("hint")}</p>
          ) : results && flat.length === 0 && !loading ? (
            <p className="px-4 py-8 text-sm text-zinc-500 text-center">{t("noResults", { q: trimmed })}</p>
          ) : (
            results &&
            groups.map(({ key, label }) => {
              const items = flat.filter((f) => f.kind === key);
              if (!items.length) return null;
              return (
                <div key={key} className="mb-1">
                  <p className="px-4 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">{label}</p>
                  {items.map((item) => {
                    index += 1;
                    const i = index;
                    return (
                      <ResultRow
                        key={`${item.kind}-${item.id}`}
                        id={`global-search-row-${i}`}
                        dataIndex={i}
                        item={item}
                        active={active === i}
                        locale={locale}
                        onHover={() => setActive(i)}
                        onSelect={() => go(i)}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
          {trimmed.length >= MIN_LENGTH && (
            <button
              type="button"
              id={`global-search-row-${flat.length}`}
              data-index={flat.length}
              role="option"
              aria-selected={active === flat.length}
              onMouseEnter={() => setActive(flat.length)}
              onClick={() => go(flat.length)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left ${
                active === flat.length ? "bg-red-50 text-[#e21d12]" : "text-zinc-700"
              }`}
            >
              <SearchIcon />
              {t("seeAll", { q: trimmed })}
            </button>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-zinc-100 text-[11px] text-zinc-400 shrink-0">
          <span>{t("keyboardHint")}</span>
        </div>
      </div>
    </div>
  );
}
