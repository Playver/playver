"use client";

// Home/About/Media/Explore tabs for the public organization profile page
// (/organizations/[slug]). Same client-side tab-state pattern as
// AthleteProfileTabs (src/components/athletes/AthleteProfileTabs.tsx) — all
// tabs' content are rendered server-side and passed in as ReactNode, so
// switching tabs never triggers a refetch. initialTab comes from the URL
// (?tab=media, or a shared ?media=<id> link).
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export type OrganizationProfileTab = "home" | "about" | "media" | "explore";

export default function OrganizationPublicProfileTabs({
  homeContent,
  aboutContent,
  mediaContent,
  exploreContent,
  initialTab = "home",
}: {
  homeContent: ReactNode;
  aboutContent: ReactNode;
  mediaContent: ReactNode;
  exploreContent: ReactNode;
  initialTab?: OrganizationProfileTab;
}) {
  const t = useTranslations("OrganizationPublicProfile");
  const [tab, setTab] = useState<OrganizationProfileTab>(initialTab);

  return (
    <div>
      <div className="flex gap-6 border-b border-zinc-200 mb-6">
        <TabButton active={tab === "home"} onClick={() => setTab("home")}>
          {t("tabHome")}
        </TabButton>
        <TabButton active={tab === "about"} onClick={() => setTab("about")}>
          {t("tabAbout")}
        </TabButton>
        <TabButton active={tab === "media"} onClick={() => setTab("media")}>
          {t("tabMedia")}
        </TabButton>
        <TabButton active={tab === "explore"} onClick={() => setTab("explore")}>
          {t("tabExplore")}
        </TabButton>
      </div>
      <div className={tab === "home" ? "flex flex-col gap-6" : "hidden"}>{homeContent}</div>
      <div className={tab === "about" ? "flex flex-col gap-6" : "hidden"}>{aboutContent}</div>
      <div className={tab === "media" ? "" : "hidden"}>{mediaContent}</div>
      <div className={tab === "explore" ? "" : "hidden"}>{exploreContent}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative pb-3 text-sm font-bold transition-colors ${active ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
    >
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#e21d12] rounded-full" />}
    </button>
  );
}
