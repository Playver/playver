"use client";

// The buttons that open the site-wide search window (GlobalSearch):
// "pill" (desktop top bars), "icon" (mobile bars), "sidebar" (FeedSidebar
// nav row).
import { useTranslations } from "next-intl";
import { openGlobalSearch } from "@/components/search/GlobalSearch";
import { SearchIcon } from "@/components/search/search-ui";

export default function SearchButton({ variant, className = "" }: { variant: "pill" | "icon" | "sidebar"; className?: string }) {
  const t = useTranslations("Search");

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => openGlobalSearch()}
        aria-label={t("button")}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-zinc-600 hover:bg-zinc-100 transition-colors ${className}`}
      >
        <SearchIcon />
      </button>
    );
  }

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={() => openGlobalSearch()}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors text-left ${className}`}
      >
        <span className="text-zinc-400"><SearchIcon /></span>
        <span className="flex-1">{t("button")}</span>
        <kbd className="text-[10px] font-semibold text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openGlobalSearch()}
      className={`flex items-center gap-2 h-9 pl-3 pr-2 rounded-full border border-zinc-200 bg-white text-sm text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 transition-colors ${className}`}
    >
      <SearchIcon size={16} />
      <span className="truncate">{t("placeholder")}</span>
      <kbd className="ml-auto text-[10px] font-semibold text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5">⌘K</kbd>
    </button>
  );
}
