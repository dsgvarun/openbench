// The LLM JSON contract (Phase 2.2). Pure, deterministic, fully unit-tested.
// Turns a model's raw text output into a typed ParseResult, handling every failure
// mode explicitly so the caller can fail closed — never a 500, never a half-publish.

import {
  CONFIDENCE_THRESHOLD,
  type ParseResult,
  type ParsedEmployer,
  type ParsedResume,
} from "./types";

/** Pull the first balanced {...} block out of model output (handles ```json fences, prose wrappers). */
function extractJsonBlock(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

const REFUSAL = /\b(cannot|can't|can not|unable to|i'?m sorry|i am sorry|as an ai)\b/i;

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
}

function coerceEmployers(v: unknown): ParsedEmployer[] {
  if (!Array.isArray(v)) return [];
  const out: ParsedEmployer[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    out.push({
      name,
      domain: typeof o.domain === "string" && o.domain.trim() ? o.domain.trim().toLowerCase() : null,
      is_current: o.is_current === true,
    });
  }
  return out.slice(0, 50);
}

function coerceConfidence(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Validate raw LLM output into a ParseResult. Treats `raw` as untrusted: reads only
 * known fields, coerces types, ignores anything else (including any "instructions"
 * smuggled into the resume text — prompt-injection defense).
 */
export function validateParseOutput(raw: string): ParseResult {
  if (!raw || !raw.trim()) return { ok: false, reason: "empty_input" };

  const block = extractJsonBlock(raw);
  if (!block) {
    // No object block. It might still be valid JSON of the wrong shape (array/scalar).
    try {
      JSON.parse(raw.trim());
      return { ok: false, reason: "schema_invalid" };
    } catch {
      // Not JSON at all. Refusal prose vs. truncated/garbage.
      return { ok: false, reason: REFUSAL.test(raw) ? "refusal" : "malformed_json" };
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch {
    return { ok: false, reason: "malformed_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "schema_invalid" };
  }

  const o = parsed as Record<string, unknown>;
  const resume: ParsedResume = {
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null,
    headline: typeof o.headline === "string" && o.headline.trim() ? o.headline.trim() : null,
    years_experience:
      typeof o.years_experience === "number"
        ? o.years_experience
        : typeof o.years_experience === "string" && o.years_experience.trim() && Number.isFinite(Number(o.years_experience))
          ? Number(o.years_experience)
          : null,
    skills: asStringArray(o.skills),
    employers: coerceEmployers(o.employers),
    education: asStringArray(o.education),
    confidence: coerceConfidence(o.confidence),
  };

  // No usable signal → treat as empty extraction (route to manual entry, never publish blank).
  const hasSignal =
    resume.name !== null || resume.employers.length > 0 || resume.skills.length > 0;
  if (!hasSignal) return { ok: false, reason: "empty_extraction" };

  return { ok: true, resume, lowConfidence: resume.confidence < CONFIDENCE_THRESHOLD };
}
