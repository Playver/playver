"use client";

// Client half of the Manage Organizations page — needs interactivity for the
// "Dashboard" button (flips active_org_id then navigates) and the "+ Create
// Another Organization" launcher. Everything else (role/member-count labels)
// is precomputed server-side in page.tsx and passed down as plain strings,
// since Server->Client props can't carry functions/translators.
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { setActiveOrganization } from "@/app/actions/organization";
import CreateOrganizationLauncher from "@/components/organizer/create-wizard/CreateOrganizationLauncher";

export type ManageOrganizationRow = {
  id: string;
  name: string;
  logoUrl: string | null;
  roleLabel: string;
  memberCountLabel: string;
  isDraft: boolean;
};

export default function OrganizationsList({
  organizations,
  dashboardLabel,
  createAnotherLabel,
  draftBadgeLabel,
  emptyStateLabel,
}: {
  organizations: ManageOrganizationRow[];
  dashboardLabel: string;
  createAnotherLabel: string;
  draftBadgeLabel: string;
  emptyStateLabel: string;
}) {
  const router = useRouter();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Same pattern as OrganizerSwitcher.tsx's handleSelect(), but this page
  // isn't already under /organizer/*, so it navigates instead of refreshing.
  async function handleDashboard(organizationId: string) {
    setSwitchingId(organizationId);
    const result = await setActiveOrganization(organizationId);
    setSwitchingId(null);
    if (!result.error) {
      router.push("/organizer/overview");
    }
  }

  // Same pattern FeedSidebar.tsx already uses for CreateOrganizationLauncher.
  async function handleOrgPublished(organizationId: string) {
    await setActiveOrganization(organizationId);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {organizations.length === 0 && (
        <p className="text-sm text-zinc-500 mb-2">{emptyStateLabel}</p>
      )}

      {organizations.map((org) => (
        <div
          key={org.id}
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <span className="size-12 rounded-xl bg-[#e21d12] flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
            {org.logoUrl ? (
              <Image src={org.logoUrl} alt="" width={48} height={48} className="w-full h-full object-cover" />
            ) : (
              org.name[0]?.toUpperCase() ?? "?"
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-zinc-900 truncate">{org.name}</p>
              {org.isDraft && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                  {draftBadgeLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {org.roleLabel} · {org.memberCountLabel}
            </p>
          </div>

          <button
            type="button"
            disabled={switchingId === org.id}
            onClick={() => handleDashboard(org.id)}
            className="shrink-0 px-4 py-2 text-sm font-bold text-white bg-[#e21d12] rounded-lg hover:bg-[#c31710] transition-colors disabled:opacity-60"
          >
            {dashboardLabel}
          </button>
        </div>
      ))}

      <CreateOrganizationLauncher
        onPublished={handleOrgPublished}
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-[#e21d12] rounded-2xl border-2 border-dashed border-zinc-200 hover:border-red-300 hover:bg-red-50/50 transition-colors"
          >
            {createAnotherLabel}
          </button>
        )}
      />
    </div>
  );
}
