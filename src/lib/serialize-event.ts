import type { GalleryItem, AgendaItem, RecurrenceRule } from "@/app/actions/event";

// Split out of event.ts (a "use server" file, where every export must be an
// async function/Server Action) so this plain row-shaping helper can be
// reused by organizer-events.ts without becoming a Server Action itself.
type EventRow = {
  id: string;
  title: string;
  sport: string;
  eventType: string;
  location: string;
  startDateTime: Date | string;
  endDateTime: Date | string;
  coverImageUrl: string | null;
  galleryUrls: string[] | null;
  galleryItems: GalleryItem[] | null;
  agendaItems: AgendaItem[] | null;
  registrationMode: string;
  capacity: number | null;
  maxPlayersPerTeam: number | null;
  description: string | null;
  rules: string | null;
  organizerId: string;
  organizerName: string;
  organizationId: string | null;
  organizationSlug?: string | null;
  organizationLogo?: string | null;
  customFormEnabled: boolean;
  price: number;
  hasCompetitionSchedule: boolean;
  recurrenceRule: RecurrenceRule | null;
  status: "active" | "cancelled";
  createdAt: Date | string;
  updatedAt: Date | string;
  participantCount: string | number;
};

function formatLocalTimestamp(value: Date | string) {
  if (typeof value === "string") {
    return value.includes(" ") ? value.replace(" ", "T") : value;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

export function serializeEvent(row: EventRow) {
  const rawItems: GalleryItem[] = row.galleryItems ?? [];
  const galleryItems: GalleryItem[] = rawItems.length > 0
    ? rawItems
    : (row.galleryUrls ?? []).map(url => ({ url, type: "image" as const }));
  return {
    ...row,
    startDateTime: formatLocalTimestamp(row.startDateTime),
    endDateTime: formatLocalTimestamp(row.endDateTime),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    galleryUrls: row.galleryUrls ?? [],
    galleryItems,
    agendaItems: (row.agendaItems ?? []) as AgendaItem[],
    participantCount: Number(row.participantCount ?? 0),
    customFormEnabled: row.customFormEnabled ?? false,
    price: Number(row.price ?? 0),
    hasCompetitionSchedule: row.hasCompetitionSchedule ?? false,
    recurrenceRule: row.recurrenceRule ?? null,
  };
}
