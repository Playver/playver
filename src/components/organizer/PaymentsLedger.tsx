"use client";

// Org-wide payments ledger for /organizer/payment-records. `payments` is the
// normalized UNION of event_payment + tournament_team_payment built by
// getOrganizationPayments (organizer-registrations.ts) — see that function's
// comments for exactly what's real vs. simplified per row.
//
// Status pills intentionally include Pending/Failed for visual parity with
// the design, but the underlying data can never produce either: an
// event_payment row is only ever inserted on a successful webhook (no row =
// no abandoned checkout), and tournament_team_payment has no status column
// at all. Those two pills will legitimately always show zero rows.
import { useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { PaymentRecord, PaymentType } from "@/app/actions/organizer-registrations";
import PaymentDetailsDrawer from "@/components/organizer/PaymentDetailsDrawer";

type StatusFilter = "all" | "paid" | "pending" | "refunded" | "failed";
type TypeFilter = "all" | PaymentType;

function formatCents(amountCents: number, locale: string) {
  return (amountCents / 100).toLocaleString(locale, { style: "currency", currency: "CAD" });
}

function statusBadgeClass(status: PaymentRecord["status"]) {
  return status === "paid"
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
    : "bg-zinc-100 text-zinc-500 border border-zinc-200";
}

export default function PaymentsLedger({
  payments,
  canViewContactInfo,
  canIssueRefunds,
}: {
  payments: PaymentRecord[];
  canViewContactInfo: boolean;
  canIssueRefunds: boolean;
}) {
  const t = useTranslations("Organizer");
  const locale = useLocale();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  // Optimistic overlay so a refund reflects instantly without waiting on the
  // router.refresh() round-trip — refundEventParticipant already revalidates
  // /organizer/payment-records server-side, this just avoids a visible lag.
  const [refundedIds, setRefundedIds] = useState<Set<string>>(new Set());

  const effectivePayments = useMemo(
    () =>
      payments.map((p) =>
        refundedIds.has(p.id) ? { ...p, status: "refunded" as const, refundable: false } : p
      ),
    [payments, refundedIds]
  );

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effectivePayments.filter((p) => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (statusFilter === "paid" && p.status !== "paid") return false;
      if (statusFilter === "refunded" && p.status !== "refunded") return false;
      // "pending"/"failed" never match any real row — see file header.
      if (statusFilter === "pending" || statusFilter === "failed") return false;
      if (!q) return true;
      return p.personName.toLowerCase().includes(q) || p.activityName.toLowerCase().includes(q);
    });
  }, [effectivePayments, search, statusFilter, typeFilter]);

  const selectedPayment = selectedPaymentId ? effectivePayments.find((p) => p.id === selectedPaymentId) ?? null : null;

  function handleRefunded(paymentId: string) {
    setRefundedIds((prev) => new Set(prev).add(paymentId));
    router.refresh();
  }

  const statusPills: { key: StatusFilter; labelKey: string }[] = [
    { key: "all", labelKey: "paymentRecordsFilterAll" },
    { key: "paid", labelKey: "paymentRecordsFilterPaid" },
    { key: "pending", labelKey: "paymentRecordsFilterPending" },
    { key: "refunded", labelKey: "paymentRecordsFilterRefunded" },
    { key: "failed", labelKey: "paymentRecordsFilterFailed" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
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
            placeholder={t("paymentRecordsSearchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400 text-zinc-800"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="text-sm bg-white border border-zinc-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-200 text-zinc-700 cursor-pointer shrink-0"
        >
          <option value="all">{t("paymentRecordsTypeAll")}</option>
          <option value="event">{t("paymentRecordsTypeEvent")}</option>
          <option value="team">{t("paymentRecordsTypeTeam")}</option>
        </select>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {statusPills.map((pill) => (
          <button
            key={pill.key}
            type="button"
            onClick={() => setStatusFilter(pill.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === pill.key ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {t(pill.labelKey)}
          </button>
        ))}
      </div>

      <p className="text-sm font-semibold text-zinc-600 mb-3">
        {t("paymentRecordsCount", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center">
          <p className="text-zinc-900 font-semibold mb-1">{t("paymentRecordsEmptyTitle")}</p>
          <p className="text-sm text-zinc-500">{t("paymentRecordsEmptyDescription")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("paymentRecordsColumnPerson")}</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("paymentRecordsColumnActivity")}</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("paymentRecordsColumnType")}</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("paymentRecordsColumnAmount")}</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("paymentRecordsColumnStatus")}</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("paymentRecordsColumnDate")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const initial = p.personName[0]?.toUpperCase() ?? "?";
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPaymentId(p.id)}
                    className="border-b border-zinc-50 last:border-b-0 cursor-pointer hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                          {p.personImage ? (
                            <Image src={p.personImage} alt={p.personName} width={32} height={32} className="size-8 object-cover" />
                          ) : (
                            initial
                          )}
                        </span>
                        <span className="font-semibold text-zinc-900 truncate">{p.personName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 max-w-[220px] truncate">{p.activityName}</td>
                    <td className="px-5 py-3 text-zinc-500">
                      {p.type === "event" ? t("paymentRecordsTypeEvent") : t("paymentRecordsTypeTeam")}
                    </td>
                    <td className="px-5 py-3 font-semibold text-zinc-900 whitespace-nowrap">{formatCents(p.amountCents, locale)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${statusBadgeClass(p.status)}`}>
                        {p.status === "paid" ? t("paymentRecordsFilterPaid") : t("paymentRecordsFilterRefunded")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaymentDetailsDrawer
        key={selectedPayment?.id ?? "none"}
        payment={selectedPayment}
        onClose={() => setSelectedPaymentId(null)}
        canViewContactInfo={canViewContactInfo}
        canIssueRefunds={canIssueRefunds}
        onRefunded={handleRefunded}
      />
    </div>
  );
}
