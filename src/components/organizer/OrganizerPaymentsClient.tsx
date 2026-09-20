"use client";

// Org wallet page: Stripe Connect onboarding link + balance/withdrawal UI.
// `overview.availableBalance` already excludes the 48h post-event hold (see
// organizer-wallet.ts) — this component just renders it, no hold-math here.
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format-price";
import { createOrganizationConnectAccountSession, requestOrganizationWithdrawal } from "@/app/actions/organizer-wallet";
import type { OrganizationWalletTransaction } from "@/app/actions/organizer-wallet";
import ConnectPayoutOnboarding from "@/components/payments/ConnectPayoutOnboarding";

export default function OrganizerPaymentsClient({
  overview,
  canManagePayments,
}: {
  overview: {
    balance: number;
    heldBalance: number;
    availableBalance: number;
    connectAccountId: string | null;
    connectOnboarded: boolean;
    transactions: OrganizationWalletTransaction[];
  };
  canManagePayments: boolean;
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [justExitedOnboarding, setJustExitedOnboarding] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const fetchConnectClientSecret = useCallback(async () => {
    const result = await createOrganizationConnectAccountSession();
    if (!result.clientSecret) throw new Error(result.error ?? "Failed to start onboarding");
    return result.clientSecret;
  }, []);

  function handleOnboardingExit() {
    setShowOnboarding(false);
    setJustExitedOnboarding(true);
    router.refresh();
  }

  function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(withdrawAmount) * 100);
    if (!amountCents || amountCents < 1000) {
      setWithdrawError(t("paymentsErrorMinWithdrawal"));
      return;
    }
    setWithdrawError("");
    setWithdrawSuccess(false);
    startTransition(async () => {
      const result = await requestOrganizationWithdrawal(amountCents);
      if (result.error) {
        setWithdrawError(result.error);
      } else {
        setWithdrawAmount("");
        setWithdrawSuccess(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {justExitedOnboarding && !overview.connectOnboarded && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-semibold">
          {t("paymentsConnectPending")}
        </div>
      )}

      {/* Balance card */}
      <div className="bg-[#e21d12] rounded-2xl p-8 text-white max-w-sm shadow-md">
        <p className="text-sm font-semibold opacity-80 mb-1">{t("paymentsBalanceLabel")}</p>
        <p className="text-4xl font-bold">{formatPrice(overview.balance)}</p>
        {overview.heldBalance > 0 && (
          <p className="mt-3 text-xs font-semibold opacity-80">
            {t("paymentsHeldBalanceNote", { amount: formatPrice(overview.heldBalance) })}
          </p>
        )}
      </div>

      {canManagePayments && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 max-w-md">
          <h2 className="text-base font-bold text-zinc-900 mb-6">{t("paymentsPayoutTitle")}</h2>
          {!overview.connectOnboarded ? (
            <div className="flex flex-col gap-4">
              {!showOnboarding && <p className="text-sm text-zinc-500">{t("paymentsConnectDescription")}</p>}
              {connectError && <p className="text-xs font-semibold text-red-600">{connectError}</p>}
              {showOnboarding ? (
                <div className="rounded-lg border border-zinc-200 overflow-hidden">
                  <ConnectPayoutOnboarding
                    fetchClientSecret={fetchConnectClientSecret}
                    onExit={handleOnboardingExit}
                    onLoadError={() => {
                      setConnectError(t("paymentsErrorGeneric"));
                      setShowOnboarding(false);
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConnectError("");
                    setShowOnboarding(true);
                  }}
                  className="w-full py-3 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm"
                >
                  {overview.connectAccountId ? t("paymentsContinueConnect") : t("paymentsConnectButton")}
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleWithdraw} className="flex flex-col gap-5">
              <p className="text-xs text-zinc-500">
                {t("paymentsAvailableToWithdraw", { amount: formatPrice(overview.availableBalance) })}
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-zinc-700">{t("paymentsWithdrawAmountLabel")}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-semibold">$</span>
                  <input
                    type="number"
                    min="10"
                    max={overview.availableBalance / 100}
                    step="0.01"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
                  />
                </div>
              </div>
              {withdrawError && <p className="text-xs font-semibold text-red-600">{withdrawError}</p>}
              {withdrawSuccess && <p className="text-xs font-semibold text-emerald-600">{t("paymentsWithdrawSuccess")}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 text-sm font-semibold text-white rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-60"
              >
                {isPending ? "..." : t("paymentsWithdrawButton")}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
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
      </div>
    </div>
  );
}
