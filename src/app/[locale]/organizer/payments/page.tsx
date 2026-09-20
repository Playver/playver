// Org wallet page (/organizer/payments) — permission-denied renders
// ComingSoonPanel instead of throwing, same pattern as the other
// permission-gated organizer pages.
import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getOrganizationWalletOverview } from "@/app/actions/organizer-wallet";
import { requireOrganizationPermission } from "@/app/actions/organization";
import { hasPermission } from "@/lib/organizer-permissions";
import ComingSoonPanel from "@/components/organizer/ComingSoonPanel";
import OrganizerPaymentsClient from "@/components/organizer/OrganizerPaymentsClient";

export default async function OrganizerPaymentsPage() {
  const t = await getTranslations("Organizer");

  let overview, canManagePayments;
  try {
    overview = await getOrganizationWalletOverview();
    // VIEW_PAYMENTS is enough to load the page; MANAGE_PAYMENTS (checked
    // separately) additionally gates the Connect/withdraw controls.
    const { role } = await requireOrganizationPermission("VIEW_PAYMENTS");
    canManagePayments = hasPermission(role, "MANAGE_PAYMENTS");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <ComingSoonPanel
          eyebrow={t("navPayments")}
          title={t("paymentsPermissionDeniedTitle")}
          badge={t("paymentsPermissionDeniedBadge")}
          description={t("paymentsPermissionDeniedDescription")}
        />
      );
    }
    throw error;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("navPayments")}</p>
      <h1 className="text-3xl font-bold text-zinc-900 mb-10" style={{ fontFamily: "var(--font-playfair)" }}>
        {t("navPayments")}
      </h1>

      <OrganizerPaymentsClient overview={overview} canManagePayments={canManagePayments} />
    </div>
  );
}
