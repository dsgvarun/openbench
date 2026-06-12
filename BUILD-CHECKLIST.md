# OpenBench v1 — Sequenced Build Checklist

Thin slice (Approach B): Semi-open tier + consent reveal loop + comp/k-anon stats + blocklist.
Source of truth: `openbench-prd-v2.md` + `DESIGN.md`. Decisions: `~/.gstack/projects/OpenBench/ceo-plans/`.

**Sequencing rule:** Phase 1 (privacy foundation) ships and is tested before anything reads candidate data. Phases 2–4 then run in parallel lanes. Phase 6 (pre-launch) gates the public candidate launch, not the build.

Legend: **[P1]** blocks the loop shipping · **[P2]** same-release · **[P3]** follow-up. Lane = parallelizable group.

---

## Phase 0 — Foundations (Lane A prerequisite)
- [ ] **0.1 [P1]** Next.js (App Router) + Supabase project, India region. Route groups: `/` + `/for-employers` (public), `/me`, `/hire`, `/admin`.
  - Verify: each route group renders behind its own auth boundary.
- [ ] **0.2 [P1]** Auth: email + OTP (no passwords). Per-seat auth for employers (no shared logins).
  - Verify: OTP round-trip; sessions scoped per user.
- [ ] **0.3 [P2]** Wire `DESIGN.md` tokens (Fraunces + DM Sans, warm paper/sage/clay) into the theme layer; self-host fonts.
  - Verify: a sample page matches the preview; WCAG AA contrast on `#FAF7F2`.

## Phase 1 — Privacy Foundation (Lane A — GATE, everything below depends on it)
- [ ] **1.1 [P1]** Schema: `Candidate`, `Resume` (parsed_json, parse_confidence, version), `CandidateEmployer` (employer_id stable, name, domain, is_current, reveal_flag, block_source), `AnonymizedProfile` (schema_version; display_json = cache only), `Preferences`, `Blocklist`, `Company`, `Seat`, `JobListing`, `InterestRequest`, `Reveal` (intro_delivery_status), `Report`, `StatSnapshot`.
  - Surfaced by: Eng review T-E2 (employers as first-class rows).
  - Verify: editing/re-parsing an employer list remaps reveal + block flags by `employer_id`, never by array index.
- [ ] **1.2 [P1]** RLS row policies: blocked company can't see a profile via ANY path (search, facet count, direct URL, reveal attempt); full data granted only to a company with a `Reveal` row.
  - Surfaced by: Eng review T-E1.
  - Verify: DB integration tests — blocked company sees nothing through every path.
