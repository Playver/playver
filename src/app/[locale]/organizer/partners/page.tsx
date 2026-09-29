// Real Partners feature (Stage C) — sponsor/perk directory backed by the
// "organization_partner" table (scripts/migrate-organization-partners.mjs).
// Permission-denied renders ComingSoonPanel, same pattern as
// organizer/people/page.tsx.
import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getOrganizationPartners } from "@/app/actions/organizer-partners";
import PartnersList from "@/components/organizer/PartnersList";
import ComingSoonPanel from "@/components/organizer/ComingSoonPanel";

export default async function PartnersPage() {
  const t = await getTranslations("Organizer");

  let partners;
  try {
    partners = await getOrganizationPartners();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <ComingSoonPanel
          eyebrow={t("navPartners")}
          title={t("partnersPermissionDeniedTitle")}
          badge={t("partnersPermissionDeniedBadge")}
          description={t("partnersPermissionDeniedDescription")}
        />
      );
    }
    throw error;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("navPartners")}</p>
      <h1 className="text-3xl font-extrabold text-zinc-900 mb-6" style={{ fontFamily: "var(--font-playfair)" }}>
        {t("navPartners")}
      </h1>

      <PartnersList partners={partners} />
    </div>
  );
}
