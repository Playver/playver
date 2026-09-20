// /dashboard/wallet: athlete wallet balance/transactions. `deposit` query
// param is set by Stripe redirecting back here after a wallet top-up
// Checkout session, read by WalletClient to show the success banner.
// Connect onboarding no longer redirects — see ConnectPayoutOnboarding.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getWalletOverview } from "@/app/actions/wallet";
import WalletClient from "@/components/dashboard/WalletClient";

export default async function DashboardWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ deposit?: string }>;
}) {
  const [session, t, params] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getTranslations("DashboardWallet"),
    searchParams,
  ]);

  if (!session) redirect("/auth/signin");

  const overview = await getWalletOverview();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">
        {t("eyebrow")}
      </p>
      <h1
        className="text-3xl font-bold text-zinc-900 mb-2"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        {t("title")}
      </h1>
      <p className="text-zinc-500 text-sm mb-10">{t("subtitle")}</p>

      <WalletClient overview={overview} depositSuccess={params.deposit === "success"} />
    </div>
  );
}
