"use client";

// Shared Public/Admin segmented control — shown in the organizer console's
// own top bar (OrganizerTopNav, mode="admin") AND on the org's public page
// for a viewer who admins that org (organizations/[slug]/page.tsx,
// mode="public"), so switching to Public doesn't strand you without a way
// back to Admin. The two modes are mirror images of each other: whichever
// side matches the current page renders as the static/active pill, the
// other renders as the real navigation control.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { setActiveOrganization } from "@/app/actions/organization";

export default function PublicAdminToggle({
  mode,
  organizationId,
  organizationSlug,
  organizationPublished = true,
}: {
  mode: "admin" | "public";
  organizationId: string;
  organizationSlug: string;
  // Only relevant for mode="admin" — mode="public" implies the org is
  // already published (you can't be viewing an unpublished org's public
  // page at all, per getPublicOrganizationProfile's own gating).
  organizationPublished?: boolean;
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function goAdmin() {
    setSwitching(true);
    await setActiveOrganization(organizationId);
    router.push("/organizer/overview");
  }

  return (
    <div className="flex items-center rounded-full border border-zinc-200 p-0.5 text-xs font-semibold">
      {mode === "public" ? (
        <span className="px-3 py-1.5 rounded-full bg-zinc-900 text-white">{t("publicView")}</span>
      ) : organizationPublished ? (
        <Link
          href={`/organizations/${organizationSlug}`}
          className="px-3 py-1.5 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          {t("publicView")}
        </Link>
      ) : (
        <span title={t("publicViewUnpublished")} className="px-3 py-1.5 rounded-full text-zinc-300 cursor-not-allowed">
          {t("publicView")}
        </span>
      )}

      {mode === "admin" ? (
        <span className="px-3 py-1.5 rounded-full bg-zinc-900 text-white">{t("adminView")}</span>
      ) : (
        <button
          type="button"
          onClick={goAdmin}
          disabled={switching}
          className="px-3 py-1.5 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-60"
        >
          {t("adminView")}
        </button>
      )}
    </div>
  );
}