- [ ] **1.3 [P1]** Server-side projection layer (SECURITY-DEFINER view or single serializer the client can't bypass): hides name + employers by default, surfaces only candidate-opted-in fields, returns full data only with a Reveal. `display_json` is a non-authoritative cache.
  - Surfaced by: Eng review T-E1 (RLS does rows, projection does fields).
  - Verify: field-level test per visibility state; no raw `Candidate`/`Resume` read path exists except through projection.
- [ ] **1.4 [P1]** Per-employer reveal control (`reveal_employers: none/past-only/all` + per-employer flag), enforced in projection.
  - Surfaced by: CEO decision D3.
  - Verify: toggling one employer reveals only that one.

> **GATE:** Phase 1 tests green before any candidate data is readable. This is the trust promise.

---

## Phase 2 — Candidate Side (Lane B — depends on Phase 1)
- [ ] **2.1 [P1]** Resume upload (PDF/DOCX ≤10MB, encrypted at rest, signed expiring URLs).
  - Verify: corrupt/oversized/password-protected/image-only/non-resume/non-English → rejected loudly or routed to manual, never half-parsed.
- [ ] **2.2 [P1]** LLM parse → structured JSON. Define the JSON contract: malformed/empty/refusal/injection handling; treat resume text as untrusted (no embedded-instruction execution).
  - Surfaced by: Eng review T-E6 / CEO Section 2.
  - Verify: each failure mode → graceful manual-entry fallback, never a 500.
- [ ] **2.3 [P1]** Fail-closed employer-confirmation step ("companies we'll hide you from — add any we missed"); low confidence / parse failure BLOCKS publish.
  - Surfaced by: CEO decision D5. Design: safety-weighted, not a generic field.
  - Verify: cannot publish until employer list confirmed; low-confidence parse forces manual confirm.
- [ ] **2.4 [P2]** Preferences (functions/industries/cities/work-mode/CTC band/current-band-private/availability/seniority); visibility + opt-in-reveal selector.
  - Verify: required fields gate publish; current-band never exposed in projection.
- [ ] **2.5 [P2]** Blocklist: auto-block confirmed employers + manual add by name/domain; silent to blocked companies.
  - Verify: blocked company absent from search/counts/direct-URL.
- [ ] **2.6 [P2]** Candidate statuses: active / paused / placed (30-day delist nudge) / deleted.

## Phase 3 — Employer Side (Lane C — depends on Phase 1)
- [ ] **3.1 [P1]** Work-email verification (domain match, free-mail rejected) + manual admin approval (<24h) in `/admin`.
- [ ] **3.2 [P1]** Comp/availability index as the primary employer surface: distributions + percentiles by city/function/seniority/band + availability curves (30/60/90-day). Every aggregate has one-click drill into the candidates behind it.
  - Surfaced by: CEO decisions D6/D7. Design: grid-disciplined data zone.
  - Verify: index loads with skeleton (not spinner); drill-through lands on the filtered pool.
- [ ] **3.3 [P2]** Search/filter (function/skills-FTS/city/band/seniority/availability/work-mode); profile cards render via projection (names hidden unless opted in); paginate 20, rate-limit per seat.
- [ ] **3.4 [P2]** Job listings (required fields incl. CTC band; auto-expire 60d + renewal nudge).

## Phase 4 — Reveal Loop (Lane D — depends on Phase 1 + 2 + 3)
- [ ] **4.1 [P1]** Send interest: attach own listing + note ≤300 chars (contact-info screened, leak rate measured). `UNIQUE(company_id, candidate_id, listing_id)`.
  - Surfaced by: Eng review T-E3.
  - Verify: double-submit → one request; note with smuggled contact info caught.
- [ ] **4.2 [P1]** Accept = conditional state transition (`UPDATE ... WHERE status='pending'`) → exactly one `Reveal` + one intro email; rate limits (1/listing, 3/candidate then lock 90d).
  - Surfaced by: Eng review T-E3.
  - Verify: double-accept → one Reveal + one email; accept while paused/deleted → rejected cleanly, no partial reveal.
- [ ] **4.3 [P1]** Reveal-accept confirmation UI: plain-language irrevocability + scoped-purge copy (clay warning block); full-screen on mobile; keyboard focus trap + SR reads copy before confirm.
  - Surfaced by: CEO decision D4 + Design state-matrix/a11y.
  - Verify: copy present in confirm + deletion flows; a11y pass on the dialog.
- [ ] **4.4 [P2]** Intro email (Resend) with delivery confirmation; bounce → flag + retry + surface, never silent.
- [ ] **4.5 [P2]** Decline (aggregated reasons across ≥5) / ignore (14-day expire).

## Phase 5 — Stats & k-anonymity (folds into Lane C)
- [ ] **5.1 [P1]** Nightly `StatSnapshot` of UNSUPPRESSED raw counts (access-controlled table, never client-exposed) + listing expiry job.
- [ ] **5.2 [P1]** Per-viewer count path: indexed blocklist anti-join, then apply `<5` suppression at render per viewer.
  - Surfaced by: Eng review T-E5 / CEO Section 1.
  - Verify: `<5` boundary correct per viewer; <1s p95; suppressed cells render hatched; SR announces "fewer than 5, suppressed."

## Phase 6 — Pre-launch gates (block public candidate launch, not the build)
- [ ] **6.1 [P1]** Parser employer-recall eval: labeled India-resume corpus, recall threshold, fail-closed below it.
  - Surfaced by: Eng review T-E4. This is a safety eval, not a quality test.
  - Verify: recall ≥ threshold on holdout; below → publish blocked.
- [ ] **6.2 [P1]** DPDP posture: scoped-purge wording sign-off with counsel before the first real reveal; consent log per reveal; full purge (originals/JSON/embeddings/backups ≤30d); named DPO; breach-notification timeline.
  - Surfaced by: CEO decision D4 + outside-voice #6.
- [ ] **6.3 [P1]** Observability day 1: dashboards for the kill/pivot metrics (publish-completion, acceptance rate w/ 25–50% alert band, redacted/employer-reveal adoption, time-to-first-interest) + safety dashboards (parser recall, parse-failure rate, re-identification report channel) + placement-grade metrics (employer return rate, revealed→contacted, hires) + WTP signal.
  - Surfaced by: CEO Section 8 + outside-voice #5/#8.
- [ ] **6.4 [P1]** Seed: ≥20 companies / ≥50 listings before opening candidate signups (so the index is non-zero day one).

## Phase 7 — Deferred (Phase 2 / follow-up, not v1)
- [ ] **7.1 [P3]** Redacted tier: AI generalization + re-identification adversary (gated on observed demand — kill-signal #3).
- [ ] **7.2 [P3]** Active staleness loop: "still available?" pings + auto-pause + freshness badge.
- [ ] **7.3 [P3]** Dark mode; cohort-join product feature (manual link only in v1); agencies (Phase 3).

---

## Parallelization
```
Phase 0  ──▶  Phase 1 (GATE: privacy foundation, tested green)
                  │
       ┌──────────┼──────────┬──────────┐
       ▼          ▼          ▼          ▼
   Lane B      Lane C      Lane D     (Phase 5 folds into C)
   candidate   employer    reveal
   (P2)        index (P3)  loop (P4)
       └──────────┴──────────┘
                  ▼
            Phase 6 gates → public candidate launch
```
Conflict flag: Lane B (2.x) and Phase 1 (1.1) both touch `CandidateEmployer` — coordinate that seam; build 1.1 first, then B consumes it.
