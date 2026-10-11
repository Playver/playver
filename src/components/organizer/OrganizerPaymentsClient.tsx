"use client";

// Org Earnings page (/organizer/payments): what's available vs held, payout
// setup, one-click "withdraw everything", payout tracking, and how fees work.
// All amounts are already net of fees (taken when each payment came in), and
// `overview.payoutReadiness` is read live from Stripe, so the Withdraw button
// is only offered when a withdrawal can actually go through.
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format-price";
import {
  createOrganizationConnectAccountSession,
  requestOrganizationWithdrawal,
  retryOrganizationPayouts,
  type getOrganizationWalletOverview,
  type OrganizationWithdrawal,
} from "@/app/actions/organizer-wallet";
import ConnectPayoutOnboarding from "@/components/payments/ConnectPayoutOnboarding";
import FeeExplainer from "@/components/organizer/FeeExplainer";

type Overview = Awaited<ReturnType<typeof getOrganizationWalletOverview>>;

const STATE_STYLES: Record<OrganizationWithdrawal["state"], string> = {
  queued: "bg-amber-50 text-amber-700 border-amber-200",
  on_the_way: "bg-sky-50 text-sky-700 border-sky-200",
  deposited: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_bank: "bg-red-50 text-red-700 border-red-200",
  returned: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export default function OrganizerPaymentsClient({
  overview,
  canManagePayments,
}: {
  overview: Overview;
  canManagePayments: boolean;
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panel, setPanel] = useState<"none" | "onboarding" | "management">("none");
  const [connectError, setConnectError] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawResult, setWithdrawResult] = useState<{ amountCents: number; state: OrganizationWithdrawal["state"] } | null>(
    null
  );

  const readiness = overview.payoutReadiness;
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const nextRelease = overview.holds.find((h) => h.releasesAt);

  const fetchConnectClientSecret = useCallback(async () => {
    const result = await createOrganizationConnectAccountSession();
    if (!result.clientSecret) throw new Error(result.error ?? "Failed to start payout setup");
    return result.clientSecret;
  }, []);

  function closePanel() {
    // Stripe's component can call onExit from inside its own render/commit;
    // deferring avoids React's "update while rendering" guard on the router.
    queueMicrotask(() => {
      setPanel("none");
      router.refresh();
    });
  }

  function handleWithdraw() {
    setWithdrawError("");
    setWithdrawResult(null);
    startTransition(async () => {
      const result = await requestOrganizationWithdrawal();
      if (result.error) setWithdrawError(result.error);
      else if (result.amountCents && result.state) setWithdrawResult({ amountCents: result.amountCents, state: result.state });
      router.refresh();
    });
  }

  function handleRetry() {
    startTransition(async () => {
      const result = await retryOrganizationPayouts();
      if (result.error) setWithdrawError(result.error);
      router.refresh();
    });
  }

  const panelOpen = panel !== "none";

  return (
    <div className="flex flex-col gap-8">
      {/* Balances */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-[#e21d12] rounded-2xl p-6 text-white shadow-md sm:col-span-1">
          <p className="text-sm font-semibold opacity-80">{t("earningsAvailableLabel")}</p>
          <p className="mt-1 text-4xl font-bold">{formatPrice(overview.availableBalance)}</p>
          <p className="mt-2 text-xs opacity-80">{t("earningsAvailableHint")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-zinc-500">{t("earningsHeldLabel")}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{formatPrice(overview.heldBalance)}</p>
          {overview.holds.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2.5">
              {overview.holds.slice(0, 4).map((h) => (
                <li key={h.eventId} className="text-xs text-zinc-500 flex flex-col min-w-0">
                  <span className="truncate" title={h.eventTitle}>{h.eventTitle}</span>
                  <span className="font-semibold text-zinc-700">
                    {formatPrice(h.amountCents)} ·{" "}
                    {h.releasesAt ? t("earningsHeldUnlocks", { date: dateFmt(h.releasesAt) }) : t("earningsHeldCancelled")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">{t("earningsHeldNone")}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-zinc-500">{t("earningsTotalLabel")}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{formatPrice(overview.earnings.netCents)}</p>
          <p className="mt-2 text-xs text-zinc-500">
            {t("earningsTotalBreakdown", {
              count: overview.earnings.paymentCount,
              gross: formatPrice(overview.earnings.grossCents),
              fees: formatPrice(overview.earnings.stripeFeeCents + overview.earnings.platformFeeCents),
            })}
          </p>
        </div>
      </div>

      {/* Payout */}
      {canManagePayments && (
        <section className={`bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8 ${panelOpen ? "w-full" : ""}`}>
          <h2 className="text-base font-bold text-zinc-900 mb-4">{t("paymentsPayoutTitle")}</h2>
          {connectError && <p className="mb-4 text-sm font-semibold text-red-600">{connectError}</p>}

          {panelOpen ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-zinc-200 overflow-hidden">
                <ConnectPayoutOnboarding
                  mode={panel === "management" ? "management" : "onboarding"}
                  fetchClientSecret={fetchConnectClientSecret}
                  onExit={closePanel}
                  onLoadError={(message) => {
                    setConnectError(message ? `${t("paymentsErrorSetup")} (${message})` : t("paymentsErrorSetup"));
                    setPanel("none");
                  }}
                />
              </div>
              {panel === "management" && (
                <button
                  type="button"
                  onClick={closePanel}
                  className="self-end px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-zinc-900 hover:bg-zinc-800"
                >
                  {t("paymentsManagePayoutDone")}
                </button>
              )}
            </div>
          ) : readiness.state === "ready" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-600">
                {t("payoutDepositTo", {
                  bank: readiness.bankName ?? t("payoutYourBank"),
                  last4: readiness.last4 ?? "····",
                })}
              </p>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={isPending || overview.availableBalance <= 0}
                className="w-full sm:w-auto sm:self-start px-6 py-3 text-sm font-semibold text-white rounded-lg bg-zinc-900 hover:bg-zinc-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending
                  ? t("payoutWithdrawing")
                  : t("payoutWithdrawAll", { amount: formatPrice(overview.availableBalance) })}
              </button>
              {overview.availableBalance <= 0 && (
                <p className="text-xs text-zinc-500">
                  {nextRelease?.releasesAt
                    ? t("payoutNothingYetUnlocks", {
                        amount: formatPrice(nextRelease.amountCents),
                        date: dateFmt(nextRelease.releasesAt),
                      })
                    : t("payoutNothingYet")}
                </p>
              )}
              {withdrawResult && (
                <p className={`text-sm font-semibold ${withdrawResult.state === "returned" ? "text-red-600" : "text-emerald-700"}`}>
                  {t(`payoutResult_${withdrawResult.state}`, { amount: formatPrice(withdrawResult.amountCents) })}
                </p>
              )}
              {withdrawError && <p className="text-sm font-semibold text-red-600">{withdrawError}</p>}
              <button
                type="button"
                onClick={() => {
                  setConnectError("");
                  setPanel("management");
                }}
                className="self-start text-sm font-semibold text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
              >
                {t("paymentsManagePayoutAccount")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-600">
                {readiness.state === "needs_info"
                  ? readiness.disabledReason === "stripe_unreachable"
                    ? t("payoutStripeUnreachable")
                    : t("payoutNeedsInfo")
                  : t("paymentsConnectDescription")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setConnectError("");
                  setPanel("onboarding");
                }}
                className="w-full sm:w-auto sm:self-start px-6 py-3 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] shadow-sm"
              >
                {readiness.state === "needs_info" ? t("paymentsContinueConnect") : t("paymentsConnectButton")}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Payout history */}
      {overview.withdrawals.length > 0 && (
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8">
          <h2 className="text-base font-bold text-zinc-900 mb-4">{t("payoutHistoryTitle")}</h2>
          <ul className="flex flex-col divide-y divide-zinc-100">
            {overview.withdrawals.map((w) => (
              <li key={w.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{formatPrice(w.amountCents)}</p>
                  <p className="text-xs text-zinc-400">{t("payoutRequestedOn", { date: dateFmt(w.createdAt) })}</p>
                  {(w.state === "needs_bank" || w.state === "queued" || w.state === "returned") && w.detail && (
                    <p className="mt-1 text-xs text-zinc-500 max-w-md">{w.detail}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATE_STYLES[w.state]}`}>
                    {w.state === "on_the_way" && w.arrivalDate
                      ? t("payoutState_on_the_way_by", { date: dateFmt(w.arrivalDate) })
                      : t(`payoutState_${w.state}`)}
                  </span>
                  {w.state === "needs_bank" && canManagePayments && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isPending}
                      className="text-xs font-semibold text-[#e21d12] hover:underline disabled:opacity-50"
                    >
                      {t("payoutRetry")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FeeExplainer />

      {/* Refund fee policy */}
      <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-base font-bold text-zinc-900">{t("refundFeesTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {t("refundFeesPolicy", {
            events: overview.refundFees.freeEvents,
            days: overview.refundFees.windowDays,
          })}
        </p>
        {overview.refundFees.owedCents > 0 && (
          <p className="mt-3 text-sm font-semibold text-red-600">
            {t("refundFeesOwed", { amount: formatPrice(overview.refundFees.owedCents) })}
          </p>
        )}
        <p
          className={`mt-3 text-sm font-semibold ${overview.refundFees.chargesProcessingFee ? "text-red-600" : "text-zinc-700"}`}
        >
          {overview.refundFees.chargesProcessingFee
            ? t("refundFeesCharging", { days: overview.refundFees.windowDays })
            : t("refundFeesUsage", {
                used: overview.refundFees.refundedEventsInWindow,
                events: overview.refundFees.freeEvents,
                days: overview.refundFees.windowDays,
              })}
        </p>
      </section>

      {/* Transaction history */}
      <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-base font-bold text-zinc-900 mb-6">{t("paymentsHistoryTitle")}</h2>
        {overview.transactions.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("paymentsHistoryEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100">
            {overview.transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">
                    {tx.type === "withdrawal" && tx.amount > 0
                      ? t("paymentsType_withdrawal_reversed")
                      : t(`paymentsType_${tx.type}`)}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {tx.eventTitle ? `${tx.eventTitle} · ` : ""}
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className={`text-sm font-bold ${tx.amount >= 0 ? "text-emerald-600" : "text-zinc-700"}`}>
                  {tx.amount >= 0 ? "+" : "-"}
                  {formatPrice(Math.abs(tx.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
