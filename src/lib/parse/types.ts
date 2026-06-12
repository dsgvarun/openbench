// Types for the resume parse pipeline. The resume is UNTRUSTED input to the LLM —
// we only ever read these known structured fields back out, never execute anything
// embedded in the document text.

export interface ParsedEmployer {
  name: string;
  domain: string | null;
  is_current: boolean;
}

export interface ParsedResume {
  name: string | null;
  headline: string | null;
  years_experience: number | null;
  skills: string[];
  employers: ParsedEmployer[];
  education: string[];
  /** Model's self-reported extraction confidence, 0..1. */
  confidence: number;
}

export type ParseFailureReason =
  | "empty_input" // no text given to parse
  | "no_text_extracted" // file had no extractable text (scanned/image PDF)
  | "malformed_json" // model returned something that isn't valid JSON
  | "empty_extraction" // valid JSON but no usable signal (no name/employers/skills)
  | "refusal" // model refused / returned prose instead of data
  | "schema_invalid"; // JSON present but wrong shape

export type ParseResult =
  | { ok: true; resume: ParsedResume; lowConfidence: boolean }
  | { ok: false; reason: ParseFailureReason };

/**
 * Below this confidence, publish is BLOCKED until the candidate manually confirms
 * the employer list (fail-closed — a missed employer is an exposure, Phase 2.3).
 */
export const CONFIDENCE_THRESHOLD = 0.7;
