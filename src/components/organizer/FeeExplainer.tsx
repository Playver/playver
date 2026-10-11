"use client";

// "How fees work" card with a live calculator — shown on the org Earnings
// page and above the Payments ledger. Uses the same calculateFees() the
// server uses when crediting payments, so the example is always exact.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format-price";
import {
  calculateFees,
  PLATFORM_FEE_PERCENT,
  PROCESSING_FEE_FIXED_CENTS,
  PROCESSING_FEE_PERCENT,
} from "@/lib/payment-fees";

export default function FeeExplainer({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Organizer");
  const [price, setPrice] = useState("200");
  const cents = Math.round((parseFloat(price) || 0) * 100);
  const fees = calculateFees(cents);
  const rates = {
    processing: t("feesProcessingRate", {
      percent: PROCESSING_FEE_PERCENT,
      fixed: formatPrice(PROCESSING_FEE_FIXED_CENTS),
    }),
    platform: t("feesPlatformRate", { percent: PLATFORM_FEE_PERCENT }),
  };

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8">
      <h2 className="text-base font-bold text-zinc-900">{t("feesTitle")}</h2>
      <p className="mt-1 text-sm text-zinc-500">{t("feesIntro")}</p>

      <div className={`mt-6 grid gap-6 ${compact ? "" : "md:grid-cols-2"}`}>
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-zinc-600">
              <span className="font-semibold text-zinc-800">{t("feesProcessingLabel")}</span>
              <span className="block text-xs text-zinc-400">{t("feesProcessingHint")}</span>
            </dt>
            <dd className="font-semibold text-zinc-800 whitespace-nowrap">{rates.processing}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-zinc-600">
              <span className="font-semibold text-zinc-800">{t("feesPlatformLabel")}</span>
              <span className="block text-xs text-zinc-400">{t("feesPlatformHint")}</span>
            </dt>
            <dd className="font-semibold text-zinc-800 whitespace-nowrap">{rates.platform}</dd>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">{t("feesNoWithdrawalFee")}</p>
        </dl>

        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="fee-calc-price">
            {t("feesCalculatorLabel")}
          </label>
          <div className="relative mt-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-semibold">$</span>
            <input
              id="fee-calc-price"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full pl-7 pr-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-600">{t("feesRowPlayerPays")}</dt>
              <dd className="font-semibold text-zinc-800">{formatPrice(fees.grossCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-600">{t("feesProcessingLabel")}</dt>
              <dd className="text-zinc-600">−{formatPrice(fees.stripeFeeCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-600">{t("feesPlatformLabel")}</dt>
              <dd className="text-zinc-600">−{formatPrice(fees.platformFeeCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 mt-1">
              <dt className="font-bold text-zinc-900">{t("feesRowYouReceive")}</dt>
              <dd className="font-bold text-emerald-700">{formatPrice(fees.netCents)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
