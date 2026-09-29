"use client";

// Right-side "Payment Details" drawer opened from a PaymentsLedger row.
// Follows ProfileSlideOver's slide-over mechanics (backdrop click + Escape
// to close) mirrored to the right edge, and RegistrationsClient's
// confirm-before-refund pattern for Issue Refund — this moves real money via
// the same refundEventParticipant server action, so it never fires on the
// first click.
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { refundEventParticipant } from "@/app/actions/event";
import type { PaymentRecord } from "@/app/actions/organizer-registrations";

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function formatCents(amountCents: number, locale: string) {
  return (amountCents / 100).toLocaleString(locale, { style: "currency", currency: "CAD" });
}

function statusBadgeClass(status: PaymentRecord["status"]) {
  return status === "paid"
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
    : "bg-zinc-100 text-zinc-500 border border-zinc-200";
}

export default function PaymentDetailsDrawer({
  payment,
  onClose,
  canViewContactInfo,
  canIssueRefunds,
  onRefunded,
}: {
  payment: PaymentRecord | null;
  onClose: () => void;
  canViewContactInfo: boolean;
  canIssueRefunds: boolean;
  onRefunded: (paymentId: string) => void;
}) {
  const t = useTranslations("Organizer");
  const locale = useLocale();

  // Confirm/error state naturally resets whenever a different row is opened
  // because PaymentsLedger mounts this component keyed by payment id — no
  // reset effect needed (a fresh key means a fresh component instance).
  const [confirmingRefund, setConfirmingRefund] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");

  useEffect(() => {
    if (!payment) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [payment, onClose]);

  if (!payment) return null;

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));

  const methodLabel =
    payment.method === "wallet"
      ? t("paymentRecordsMethodWallet")
      : payment.method === "stripe_direct" || payment.method === "stripe"
        ? t("paymentRecordsMethodCard")
        : t("paymentRecordsMethodUnknown");

  const typeLabel = payment.type === "event" ? t("paymentRecordsTypeEvent") : t("paymentRecordsTypeTeam");
  const canRefundThis = canIssueRefunds && payment.refundable;

  async function handleRefund() {
    if (!payment) return;
    setIsRefunding(true);
    setRefundError("");
    const result = await refundEventParticipant(payment.eventId, payment.userId);
    setIsRefunding(false);
    if (result.error) {
      setRefundError(result.error);
      return;
    }
    setConfirmingRefund(false);
    onRefunded(payment.id);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <h2 className="text-lg font-extrabold text-zinc-900">{t("paymentRecordsDrawerTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("paymentRecordsDrawerClose")}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <IconClose />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          <div>
            <p className="text-3xl font-extrabold text-zinc-900">{formatCents(payment.amountCents, locale)}</p>
            <span className={`inline-block mt-2 text-xs font-semibold rounded-full px-2.5 py-1 ${statusBadgeClass(payment.status)}`}>
              {payment.status === "paid" ? t("paymentRecordsFilterPaid") : t("paymentRecordsFilterRefunded")}
            </span>
          </div>

          <dl className="flex flex-col gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-0.5">{t("paymentRecordsDrawerCustomer")}</dt>
              <dd className="font-semibold text-zinc-900">{payment.personName}</dd>
              {canViewContactInfo && payment.personEmail && (
                <dd className="text-zinc-500">{payment.personEmail}</dd>
              )}
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-0.5">{t("paymentRecordsDrawerPaidFor")}</dt>
              <dd className="font-semibold text-zinc-900">{payment.activityName}</dd>
              <dd className="text-zinc-500">{typeLabel}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-0.5">{t("paymentRecordsDrawerRecordId")}</dt>
              <dd className="font-mono text-xs text-zinc-500">{payment.id}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-0.5">{t("paymentRecordsDrawerPaymentDate")}</dt>
              <dd className="text-zinc-700">{formatDate(payment.paymentDate)}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-0.5">{t("paymentRecordsDrawerPaymentMethod")}</dt>
              <dd className="text-zinc-700">{methodLabel}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-0.5">{t("paymentRecordsDrawerPaymentId")}</dt>
              <dd className="font-mono text-xs text-zinc-500">{payment.stripeSessionId ?? t("paymentRecordsDrawerPaymentIdNone")}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2.5 pt-2 border-t border-zinc-100">
            {canIssueRefunds && payment.type === "team" && (
              <p className="text-xs text-zinc-400">{t("paymentRecordsTeamRefundNote")}</p>
            )}

            {canRefundThis && !confirmingRefund && (
              <button
                type="button"
                onClick={() => {
                  setRefundError("");
                  setConfirmingRefund(true);
                }}
                className="w-full py-2.5 text-sm font-semibold text-[#e21d12] border border-[#e21d12]/30 rounded-lg hover:bg-red-50 transition-colors"
              >
                {t("paymentRecordsIssueRefund")}
              </button>
            )}

            {canRefundThis && confirmingRefund && (
              <div className="flex flex-col gap-2.5 px-4 py-3 rounded-lg border border-red-200 bg-red-50/50">
                <p className="text-xs font-semibold text-zinc-700">
                  {t("paymentRecordsRefundConfirm", { name: payment.personName, amount: formatCents(payment.amountCents, locale) })}
                </p>
                {refundError && <p className="text-xs font-semibold text-red-600">{refundError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingRefund(false)}
                    disabled={isRefunding}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {t("paymentRecordsCancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefund}
                    disabled={isRefunding}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-[#e21d12] rounded-lg hover:bg-[#d41810] transition-colors disabled:opacity-60"
                  >
                    {isRefunding ? t("paymentRecordsRefunding") : t("paymentRecordsConfirmRefund")}
                  </button>
                </div>
              </div>
            )}

            <Link
              href="/organizer/registrations"
              className="w-full text-center py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              {t("paymentRecordsViewRegistration")}
            </Link>

            {canViewContactInfo && payment.personEmail && (
              <a
                href={`mailto:${payment.personEmail}`}
                className="w-full text-center py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                {t("paymentRecordsMessageParticipant")}
              </a>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
