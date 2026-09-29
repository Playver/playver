// /dashboard/organizations: lists every org the signed-in user belongs to
// (role + member count), lets them jump into that org's dashboard, and offers
// the same "create another organization" launcher used on the home feed.
import { getTranslations } from "next-intl/server";
import { getUserOrganizationsWithMemberCount } from "@/app/actions/organization";
import OrganizationsList from "@/components/dashboard/OrganizationsList";

export default async function ManageOrganizationsPage() {
  const [t, tOrganizer, organizations] = await Promise.all([
    getTranslations("ManageOrganizations"),
    getTranslations("Organizer"),
    getUserOrganizationsWithMemberCount(),
  ]);

  const rows = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    logoUrl: org.logoUrl,
    roleLabel: tOrganizer(`role_${org.role}`),
    memberCountLabel: t("memberCount", { count: org.memberCount }),
    isDraft: org.publicationStatus !== "published",
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("eyebrow")}</p>
      <h1
        className="text-3xl font-bold text-zinc-900 mb-2"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        {t("title")}
      </h1>
      <p className="text-zinc-500 text-sm mb-10">{t("subtitle")}</p>

      <OrganizationsList
        organizations={rows}
        dashboardLabel={t("dashboardButton")}
        createAnotherLabel={t("createAnother")}
        draftBadgeLabel={tOrganizer("draftBadge")}
        emptyStateLabel={t("emptyState")}
      />
    </div>
  );
}
