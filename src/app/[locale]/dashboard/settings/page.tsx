// /dashboard/settings: profile-name and change-password forms. Note these
// forms are not wired to any server action yet (no onSubmit/action, no
// updateUserProfile call) — they render pre-filled but "Save" currently
// does nothing. Real profile editing lives on the merged /athletes/[userId]
// page (/dashboard/profile just redirects there).
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

export default async function DashboardSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const t = await getTranslations("DashboardSettings");
  const user = session!.user;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">
        {t("eyebrow")}
      </p>
      <h1
        className="text-3xl font-bold text-zinc-900 mb-2"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        {t("title")}
      </h1>
      <p className="text-zinc-500 text-sm mb-10">{t("subtitle")}</p>

      {/* Profile settings */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 max-w-lg mb-6">
        <h2 className="text-base font-bold text-zinc-900 mb-6">{t("profileTitle")}</h2>
        <form className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-zinc-700">{t("nameLabel")}</label>
            <input
              type="text"
              defaultValue={user.name ?? ""}
              className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-zinc-700">{t("emailLabel")}</label>
            <input
              type="email"
              defaultValue={user.email ?? ""}
              disabled
              className="w-full px-4 py-3 text-sm bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-400 cursor-not-allowed"
            />
            <p className="text-xs text-zinc-400">{t("emailHint")}</p>
          </div>
          <button
            type="submit"
            className="self-start px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm"
          >
            {t("saveProfile")}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 max-w-lg">
        <h2 className="text-base font-bold text-zinc-900 mb-6">{t("passwordTitle")}</h2>
        <form className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-zinc-700">{t("currentPasswordLabel")}</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-zinc-700">{t("newPasswordLabel")}</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
            />
          </div>
          <button
            type="submit"
            className="self-start px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors shadow-sm"
          >
            {t("savePassword")}
          </button>
        </form>
      </div>
    </div>
  );
}
