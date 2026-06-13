// Parser employer-recall scoring (Phase 6.1). Employer recall is a SAFETY metric: a
// missed employer means that company could see an at-risk candidate. The launch gate
// requires recall at or above EMPLOYER_RECALL_GATE on the labeled corpus.

import type { ParsedEmployer } from "./types";

export const EMPLOYER_RECALL_GATE = 0.9;

const SUFFIXES = /\b(pvt|private|ltd|limited|inc|llc|llp|technologies|technology|labs|india|systems|solutions|corp|co)\b/g;

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[.,]/g, " ").replace(SUFFIXES, " ").replace(/\s+/g, " ").trim();
}

/** Fraction of expected employers found in the parsed set (order-insensitive, fuzzy). */
export function employerRecall(expected: string[], got: ParsedEmployer[]): number {
  if (expected.length === 0) return 1;
  const gotNorm = got.map((g) => normalizeName(g.name)).filter(Boolean);
  let matched = 0;
  for (const e of expected) {
    const en = normalizeName(e);
    if (gotNorm.some((g) => g === en || g.includes(en) || en.includes(g))) matched++;
  }
  return matched / expected.length;
}

export interface RecallFixtureResult {
  name: string;
  recall: number;
  missed: string[];
}

export function scoreFixtures(
  fixtures: { name: string; expectedEmployers: string[]; employers: ParsedEmployer[] }[],
): { perFixture: RecallFixtureResult[]; overall: number } {
  const perFixture = fixtures.map((f) => {
    const recall = employerRecall(f.expectedEmployers, f.employers);
    const gotNorm = f.employers.map((g) => normalizeName(g.name));
    const missed = f.expectedEmployers.filter((e) => {
      const en = normalizeName(e);
      return !gotNorm.some((g) => g === en || g.includes(en) || en.includes(g));
    });
    return { name: f.name, recall, missed };
  });
  const overall = perFixture.reduce((s, r) => s + r.recall, 0) / (perFixture.length || 1);
  return { perFixture, overall };
}
