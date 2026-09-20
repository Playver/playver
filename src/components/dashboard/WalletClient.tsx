"use client";

// Athlete wallet page (/dashboard/wallet) — the player-side twin of
// OrganizerPaymentsClient.tsx. `overview.availableBalance` already excludes
// the withdrawal hold; see wallet.ts's duplicated-constants note.
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format-price";
import { createConnectAccountSession, requestWithdrawal } from "@/app/actions/wallet";
import type { WalletTransaction } from "@/app/actions/wallet";
import ConnectPayoutOnboarding from "@/components/payments/ConnectPayoutOnboarding";

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000]; // cents

export default function WalletClient({
  overview,
  depositSuccess,
}: {
  overview: {
    balance: number;
    heldBalance: number;
    availableBalance: number;
    connectAccountId: string | null;
    connectOnboarded: boolean;
    transactions: WalletTransaction[];
  };
  depositSuccess: boolean;
}) {
  const t = useTranslations("DashboardWallet");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [justExitedOnboarding, setJustExitedOnboarding] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const fetchConnectClientSecret = useCallback(async () => {
    const result = await createConnectAccountSession();
    if (!result.clientSecret) throw new Error(result.error ?? "Failed to start onboarding");
    return result.clientSecret;
  }, []);

  function handleOnboardingExit() {
    setShowOnboarding(false);
    setJustExitedOnboarding(true);
    router.refresh();
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(depositAmount) * 100);
    if (!amountCents || amountCents < 100) {
      setDepositError(t("errorMinDeposit"));
      return;
    }
    setDepositLoading(true);
    setDepositError("");
    try {
      const res = await fetch("/api/stripe/wallet-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const { url, error } = await res.json();
      if (url) {
        window.location.href = url;
        return;
      }
      setDepositError(error ?? t("errorGeneric"));
    } catch {
      setDepositError(t("errorGeneric"));
    }
    setDepositLoading(false);
  }

  function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(withdrawAmount) * 100);
    if (!amountCents || amountCents < 1000) {
      setWithdrawError(t("errorMinWithdrawal"));
      return;
    }
    setWithdrawError("");
    setWithdrawSuccess(false);
    startTransition(async () => {
      const result = await requestWithdrawal(amountCents);
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
      {depositSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-semibold">
          {t("depositSuccess")}
        </div>
      )}
      {justExitedOnboarding && !overview.connectOnboarded && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-semibold">
          {t("connectPending")}
        </div>
      )}

      {/* Balance card */}
      <div className="bg-[#e21d12] rounded-2xl p-8 text-white max-w-sm shadow-md">
        <p className="text-sm font-semibold opacity-80 mb-1">{t("balanceLabel")}</p>
        <p className="text-4xl font-bold">{formatPrice(overview.balance)}</p>
        {overview.heldBalance > 0 && (
          <p className="mt-3 text-xs font-semibold opacity-80">
            {t("heldBalanceNote", { amount: formatPrice(overview.heldBalance) })}
          </p>
        )}
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        {/* Add money form */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          <h2 className="text-base font-bold text-zinc-900 mb-6">{t("formTitle")}</h2>
          <form onSubmit={handleDeposit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-zinc-700">{t("amountLabel")}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-semibold">$</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {PRESET_AMOUNTS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => setDepositAmount((cents / 100).toString())}
                  className="flex-1 py-2 text-xs font-semibold border border-zinc-200 rounded-lg text-zinc-600 hover:border-[#e21d12] hover:text-[#e21d12] transition-colors"
                >
                  {formatPrice(cents)}
                </button>
              ))}
            </div>
            {depositError && <p className="text-xs font-semibold text-red-600">{depositError}</p>}
            <button
              type="submit"
              disabled={depositLoading}
              className="w-full py-3 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm disabled:opacity-60"
            >
              {depositLoading ? "..." : t("submit")}
            </button>
          </form>
        </div>

        {/* Payout / withdraw */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          <h2 className="text-base font-bold text-zinc-900 mb-6">{t("payoutTitle")}</h2>
          {!overview.connectOnboarded ? (
            <div className="flex flex-col gap-4">
              {!showOnboarding && <p className="text-sm text-zinc-500">{t("connectDescription")}</p>}
              {connectError && <p className="text-xs font-semibold text-red-600">{connectError}</p>}
              {showOnboarding ? (
                <div className="rounded-lg border border-zinc-200 overflow-hidden">
                  <ConnectPayoutOnboarding
                    fetchClientSecret={fetchConnectClientSecret}
                    onExit={handleOnboardingExit}
                    onLoadError={() => {
                      setConnectError(t("errorGeneric"));
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
                  {overview.connectAccountId ? t("continueConnect") : t("connectButton")}
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleWithdraw} className="flex flex-col gap-5">
              <p className="text-xs text-zinc-500">
                {t("availableToWithdraw", { amount: formatPrice(overview.availableBalance) })}
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-zinc-700">{t("withdrawAmountLabel")}</label>
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
              {withdrawSuccess && <p className="text-xs font-semibold text-emerald-600">{t("withdrawSuccess")}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 text-sm font-semibold text-white rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-60"
              >
                {isPending ? "..." : t("withdrawButton")}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h2 className="text-base font-bold text-zinc-900 mb-6">{t("historyTitle")}</h2>
        {overview.transactions.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("historyEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100">
            {overview.transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">
                    {tx.type === "withdrawal" && tx.amount > 0 ? t("type_withdrawal_reversed") : t(`type_${tx.type}`)}
                  </p>
                  <p className="text-xs text-zinc-400">{new Date(tx.createdAt).toLocaleString()}</p>
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
