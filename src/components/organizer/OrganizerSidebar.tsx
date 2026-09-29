"use client";

// Left nav for /organizer/*. `role` (an OrgRole) is only used to render the
// role badge here — actual permission gating happens per-page/per-action via
// requireOrganizationPermission(), not by hiding sidebar links; a page the
// role can't use will 404 or show ForbiddenError when actually visited.
//
// `enabledModules` (from the org's `enabledModules` column, see
// src/lib/organization-modules.ts) DOES drive which items render in the
// MANAGE section's dynamic tail — this is the one place nav content actually
// depends on real data. Everything else (TOP_ITEMS, OPERATIONS, WALLET,
// ORGANIZATION, and the static head of MANAGE) is unconditional, matching
// this file's pre-existing behavior of never hiding a static nav item.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import HqCompletenessBar from "@/components/organizer/HqCompletenessBar";
import AddModuleModal from "@/components/organizer/AddModuleModal";
import OrganizerSidebarSwitcher from "@/components/organizer/OrganizerSidebarSwitcher";
import { ORGANIZATION_MODULES, type OrganizationModuleKey } from "@/lib/organization-modules";
import type { OrgRole } from "@/lib/organizer-permissions";
import type { OrganizationSummary } from "@/app/actions/organization";

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconOverview = () => (
  <svg {...ICON_PROPS}>
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);
const IconPeople = () => (
  <svg {...ICON_PROPS}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconTeams = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
);
const IconEvents = () => (
  <svg {...ICON_PROPS}>
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconRegistrations = () => (
  <svg {...ICON_PROPS}>
    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const IconPayments = () => (
  <svg {...ICON_PROPS}>
    <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);
const IconEarnings = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v10" /><path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5-3-1.12-3-2.5" />
  </svg>
);
const IconPartners = () => (
  <svg {...ICON_PROPS}>
    <path d="M18.36 5.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);
const IconProfile = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
);
const IconSettings = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconAddModule = () => (
  <svg {...ICON_PROPS}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconMore = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
  </svg>
);
const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

type NavItem = { kind?: undefined; href: string; labelKey: string; icon: React.ReactNode };
type ActionItem = { kind: "add-module"; labelKey: string; icon: React.ReactNode };
type SectionItem = NavItem | ActionItem;

function isActionItem(item: SectionItem): item is ActionItem {
  return item.kind === "add-module";
}

const TOP_ITEMS: NavItem[] = [
  { href: "/organizer/overview", labelKey: "navOverview", icon: <IconOverview /> },
];

// MANAGE's static head — Events/Teams are `alwaysOn` modules (see
// organization-modules.ts) so they render unconditionally. Opportunities was
// dropped from the visible nav per the user's explicit request (the
// /organizer/opportunities route itself is left in place, just unlinked).
const MANAGE_STATIC_ITEMS: NavItem[] = [
  { href: "/organizer/events", labelKey: "navEvents", icon: <IconEvents /> },
  { href: "/organizer/teams", labelKey: "navTeams", icon: <IconTeams /> },
];

// Real nav destinations for opt-in modules. Only Partners has one today —
// this map exists so adding the next real module (e.g. Memberships, once it
// has a page) is a one-line addition here rather than new branching logic.
const MODULE_NAV_ROUTES: Partial<Record<OrganizationModuleKey, NavItem>> = {
  partners: { href: "/organizer/partners", labelKey: "navPartners", icon: <IconPartners /> },
};

function getEnabledModuleNavItems(enabledModules: string[]): NavItem[] {
  return ORGANIZATION_MODULES.filter(
    (m) => (m.alwaysOn || enabledModules.includes(m.key)) && MODULE_NAV_ROUTES[m.key]
  ).map((m) => MODULE_NAV_ROUTES[m.key] as NavItem);
}

const OPERATIONS_ITEMS: NavItem[] = [
  { href: "/organizer/registrations", labelKey: "navRegistrations", icon: <IconRegistrations /> },
  { href: "/organizer/payment-records", labelKey: "navPaymentRecords", icon: <IconPayments /> },
];

// Same URL as always — only the label changed (Payments -> Earnings), moving
// it under its own WALLET heading. See navPayments' value in messages/*.json.
const WALLET_ITEMS: NavItem[] = [
  { href: "/organizer/payments", labelKey: "navPayments", icon: <IconEarnings /> },
];

const ORGANIZATION_ITEMS: NavItem[] = [
  { href: "/organizer/people", labelKey: "navPeople", icon: <IconPeople /> },
  { href: "/organizer/profile", labelKey: "navProfile", icon: <IconProfile /> },
  { href: "/organizer/settings", labelKey: "navSettings", icon: <IconSettings /> },
];

function NavLink({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick?: () => void }) {
  const t = useTranslations("Organizer");
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive ? "bg-red-50 text-[#e21d12]" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <span className={isActive ? "text-[#e21d12]" : "text-zinc-400"}>{item.icon}</span>
      {t(item.labelKey)}
    </Link>
  );
}

