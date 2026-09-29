"use client";

// Public/Admin-style segmented control for your OWN identity, mirroring
// PublicAdminToggle's organization pattern: /athletes/[userId] (how others
// see you) and /dashboard (managing your teams/events/wallet) are the
// profile equivalent of an org's public page vs. its admin console. Whichever
// side matches the current page renders as the static/active pill; the other
// is a real link, so switching never strands you. No org-switch side effect
// needed here (unlike PublicAdminToggle), so this is a plain nav control.
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function ProfileDashboardToggle({
  mode,
  userId,
}: {
  mode: "profile" | "dashboard";
  userId: string;
}) {
  const t = useTranslations("ProfileMenu");

  return (
    <div className="flex items-center rounded-full border border-zinc-200 p-0.5 text-xs font-semibold">
      {mode === "profile" ? (
        <span className="px-3 py-1.5 rounded-full bg-zinc-900 text-white">{t("viewProfile")}</span>
      ) : (
        <Link
          href={`/athletes/${userId}`}
          className="px-3 py-1.5 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          {t("viewProfile")}
        </Link>
      )}

      {mode === "dashboard" ? (
        <span className="px-3 py-1.5 rounded-full bg-zinc-900 text-white">{t("viewDashboard")}</span>
      ) : (
        <Link
          href="/dashboard"
          className="px-3 py-1.5 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          {t("viewDashboard")}
        </Link>
      )}
    </div>
  );
}
