"use client";

// The tabbed body of the public event-detail page (/events/[eventId]) —
// the biggest single component in the app. Renders a different tab set
// depending on event type: plain events get details/participants/gallery,
// while tournaments additionally get agenda/results/teams/standings (games
// + mini-events management). `isOrganizer`/`isSuperAdmin` gate the
// management controls (create/edit/delete games, enter results, remove
// participants) inline in each tab rather than via a separate admin view.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { EventItem, EventParticipant, GalleryItem } from "@/app/actions/event";
import type { PublicTournamentTeam } from "@/app/actions/tournament";
import { disbandTournamentTeam } from "@/app/actions/tournament";
import type { Game, GameDetail } from "@/app/actions/game";
import { getGameDetail, deleteGame, clearGameResult } from "@/app/actions/game";
import type { MiniEvent, MiniEventDetail, TournamentPlayer } from "@/app/actions/miniEvent";
import { getMiniEventDetail, deleteMiniEvent, clearMiniEventResult } from "@/app/actions/miniEvent";
import { adminRemoveParticipant } from "@/app/actions/admin";
import { JoinOpenTeamButton } from "@/components/tournaments/TournamentCaptainPanel";
import GameFormModal from "@/components/events/GameFormModal";
import GameResultModal from "@/components/events/GameResultModal";
import GameStatsModal from "@/components/events/GameStatsModal";
import MiniEventFormModal from "@/components/events/MiniEventFormModal";
import MiniEventResultModal from "@/components/events/MiniEventResultModal";
import MiniEventResultsModal from "@/components/events/MiniEventResultsModal";

export type TabKey = "details" | "agenda" | "results" | "participants" | "gallery" | "teams" | "standings";

const ALL_TAB_KEYS: TabKey[] = ["details", "agenda", "results", "participants", "gallery", "teams", "standings"];

