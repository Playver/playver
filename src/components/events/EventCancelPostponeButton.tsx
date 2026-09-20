"use client";

// Organizer control for cancelling or postponing an event. `isPaid` changes
// the cancel-confirm copy (cancelling a paid event triggers automatic
// refunds — see event.ts's cancelEvent, and the withdrawal-hold logic in
// organizer-wallet.ts that keeps funds available for exactly this case).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cancelEvent, getEventRefundPreview, postponeEvent } from "@/app/actions/event";
import { formatPrice } from "@/lib/format-price";

type View = "closed" | "choice" | "cancel-confirm" | "cancel-result" | "postpone-form";

type CancelResult = { refundedCount: number; refundedTotalCents: number; pendingReviewCount: number };

export default function EventCancelPostponeButton({
  eventId,
  eventTitle,
  startDateTime,
  endDateTime,
  isPaid,
}: {
  eventId: string;
  eventTitle: string;
  startDateTime: string;
  endDateTime: string;
  isPaid: boolean;
}) {
  const t = useTranslations("EventCancelPostpone");
  const router = useRouter();
  const [view, setView] = useState<View>("closed");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [newStart, setNewStart] = useState(startDateTime.slice(0, 16));
  const [newEnd, setNewEnd] = useState(endDateTime.slice(0, 16));
  const [refundPreview, setRefundPreview] = useState<{ count: number; totalCents: number } | null>(null);
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);

  function close() {
    setView("closed");
    setError("");
    setRefundPreview(null);
    setCancelResult(null);
    router.refresh();
  }

  async function openCancelConfirm() {
    setView("cancel-confirm");
    if (!isPaid) return;
    const preview = await getEventRefundPreview(eventId);
    if (!preview.error) setRefundPreview({ count: preview.count ?? 0, totalCents: preview.totalCents ?? 0 });
  }

  async function handleCancel() {
    setIsLoading(true);
    setError("");
    const result = await cancelEvent(eventId);
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (isPaid) {
      setCancelResult({
        refundedCount: result.refundedCount ?? 0,
        refundedTotalCents: result.refundedTotalCents ?? 0,
        pendingReviewCount: result.pendingReviewCount ?? 0,
      });
      setView("cancel-result");
    } else {
      close();
    }
  }

  async function handlePostpone(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    const result = await postponeEvent(eventId, newStart, newEnd);
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setView("choice")}
        className="block w-full rounded-lg border border-red-200 px-4 py-3 text-center text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
      >
        {t("buttonLabel")}
      </button>

      {view !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
            {view === "choice" && (
              <>
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-900">{t("modalTitle")}</h2>
                  <p className="mt-1.5 text-sm text-zinc-500">{t("modalSubtitle", { eventTitle })}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setView("postpone-form")}
                    className="w-full py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    {t("postponeOption")}
                  </button>
                  <button
                    type="button"
                    onClick={openCancelConfirm}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-[#e21d12] rounded-lg hover:bg-[#d41810] transition-colors"
                  >
                    {t("cancelOption")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="text-sm font-semibold text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  {t("close")}
                </button>
              </>
            )}

            {view === "cancel-confirm" && (
              <>
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-900">{t("cancelConfirmTitle")}</h2>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    {isPaid ? t("cancelConfirmPaidBody", { eventTitle }) : t("cancelConfirmBody", { eventTitle })}
                  </p>
                </div>
                {isPaid && refundPreview && refundPreview.count > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">
                      {t("cancelRefundPreview", {
                        count: refundPreview.count,
                        amount: formatPrice(refundPreview.totalCents),
                      })}
                    </p>
                  </div>
                )}
                {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setView("choice")}
                    disabled={isLoading}
                    className="flex-1 py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    {t("back")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#e21d12] rounded-lg hover:bg-[#d41810] transition-colors disabled:opacity-60"
                  >
                    {isLoading ? t("cancelling") : t("confirmCancel")}
                  </button>
                </div>
              </>
            )}

            {view === "cancel-result" && cancelResult && (
              <>
                <div>
                  <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-emerald-50">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <h2 className="text-lg font-extrabold text-zinc-900">{t("cancelResultTitle")}</h2>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    {cancelResult.refundedCount > 0
                      ? t("cancelResultRefunded", {
                          count: cancelResult.refundedCount,
                          amount: formatPrice(cancelResult.refundedTotalCents),
                        })
                      : t("cancelResultNoPayments")}
                  </p>
                  {cancelResult.pendingReviewCount > 0 && (
                    <p className="mt-2 text-sm font-semibold text-amber-700">
                      {t("cancelResultPendingReview", { count: cancelResult.pendingReviewCount })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-[#e21d12] rounded-lg hover:bg-[#d41810] transition-colors"
                >
                  {t("done")}
                </button>
              </>
            )}

            {view === "postpone-form" && (
              <form onSubmit={handlePostpone} className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-900">{t("postponeTitle")}</h2>
                  <p className="mt-1.5 text-sm text-zinc-500">{t("postponeBody")}</p>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t("newStart")}</span>
                  <input
                    type="datetime-local"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    required
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t("newEnd")}</span>
                  <input
                    type="datetime-local"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    required
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-red-200"
                  />
                </label>
                {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setView("choice")}
                    disabled={isLoading}
                    className="flex-1 py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    {t("back")}
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#e21d12] rounded-lg hover:bg-[#d41810] transition-colors disabled:opacity-60"
                  >
                    {isLoading ? t("postponing") : t("confirmPostpone")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
