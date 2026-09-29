// Auth-gated shell for the organizer console (/organizer/*). Requires a
// session AND an active organization (via the active_org_id cookie, resolved
// by getActiveOrganization() — see src/app/actions/organization.ts); if the
// user has no org yet, shows an empty state with the create-org wizard
// launcher instead of the normal chrome. Otherwise wraps OrganizerTopNav +
// OrganizerSidebar (scoped to `active.role`, an OrgRole, not the site-wide
// user.role from dashboard/layout.tsx) in OrganizerAppShell, which adds the
// outer Home/Explore/Create app rail (same one used everywhere else in the
// redesign) so the organizer console isn't a dead end you can't navigate
// out of back to the rest of the app.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getActiveOrganization, getUserOrganizations } from "@/app/actions/organization";
import { computeCompleteness } from "@/lib/organization-completeness";
import Navbar from "@/components/layout/Navbar";
import OrganizerTopNav from "@/components/organizer/OrganizerTopNav";
import OrganizerSidebar from "@/components/organizer/OrganizerSidebar";
import OrganizerAppShell from "@/components/organizer/OrganizerAppShell";
import EmptyStateCreateOrganization from "@/components/organizer/EmptyStateCreateOrganization";
import EmptyStateResumeDraft from "@/components/organizer/EmptyStateResumeDraft";

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/signin");

  const [active, organizations, t] = await Promise.all([
    getActiveOrganization(),
    getUserOrganizations(),
    getTranslations("Organizer"),
  ]);

  // A draft org's admin console isn't accessible until it's actually
  // published — reaching this point with a draft active (e.g. the
  // active_org_id cookie points at an org they started creating but haven't
  // finished) sends them back into the wizard to finish it instead of
  // rendering real dashboard chrome for something that was never published.
  if (!active || active.organization.publicationStatus !== "published") {
    if (active) {
      return (
        <>
          <Navbar />
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-16">
            <div className="flex flex-col items-center gap-3 text-center max-w-sm">
              <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12]">{t("draftEyebrow")}</p>
              <h1 className="text-2xl font-extrabold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
                {t("draftTitle")}
              </h1>
              <p className="text-sm text-zinc-500 mb-4">{t("draftSubtitle", { name: active.organization.name })}</p>
              <EmptyStateResumeDraft organizationId={active.organization.id} />
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <Navbar />
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-16">
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12]">{t("emptyEyebrow")}</p>
            <h1 className="text-2xl font-extrabold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
              {t("emptyTitle")}
            </h1>
            <p className="text-sm text-zinc-500 mb-4">{t("emptySubtitle")}</p>
            <EmptyStateCreateOrganization />
          </div>
        </div>
      </>
    );
  }

  return (
    <OrganizerAppShell
      user={{ id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }}
    >
      <OrganizerTopNav
        organizationId={active.organization.id}
        organizationSlug={active.organization.slug}
        organizationPublished={active.organization.publicationStatus === "published"}
        role={active.role}
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
        userImage={session.user.image ?? null}
      />
      <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
        <OrganizerSidebar
          organizations={organizations}
          activeOrganizationId={active.organization.id}
          organizationName={active.organization.name}
          organizationLogoUrl={active.organization.logoUrl}
          role={active.role}
          userName={session.user.name ?? ""}
          completeness={computeCompleteness(active.organization)}
          enabledModules={active.organization.enabledModules}
        />
        <main className="flex-1 bg-zinc-50 overflow-auto pb-16 md:pb-0">{children}</main>
      </div>
    </OrganizerAppShell>
  );
}
