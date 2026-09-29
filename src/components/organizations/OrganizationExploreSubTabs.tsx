"use client";

// Sub-navigation pills inside the public organization profile's Explore tab
// (/organizations/[slug]). Same client-side tab-state pattern as
// OrganizationPublicProfileTabs — all content is rendered server-side and
// passed in as ReactNode, so switching sub-tabs never triggers a refetch.
// The "partners" pill/content is entirely optional: the page only passes it
// when "partners" is in the org's enabledModules, so a non-partners org never
// even mounts the pill.
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export default function OrganizationExploreSubTabs({
  eventsContent,
  teamsContent,
  partnersContent,
}: {
  eventsContent: ReactNode;
  teamsContent: ReactNode;
  partnersContent?: ReactNode;
}) {
  const t = useTranslations("OrganizationPublicProfile");
  const [tab, setTab] = useState<"events" | "teams" | "partners">("events");

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <PillButton active={tab === "events"} onClick={() => setTab("events")}>
          {t("explorePillEvents")}
        </PillButton>
        <PillButton active={tab === "teams"} onClick={() => setTab("teams")}>
          {t("explorePillTeams")}
        </PillButton>
        {partnersContent !== undefined && (
          <PillButton active={tab === "partners"} onClick={() => setTab("partners")}>
            {t("explorePillPartners")}
          </PillButton>
        )}
      </div>
      <div className={tab === "events" ? "" : "hidden"}>{eventsContent}</div>
      <div className={tab === "teams" ? "" : "hidden"}>{teamsContent}</div>
      {partnersContent !== undefined && <div className={tab === "partners" ? "" : "hidden"}>{partnersContent}</div>}
    </div>
  );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
        active ? "bg-[#e21d12] text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