function ActionNavButton({ item, onClick }: { item: ActionItem; onClick: () => void }) {
  const t = useTranslations("Organizer");
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
    >
      <span className="text-zinc-400">{item.icon}</span>
      {t(item.labelKey)}
    </button>
  );
}

export default function OrganizerSidebar({
  organizations,
  activeOrganizationId,
  organizationName,
  organizationLogoUrl,
  role,
  userName,
  completeness,
  enabledModules,
}: {
  organizations: OrganizationSummary[];
  activeOrganizationId: string;
  organizationName: string;
  organizationLogoUrl: string | null;
  role: OrgRole;
  userName: string;
  completeness: number;
  enabledModules: string[];
}) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModuleOpen, setAddModuleOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const manageItems: SectionItem[] = [
    ...MANAGE_STATIC_ITEMS,
    ...getEnabledModuleNavItems(enabledModules),
    { kind: "add-module", labelKey: "navAddToManage", icon: <IconAddModule /> },
  ];

  const sections: { headingKey: string; items: SectionItem[] }[] = [
    { headingKey: "navSectionManage", items: manageItems },
    { headingKey: "navSectionOperations", items: OPERATIONS_ITEMS },
    { headingKey: "navSectionWallet", items: WALLET_ITEMS },
    { headingKey: "navSectionOrganization", items: ORGANIZATION_ITEMS },
  ];

  function openAddModule(closeDrawer?: boolean) {
    if (closeDrawer) setDrawerOpen(false);
    setAddModuleOpen(true);
  }

  function renderItem(item: SectionItem, closeDrawer?: boolean) {
    if (isActionItem(item)) {
      return <ActionNavButton key="add-module" item={item} onClick={() => openAddModule(closeDrawer)} />;
    }
    return (
      <NavLink
        key={item.href}
        item={item}
        isActive={isActive(item.href)}
        onClick={closeDrawer ? () => setDrawerOpen(false) : undefined}
      />
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-zinc-200 flex-col sticky top-16 h-[calc(100vh-4rem)]">
        <OrganizerSidebarSwitcher
          organizations={organizations}
          activeOrganizationId={activeOrganizationId}
          organizationName={organizationName}
          organizationLogoUrl={organizationLogoUrl}
          role={role}
          userName={userName}
        />

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {TOP_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
          ))}

          {sections.map((section) => (
            <div key={section.headingKey} className="mt-4">
              <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                {t(section.headingKey)}
              </p>
              <div className="flex flex-col gap-1">{section.items.map((item) => renderItem(item))}</div>
            </div>
          ))}
        </nav>

        <HqCompletenessBar percent={completeness} />
      </aside>

      {/* Mobile bottom navigation — curated set + "More" drawer for everything else */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200">
        <div className="flex items-stretch h-16">
          {[TOP_ITEMS[0], MANAGE_STATIC_ITEMS[0], MANAGE_STATIC_ITEMS[1]].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
                isActive(item.href) ? "text-[#e21d12]" : "text-zinc-400"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold leading-none">{t(item.labelKey)}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-zinc-400"
          >
            <IconMore />
            <span className="text-[10px] font-semibold leading-none">{t("navMore")}</span>
          </button>
        </div>
      </nav>

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-h-[80vh] overflow-y-auto bg-white rounded-t-2xl px-4 pt-4 pb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-zinc-900">{organizationName}</p>
              <button onClick={() => setDrawerOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <IconClose />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {TOP_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} isActive={isActive(item.href)} onClick={() => setDrawerOpen(false)} />
              ))}
            </div>
            {sections.map((section) => (
              <div key={section.headingKey} className="mt-4">
                <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                  {t(section.headingKey)}
                </p>
                <div className="flex flex-col gap-1">{section.items.map((item) => renderItem(item, true))}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {addModuleOpen && (
        <AddModuleModal
          enabledModules={enabledModules}
          onClose={() => setAddModuleOpen(false)}
          onSuccess={() => {
            setAddModuleOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
