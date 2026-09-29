"use client";

// Wizard step 2 of 4: "What to Manage". Thin wrapper around Step7Modules
// (the old step-7-of-10 modules toggle-card list) rather than a third
// parallel implementation of the same UI (see AddModuleModal.tsx for the
// other place this pattern is reused). Events and Teams are `alwaysOn` in
// organization-modules.ts (Stage C) so Step7Modules already renders them as
// checked, non-interactive cards; Partners is the one real toggle here.
// Programs is filtered out of the list entirely via `visibleKeys` per the
// product decision to drop it from the wizard.
import Step7Modules from "./Step7Modules";
import type { StepProps } from "./types";

export default function Step2Manage({ state, update }: StepProps) {
  return (
    <Step7Modules
      state={state}
      update={update}
      visibleKeys={["events", "teams", "partners"]}
      stepCurrent={2}
      stepTotal={4}
      titleKey="wizardManageTitle"
      subtitleKey="wizardManageSubtitle"
    />
  );
}
