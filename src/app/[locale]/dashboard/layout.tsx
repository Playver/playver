// Auth-gated shell for the athlete dashboard (/dashboard/*): redirects
// anonymous visitors to sign-in, then renders LoggedInPageShell (the
// Home/Explore/Create sidebar shared across the redesign) with
// DashboardSidebar as a second, section-scoped nav alongside the page
// content — same layering as OrganizerAppShell + OrganizerSidebar. The
// site-wide user.role ("player"/"organizer"/"super_admin") is read here for
// the sidebar, separate from the per-org OrgRole used under /organizer/*.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import LoggedInPageShell from "@/components/layout/LoggedInPageShell";
import ProfileDashboardToggle from "@/components/layout/ProfileDashboardToggle";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { getUserOrganizations } from "@/app/actions/organization";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/signin");
  }

  const [roleResult, organizations] = await Promise.all([
    pool.query(`SELECT role FROM "user" WHERE id = $1`, [session.user.id]),
    getUserOrganizations(),
  ]);

  const user = {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: (roleResult.rows[0]?.role ?? "player") as string,
  };
  const hasOrganization = organizations.some((org) => org.publicationStatus === "published");

  return (
    <LoggedInPageShell
      user={{ id: session.user.id, name: user.name, email: user.email, image: session.user.image ?? null }}
      hasOrganization={hasOrganization}
      topBarExtra={<ProfileDashboardToggle mode="dashboard" userId={session.user.id} />}
    >
      <div className="flex flex-1">
        <DashboardSidebar user={user} />
        <div className="flex-1 min-w-0 bg-zinc-50">{children}</div>
      </div>
    </LoggedInPageShell>
  );
}
