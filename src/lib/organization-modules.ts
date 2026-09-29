// Canonical module list for the create-organization wizard's Modules step
// and (source of truth going forward for) enabledModules on the organization
// row. i18n keys follow `module_<key>Label` / `module_<key>Description`.
export type OrganizationModuleKey =
  | "posts"
  | "programs"
  | "teams"
  | "events"
  | "people"
  | "opportunities"
  | "partners"
  | "memberships";

export type OrganizationModuleDefinition = {
  key: OrganizationModuleKey;
  alwaysOn?: boolean;
  recommended?: boolean;
};

// Events/Teams/People/Opportunities are `alwaysOn` (not just "recommended") as
// of the Stage C org-dashboard nav reorg — OrganizerSidebar.tsx renders them
// unconditionally rather than gating on enabledModules, matching how they
// were (accidentally) always shown pre-reorg regardless of this array. Only
// Partners (and, later, Memberships) are real opt-in modules today.
export const ORGANIZATION_MODULES: OrganizationModuleDefinition[] = [
  { key: "posts", alwaysOn: true },
  { key: "programs", recommended: true },
  { key: "teams", alwaysOn: true },
  { key: "events", alwaysOn: true },
  { key: "people", alwaysOn: true },
  { key: "opportunities", alwaysOn: true },
  { key: "partners" },
  { key: "memberships" },
];

export const DEFAULT_ENABLED_MODULES: OrganizationModuleKey[] = ORGANIZATION_MODULES
  .filter((m) => m.alwaysOn || m.recommended)
  .map((m) => m.key);
