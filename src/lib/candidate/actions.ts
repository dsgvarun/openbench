"use server";

import { createClient } from "@/lib/supabase/server";
import { extractResumeText } from "@/lib/parse/extract";
import { parseResume } from "@/lib/parse";
import { getParseClient } from "@/lib/parse/provider";
import { evaluatePublish, type PublishState } from "./publish-gate";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (PRD §6.1)
const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// Resolve (or create) the candidate row for the signed-in user.
async function ensureCandidate(): Promise<{ id: string; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("candidate")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { id: existing.id as string, userId: user.id };

  const { data: created, error } = await supabase
    .from("candidate")
    .insert({ user_id: user.id, email: user.email })
    .select("id")
    .single();
  if (error || !created) return null;
  return { id: created.id as string, userId: user.id };
}

// 2.1 — upload a resume to the private bucket and create a resume row.
export async function uploadResume(formData: FormData): Promise<Result<{ resumeId: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  if (file.size > MAX_BYTES) return { ok: false, error: "File exceeds 10 MB." };
  if (!ALLOWED.has(file.type)) return { ok: false, error: "Upload a PDF, DOCX, or TXT." };

  const cand = await ensureCandidate();
  if (!cand) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const path = `${cand.userId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage
    .from("resumes")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };

  const { data: resume, error: rErr } = await supabase
    .from("resume")
    .insert({ candidate_id: cand.id, file_path: path })
    .select("id")
    .single();
  if (rErr || !resume) return { ok: false, error: "Could not record the resume." };

  return { ok: true, data: { resumeId: resume.id as string } };
}

// 2.2 — extract text + parse + persist. On any failure, leaves the candidate in a
// "manual entry" state (never a half-parsed publish). Returns whether manual is required.
export async function runParse(resumeId: string): Promise<Result<{ manualRequired: boolean; reason?: string }>> {
  const cand = await ensureCandidate();
  if (!cand) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();

  const { data: resume } = await supabase
    .from("resume")
    .select("id, file_path, version")
    .eq("id", resumeId)
    .eq("candidate_id", cand.id)
    .single();
  if (!resume) return { ok: false, error: "Resume not found." };

  const dl = await supabase.storage.from("resumes").download(resume.file_path as string);
  if (dl.error || !dl.data) return { ok: false, error: "Could not read the uploaded file." };
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  const fileName = (resume.file_path as string).split("/").pop() ?? "resume";

  const text = await extractResumeText({ bytes, mimeType: dl.data.type, fileName });
  if (!text) {
    // Scanned/image PDF or unreadable → manual entry. Fail closed.
    return { ok: true, data: { manualRequired: true, reason: "no_text_extracted" } };
  }

  // Provider-agnostic: cheap/free hosted model, local Ollama, or none. No provider
  // configured → manual employer entry ($0, zero keys). Parsing only pre-fills.
  const client = await getParseClient();
  if (!client) {
    return { ok: true, data: { manualRequired: true, reason: "parser_disabled" } };
  }
  let parsed;
  try {
    parsed = await parseResume(text, client);
  } catch {
    return { ok: true, data: { manualRequired: true, reason: "parser_unavailable" } };
  }

  if (!parsed.ok) {
    return { ok: true, data: { manualRequired: true, reason: parsed.reason } };
  }

  // Persist parse + create UNCONFIRMED employer rows (candidate must confirm — fail closed).
  await supabase
    .from("resume")
    .update({ parsed_json: parsed.resume, parse_confidence: parsed.resume.confidence })
    .eq("id", resume.id);

  // Replace any prior parsed (unconfirmed) employers for a clean re-parse.
  await supabase.from("candidate_employer").delete().eq("candidate_id", cand.id).eq("from_parse", true).eq("confirmed", false);
  if (parsed.resume.employers.length) {
    await supabase.from("candidate_employer").insert(
      parsed.resume.employers.map((e, i) => ({
        candidate_id: cand.id,
        name: e.name,
        domain: e.domain,
        is_current: e.is_current,
        display_order: i,
        from_parse: true,
        confirmed: false,
        reveal_flag: false,
      })),
    );
  }

  return { ok: true, data: { manualRequired: parsed.lowConfidence, reason: parsed.lowConfidence ? "low_confidence" : undefined } };
}

// 2.3 — the fail-closed employer confirmation. Adds any candidate-supplied employers,
// marks the list confirmed, and auto-blocks every confirmed employer.
export async function confirmEmployers(input: {
  addedEmployers: { name: string; domain?: string; is_current: boolean }[];
}): Promise<Result> {
  const cand = await ensureCandidate();
  if (!cand) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();

  if (input.addedEmployers.length) {
    await supabase.from("candidate_employer").insert(
      input.addedEmployers.map((e, i) => ({
        candidate_id: cand.id,
        name: e.name.trim(),
        domain: e.domain?.trim().toLowerCase() || null,
        is_current: e.is_current,
        display_order: 1000 + i,
        from_parse: false,
        confirmed: true,
        reveal_flag: false,
      })),
    );
  }

  // Confirm the whole list (the un-skippable "these are the companies we hide you from").
  await supabase.from("candidate_employer").update({ confirmed: true }).eq("candidate_id", cand.id);

  // Auto-block every confirmed employer (candidate can later unblock old ones).
  const { data: employers } = await supabase
    .from("candidate_employer")
    .select("id, name, domain")
    .eq("candidate_id", cand.id)
    .eq("confirmed", true);

  if (employers?.length) {
    await supabase.from("blocklist").delete().eq("candidate_id", cand.id).eq("source", "auto_history");
    await supabase.from("blocklist").insert(
      employers.map((e) => ({
        candidate_id: cand.id,
        candidate_employer_id: e.id,
        company_domain: e.domain,
        company_name: e.name,
        source: "auto_history",
      })),
    );
  }

  return { ok: true };
}

// 2.4 — preferences
export async function savePreferences(input: {
  functions: string[];
  industries: string[];
  cities: string[];
  remote_only: boolean;
  work_mode_pref: string | null;
  expected_band: string | null;
  current_band: string | null; // PRIVATE
  availability: string | null;
  availability_date: string | null;
  seniority: string | null;
}): Promise<Result> {
  const cand = await ensureCandidate();
  if (!cand) return { ok: false, error: "Not signed in." };
  if (input.functions.length > 3) return { ok: false, error: "Pick at most 3 target functions." };
  if (input.industries.length > 5) return { ok: false, error: "Pick at most 5 industries." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("preferences")
    .upsert({ candidate_id: cand.id, ...input }, { onConflict: "candidate_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// 2.3/§6.3 — visibility: reveal mode + per-employer opt-in flags
export async function setVisibility(input: {
  reveal_employers_mode: "none" | "past_only" | "all";
  revealedEmployerIds: string[];
}): Promise<Result> {
  const cand = await ensureCandidate();
  if (!cand) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();

  await supabase.from("candidate").update({ reveal_employers_mode: input.reveal_employers_mode }).eq("id", cand.id);
  // Reset all flags, then set the opted-in ones.
  await supabase.from("candidate_employer").update({ reveal_flag: false }).eq("candidate_id", cand.id);
  if (input.revealedEmployerIds.length) {
    await supabase
      .from("candidate_employer")
      .update({ reveal_flag: true })
      .in("id", input.revealedEmployerIds)
      .eq("candidate_id", cand.id);
  }
  return { ok: true };
}

// 2.x — publish, gated by evaluatePublish (fail closed)
export async function publishProfile(): Promise<Result<{ blockers: string[] }>> {
  const cand = await ensureCandidate();
  if (!cand) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();

  const [{ data: resume }, { data: prefs }, { data: employers }, { data: candidate }] = await Promise.all([
    supabase.from("resume").select("parse_confidence").eq("candidate_id", cand.id).order("version", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("preferences").select("functions, expected_band, availability, seniority").eq("candidate_id", cand.id).maybeSingle(),
    supabase.from("candidate_employer").select("confirmed, from_parse").eq("candidate_id", cand.id),
    supabase.from("candidate").select("reveal_employers_mode").eq("id", cand.id).single(),
  ]);

  const confidence = (resume?.parse_confidence as number | null) ?? null;
  const allConfirmed = (employers ?? []).length > 0 && (employers ?? []).every((e) => e.confirmed === true);
  const manualDone = (employers ?? []).some((e) => e.from_parse === false || e.confirmed === true);

  const state: PublishState = {
    hasResume: !!resume,
    hasRequiredPreferences:
      !!prefs && (prefs.functions as string[] | null)?.length! > 0 && !!prefs.expected_band && !!prefs.availability && !!prefs.seniority,
    employersConfirmed: allConfirmed,
    parseConfidenceOk: confidence !== null && confidence >= 0.7,
    manualEmployerEntryDone: manualDone,
    visibilityChosen: !!candidate?.reveal_employers_mode,
  };

  const decision = evaluatePublish(state);
  if (!decision.canPublish) return { ok: true, data: { blockers: decision.blockers } };

  await supabase
    .from("anonymized_profile")
    .upsert({ candidate_id: cand.id, published_at: new Date().toISOString() }, { onConflict: "candidate_id" });

  return { ok: true, data: { blockers: [] } };
}

// DPDP scoped deletion (Phase 6.2): purge candidate-side data on OpenBench + delete the
// stored resume files. Data already disclosed via an accepted reveal is held by that
// company under their own retention — the candidate is told this at accept and here.
export async function deleteAccount(): Promise<Result> {
  const cand = await ensureCandidate();
  if (!cand) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();

  // 1. Delete stored resume files (owner-scoped folder).
  const { data: files } = await supabase.storage.from("resumes").list(cand.userId);
  if (files?.length) {
    await supabase.storage.from("resumes").remove(files.map((f) => `${cand.userId}/${f.name}`));
  }

  // 2. Scoped DB purge (wipes rows, scrubs identity, logs deletion consent).
  const { data, error } = await supabase.rpc("purge_candidate");
  if (error) return { ok: false, error: error.message };
  const res = data as { ok: boolean; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "Could not delete." };

  await supabase.auth.signOut();
  return { ok: true };
}
