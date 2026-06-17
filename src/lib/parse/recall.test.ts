import { describe, it, expect } from "vitest";
import { employerRecall, normalizeName, scoreFixtures, EMPLOYER_RECALL_GATE } from "./recall";
import { validateParseOutput } from "./contract";
import type { ParsedEmployer } from "./types";

const emp = (name: string, is_current = false): ParsedEmployer => ({ name, domain: null, is_current, tenure: null });

describe("employerRecall", () => {
  it("is 1.0 when all expected employers are found", () => {
    expect(employerRecall(["Razorpay", "Flipkart"], [emp("Razorpay"), emp("Flipkart")])).toBe(1);
  });

  it("matches across legal-suffix noise (fuzzy)", () => {
    expect(employerRecall(["Razorpay"], [emp("Razorpay Technologies Pvt Ltd")])).toBe(1);
    expect(normalizeName("Razorpay Technologies Pvt Ltd")).toBe("razorpay");
  });

  it("drops when an employer is missed — the safety failure", () => {
    expect(employerRecall(["Razorpay", "Flipkart"], [emp("Razorpay")])).toBe(0.5);
  });
});

describe("scoreFixtures against recorded model outputs", () => {
  // Recorded model JSON outputs (deterministic). A live eval against the real model is a
  // separate `eval:live` run (needs ANTHROPIC_API_KEY); this guards the scorer + contract.
  const fixtures = [
    {
      name: "clean-3-employers",
      expectedEmployers: ["Razorpay", "Flipkart", "Freshworks"],
      raw: JSON.stringify({ name: "A", skills: ["pm"], confidence: 0.95, employers: [
        { name: "Razorpay", is_current: true }, { name: "Flipkart", is_current: false }, { name: "Freshworks", is_current: false },
      ] }),
    },
    {
      name: "legal-suffixes",
      expectedEmployers: ["Zomato", "Paytm"],
      raw: JSON.stringify({ name: "B", skills: ["ops"], confidence: 0.9, employers: [
        { name: "Zomato Ltd", is_current: true }, { name: "One97 Paytm", is_current: false },
      ] }),
    },
  ];

  it("scores recorded fixtures at or above the gate", () => {
    const scored = scoreFixtures(
      fixtures.map((f) => {
        const r = validateParseOutput(f.raw);
        return { name: f.name, expectedEmployers: f.expectedEmployers, employers: r.ok ? r.resume.employers : [] };
      }),
    );
    expect(scored.overall).toBeGreaterThanOrEqual(EMPLOYER_RECALL_GATE);
    expect(scored.perFixture.every((p) => p.missed.length === 0)).toBe(true);
  });

  it("flags a fixture where the model dropped an employer", () => {
    const scored = scoreFixtures([
      { name: "missed", expectedEmployers: ["Razorpay", "Flipkart"], employers: [emp("Razorpay")] },
    ]);
    expect(scored.overall).toBeLessThan(EMPLOYER_RECALL_GATE);
    expect(scored.perFixture[0].missed).toEqual(["Flipkart"]);
  });
});
