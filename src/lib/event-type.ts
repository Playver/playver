// Whether an event uses team registration (Teams/Schedule/Results/Standings
// tabs, tournament_team rows) vs. individual registration (Participants tab,
// event_participant rows). Previously every call site independently checked
// eventType === "Tournament" (a hardcoded string, duplicated ~25 times) —
// registrationMode is the actual, already-populated-on-every-row column this
// should have been driven by all along. See event-flow-redesign plan.
export function isTeamEvent(event: { registrationMode: string }) {
  return event.registrationMode === "team";
}
