// Real Teams feature — organization-owned teams directory backed by the
// "organization_team" table (scripts/migrate-organization-teams.mjs).
// Mirrors organizer/partners/page.tsx's exact pattern: permission-denied
// renders ComingSoonPanel, same pattern as organizer/people/page.tsx.
import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getOrganizationTeams } from "@/app/actions/organizer-teams";
import TeamsList from "@/components/organizer/TeamsList";
import ComingSoonPanel from "@/components/organizer/ComingSoonPanel";

export default async function TeamsPage() {
  const t = await getTranslations("Organizer");

  let teams;
  try {
    teams = await getOrganizationTeams();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <ComingSoonPanel
          eyebrow={t("navTeams")}
          title={t("teamsPermissionDeniedTitle")}
          badge={t("teamsPermissionDeniedBadge")}
          description={t("teamsPermissionDeniedDescription")}
        />
      );
    }
    throw error;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("navTeams")}</p>
      <h1 className="text-3xl font-extrabold text-zinc-900 mb-6" style={{ fontFamily: "var(--font-playfair)" }}>
        {t("navTeams")}
      </h1>

      <TeamsList teams={teams} />
    </div>
  );
}
