"use client";

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

function isSameCalendarDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function EventListRow({
  event,
  freeLabel,
  endedLabel,
  joinedLabel,
  organizerLabel,
  todayLabel,
  tomorrowLabel,
  href,
  onViewed,
}: {
  event: EventItem;
  freeLabel: string;
  endedLabel: string;
  joinedLabel: string;
  organizerLabel: string;
  todayLabel?: string;
  tomorrowLabel?: string;
  href: string;
  onViewed?: (event: EventItem) => void;
}) {
  const isEnded = new Date(event.endDateTime) < new Date();
  const isCancelled = event.status === "cancelled";
  const now = new Date();
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const startDate = new Date(event.startDateTime);
  const isToday = isSameCalendarDate(startDate, now);
  const isTomorrow = isSameCalendarDate(startDate, tomorrowDate);
  const cover = event.coverImageUrl;

  return (
    <Link
      href={href}
      onClick={() => onViewed?.(event)}
      className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl">
        {cover ? (
          <Image src={cover} alt={event.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-2xl font-black text-zinc-300 select-none">
            {event.sport[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[#c32722]">
            {event.sport}
          </span>
          {isCancelled ? (
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#e21d12]">{endedLabel}</span>
          ) : isEnded ? (
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-zinc-400">{endedLabel}</span>
          ) : isToday && todayLabel ? (
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-zinc-900">{todayLabel}</span>
          ) : isTomorrow && tomorrowLabel ? (
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-zinc-500">{tomorrowLabel}</span>
          ) : null}
        </div>
        <p className="truncate text-base font-extrabold text-zinc-950">{event.title}</p>
        <p className="truncate text-sm font-medium text-zinc-500">
          {formatDate(event.startDateTime)} · {event.location}
        </p>
        <p className="truncate text-xs text-zinc-400 mt-0.5">
          {organizerLabel}: <span className="font-semibold text-zinc-600">{event.organizerName}</span> · {joinedLabel}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {event.price > 0 ? (
          <span className="text-base font-extrabold text-[#e21d12]">{formatPrice(event.price)}</span>
        ) : (
          <span className="text-base font-extrabold uppercase text-emerald-600">{freeLabel}</span>
        )}
      </div>
    </Link>
  );
}
