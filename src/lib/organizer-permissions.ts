// The org-level role/permission matrix — read this before touching any
// organizer-scoped action file. Unrelated to the separate site-wide
// user.role column checked in admin.ts (that's "player"/"organizer"/
// "super_admin"; this is per-organization membership role).
export type OrgRole =
  | "OWNER"
  | "ADMINISTRATOR"
  | "OPERATIONS_MANAGER"
  | "COACH"
  | "STAFF"
  | "READ_ONLY";

export const ORG_ROLES: OrgRole[] = [
  "OWNER",
  "ADMINISTRATOR",
  "OPERATIONS_MANAGER",
  "COACH",
  "STAFF",
  "READ_ONLY",
];

export type OrgPermission =
  | "VIEW_DASHBOARD"
  | "MANAGE_ORGANIZATION_PROFILE"
  | "MANAGE_ADMINISTRATORS"
  | "MANAGE_PEOPLE"
  | "VIEW_SENSITIVE_PARTICIPANT_DATA"
  | "MANAGE_PROGRAMS"
  | "MANAGE_PARTNERS"
  | "MANAGE_TEAMS"
  | "MANAGE_EVENTS"
  | "MANAGE_REGISTRATIONS"
  | "APPROVE_REGISTRATIONS"
  | "VIEW_PAYMENTS"
  | "MANAGE_PAYMENTS"
  | "ISSUE_REFUNDS"
  | "PUBLISH_CONTENT"
  | "VIEW_REPORTS";

// Default permission matrix. OWNER and ADMINISTRATOR are functionally
// equivalent here — the distinction between them is enforced elsewhere
// (an OWNER can never be removed/demoted below the last-owner threshold),
// not by a wider set of permissions.
const PERMISSION_MATRIX: Record<OrgRole, Set<OrgPermission>> = {
  OWNER: new Set([
    "VIEW_DASHBOARD",
    "MANAGE_ORGANIZATION_PROFILE",
    "MANAGE_ADMINISTRATORS",
    "MANAGE_PEOPLE",
    "VIEW_SENSITIVE_PARTICIPANT_DATA",
    "MANAGE_PROGRAMS",
    "MANAGE_PARTNERS",
    "MANAGE_TEAMS",
    "MANAGE_EVENTS",
    "MANAGE_REGISTRATIONS",
    "APPROVE_REGISTRATIONS",
    "VIEW_PAYMENTS",
    "MANAGE_PAYMENTS",
    "ISSUE_REFUNDS",
    "PUBLISH_CONTENT",
    "VIEW_REPORTS",
  ]),
  ADMINISTRATOR: new Set([
    "VIEW_DASHBOARD",
    "MANAGE_ORGANIZATION_PROFILE",
    "MANAGE_ADMINISTRATORS",
    "MANAGE_PEOPLE",
    "VIEW_SENSITIVE_PARTICIPANT_DATA",
    "MANAGE_PROGRAMS",
    "MANAGE_PARTNERS",
    "MANAGE_TEAMS",
    "MANAGE_EVENTS",
    "MANAGE_REGISTRATIONS",
    "APPROVE_REGISTRATIONS",
    "VIEW_PAYMENTS",
    "MANAGE_PAYMENTS",
    "ISSUE_REFUNDS",
    "PUBLISH_CONTENT",
    "VIEW_REPORTS",
  ]),
  OPERATIONS_MANAGER: new Set([
    "VIEW_DASHBOARD",
    "MANAGE_PEOPLE",
    "VIEW_SENSITIVE_PARTICIPANT_DATA",
    "MANAGE_PROGRAMS",
    "MANAGE_PARTNERS",
    "MANAGE_TEAMS",
    "MANAGE_EVENTS",
    "MANAGE_REGISTRATIONS",
    "APPROVE_REGISTRATIONS",
    "VIEW_PAYMENTS",
    "VIEW_REPORTS",
  ]),
  COACH: new Set([
    "VIEW_DASHBOARD",
    "VIEW_SENSITIVE_PARTICIPANT_DATA",
    "MANAGE_PROGRAMS",
  ]),
  STAFF: new Set([
    "VIEW_DASHBOARD",
    "MANAGE_PEOPLE",
    "MANAGE_TEAMS",
    "MANAGE_EVENTS",
    "MANAGE_REGISTRATIONS",
  ]),
  READ_ONLY: new Set([
    "VIEW_DASHBOARD",
    "VIEW_PAYMENTS",
    "VIEW_REPORTS",
  ]),
};

export function hasPermission(role: OrgRole, permission: OrgPermission): boolean {
  return PERMISSION_MATRIX[role]?.has(permission) ?? false;
}

// Whether `assignerRole` may place/keep someone at `targetRole`. Granting or
// revoking an OWNER/ADMINISTRATOR role requires MANAGE_ADMINISTRATORS, not just
// MANAGE_PEOPLE — otherwise STAFF (which has MANAGE_PEOPLE but not
// MANAGE_ADMINISTRATORS) could promote itself or others to admin, or demote an
// existing admin. Every other role only requires MANAGE_PEOPLE.
export function canAssignRole(assignerRole: OrgRole, targetRole: OrgRole): boolean {
  const isAdminTier = targetRole === "OWNER" || targetRole === "ADMINISTRATOR";
  return hasPermission(assignerRole, isAdminTier ? "MANAGE_ADMINISTRATORS" : "MANAGE_PEOPLE");
}
