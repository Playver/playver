// /dashboard/profile: kept alive only as a redirect to the merged
// /athletes/[userId] profile page (Stage B retired this route as a separate
// editing surface — see ARCHITECTURE.md-adjacent frontend-refactor plan).
// Old bookmarks/links into /dashboard/profile still land somewhere useful.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/signin");
  redirect(`/athletes/${session.user.id}`);
}
