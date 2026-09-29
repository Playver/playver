// Public-facing org content (/organizer/profile) — branding (cover/brand
// color), About, and Contact. Replaces Stage C's ComingSoonPanel stub with
// real content moved out of the old 10-step wizard (Step3Branding minus the
// profile-picture half, Step4About, Step5Contact — profile picture itself
// now lives in the wizard's Step1Profile). Permission-denied renders
// ComingSoonPanel, same pattern as /organizer/partners and /organizer/people.
import { getTranslations } from "next-intl/server";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getActiveOrganizationProfile } from "@/app/actions/organization";
import ComingSoonPanel from "@/components/organizer/ComingSoonPanel";
import OrganizerBasicsSection from "@/components/organizer/OrganizerBasicsSection";
import OrganizerBrandingSection from "@/components/organizer/OrganizerBrandingSection";
import OrganizerAboutSection from "@/components/organizer/OrganizerAboutSection";
import OrganizerContactSection from "@/components/organizer/OrganizerContactSection";

export default async function OrganizerProfilePage() {
  const t = await getTranslations("Organizer");

  let profile;
  try {
    profile = await getActiveOrganizationProfile();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <ComingSoonPanel
          eyebrow={t("navProfile")}
          title={t("profilePermissionDeniedTitle")}
          badge={t("profilePermissionDeniedBadge")}
          description={t("profilePermissionDeniedDescription")}
        />
      );
    }
    throw error;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("navProfile")}</p>
        <h1 className="text-3xl font-extrabold text-zinc-900" style={{ fontFamily: "var(--font-playfair)" }}>
          {t("navProfile")}
        </h1>
      </div>

      <OrganizerBasicsSection shortDescription={profile.shortDescription ?? ""} sports={profile.sports} />

      <OrganizerBrandingSection coverImageUrl={profile.coverImageUrl} brandColor={profile.brandColor ?? "#22c55e"} />

      <OrganizerAboutSection
        mission={profile.mission ?? ""}
        vision={profile.vision ?? ""}
        history={profile.history ?? ""}
        yearFounded={profile.yearFounded ? String(profile.yearFounded) : ""}
        ageGroups={profile.ageGroups[0] ?? ""}
        values={profile.values.join(", ")}
        affiliations={profile.affiliations.join(", ")}
      />

      <OrganizerContactSection
        publicEmail={profile.publicEmail ?? ""}
        phone={profile.phone ?? ""}
        website={profile.website ?? ""}
        socialLinks={profile.socialLinks}
        locations={profile.locations}
      />
    </div>
  );
}
