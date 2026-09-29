"use client";

// Replaces the old anchor-scroll <section id="..."> + MobileSectionNav
// pattern with real client-side tab state. Both tabs' content are fetched
// and rendered server-side (passed in as ReactNode) — this component only
// owns which one is visible, so switching tabs never triggers a refetch.
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export default function AthleteProfileTabs({
  aboutContent,
  achievementsContent,
}: {
  aboutContent: ReactNode;
  achievementsContent: ReactNode;
}) {
  const t = useTranslations("AthleteProfile");
  const [tab, setTab] = useState<"about" | "achievements">("about");

  return (
    <div>
      <div className="flex gap-6 border-b border-zinc-200 mb-6">
        <TabButton active={tab === "about"} onClick={() => setTab("about")}>
          {t("tabAbout")}
        </TabButton>
        <TabButton active={tab === "achievements"} onClick={() => setTab("achievements")}>
          {t("tabAchievements")}
        </TabButton>
      </div>
      <div className={tab === "about" ? "flex flex-col gap-6" : "hidden"}>{aboutContent}</div>
      <div className={tab === "achievements" ? "" : "hidden"}>{achievementsContent}</div>
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
