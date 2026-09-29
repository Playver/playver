// Operational org content (/organizer/settings) — Legal/insurance/policy
// docs and Stripe payout onboarding. Replaces Stage C's ComingSoonPanel stub
// with real content moved out of the old 10-step wizard (Step6Legal,
// Step9Payments). Admin invites (old Step8Admins) are NOT duplicated here —
// /organizer/people already owns staff invitations end to end.
// Permission-denied renders ComingSoonPanel, same pattern as
// /organizer/partners and /organizer/people. The payout section is gated
// separately (VIEW_PAYMENTS/MANAGE_PAYMENTS) from the page's own Legal gate
// (MANAGE_ORGANIZATION_PROFILE) so a role that can edit one but not view the
// other still sees whichever section it has access to, rather than the
// whole page falling back to ComingSoonPanel.
import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getActiveOrganizationProfile, requireOrganizationPermission } from "@/app/actions/organization";
import { getOrganizationWalletOverview } from "@/app/actions/organizer-wallet";
import { hasPermission } from "@/lib/organizer-permissions";
import ComingSoonPanel from "@/components/organizer/ComingSoonPanel";
import OrganizerLegalSection from "@/components/organizer/OrganizerLegalSection";
import OrganizerPayoutSection from "@/components/organizer/OrganizerPayoutSection";

export default async function OrganizerSettingsPage() {
  const t = await getTranslations("Organizer");

  let profile;
  try {
    profile = await getActiveOrganizationProfile();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <ComingSoonPanel
          eyebrow={t("navSettings")}
          title={t("settingsPermissionDeniedTitle")}
          badge={t("settingsPermissionDeniedBadge")}
          description={t("settingsPermissionDeniedDescription")}
        />
      );
    }
    throw error;
  }

  let connectOnboarded: boolean | null = null;
  try {
    const overview = await getOrganizationWalletOverview();
    const { role } = await requireOrganizationPermission("VIEW_PAYMENTS");
    if (hasPermission(role, "MANAGE_PAYMENTS")) connectOnboarded = overview.connectOnboarded;
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("navSettings")}</p>
        <h1 className="text-3xl font-extrabold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
          {t("navSettings")}
        </h1>
      </div>

      <OrganizerLegalSection
        legalName={profile.legalName ?? ""}
        registrationNumber={profile.registrationNumber ?? ""}
        organizationStatus={profile.organizationStatus ?? "Non-profit"}
        insuranceProvider={profile.insuranceProvider ?? ""}
        insurancePolicyNumber={profile.insurancePolicyNumber ?? ""}
        refundPolicyMode={profile.refundPolicyUrl ? "upload" : "write"}
        refundPolicyUrl={profile.refundPolicyUrl ?? ""}
        refundPolicyText={profile.refundPolicyText ?? ""}
        privacyPolicyMode={profile.privacyPolicyUrl ? "upload" : "write"}
        privacyPolicyUrl={profile.privacyPolicyUrl ?? ""}
        privacyPolicyText={profile.privacyPolicyText ?? ""}
        codeOfConductMode={profile.codeOfConductUrl ? "upload" : "write"}
        codeOfConductUrl={profile.codeOfConductUrl ?? ""}
        codeOfConductText={profile.codeOfConductText ?? ""}
      />

      {connectOnboarded !== null && <OrganizerPayoutSection connectOnboarded={connectOnboarded} />}
    </div>
  );
}