const TAB_ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  details: (
    <svg {...TAB_ICON_PROPS}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  agenda: (
    <svg {...TAB_ICON_PROPS}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  results: (
    <svg {...TAB_ICON_PROPS}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  participants: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  gallery: (
    <svg {...TAB_ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
    </svg>
  ),
  teams: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    </svg>
  ),
  standings: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h2a2 2 0 0 1 2 2 4 4 0 0 1-4 4" /><path d="M7 5H5a2 2 0 0 0-2 2 4 4 0 0 0 4 4" /><path d="M8 21h8" /><path d="M12 17v4" />
    </svg>
  ),
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

// formatDate parses full timestamps correctly, but a bare "YYYY-MM-DD" date
// (no time component, e.g. recurrenceRule's startDate/endDate) gets parsed
// as UTC midnight by `new Date()`, then shifted back a day when formatted in
// any timezone behind UTC — construct the Date from local-timezone parts
// instead to avoid that.
function formatDateOnly(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(y, m - 1, d));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatTimeStr(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#b72a25] text-xl text-white">
      {children}
    </span>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-6">
      <div className="mb-5 flex items-center gap-3 text-[#c32722]">
        {icon}
        <p className="text-sm font-extrabold uppercase tracking-wide text-zinc-500">{label}</p>
      </div>
      <p className="text-2xl font-extrabold leading-snug text-zinc-950">{value}</p>
    </div>
  );
}

function GameEntryCard({
  game,
  canManage,
  isLoadingResult,
  isLoadingStats,
  isDeleting,
  isClearing,
  onEdit,
  onEnterResult,
  onViewResult,
  onDelete,
  onClearResult,
  t,
}: {
  game: Game;
  canManage: boolean;
  isLoadingResult: boolean;
  isLoadingStats: boolean;
  isDeleting: boolean;
  isClearing: boolean;
  onEdit: () => void;
  onEnterResult: () => void;
  onViewResult: () => void;
  onDelete: () => void;
  onClearResult: () => void;
  t: (key: string) => string;
}) {
  const isFinal = game.status === "final";
  const bothTeamsAssigned = !!game.homeTeamId && !!game.awayTeamId;
  return (
    <div className="grid gap-6 rounded-[20px] border border-zinc-100 bg-white p-6 shadow-md md:grid-cols-[160px_1fr]">
      <div className="flex flex-col items-center justify-center gap-1 border-zinc-100 text-center md:border-r">
        <p className="text-sm font-bold uppercase tracking-wide text-zinc-500">{formatDate(game.scheduledTime)}</p>
        <p className="text-xl font-extrabold text-[#b72a25]">{formatTime(game.scheduledTime)}</p>
        {game.court && <p className="mt-1 text-xs font-semibold text-zinc-400">{game.court}</p>}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {game.round && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-zinc-500">
                {game.round}
              </span>
            )}
            {isFinal && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                {t("finalBadge")}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-2xl font-extrabold text-zinc-950">
            {game.homeTeamName ?? t("tbd")} <span className="text-zinc-300">{t("vs")}</span> {game.awayTeamName ?? t("tbd")}
          </h3>
          {isFinal && (
            <p className="mt-1 text-lg font-extrabold text-zinc-700">{game.homeScore} – {game.awayScore}</p>
          )}
          {game.notes && (
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-500">{game.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {canManage && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={onEdit} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={onEnterResult}
                disabled={isLoadingResult || !bothTeamsAssigned}
                title={bothTeamsAssigned ? undefined : t("assignTeamsFirst")}
                className="text-xs font-semibold text-[#e21d12] hover:underline disabled:opacity-50"
              >
                {isLoadingResult ? "..." : isFinal ? t("changeResult") : t("enterResult")}
              </button>
              {isFinal && (
                <button
                  type="button"
                  onClick={onClearResult}
                  disabled={isClearing}
                  className="text-xs font-semibold text-zinc-500 hover:underline disabled:opacity-50"
                >
                  {isClearing ? "..." : t("clearResult")}
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
              >
                {isDeleting ? "..." : t("delete")}
              </button>
            </div>
          )}
          {isFinal && (
            <button
              type="button"
              onClick={onViewResult}
              disabled={isLoadingStats}
              className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {isLoadingStats ? t("loading") : t("viewResult")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniEventEntryCard({
  miniEvent,
  canManage,
  isLoadingResult,
  isLoadingResults,
  isDeleting,
  isClearing,
  onEdit,
  onEnterResult,
  onViewResults,
  onDelete,
  onClearResult,
  t,
}: {
  miniEvent: MiniEvent;
  canManage: boolean;
  isLoadingResult: boolean;
  isLoadingResults: boolean;
  isDeleting: boolean;
  isClearing: boolean;
  onEdit: () => void;
  onEnterResult: () => void;
  onViewResults: () => void;
  onDelete: () => void;
  onClearResult: () => void;
  t: (key: string) => string;
}) {
  const isFinal = miniEvent.status === "final";
  return (
    <div className="grid gap-6 rounded-[20px] border border-zinc-100 bg-white p-6 shadow-md md:grid-cols-[160px_1fr]">
      <div className="flex flex-col items-center justify-center gap-1 border-zinc-100 text-center md:border-r">
        <p className="text-sm font-bold uppercase tracking-wide text-zinc-500">{formatDate(miniEvent.scheduledTime)}</p>
        <p className="text-xl font-extrabold text-[#b72a25]">{formatTime(miniEvent.scheduledTime)}</p>
        {miniEvent.court && <p className="mt-1 text-xs font-semibold text-zinc-400">{miniEvent.court}</p>}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
              {t("miniEventBadge")}
            </span>
            {isFinal && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                {t("finalBadge")}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-2xl font-extrabold text-zinc-950">{miniEvent.title}</h3>
          {miniEvent.notes && (
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-500">{miniEvent.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {canManage && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={onEdit} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={onEnterResult}
                disabled={isLoadingResult}
                className="text-xs font-semibold text-[#e21d12] hover:underline disabled:opacity-50"
              >
                {isLoadingResult ? "..." : isFinal ? t("changeResult") : t("enterResult")}
              </button>
              {isFinal && (
                <button
                  type="button"
                  onClick={onClearResult}
                  disabled={isClearing}
                  className="text-xs font-semibold text-zinc-500 hover:underline disabled:opacity-50"
                >
                  {isClearing ? "..." : t("clearResult")}
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
              >
                {isDeleting ? "..." : t("delete")}
              </button>
            </div>
          )}
          {isFinal && (
            <button
              type="button"
              onClick={onViewResults}
              disabled={isLoadingResults}
              className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {isLoadingResults ? t("loading") : t("viewResult")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-zinc-200 text-center">
      <div className="mb-5 text-zinc-300">{icon}</div>
      <p className="text-xl text-zinc-500">{title}</p>
      <p className="mt-3 text-base text-zinc-400">{subtitle}</p>
    </div>
  );
}

function GalleryLightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  async function handleDownload() {
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = item.url.split("/").pop() ?? "download";
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(item.url, "_blank");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-white/60">
            {index + 1} / {items.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
              title="Download"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Prev */}
        {hasPrev && (
          <button
            type="button"
            onClick={onPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}

        {/* Media */}
        <div className="flex max-h-[85vh] max-w-[90vw] items-center justify-center">
          {item.type === "video" ? (
            <video
              key={item.url}
              src={item.url}
              controls
              autoPlay
              className="max-h-[85vh] max-w-[90vw] rounded-lg"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt=""
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />
          )}
        </div>

        {/* Next */}
        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}


export default function EventDetailsTabs({
  event,
  participants: initialParticipants,
  isSuperAdmin = false,
  isOrganizer = false,
  hideTabs = [],
  desktopHideTabs = [],
  initialTab,
  tournamentTeams,
  myTournamentTeamId,
  canRequestJoin = false,
  tournamentId,
  games: initialGames,
  miniEvents: initialMiniEvents,
  tournamentPlayers = [],
}: {
  event: EventItem;
  participants: EventParticipant[];
  isSuperAdmin?: boolean;
  isOrganizer?: boolean;
  hideTabs?: TabKey[];
  /** Tabs whose button is hidden at the lg breakpoint and up (e.g. content that's shown inline on desktop instead). Still reachable on smaller screens. */
  desktopHideTabs?: TabKey[];
  /** Tab to land on, decided server-side (e.g. from the request's User-Agent) so desktop and mobile can land on different tabs with no client-side flash. */
  initialTab?: TabKey;
  tournamentTeams?: PublicTournamentTeam[];
  myTournamentTeamId?: string;
  canRequestJoin?: boolean;
  tournamentId?: string;
  games?: Game[];
  miniEvents?: MiniEvent[];
  tournamentPlayers?: TournamentPlayer[];
}) {
  const t = useTranslations("EventDetails");
  const router = useRouter();
  const defaultTabOrder: TabKey[] = ["details", "participants", "teams", "standings", "agenda", "results", "gallery"];
  const fallbackDefaultTab = defaultTabOrder.find((key) => !hideTabs.includes(key) && !desktopHideTabs.includes(key)) ?? "details";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? fallbackDefaultTab);
  const [participants, setParticipants] = useState(initialParticipants);
  const [teamsState, setTeamsState] = useState<PublicTournamentTeam[] | undefined>(tournamentTeams ?? undefined);
  const [myTeamIdState, setMyTeamIdState] = useState<string | undefined>(myTournamentTeamId ?? undefined);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [gamesState, setGamesState] = useState<Game[] | undefined>(initialGames);
  const [gameFormState, setGameFormState] = useState<{ mode: "create" } | { mode: "edit"; game: Game } | null>(null);
  const [resultModalDetail, setResultModalDetail] = useState<GameDetail | null>(null);
  const [statsModalDetail, setStatsModalDetail] = useState<GameDetail | null>(null);
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [clearingGameId, setClearingGameId] = useState<string | null>(null);
  const [miniEventsState, setMiniEventsState] = useState<MiniEvent[] | undefined>(initialMiniEvents);
  const [miniEventFormState, setMiniEventFormState] = useState<{ mode: "create" } | { mode: "edit"; miniEvent: MiniEvent } | null>(null);
  const [miniEventResultModalDetail, setMiniEventResultModalDetail] = useState<MiniEventDetail | null>(null);
  const [miniEventResultsModalDetail, setMiniEventResultsModalDetail] = useState<MiniEventDetail | null>(null);
  const [loadingMiniEventId, setLoadingMiniEventId] = useState<string | null>(null);
  const [deletingMiniEventId, setDeletingMiniEventId] = useState<string | null>(null);
  const [clearingMiniEventId, setClearingMiniEventId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTeamsState(tournamentTeams ?? undefined);
  }, [tournamentTeams]);

  useEffect(() => {
    setGamesState(initialGames);
  }, [initialGames]);

  useEffect(() => {
    setMiniEventsState(initialMiniEvents);
  }, [initialMiniEvents]);

  // Tabs are real <a href="#key"> links so they're bookmarkable/shareable and usable
  // without JS; this keeps `activeTab` in sync whenever the hash changes (click, back/forward,
  // or landing on a direct link like #results).
  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash.slice(1);
      if ((ALL_TAB_KEYS as string[]).includes(hash)) {
        setActiveTab(hash as TabKey);
      }
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const canManageSchedule = (gamesState !== undefined || miniEventsState !== undefined) && (isOrganizer || isSuperAdmin);

  async function openResultModal(gameId: string) {
    setLoadingGameId(gameId);
    try {
      const detail = await getGameDetail(gameId);
      if (detail) setResultModalDetail(detail);
    } finally {
      setLoadingGameId(null);
    }
  }

  async function openStatsModal(gameId: string) {
    setLoadingGameId(gameId);
    try {
      const detail = await getGameDetail(gameId);
      if (detail) setStatsModalDetail(detail);
    } finally {
      setLoadingGameId(null);
    }
  }

  function handleGameSaved() {
    setGameFormState(null);
    router.refresh();
  }

  function handleResultSaved() {
    setResultModalDetail(null);
    router.refresh();
  }

  function handleDeleteGame(gameId: string) {
    setDeletingGameId(gameId);
    startTransition(async () => {
      await deleteGame(gameId);
      setGamesState((prev) => prev?.filter((g) => g.id !== gameId));
      setDeletingGameId(null);
    });
  }

  function handleClearGameResult(gameId: string) {
    if (!window.confirm(t("clearResultConfirm"))) return;
    setClearingGameId(gameId);
    startTransition(async () => {
      await clearGameResult(gameId);
      setGamesState((prev) =>
        prev?.map((g) => (g.id === gameId ? { ...g, status: "scheduled", homeScore: null, awayScore: null } : g))
      );
      setClearingGameId(null);
    });
  }

  async function openMiniEventResultModal(miniEventId: string) {
    setLoadingMiniEventId(miniEventId);
    try {
      const detail = await getMiniEventDetail(miniEventId);
      if (detail) setMiniEventResultModalDetail(detail);
    } finally {
      setLoadingMiniEventId(null);
    }
  }

  async function openMiniEventResultsModal(miniEventId: string) {
    setLoadingMiniEventId(miniEventId);
    try {
      const detail = await getMiniEventDetail(miniEventId);
      if (detail) setMiniEventResultsModalDetail(detail);
    } finally {
      setLoadingMiniEventId(null);
    }
  }

  function handleMiniEventSaved() {
    setMiniEventFormState(null);
    router.refresh();
  }

  function handleMiniEventResultSaved() {
    setMiniEventResultModalDetail(null);
    router.refresh();
  }

  function handleDeleteMiniEvent(miniEventId: string) {
    setDeletingMiniEventId(miniEventId);
    startTransition(async () => {
      await deleteMiniEvent(miniEventId);
      setMiniEventsState((prev) => prev?.filter((m) => m.id !== miniEventId));
      setDeletingMiniEventId(null);
    });
  }

  function handleClearMiniEventResult(miniEventId: string) {
    if (!window.confirm(t("clearResultConfirm"))) return;
    setClearingMiniEventId(miniEventId);
    startTransition(async () => {
      await clearMiniEventResult(miniEventId);
      setMiniEventsState((prev) => prev?.map((m) => (m.id === miniEventId ? { ...m, status: "scheduled" } : m)));
      setClearingMiniEventId(null);
    });
  }

  useEffect(() => {
    function handleMembership(e: any) {
      try {
        const { teamId, member } = e.detail ?? {};
        if (!teamId || typeof member !== "boolean") return;
        setTeamsState((prev) =>
          prev
            ? prev.map((t) => (t.id === teamId ? { ...t, memberCount: Math.max(0, (t.memberCount || 0) + (member ? 1 : -1)) } : t))
            : prev
        );
        if (member) setMyTeamIdState(teamId);
        else setMyTeamIdState((cur) => (cur === teamId ? undefined : cur));
      } catch (err) {
        // ignore
      }
    }

    function handleRequest(e: any) {
      // for now we don't change counts on requests, but could mark team as having a pending request
      // keep placeholder to allow future improvements
      return;
    }

    window.addEventListener("teamMembershipChanged", handleMembership as EventListener);
    window.addEventListener("teamRequestSent", handleRequest as EventListener);
    window.addEventListener("teamRequestCancelled", handleRequest as EventListener);
    return () => {
      window.removeEventListener("teamMembershipChanged", handleMembership as EventListener);
      window.removeEventListener("teamRequestSent", handleRequest as EventListener);
      window.removeEventListener("teamRequestCancelled", handleRequest as EventListener);
    };
  }, []);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevItem = useCallback(() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const nextItem = useCallback(() => setLightboxIndex((i) => (i !== null && i < event.galleryItems.length - 1 ? i + 1 : i)), [event.galleryItems.length]);

  function handleRemoveParticipant(userId: string) {
    setRemovingId(userId);
    startTransition(async () => {
      try {
        await adminRemoveParticipant(event.id, userId);
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
      } catch {
        // keep current state
      }
      setRemovingId(null);
    });
  }

  function handleRemoveTeam(teamId: string) {
    if (!window.confirm(t("removeTeamConfirm"))) return;
    setRemovingTeamId(teamId);
    startTransition(async () => {
      const result = await disbandTournamentTeam(teamId);
      if (!result.error) {
        setTeamsState((prev) => prev?.filter((tm) => tm.id !== teamId));
      }
      setRemovingTeamId(null);
    });
  }
  const capacity = event.capacity ?? 0;
  const end = new Date(event.endDateTime);
  const agendaItems = useMemo(() =>
    [...(event.agendaItems ?? [])].sort((a, b) => {
      const dateA = `${a.date ?? ""}${a.startTime ?? ""}`;
      const dateB = `${b.date ?? ""}${b.startTime ?? ""}`;
      return dateA.localeCompare(dateB);
    }),
  [event.agendaItems]);
  type ScheduleEntry =
    | { type: "agenda"; item: (typeof agendaItems)[number]; sortKey: string }
    | { type: "game"; game: Game; sortKey: string }
    | { type: "miniEvent"; miniEvent: MiniEvent; sortKey: string };
  const scheduleEntries = useMemo<ScheduleEntry[]>(() => {
    const agendaEntries: ScheduleEntry[] = agendaItems.map((item) => ({
      type: "agenda",
      item,
      sortKey: `${item.date ?? ""}${item.startTime ?? ""}`,
    }));
    const gameEntries: ScheduleEntry[] = (gamesState ?? []).map((game) => ({
      type: "game",
      game,
      sortKey: game.scheduledTime,
    }));
    const miniEventEntries: ScheduleEntry[] = (miniEventsState ?? []).map((miniEvent) => ({
      type: "miniEvent",
      miniEvent,
      sortKey: miniEvent.scheduledTime,
    }));
    return [...agendaEntries, ...gameEntries, ...miniEventEntries].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [agendaItems, gamesState, miniEventsState]);
  const finalGames = useMemo(
    () =>
      [...(gamesState ?? [])]
        .filter((g) => g.status === "final")
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [gamesState]
  );
  const finalMiniEvents = useMemo(
    () =>
      [...(miniEventsState ?? [])]
        .filter((m) => m.status === "final")
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [miniEventsState]
  );
  type ResultEntry =
    | { type: "game"; game: Game; sortKey: string }
    | { type: "miniEvent"; miniEvent: MiniEvent; sortKey: string };
  const resultEntries = useMemo<ResultEntry[]>(() => {
    const gameEntries: ResultEntry[] = finalGames.map((game) => ({ type: "game", game, sortKey: game.scheduledTime }));
    const miniEventEntries: ResultEntry[] = finalMiniEvents.map((miniEvent) => ({
      type: "miniEvent",
      miniEvent,
      sortKey: miniEvent.scheduledTime,
    }));
    return [...gameEntries, ...miniEventEntries].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [finalGames, finalMiniEvents]);
  type TeamStanding = {
    teamId: string;
    teamName: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
  };
  const standings = useMemo<TeamStanding[]>(() => {
    if (!teamsState) return [];
    const byTeam = new Map<string, TeamStanding>(
      teamsState.map((team) => [
        team.id,
        { teamId: team.id, teamName: team.name, gamesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
      ])
    );
    for (const game of finalGames) {
      if (game.homeScore == null || game.awayScore == null || !game.homeTeamId || !game.awayTeamId) continue;
      const home = byTeam.get(game.homeTeamId);
      if (home) {
        home.gamesPlayed += 1;
        home.pointsFor += game.homeScore;
        home.pointsAgainst += game.awayScore;
        if (game.homeScore > game.awayScore) home.wins += 1;
        else home.losses += 1;
      }
      const away = byTeam.get(game.awayTeamId);
      if (away) {
        away.gamesPlayed += 1;
        away.pointsFor += game.awayScore;
        away.pointsAgainst += game.homeScore;
        if (game.awayScore > game.homeScore) away.wins += 1;
        else away.losses += 1;
      }
    }
    return [...byTeam.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const diffA = a.pointsFor - a.pointsAgainst;
      const diffB = b.pointsFor - b.pointsAgainst;
      if (diffB !== diffA) return diffB - diffA;
      return b.pointsFor - a.pointsFor;
    });
  }, [teamsState, finalGames]);
  const tabs: { key: TabKey; label: string }[] = (
    [
      { key: "details", label: t("tabDetails") },
      { key: "participants", label: t("tabParticipants") },
      ...(teamsState ? [{ key: "teams" as TabKey, label: t("tabTeams") }] : []),
      ...(teamsState ? [{ key: "standings" as TabKey, label: t("tabStandings") }] : []),
      { key: "agenda", label: t("tabAgenda") },
      { key: "results", label: t("tabResults") },
      { key: "gallery", label: t("tabGallery") },
    ] as { key: TabKey; label: string }[]
  ).filter((tab) => !hideTabs.includes(tab.key));
  const desktopTabs = tabs.filter((tab) => !desktopHideTabs.includes(tab.key));

  return (
    <section id="event-tabs" className="mt-10">
      {/* Desktop tab bar — hidden below lg, where the bottom icon nav takes over */}
      <div className="mb-10 hidden overflow-x-auto border-b border-zinc-200 lg:flex">
        {desktopTabs.map((tab) => (
          <a
            key={tab.key}
            href={`#${tab.key}`}
            className={`min-w-fit px-8 pb-4 text-base font-extrabold uppercase tracking-[0.12em] transition-colors ${
              activeTab === tab.key
                ? "border-b-[3px] border-[#c32722] text-[#b72a25]"
                : "border-b-[3px] border-white text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Mobile bottom icon nav — mirrors the dashboard's mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white lg:hidden">
        <div className="flex items-stretch h-16 overflow-x-auto">
          {tabs.map((tab) => (
            <a
              key={tab.key}
              href={`#${tab.key}`}
              onClick={() => {
                document.getElementById("event-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`flex min-w-[64px] shrink-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
                activeTab === tab.key ? "text-[#e21d12]" : "text-zinc-400"
              }`}
            >
              {TAB_ICONS[tab.key]}
              <span className="whitespace-nowrap text-[10px] font-semibold leading-none">{tab.label}</span>
            </a>
          ))}
        </div>
      </nav>

      {activeTab === "details" && (
        <div className={`grid gap-8 ${desktopHideTabs.includes("details") ? "lg:hidden" : ""}`}>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<span>▣</span>} label={t("startDate")} value={`${formatDate(event.startDateTime)} · ${formatTime(event.startDateTime)}`} />
            <MetricCard icon={<span>▣</span>} label={t("endDate")} value={`${formatDate(event.endDateTime)} · ${formatTime(event.endDateTime)}`} />
            <MetricCard icon={<span>⌖</span>} label={t("location")} value={event.location} />
            <MetricCard icon={<span>♟</span>} label={event.registrationMode === "team" ? t("tabTeams") : t("tabParticipants")} value={`${event.participantCount}/${capacity || "-"}`} />
          </div>
          {event.recurrenceRule && (
            <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm text-zinc-600">
              <span className="font-bold text-zinc-800">{t("recurrenceLabel")}:</span>{" "}
              {event.recurrenceRule.daysOfWeek.map(d => t(`recurrenceDay_${d}`)).join(", ")}, {formatDateOnly(event.recurrenceRule.startDate)} – {formatDateOnly(event.recurrenceRule.endDate)}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-xl font-extrabold text-zinc-950">{t("description")}</h2>
              <p className="whitespace-pre-line text-base leading-7 text-zinc-600">{event.description || t("noDescription")}</p>
            </section>
            <section>
              <h2 className="mb-3 text-xl font-extrabold text-zinc-950">{t("rules")}</h2>
              <p className="whitespace-pre-line text-base leading-7 text-zinc-600">{event.rules || t("noRules")}</p>
            </section>
          </div>
        </div>
      )}

      {activeTab === "agenda" && (
        <div>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <IconBadge>▣</IconBadge>
              <h2 className="text-3xl font-extrabold text-[#b72a25]">{t("agendaTitle")}</h2>
            </div>
            {canManageSchedule && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setGameFormState({ mode: "create" })}
                  className="rounded-lg bg-[#e21d12] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d41810]"
                >
                  {t("scheduleGame")}
                </button>
                <button
                  type="button"
                  onClick={() => setMiniEventFormState({ mode: "create" })}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  {t("scheduleMiniEvent")}
                </button>
              </div>
            )}
          </div>
          {scheduleEntries.length === 0 ? (
            <EmptyState
              icon={<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              title={t("noAgenda")}
              subtitle={t("noAgendaHint")}
            />
          ) : (
            <div className="grid gap-5">
              {scheduleEntries.map((entry, i) =>
                entry.type === "game" ? (
                  <GameEntryCard
                    key={`game-${entry.game.id}`}
                    game={entry.game}
                    canManage={canManageSchedule}
                    isLoadingResult={loadingGameId === entry.game.id}
                    isLoadingStats={loadingGameId === entry.game.id}
                    isDeleting={deletingGameId === entry.game.id}
                    isClearing={clearingGameId === entry.game.id}
                    onEdit={() => setGameFormState({ mode: "edit", game: entry.game })}
                    onEnterResult={() => openResultModal(entry.game.id)}
                    onViewResult={() => openStatsModal(entry.game.id)}
                    onDelete={() => handleDeleteGame(entry.game.id)}
                    onClearResult={() => handleClearGameResult(entry.game.id)}
                    t={t}
                  />
                ) : entry.type === "miniEvent" ? (
                  <MiniEventEntryCard
                    key={`mini-${entry.miniEvent.id}`}
                    miniEvent={entry.miniEvent}
                    canManage={canManageSchedule}
                    isLoadingResult={loadingMiniEventId === entry.miniEvent.id}
                    isLoadingResults={loadingMiniEventId === entry.miniEvent.id}
                    isDeleting={deletingMiniEventId === entry.miniEvent.id}
                    isClearing={clearingMiniEventId === entry.miniEvent.id}
                    onEdit={() => setMiniEventFormState({ mode: "edit", miniEvent: entry.miniEvent })}
                    onEnterResult={() => openMiniEventResultModal(entry.miniEvent.id)}
                    onViewResults={() => openMiniEventResultsModal(entry.miniEvent.id)}
                    onDelete={() => handleDeleteMiniEvent(entry.miniEvent.id)}
                    onClearResult={() => handleClearMiniEventResult(entry.miniEvent.id)}
                    t={t}
                  />
                ) : (
                  <div key={`agenda-${i}`} className="grid gap-6 rounded-[20px] border border-zinc-100 bg-white p-6 shadow-md md:grid-cols-[160px_1fr]">
                    <div className="border-zinc-100 text-center md:border-r flex flex-col items-center justify-center gap-1">
                      {entry.item.date && (
                        <p className="text-sm font-bold text-zinc-500 uppercase tracking-wide">
                          {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${entry.item.date}T00:00:00Z`))}
                        </p>
                      )}
                      {entry.item.startTime && <p className="text-xl font-extrabold text-[#b72a25]">{formatTimeStr(entry.item.startTime)}</p>}
                      {entry.item.startTime && entry.item.endTime && <p className="text-sm text-zinc-400">{t("to")}</p>}
                      {entry.item.endTime && <p className="text-xl font-extrabold text-[#b72a25]">{formatTimeStr(entry.item.endTime)}</p>}
                      {!entry.item.date && !entry.item.startTime && !entry.item.endTime && (
                        <span className="text-3xl text-zinc-200">◷</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold text-zinc-950">{entry.item.title}</h3>
                      {entry.item.description && <p className="mt-3 text-base leading-7 text-zinc-600">{entry.item.description}</p>}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "results" && (
        <div>
          <div className="mb-8 flex items-center gap-4">
            <IconBadge>⚔</IconBadge>
            <h2 className="text-3xl font-extrabold text-[#b72a25]">{t("resultsTitle")}</h2>
          </div>
          {resultEntries.length === 0 ? (
            <div className="rounded-[20px] border border-zinc-100 bg-white p-8 shadow-md">
              {end < new Date() ? (
                <p className="text-xl font-extrabold text-zinc-950">{t("resultsPending")}</p>
              ) : (
                <p className="text-xl font-extrabold text-zinc-950">{t("resultsAfterEvent")}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-5">
              {resultEntries.map((entry) =>
                entry.type === "game" ? (
                  <button
                    key={`game-${entry.game.id}`}
                    type="button"
                    onClick={() => openStatsModal(entry.game.id)}
                    disabled={loadingGameId === entry.game.id}
                    className="grid w-full gap-6 rounded-[20px] border border-zinc-100 bg-white p-6 text-left shadow-md transition-shadow hover:shadow-lg md:grid-cols-[160px_1fr] disabled:opacity-60"
                  >
                    <div className="flex flex-col items-center justify-center gap-1 border-zinc-100 text-center md:border-r">
                      <p className="text-sm font-bold uppercase tracking-wide text-zinc-500">{formatDate(entry.game.scheduledTime)}</p>
                      <p className="text-base font-extrabold text-[#b72a25]">{formatTime(entry.game.scheduledTime)}</p>
                      {entry.game.court && <p className="text-xs font-semibold text-zinc-400">{entry.game.court}</p>}
                    </div>
                    <div>
                      {entry.game.round && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-zinc-500">
                          {entry.game.round}
                        </span>
                      )}
                      <h3 className="mt-2 text-xl font-extrabold text-zinc-950">
                        {entry.game.homeTeamName ?? t("tbd")} <span className="text-zinc-300">{t("vs")}</span> {entry.game.awayTeamName ?? t("tbd")}
                      </h3>
                      <p className="mt-1 text-2xl font-extrabold text-[#b72a25]">{entry.game.homeScore} – {entry.game.awayScore}</p>
                      <p className="mt-1 text-xs font-semibold text-zinc-400">
                        {loadingGameId === entry.game.id ? t("loading") : t("viewBoxScore")}
                      </p>
                    </div>
                  </button>
                ) : (
                  <button
                    key={`mini-${entry.miniEvent.id}`}
                    type="button"
                    onClick={() => openMiniEventResultsModal(entry.miniEvent.id)}
                    disabled={loadingMiniEventId === entry.miniEvent.id}
                    className="grid w-full gap-6 rounded-[20px] border border-zinc-100 bg-white p-6 text-left shadow-md transition-shadow hover:shadow-lg md:grid-cols-[160px_1fr] disabled:opacity-60"
                  >
                    <div className="flex flex-col items-center justify-center gap-1 border-zinc-100 text-center md:border-r">
                      <p className="text-sm font-bold uppercase tracking-wide text-zinc-500">{formatDate(entry.miniEvent.scheduledTime)}</p>
                      <p className="text-base font-extrabold text-[#b72a25]">{formatTime(entry.miniEvent.scheduledTime)}</p>
                      {entry.miniEvent.court && <p className="text-xs font-semibold text-zinc-400">{entry.miniEvent.court}</p>}
                    </div>
                    <div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                        {t("miniEventBadge")}
                      </span>
                      <h3 className="mt-2 text-xl font-extrabold text-zinc-950">{entry.miniEvent.title}</h3>
                      <p className="mt-1 text-xs font-semibold text-zinc-400">
                        {loadingMiniEventId === entry.miniEvent.id ? t("loading") : t("viewResult")}
                      </p>
                    </div>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "participants" && (
        participants.length === 0 ? (
          <EmptyState
            icon={<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
            title={t("noParticipants")}
            subtitle={t("firstToRegister")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-zinc-100 font-extrabold text-zinc-500">
                  {participant.image ? <Image src={participant.image} alt={participant.name} width={48} height={48} className="size-12 object-cover" /> : participant.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-zinc-950">{participant.name}</p>
                  <p className="text-sm text-zinc-400">{formatDate(participant.joinedAt)}</p>
                </div>
                {isSuperAdmin && (
                  <button
                    type="button"
                    disabled={removingId === participant.id}
                    onClick={() => handleRemoveParticipant(participant.id)}
                    className="shrink-0 px-2.5 py-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {removingId === participant.id ? "..." : t("removeParticipant")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === "gallery" && (
        <div>
          <h2 className="mb-8 text-3xl font-extrabold text-zinc-950">{t("galleryTitle")}</h2>
          {event.galleryItems.length === 0 ? (
            <EmptyState
              icon={<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>}
              title={t("noGallery")}
              subtitle={t("galleryHint")}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {event.galleryItems.map((item, i) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-[16px] bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#e21d12]"
                >
                  {item.type === "video" ? (
                    <>
                      <video src={item.url} className="h-full w-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
                        <span className="flex size-12 items-center justify-center rounded-full bg-white/85 text-xl text-zinc-700 shadow">▶</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Image src={item.url} alt={t("galleryTitle")} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "teams" && teamsState && (
        <div>
          <div className="mb-8 flex items-center gap-4">
            <IconBadge>👥</IconBadge>
            <h2 className="text-3xl font-extrabold text-[#b72a25]">{t("teamsTitle")}</h2>
          </div>
          {teamsState.length === 0 ? (
            <EmptyState
              icon={<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
              title={t("noTeamsYet")}
              subtitle={t("firstTeamRegister")}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {teamsState.map((team) => {
                const isMyTeam = myTeamIdState === team.id;
                const isFull = team.memberCount >= team.playerCount;
                const showJoin = canRequestJoin && team.recruitmentStatus === "open" && !isFull && tournamentId;
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-zinc-900 leading-tight group-hover:text-[#e21d12] transition-colors">{team.name}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{t("captainLabel", { name: team.captainName })}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {team.status === "pending" && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{t("teamStatusPending")}</span>
                        )}
                        {team.recruitmentStatus === "open" && !isFull && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{t("teamStatusOpen")}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 text-xs font-extrabold text-zinc-500 border-2 border-white">
                        {team.captainName[0]}
                      </div>
                      {team.members.slice(0, 4).map((m) => (
                        <div key={m.id} className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-200 text-xs font-extrabold text-zinc-500 border-2 border-white">
                          {m.name[0]}
                        </div>
                      ))}
                      {team.memberCount > 5 && (
                        <span className="text-xs font-semibold text-zinc-400">+{team.memberCount - 5}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500">
                        {t("teamPlayerCount", { current: team.memberCount, total: team.playerCount })}
                      </span>
                      <div className="flex items-center gap-3">
                        {(isOrganizer || isSuperAdmin) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveTeam(team.id);
                            }}
                            disabled={removingTeamId === team.id}
                            className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
                          >
                            {removingTeamId === team.id ? "..." : t("removeTeam")}
                          </button>
                        )}
                        {showJoin && (
                          <JoinOpenTeamButton teamId={team.id} tournamentId={tournamentId} />
                        )}
                      </div>
                    </div>
                  </>
                );

                const className = `group rounded-2xl border bg-white p-5 flex flex-col gap-3 shadow-sm transition-shadow ${isMyTeam ? "border-[#e21d12]/40 ring-1 ring-[#e21d12]/20" : "border-zinc-200"} ${team.linkedTeamId ? "hover:shadow-md cursor-pointer" : ""}`;

                return team.linkedTeamId ? (
                  <Link key={team.id} href={`/teams/${team.linkedTeamId}`} className={className}>
                    {cardContent}
                  </Link>
                ) : (
                  <div key={team.id} className={className}>
                    {cardContent}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "standings" && teamsState && (
        <div>
          <div className="mb-8 flex items-center gap-4">
            <IconBadge>🏆</IconBadge>
            <h2 className="text-3xl font-extrabold text-[#b72a25]">{t("standingsTitle")}</h2>
          </div>
          {standings.length === 0 ? (
            <EmptyState
              icon={<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
              title={t("noStandings")}
              subtitle={t("noStandingsHint")}
            />
          ) : (
            <div className="overflow-x-auto rounded-[20px] border border-zinc-100 bg-white shadow-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-left text-[10px] font-extrabold uppercase tracking-wide text-zinc-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">{t("standingsTeam")}</th>
                    <th className="px-4 py-3 text-center">{t("standingsWins")}</th>
                    <th className="px-4 py-3 text-center">{t("standingsLosses")}</th>
                    <th className="px-4 py-3 text-center">{t("standingsPF")}</th>
                    <th className="px-4 py-3 text-center">{t("standingsPA")}</th>
                    <th className="px-4 py-3 text-center">{t("standingsDiff")}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((standing, i) => {
                    const diff = standing.pointsFor - standing.pointsAgainst;
                    return (
                      <tr key={standing.teamId} className="border-t border-zinc-100">
                        <td className="px-4 py-3 font-extrabold text-zinc-400">{i + 1}</td>
                        <td className="px-4 py-3 font-bold text-zinc-900">{standing.teamName}</td>
                        <td className="px-4 py-3 text-center font-extrabold text-emerald-600">{standing.wins}</td>
                        <td className="px-4 py-3 text-center font-extrabold text-red-500">{standing.losses}</td>
                        <td className="px-4 py-3 text-center text-zinc-600">{standing.pointsFor}</td>
                        <td className="px-4 py-3 text-center text-zinc-600">{standing.pointsAgainst}</td>
                        <td
                          className={`px-4 py-3 text-center font-bold ${
                            diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-zinc-500"
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          items={event.galleryItems}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevItem}
          onNext={nextItem}
        />
      )}

      {gameFormState && teamsState && (
        <GameFormModal
          tournamentId={event.id}
          teams={teamsState}
          game={gameFormState.mode === "edit" ? gameFormState.game : undefined}
          onClose={() => setGameFormState(null)}
          onSaved={handleGameSaved}
        />
      )}

      {resultModalDetail && (
        <GameResultModal
          detail={resultModalDetail}
          sport={event.sport}
          onClose={() => setResultModalDetail(null)}
          onSaved={handleResultSaved}
        />
      )}

      {statsModalDetail && (
        <GameStatsModal
          homeTeamName={statsModalDetail.homeTeamName ?? t("tbd")}
          awayTeamName={statsModalDetail.awayTeamName ?? t("tbd")}
          homeScore={statsModalDetail.homeScore ?? 0}
          awayScore={statsModalDetail.awayScore ?? 0}
          sport={event.sport}
          round={statsModalDetail.round}
          court={statsModalDetail.court}
          homeRoster={statsModalDetail.homeRoster}
          awayRoster={statsModalDetail.awayRoster}
          onClose={() => setStatsModalDetail(null)}
        />
      )}

      {miniEventFormState && (
        <MiniEventFormModal
          tournamentId={event.id}
          miniEvent={miniEventFormState.mode === "edit" ? miniEventFormState.miniEvent : undefined}
          onClose={() => setMiniEventFormState(null)}
          onSaved={handleMiniEventSaved}
        />
      )}

      {miniEventResultModalDetail && (
        <MiniEventResultModal
          miniEventId={miniEventResultModalDetail.id}
          title={miniEventResultModalDetail.title}
          allPlayers={tournamentPlayers}
          initialResults={miniEventResultModalDetail.results}
          onClose={() => setMiniEventResultModalDetail(null)}
          onSaved={handleMiniEventResultSaved}
        />
      )}

      {miniEventResultsModalDetail && (
        <MiniEventResultsModal
          title={miniEventResultsModalDetail.title}
          court={miniEventResultsModalDetail.court}
          results={miniEventResultsModalDetail.results}
          onClose={() => setMiniEventResultsModalDetail(null)}
        />
      )}
    </section>
  );
}
