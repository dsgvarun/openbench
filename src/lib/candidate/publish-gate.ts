// Fail-closed publish gate (Phase 2.3). Pure logic, fully unit-tested.
//
// A candidate CANNOT publish until every safety precondition holds. The
// load-bearing one is `employersConfirmed`: the candidate must explicitly confirm
// the employer list ("these are the companies we'll hide you from — add any we
// missed"). A missed employer = the at-risk candidate's employer can find them, so
// this is never skippable, and low parse confidence forces a manual pass.

export interface PublishState {
  hasResume: boolean;
  /** Required preferences set (functions, expected band, availability, seniority, cities/remote). */
  hasRequiredPreferences: boolean;
  /** Candidate ticked the mandatory "this employer list is complete" confirmation. */
  employersConfirmed: boolean;
  /** Parser confidence >= threshold. If false, manual entry must compensate. */
  parseConfidenceOk: boolean;
  /** Candidate manually reviewed/edited the employer list (compensates for low confidence). */
  manualEmployerEntryDone: boolean;
  /** A visibility / opt-in-reveal selection was made. */
  visibilityChosen: boolean;
}

export type PublishBlocker =
  | "no_resume"
  | "preferences_incomplete"
  | "employers_not_confirmed"
  | "low_confidence_needs_manual_review"
  | "visibility_not_chosen";

export interface PublishDecision {
  canPublish: boolean;
  blockers: PublishBlocker[];
}

export function evaluatePublish(state: PublishState): PublishDecision {
  const blockers: PublishBlocker[] = [];

  if (!state.hasResume) blockers.push("no_resume");
  if (!state.hasRequiredPreferences) blockers.push("preferences_incomplete");

  // The fail-closed safety gate: employer list must be explicitly confirmed.
  if (!state.employersConfirmed) blockers.push("employers_not_confirmed");

  // Low parser confidence is only acceptable if the candidate did a manual pass.
  if (!state.parseConfidenceOk && !state.manualEmployerEntryDone) {
    blockers.push("low_confidence_needs_manual_review");
  }

  if (!state.visibilityChosen) blockers.push("visibility_not_chosen");

  return { canPublish: blockers.length === 0, blockers };
}
