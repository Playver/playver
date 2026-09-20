"use client";

// Organizer's per-event registrant list + CSV export. `canViewContactInfo`/
// `canViewPayments` (from getEventRegistrants) gate which columns render —
// VIEW_SENSITIVE_PARTICIPANT_DATA and VIEW_PAYMENTS respectively, see
// organizer-permissions.ts.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  getEventRegistrants,
  type OrganizerEventSummary,
  type RegistrantRow,
} from "@/app/actions/organizer-registrations";
import { refundEventParticipant } from "@/app/actions/event";

type LoadedRegistrants = {
  event: OrganizerEventSummary;
  canViewContactInfo: boolean;
  canViewPayments: boolean;
  canIssueRefunds: boolean;
  registrants: RegistrantRow[];
};

function formatCents(amountCents: number) {
  return (amountCents / 100).toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

// Fallback for environments where the async Clipboard API is unavailable or
// denied (older browsers, some embedded/automated contexts) — without this,
// a rejected writeText() promise fails silently and the button just does
// nothing with no feedback.
function fallbackCopy(text: string, onDone: () => void) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (document.execCommand("copy")) onDone();
  } catch {
    // Nothing more we can do here — Export CSV and Email all remain as
    // working alternatives for getting these addresses.
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function RegistrationsClient({ events }: { events: OrganizerEventSummary[] }) {
  const t = useTranslations("Organizer");
  const locale = useLocale();

  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [fetchState, setFetchState] = useState<{ data: LoadedRegistrants | null; error: boolean }>({
    data: null,
    error: false,
  });
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmRefundId, setConfirmRefundId] = useState<string | null>(null);
  const [refundSubmittingId, setRefundSubmittingId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<{ id: string; message: string } | null>(null);
  const data = fetchState.data;
  const loadError = fetchState.error;
  const isTournament = data?.event.eventType === "Tournament";

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

  const loadRegistrants = useCallback((eventId: string) => {
    startTransition(async () => {
      const result = await getEventRegistrants(eventId);
      setFetchState("error" in result ? { data: null, error: true } : { data: result, error: false });
    });
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    loadRegistrants(selectedEventId);
  }, [selectedEventId, loadRegistrants]);

  async function handleRefund(userId: string) {
    setRefundSubmittingId(userId);
    setRefundError(null);
    const result = await refundEventParticipant(selectedEventId, userId);
    setRefundSubmittingId(null);
    if (result.error) {
      setRefundError({ id: userId, message: result.error });
      return;
    }
    setConfirmRefundId(null);
    loadRegistrants(selectedEventId);
  }

  const customFieldLabels = useMemo(() => {
    if (!data) return [];
    const labels = new Set<string>();
    for (const r of data.registrants) {
      for (const f of r.customFields) labels.add(f.label);
    }
    return Array.from(labels);
  }, [data]);

  const filteredRegistrants = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.registrants;
    return data.registrants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.team?.name ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const emails = useMemo(
    () => filteredRegistrants.map((r) => r.email).filter((e): e is string => !!e),
    [filteredRegistrants]
  );

  function handleCopyEmails() {
    const text = emails.join(", ");
    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(markCopied, () => fallbackCopy(text, markCopied));
    } else {
      fallbackCopy(text, markCopied);
    }
  }

  function handleExportCsv() {
    if (!data) return;
    const headers = [
      t("registrationsColumnName"),
      ...(isTournament ? [t("registrationsTeamColumn"), t("registrationsRoleColumn")] : []),
      ...(data.canViewContactInfo ? [t("registrationsColumnEmail"), ...customFieldLabels] : []),
      t("registrationsColumnJoined"),
      ...(data.canViewPayments ? [t("registrationsColumnPayment")] : []),
    ];
    const rows = filteredRegistrants.map((r) => [
      r.name,
      ...(isTournament
        ? [r.team?.name ?? "", r.team?.isCaptain ? t("registrationsCaptainBadge") : t("registrationsMemberLabel")]
        : []),
      ...(data.canViewContactInfo
        ? [r.email ?? "", ...customFieldLabels.map((label) => r.customFields.find((f) => f.label === label)?.value ?? "")]
        : []),
      formatDate(r.joinedAt),
      ...(data.canViewPayments ? [r.payment ? `${formatCents(r.payment.amountCents)} (${r.payment.status})` : ""] : []),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-registrants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-zinc-700">{t("registrationsSelectEventLabel")}</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="min-w-[280px] text-sm bg-white border border-zinc-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-200 text-zinc-800"
          >
            {!selectedEventId && (
              <option value="" disabled>
                {t("registrationsSelectPlaceholder")}
              </option>
            )}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {formatDate(event.startDateTime)}
                {event.eventType === "Tournament" ? ` ${t("registrationsTournamentTag")}` : ""}
              </option>
            ))}
          </select>
        </div>

        {data && (
          <div className="relative flex-1 min-w-[220px]">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("registrationsSearchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400 text-zinc-800"
            />
          </div>
        )}
      </div>

      {events.length === 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 max-w-lg">
          <p className="font-extrabold text-zinc-900 mb-1">{t("registrationsNoEventsTitle")}</p>
          <p className="text-sm text-zinc-500">{t("registrationsNoEventsDescription")}</p>
        </div>
      )}

      {events.length > 0 && !selectedEventId && (
        <p className="text-sm text-zinc-500">{t("registrationsSelectPrompt")}</p>
      )}

      {isPending && <p className="text-sm text-zinc-500">{t("registrationsLoading")}</p>}

      {!isPending && loadError && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-600">
          {t("registrationsLoadError")}
        </div>
      )}

      {!isPending && data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm font-semibold text-zinc-600">
              {t("registrationsCount", { count: filteredRegistrants.length })}
            </p>
            {data.canViewContactInfo && emails.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyEmails}
                  className="px-3 py-1.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  {copied ? t("registrationsCopyEmailsDone") : t("registrationsCopyEmails")}
                </button>
                <a
                  href={`mailto:?bcc=${encodeURIComponent(emails.join(","))}`}
                  className="px-3 py-1.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  {t("registrationsEmailAll")}
                </a>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors"
                >
                  {t("registrationsExportCsv")}
                </button>
              </div>
            )}
          </div>

          {filteredRegistrants.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center">
              <p className="text-zinc-900 font-semibold mb-1">{t("registrationsEmptyRosterTitle")}</p>
              <p className="text-sm text-zinc-500">{t("registrationsEmptyRosterDescription")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredRegistrants.map((r) => {
                const initial = r.name[0]?.toUpperCase() ?? "?";
                const canRefundThisRow = data.canIssueRefunds && r.payment && r.payment.status === "completed";
                return (
                  <div key={r.id} className="flex flex-col bg-white rounded-2xl border border-zinc-200 shadow-sm">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 font-bold text-zinc-500">
                        {r.image ? (
                          <Image src={r.image} alt={r.name} width={44} height={44} className="size-11 object-cover" />
                        ) : (
                          initial
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-zinc-900 text-sm truncate">{r.name}</p>
                          {r.team?.isCaptain && (
                            <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-[#e21d12]/10 text-[#e21d12] border border-[#e21d12]/20">
                              {t("registrationsCaptainBadge")}
                            </span>
                          )}
                          {r.team?.pending && (
                            <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                              {t("registrationsPendingBadge")}
                            </span>
                          )}
                        </div>
                        {r.team && <p className="text-xs text-zinc-400 truncate mt-0.5">{r.team.name}</p>}
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {data.canViewContactInfo ? r.email : t("registrationsContactHidden")}
                        </p>
                        {data.canViewContactInfo && r.customFields.length > 0 && (
                          <p className="text-xs text-zinc-400 truncate mt-0.5">
                            {r.customFields.map((f) => `${f.label}: ${f.value ?? "—"}`).join(" · ")}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                        <span className="text-xs text-zinc-400">{formatDate(r.joinedAt)}</span>
                        {data.canViewPayments ? (
                          r.payment && (
                            <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {t("registrationsPaid")} · {formatCents(r.payment.amountCents)}
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-zinc-300">{t("registrationsPaymentHidden")}</span>
                        )}
                      </div>

                      {data.canViewContactInfo && r.email && (
                        <a
                          href={`mailto:${r.email}`}
                          className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                        >
                          {t("registrationsContact")}
                        </a>
                      )}

                      {canRefundThisRow && confirmRefundId !== r.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundError(null);
                            setConfirmRefundId(r.id);
                          }}
                          className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold text-[#e21d12] border border-[#e21d12]/30 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          {t("registrationsIssueRefund")}
                        </button>
                      )}
                    </div>

                    {canRefundThisRow && confirmRefundId === r.id && (
                      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-zinc-100 bg-red-50/50">
                        <p className="flex-1 min-w-[220px] text-xs font-semibold text-zinc-700">
                          {t("registrationsRefundConfirm", { name: r.name, amount: formatCents(r.payment!.amountCents) })}
                        </p>
                        {refundError?.id === r.id && (
                          <p className="w-full text-xs font-semibold text-red-600">{refundError.message}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmRefundId(null)}
                          disabled={refundSubmittingId === r.id}
                          className="px-3 py-1.5 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                        >
                          {t("registrationsCancel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRefund(r.id)}
                          disabled={refundSubmittingId === r.id}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#e21d12] rounded-lg hover:bg-[#d41810] transition-colors disabled:opacity-60"
                        >
                          {refundSubmittingId === r.id ? t("registrationsRefunding") : t("registrationsConfirmRefund")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
