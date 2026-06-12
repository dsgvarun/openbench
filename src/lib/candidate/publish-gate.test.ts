import { describe, it, expect } from "vitest";
import { evaluatePublish, type PublishState } from "./publish-gate";

const ready: PublishState = {
  hasResume: true,
  hasRequiredPreferences: true,
  employersConfirmed: true,
  parseConfidenceOk: true,
  manualEmployerEntryDone: false,
  visibilityChosen: true,
};

describe("evaluatePublish", () => {
  it("publishes when every precondition holds", () => {
    expect(evaluatePublish(ready)).toEqual({ canPublish: true, blockers: [] });
  });

  it("BLOCKS when employers not confirmed — the fail-closed safety gate", () => {
    const r = evaluatePublish({ ...ready, employersConfirmed: false });
    expect(r.canPublish).toBe(false);
    expect(r.blockers).toContain("employers_not_confirmed");
  });

  it("BLOCKS low parse confidence unless a manual employer pass was done", () => {
    const blocked = evaluatePublish({ ...ready, parseConfidenceOk: false, manualEmployerEntryDone: false });
    expect(blocked.canPublish).toBe(false);
    expect(blocked.blockers).toContain("low_confidence_needs_manual_review");

    const rescued = evaluatePublish({ ...ready, parseConfidenceOk: false, manualEmployerEntryDone: true });
    expect(rescued.canPublish).toBe(true);
  });

  it("blocks on missing resume / preferences / visibility", () => {
    expect(evaluatePublish({ ...ready, hasResume: false }).blockers).toContain("no_resume");
    expect(evaluatePublish({ ...ready, hasRequiredPreferences: false }).blockers).toContain("preferences_incomplete");
    expect(evaluatePublish({ ...ready, visibilityChosen: false }).blockers).toContain("visibility_not_chosen");
  });

  it("reports ALL blockers at once for a blank state", () => {
    const r = evaluatePublish({
      hasResume: false,
      hasRequiredPreferences: false,
      employersConfirmed: false,
      parseConfidenceOk: false,
      manualEmployerEntryDone: false,
      visibilityChosen: false,
    });
    expect(r.canPublish).toBe(false);
    expect(r.blockers.sort()).toEqual(
      [
        "employers_not_confirmed",
        "low_confidence_needs_manual_review",
        "no_resume",
        "preferences_incomplete",
        "visibility_not_chosen",
      ].sort(),
    );
  });
});
