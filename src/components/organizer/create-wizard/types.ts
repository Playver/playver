// Shared state/types for the 4-step create-organization wizard
// (CreateOrganizationWizard.tsx + Step1Profile/Step2Manage/Step3Agreement/
// Step4Done). One flat WizardState object is threaded through every step via
// StepProps (state + update()); each step only reads/writes its own slice of
// it. The wizard persists incrementally to the DB as an in-progress "draft"
// org, so wizardStateFromDraft() rehydrates this same shape when a user
// resumes. Note: WizardState still carries every field from the old 10-step
// wizard (mission/legal/contact/etc.) even though most of them are no longer
// collected IN the wizard — the org Settings/Profile pages
// (src/app/[locale]/organizer/{profile,settings}/page.tsx) reuse the same
// updateOrganizationDraft()/OrganizationDraftFields machinery outside the
// wizard, so those fields still need a home on this type.
import type { OrgRole } from "@/lib/organizer-permissions";
import type { LocationInput, OrganizationDraftState } from "@/app/actions/organization";
import { DEFAULT_ENABLED_MODULES } from "@/lib/organization-modules";

export type AdminRow = { email: string; role: OrgRole };

export type StepProps = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
};

export type PolicyMode = "upload" | "write";

// Everything the wizard needs across all 10 steps, kept flat and
// string-friendly for direct input binding (numeric/array columns are
// parsed/joined only at the point of persisting to the server actions).
export type WizardState = {
  organizationId: string | null;
  furthestStep: number;

  organizationType: string;
  organizationSize: string;

  name: string;
  city: string;
  province: string;
  country: string;
  primaryLanguage: string;
  sports: string[];
  slug: string;
  slugTouched: boolean;
  shortDescription: string;

  logoUrl: string | null;
  coverImageUrl: string | null;
  slogan: string;
  brandColor: string;

  mission: string;
  vision: string;
  history: string;
  yearFounded: string;
  ageGroups: string;
  values: string;
  affiliations: string;

  publicEmail: string;
  phone: string;
  website: string;
  instagram: string;
  twitter: string;
  facebook: string;
  youtube: string;
  tiktok: string;
  locations: LocationInput[];

  legalName: string;
  registrationNumber: string;
  organizationStatus: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  refundPolicyMode: PolicyMode;
  refundPolicyUrl: string;
  refundPolicyText: string;
  privacyPolicyMode: PolicyMode;
  privacyPolicyUrl: string;
  privacyPolicyText: string;
  codeOfConductMode: PolicyMode;
  codeOfConductUrl: string;
  codeOfConductText: string;

  enabledModules: string[];

  admins: AdminRow[];

  connectAccountId: string | null;
  connectOnboarded: boolean;
};

export const EMPTY_LOCATION: LocationInput = {
  name: "",
  streetAddress: "",
  city: "",
  province: "",
  postalCode: "",
  country: "",
};

export function createInitialWizardState(): WizardState {
  return {
    organizationId: null,
    furthestStep: 1,
    organizationType: "",
    organizationSize: "",
    name: "",
    city: "",
    province: "",
    country: "Canada",
    primaryLanguage: "English",
    sports: [],
    slug: "",
    slugTouched: false,
    shortDescription: "",
    logoUrl: null,
    coverImageUrl: null,
    slogan: "",
    brandColor: "#22c55e",
    mission: "",
    vision: "",
    history: "",
    yearFounded: "",
    ageGroups: "",
    values: "",
    affiliations: "",
    publicEmail: "",
    phone: "",
    website: "",
    instagram: "",
    twitter: "",
    facebook: "",
    youtube: "",
    tiktok: "",
    locations: [],
    legalName: "",
    registrationNumber: "",
    organizationStatus: "Non-profit",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    refundPolicyMode: "write",
    refundPolicyUrl: "",
    refundPolicyText: "",
    privacyPolicyMode: "write",
    privacyPolicyUrl: "",
    privacyPolicyText: "",
    codeOfConductMode: "write",
    codeOfConductUrl: "",
    codeOfConductText: "",
    enabledModules: DEFAULT_ENABLED_MODULES,
    admins: [],
    connectAccountId: null,
    connectOnboarded: false,
  };
}

