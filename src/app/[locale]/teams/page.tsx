// Public /teams browse page — fetches all standalone teams + (if signed in)
// which ones the user belongs to, renders via the client-side TeamsGrid.
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import TeamsGrid from "@/components/teams/TeamsGrid";
import CreateTeamButton from "@/components/teams/CreateTeamButton";
import { getTeams, getMembershipMap } from "@/app/actions/team";
import { auth } from "@/lib/auth";

export default async function TeamsPage() {
  const t = await getTranslations("Teams");
  const teams = await getTeams();

  const session = await auth.api.getSession({ headers: await headers() });
  const currentUserId = session?.user?.id ?? null;

  const memberSet = currentUserId
    ? await getMembershipMap(teams.map((team) => team.id))
    : new Set<string>();

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-20">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-4">
                {t("eyebrow")}
              </p>
              <h1
                className="text-4xl sm:text-5xl font-bold text-zinc-900 mb-4"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {t("title")}
              </h1>
              <p className="text-zinc-500 text-lg max-w-xl">{t("subtitle")}</p>
            </div>
            {session && (
              <div className="shrink-0 pt-1">
                <CreateTeamButton label={t("createTeam")} />
              </div>
            )}
          </div>

          <TeamsGrid
            teams={teams}
            currentUserId={currentUserId}
            initialJoinedIds={[...memberSet]}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
