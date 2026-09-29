"use client";

// Shared sign-out flow: clear the auth session, then redirect to /auth/signin.
// This exact two-liner used to be duplicated across FeedSidebar, DashboardSidebar,
// OrganizerUserMenu, SignOutButton, and now ProfileSlideOver — kept here once so
// there's a single place to change it (e.g. if sign-out ever needs analytics,
// a confirmation step, etc.).
import { useRouter } from "@/i18n/routing";
import { signOut } from "@/lib/auth-client";

export function useSignOut() {
  const router = useRouter();

  return async function handleSignOut() {
    await signOut();
    router.push("/auth/signin");
  };
}