// Hydrates wizard state from a resumed draft fetched via getOrganizationDraftState.
export function wizardStateFromDraft(draft: OrganizationDraftState): WizardState {
  const social = draft.socialLinks ?? {};
  return {
    organizationId: draft.id,
    // Reset to 1 rather than draft.wizardStep: the wizard was rebuilt from 10
    // steps down to 4, so an old draft's stored step position (which could be
    // anywhere from 1-10 under the old scheme) has no valid mapping onto the
    // new 4-step rail. Only the field DATA below is still meaningfully
    // resumed — see CreateOrganizationWizard.tsx's currentStep init.
    furthestStep: 1,
    organizationType: draft.organizationType ?? "",
    organizationSize: draft.organizationSize ?? "",
    name: draft.name,
    city: draft.city ?? "",
    province: draft.province ?? "",
    country: draft.country ?? "Canada",
    primaryLanguage: draft.primaryLanguage ?? "English",
    sports: draft.sports ?? [],
    slug: draft.slug,
    slugTouched: true,
    shortDescription: draft.shortDescription ?? "",
    logoUrl: draft.logoUrl,
    coverImageUrl: draft.coverImageUrl,
    slogan: draft.slogan ?? "",
    brandColor: draft.brandColor ?? "#22c55e",
    mission: draft.mission ?? "",
    vision: draft.vision ?? "",
    history: draft.history ?? "",
    yearFounded: draft.yearFounded ? String(draft.yearFounded) : "",
    ageGroups: draft.ageGroups?.[0] ?? "",
    values: (draft.values ?? []).join(", "),
    affiliations: (draft.affiliations ?? []).join(", "),
    publicEmail: draft.publicEmail ?? "",
    phone: draft.phone ?? "",
    website: draft.website ?? "",
    instagram: social.instagram ?? "",
    twitter: social.twitter ?? "",
    facebook: social.facebook ?? "",
    youtube: social.youtube ?? "",
    tiktok: social.tiktok ?? "",
    locations: draft.locations.map((l) => ({
      name: l.name,
      streetAddress: l.streetAddress,
      city: l.city,
      province: l.province,
      postalCode: l.postalCode,
      country: l.country,
    })),
    legalName: draft.legalName ?? "",
    registrationNumber: draft.registrationNumber ?? "",
    organizationStatus: draft.organizationStatus ?? "Non-profit",
    insuranceProvider: draft.insuranceProvider ?? "",
    insurancePolicyNumber: draft.insurancePolicyNumber ?? "",
    refundPolicyMode: draft.refundPolicyUrl ? "upload" : "write",
    refundPolicyUrl: draft.refundPolicyUrl ?? "",
    refundPolicyText: draft.refundPolicyText ?? "",
    privacyPolicyMode: draft.privacyPolicyUrl ? "upload" : "write",
    privacyPolicyUrl: draft.privacyPolicyUrl ?? "",
    privacyPolicyText: draft.privacyPolicyText ?? "",
    codeOfConductMode: draft.codeOfConductUrl ? "upload" : "write",
    codeOfConductUrl: draft.codeOfConductUrl ?? "",
    codeOfConductText: draft.codeOfConductText ?? "",
    enabledModules: draft.enabledModules.length > 0 ? draft.enabledModules : DEFAULT_ENABLED_MODULES,
    admins: [],
    connectAccountId: null,
    connectOnboarded: false,
  };
}

export const SPORTS_OPTIONS = [
  "Soccer", "Basketball", "Hockey", "Baseball", "Volleyball", "Tennis",
  "Swimming", "Track & Field", "Gymnastics", "Martial Arts", "Cycling", "Rugby",
  "American Football", "Lacrosse", "Other",
];

export const ORG_SIZE_OPTIONS = ["1-10", "11-50", "51-200", "200+"];

export const COUNTRY_OPTIONS = ["Canada", "United States", "Other"];
export const LANGUAGE_OPTIONS = ["English", "French", "Spanish", "Other"];
export const ORG_STATUS_OPTIONS = [
  "Non-profit", "For-profit", "Registered Charity", "Educational Institution", "Government", "Unregistered",
];
export const BRAND_COLOR_OPTIONS = ["#22c55e", "#3b82f6", "#a855f7", "#f97316", "#ef4444", "#0f172a"];
