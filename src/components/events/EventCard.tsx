"use client";

// Reusable event-grid card (used on the public /events list, the athlete
// profile page, dashboard/organizer event lists, and more). Purely
// presentational — all label strings (free/ended/joined/organizer) are
// passed in by the caller so this component doesn't own an i18n namespace
// of its own.
import Image from "next/image";
import { Link } from "@/i18n/routing";
import type { EventItem } from "@/app/actions/event";
import { formatPrice } from "@/lib/format-price";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function CalendarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function isSameCalendarDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function EventCard({
  event,
  freeLabel,
  endedLabel,
  cancelledLabel,
  joinedLabel,
  organizerLabel,
  todayLabel,
  tomorrowLabel,
  onViewed,
  href,
  action,
  ctaLabel,
  ctaHref,
}: {
  event: EventItem;
  freeLabel: string;
  endedLabel: string;
  cancelledLabel?: string;
  joinedLabel: string;
  organizerLabel: string;
  todayLabel?: string;
  tomorrowLabel?: string;
  onViewed?: (event: EventItem) => void;
  href?: string;
  action?: React.ReactNode;
  // Optional footer CTA (e.g. "RSVP"/"Register" on the homepage's compact
  // event grid) — a plain link to the event detail page, not a new inline
  // join control. Omitted by every other existing caller of EventCard.
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const isEnded = new Date(event.endDateTime) < new Date();
  const isCancelled = event.status === "cancelled";
  const now = new Date();
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const startDate = new Date(event.startDateTime);
  const isToday = isSameCalendarDate(startDate, now);
  const isTomorrow = isSameCalendarDate(startDate, tomorrowDate);
  const capacity = event.capacity ?? 0;
  const progress = capacity > 0 ? Math.min((event.participantCount / capacity) * 100, 100) : 0;
  const cover = event.coverImageUrl;
  const media = (
    <>
      {cover ? (
        <>
          <Image src={cover} alt="" aria-hidden fill className="object-cover scale-110 blur-lg" />
          <Image src={cover} alt={event.title} fill className="object-contain" />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-5xl font-black text-zinc-300 select-none">
          {event.sport[0]?.toUpperCase()}
        </div>
      )}
      <div className="absolute left-5 top-5 rounded-full bg-white px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-[#c32722] shadow-sm">
        {event.sport}
      </div>
      {isCancelled ? (
        <div className="absolute bottom-5 right-5 rounded-full border-2 border-red-300 bg-[#e21d12] px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-white shadow-md">
          {cancelledLabel ?? "Cancelled"}
        </div>
      ) : isEnded ? (
        <div className="absolute bottom-5 right-5 rounded-full border-2 border-red-300 bg-[#e21d12] px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-white shadow-md">
          {endedLabel}
        </div>
      ) : isToday && todayLabel ? (
        <div className="absolute bottom-5 right-5 rounded-full border-2 border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-white shadow-md">
          {todayLabel}
        </div>
      ) : isTomorrow && tomorrowLabel ? (
        <div className="absolute bottom-5 right-5 rounded-full border-2 border-zinc-300 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-zinc-700 shadow-md">
          {tomorrowLabel}
        </div>
      ) : null}
    </>
  );

  return (
    <article className="flex flex-col h-full overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {href ? (
        <Link href={href} onClick={() => onViewed?.(event)} className="relative block h-44 w-full shrink-0 overflow-hidden text-left">
          {media}
        </Link>
      ) : onViewed ? (
        <button type="button" onClick={() => onViewed(event)} className="relative block h-44 w-full shrink-0 overflow-hidden text-left">
          {media}
        </button>
      ) : (
        <div className="relative h-44 w-full shrink-0 overflow-hidden">{media}</div>
      )}

      <div className="flex flex-col flex-1 px-5 pb-5 pt-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          {href ? (
            <Link href={href} onClick={() => onViewed?.(event)} className="text-base font-extrabold leading-snug text-zinc-950 hover:text-[#e21d12]">
              {event.title}
            </Link>
          ) : (
            <h3 className="text-base font-extrabold leading-snug text-zinc-950">{event.title}</h3>
          )}
          {event.price > 0 ? (
            <span className="shrink-0 text-base font-extrabold text-[#e21d12]">{formatPrice(event.price)}</span>
          ) : (
            <span className="shrink-0 text-base font-extrabold uppercase text-emerald-600">{freeLabel}</span>
          )}
        </div>

        <div className="flex flex-col gap-2.5 text-sm font-medium text-zinc-500">
          <div className="flex items-center gap-2.5">
            <CalendarIcon />
            <span>{formatDate(event.startDateTime)}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <LocationIcon />
            <span>{event.location}</span>
          </div>
        </div>

        <div className="my-4 h-px bg-zinc-100" />

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-extrabold uppercase text-zinc-500">
              {action ?? event.organizerName?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{organizerLabel}</p>
              <p className="truncate text-sm font-extrabold text-zinc-900">{event.organizerName}</p>
            </div>
          </div>
          <div className="w-36 max-w-[50%]">
            <p className="mb-1.5 text-right text-xs font-extrabold text-zinc-900">{joinedLabel}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-[#e21d12]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#e21d12] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#c31710]"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </article>
  );
}
