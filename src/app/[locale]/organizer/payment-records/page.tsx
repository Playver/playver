// Org-wide payments ledger (/organizer/payment-records) — a transaction-record
// list distinct from the org wallet/payout page at /organizer/payments
// (labeled "Earnings" — see OrganizerSidebar.tsx). Combines event_payment and
// tournament_team_payment rows; see getOrganizationPayments in
// organizer-registrations.ts for the full normalization + real-data caveats.
import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getOrganizationPayments } from "@/app/actions/organizer-registrations";
import ComingSoonPanel from "@/components/organizer/ComingSoonPanel";
import PaymentsLedger from "@/components/organizer/PaymentsLedger";

export default async function PaymentRecordsPage() {
  const t = await getTranslations("Organizer");

  let data;
  try {
    data = await getOrganizationPayments();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <ComingSoonPanel
          eyebrow={t("navPaymentRecords")}
          title={t("paymentRecordsPermissionDeniedTitle")}
          badge={t("paymentRecordsPermissionDeniedBadge")}
          description={t("paymentRecordsPermissionDeniedDescription")}
        />
      );
    }
    throw error;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("navPaymentRecords")}</p>
      <h1 className="text-3xl font-extrabold text-zinc-900 mb-6" style={{ fontFamily: "var(--font-playfair)" }}>
        {t("navPaymentRecords")}
      </h1>

      <PaymentsLedger
        payments={data.payments}
        canViewContactInfo={data.canViewContactInfo}
        canIssueRefunds={data.canIssueRefunds}
      />
    </div>
  );
}
