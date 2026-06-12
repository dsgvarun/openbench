# OpenBench — Product Requirements Document
### An open talent marketplace for laid-off and at-risk professionals, with candidate-controlled visibility
*PRD v2.0 — June 2026 — Owner: Varun*
*Supersedes openbench-prd-v1.md. v2 folds in the 8 decisions from the CEO review (2026-06-12). Change bars marked **[v2]**.*

---

## 0. What changed in v2 (CEO review decisions)

| # | Area | v2 resolution |
|---|------|---------------|
| 1 | Build strategy | **Thin slice first** — Semi-open tier + reveal loop + comp/k-anon stats + blocklist. Redacted tier, AI generalization, and the re-identification adversary are **deferred** to a gated fast-follow (built only if redacted-tier demand appears). |
| 2 | Semi-open re-ID | Employer names are **hidden by default**; the candidate opts in to reveal them (per-employer or all). Private-by-default. |
| 3 | Purge vs reveal | Reveal stays irrevocable; "purge" is **scoped and disclosed at accept time** (removed from OpenBench + future access revoked; already-disclosed data held under the accepting company's retention). |
| 4 | Parser safety | Employer extraction gets a **dedicated fail-closed confirmation step**; low confidence / parse failure blocks publish. |
| 5 | Employer experience | Leads with the **aggregate comp/availability index**, with every aggregate tied one-click into the candidates behind it (index = hook, reveal = conversion). |
| 6 | Metrics | Add **placement-grade** signals (employer return rate, revealed→contacted rate) and an early **willingness-to-pay** signal. |
| 7 | Staleness loop | Active freshness loop **deferred to Phase 2** (passive delist nudge ships in v1). |
| 8 | Cohort link | **Not** a v1 product feature (manual seeding link only). |

---

## 1. Summary

OpenBench is a two-sided marketplace connecting professionals who are laid off (or quietly at risk) with companies hiring right now. Candidates upload a resume, declare their terms (roles, industries, locations, salary band, availability), and choose **how visible they want to be**. Employers open the product to a **live comp-and-availability index** of the market, then move from any aggregate into the structured candidate pool and send interest requests attached to a listed role. Identity and contact details flow only on candidate consent, per company.

The wedge: **declared comp bands + verified availability, with candidate-controlled visibility.** Every profile is someone genuinely on the market; every salary expectation is stated upfront; every reveal is consented. **[v2]** The durable asset is the comp/availability index itself — the ground-truth for what Indian tech talent costs and how fast it can start; anonymity is the on-ramp that gets at-risk people in.

## 2. Goals & Non-Goals

**Goals (v1):**
1. Candidates can go from resume upload to a live, visibility-controlled profile in under 10 minutes — including a mandatory, fail-closed confirmation of which employers to hide from.
2. Employers can read the comp/availability index pre-signup, and after verification move from any aggregate directly into the candidates behind it.
3. The interest → reveal loop works end-to-end with email notifications, with median candidate response under 48 hours.
4. No candidate can be identified without their consent — enforced by names-hidden-by-default rendering, blocklists, fail-closed employment-history blocking, and k-anonymity on all aggregate counts.

**Non-goals (v1):** in-app chat, interview scheduling, assessments, offers/payments between parties, mobile apps, ATS integrations, referral bonuses, international (non-India) launch. **[v2] Also deferred:** the Redacted visibility tier with AI generalization + re-identification adversary; the active staleness loop; a productized cohort-join feature; recruiting agencies.

## 3. Decisions Already Made

| Decision | Resolution |
|---|---|
| Marketplace scope | **Open** — any verified company, any eligible candidate. |
| Build strategy **[v2]** | **Thin slice** — Semi-open tier only in v1; Redacted/generalization/reid-adversary deferred and gated on observed demand (kill-signal §14). |
| Visibility model **[v2]** | Candidate-controlled; in v1 the live tier is **Semi-open with employer names hidden by default** and per-employer opt-in reveal (see §6.3). |
| Transparency surface **[v2]** | Employer experience leads with the **comp/availability index**; k-anonymity suppression (<5) on all narrow slices is accepted (the index, not per-slice browsing, carries the first session). |
| Interest requests | Must attach to a **listed job** (title, function, location, comp band). No fishing. |
| Reveal & purge **[v2]** | Reveal is per-company and irrevocable; "purge" scoped and disclosed at accept (see §6.5/§9). |
| Job listings | Free for companies at launch; power the index. |
| Candidate pricing | Free, forever. |
| Employer pricing | Free during seeding; reveal-based pricing in Phase 2 (see §10), with a WTP signal collected during seeding. |

## 4. Personas
*(unchanged from v1)*

**P1 — The quiet looker (at-risk, still employed).** Senior IC/manager sensing a layoff. Cannot signal publicly. Needs names-hidden rendering, a reliable ex/current-employer blocklist, and total control over reveals. Highest-stakes user.

**P2 — The open candidate (laid off, public).** Layoff is known. Wants speed and inbound. Likely the volume majority.

**P3 — The in-house recruiter / hiring manager.** Needs candidates who can join in 30–60 days at a knowable cost. Values declared comp bands and availability above all. **[v2]** At design-partner scale, this is the same person who reads the comp index — the index is their entry point.

**P4 — The platform admin.** Approves companies, monitors pool health/abuse, manages suppression thresholds and takedowns.

## 5. Core User Journeys

**Candidate journey:** Land → see live index → sign up (email/OTP) → upload resume → AI parses to structured profile → **[v2] confirm the employer list (mandatory, fail-closed — "these are the companies we'll hide you from; add any we missed")** → review/edit other parsed fields → set preferences → **[v2] choose which employers (if any) to reveal in Semi-open** → set additional blocklist → publish → receive interest by email → view requester → accept (reveal to that company) or decline → mark placed / pause / delist.

**Employer journey:** **[v2]** Land → read the comp/availability index (pre-signup) → sign up with work email → verification → list open roles → **[v2] from any index aggregate, drill into the candidates behind it** → open profiles (names hidden unless candidate opted in) → send interest (own listed role + optional note ≤300 chars) → on acceptance, receive full resume + contact → mark outcome.

**Admin journey:** review verification queue → approve/reject → monitor dashboard (incl. **[v2] parser recall + re-identification reports**) → act on abuse reports → manage takedown and full-purge requests.

## 6. Feature Requirements — Candidate Side

### 6.1 Onboarding & resume ingestion **[v2 — fail-closed]**
- Auth: email + OTP (no passwords v1). Phone optional, never shown.
- Resume upload: PDF/DOCX, ≤10 MB. Stored encrypted; original never shown pre-reveal.
- LLM parsing to structured JSON. **The employer list is the safety boundary:** a dedicated, **un-skippable confirmation step** presents every parsed employer ("these are the companies we'll hide you from") and lets the candidate add any the parser missed. **Low parser confidence, empty extraction, or parse failure BLOCKS publish** and routes to manual entry — never a 500, never a half-parsed publish. Parsed text from the resume is treated as untrusted (no embedded-instruction execution / prompt-injection).
- All other parsed fields remain editable field-by-field before publish.

### 6.2 Declared preferences (required to publish)
*(unchanged)* Target functions (≤3), industries (≤5), cities (+remote-only), work mode, expected CTC band (₹4–8L … 80L+), current CTC band (optional, never shown to employers — internal match scoring only), availability, seniority.

### 6.3 Visibility (the core mechanic) **[v2 — simplified for thin slice]**
v1 ships a single live tier: **Semi-open, names hidden by default.**

| Field | v1 default (Semi-open) | Candidate control |
|---|---|---|
| Name | Hidden | Revealed only on accept |
| Employers | **Hidden by default** | **Opt-in reveal: none / past-only / all** |
| Education | Shown | — |
| Resume file | Not shown pre-reveal | Revealed only on accept |
| Contact (email/phone/LinkedIn) | Hidden | Revealed only on accept |

- Rationale: hiding the name is not enough — current-employer + city + band + seniority is often a unique re-identifier. Employer names are therefore private by default, surfaced only when the candidate explicitly opts in.
- **Deferred:** the fully-Redacted tier (AI-generalized employer/education) and the re-identification adversary check. These ship only if data shows demand for deeper redaction (§14 kill-signal).
- UI explains the opt-in tradeoff honestly at selection time. Omit any "Open profiles get interest X% faster" claim until data exists.

### 6.4 Blocklist & employment-history blocking
- Auto-block: every employer **confirmed in §6.1** is blocked by default (candidate can unblock old ones).
- Manual blocklist: candidate adds any company by name/domain.
- Blocked companies never see the profile in search, in fine-grained counts, or via direct link. Blocking is silent.

### 6.5 Interest inbox & reveal **[v2 — scoped purge disclosure]**
- Each request shows: company name, logo, attached listing (title, function, location, band, JD link), optional note, request date.
- Actions: **Accept** (reveals full profile + resume + contact to that company only), **Decline** (optional reason, aggregated), **Ignore** (auto-expires 14 days).
- **A reveal is per-company and irrevocable.** The accept confirmation states this plainly AND states the purge reality: *"Accepting shares your resume and contact with this company. You can later remove your data from OpenBench, but information you've already shared by accepting is held by that company under their own retention policy."*
- Candidate statuses: Active / Paused / Placed (delist nudge after 30 days) / Deleted (full purge, §11).

### 6.6 Candidate-facing transparency stats
Public page and post-signup dashboard show counts filtered to the candidate's terms ("31 roles match"). All counts obey k-anonymity (§9).

## 7. Feature Requirements — Employer Side

### 7.1 Verification
*(unchanged)* Work-email domain match (free-mail rejected); manual admin approval <24h; agencies excluded in v1 (revisit Phase 3 — note: this is a real demand-side constraint, see §15).

### 7.2 Job listings
*(unchanged)* Required fields incl. CTC band; public; free in v1; auto-expire at 60 days with renewal nudge.

### 7.3 The comp/availability index + search **[v2 — index-led]**
- **Primary employer surface: the aggregate comp/availability index.** Distributions and percentiles by city, function, seniority, and band; availability curves (how many can start in 30 / 60 / 90 days). Available pre-signup (k-anonymized).
- **Every aggregate is a one-click entry into the candidates behind it** ("see the 12 PMs in this band") — the index is the hook, browsing + reveal is the conversion, in the same session.
- Search/filter: function, skills (free-text against parsed skills, FTS-indexed), city, CTC band, seniority, availability, work mode.
- **Live facet counts** with k-anonymity suppression; counts are **per-viewer** (a blocked company is excluded), so the count layer combines a global precompute with a viewer-blocklist adjustment at query time (see §11).
- Profile cards render names hidden unless the candidate opted in. Bulk export/scraping prohibited by ToS; paginate at 20; rate-limit per seat.

### 7.4 Interest requests
*(unchanged)* Attach one own open listing; note ≤300 chars (contact-info screened, leak rate measured); rate limit 25 outstanding/seat; statuses sent/accepted/declined/expired; decline reasons aggregated across ≥5.

### 7.5 Reveals & outcomes
*(unchanged)* On accept: full profile + resume + contact for that candidate, both parties emailed. Employer marks outcomes (in process / hired / passed).

### 7.6 Employer-facing transparency
Covered by the index (§7.3). All k-anonymized.

## 8. Interest → Reveal Flow (canonical spec) **[v2 — race + delivery handling]**

1. Employer opens profile → "Send interest" → select one open listing → optional note → confirm. State: `pending`. (Idempotent on double-submit; one request per candidate per listing.)
2. Candidate notified by email within 5 minutes.
3. Candidate accepts → state `accepted`; reveal record created; intro email to both; **delivery confirmed** (bounce → flag, retry, surface to sender; never leave "revealed but silent"). OR declines → `declined`. OR 14 days → `expired`.
4. **Race handling:** if the candidate is paused/deleted at the accept moment, the accept is rejected with a clear message; no partial reveal.
5. One company: ≤1 request per candidate per listing; ≤3 total per candidate, then locked 90 days.
6. Reveal grants scoped to that company's seats; resume served via expiring signed URLs.

## 9. Privacy, Anonymity & Trust Requirements **[v2 — scoped purge + DPDP posture]**

- **k-anonymity on all aggregates** (<5 → "<5"; hatched bars). Applies to public stats, in-search facet counts, and any future API.
- **Names-hidden-by-default rendering** (§6.3) as the primary re-identification control in v1.
- **Fail-closed employment-history shielding:** companies in a candidate's confirmed work history can never view that profile, even by direct URL. The confirmation step (§6.1) is what makes this reliable.
- **Scoped purge:** deletion removes the candidate's data from OpenBench (originals, parsed JSON, embeddings, backups within 30 days) and revokes all future access. Data already disclosed to a company the candidate accepted is held under that company's retention; the candidate is told this at accept and at deletion. DPDP erasure rights are honored to the boundary of OpenBench's control.
- **DPDP operating posture (not just mechanics):** explicit consent at upload (parsing, anonymization, disclosure-on-accept); per-reveal consent log; India data residency; named DPO; documented breach-notification timeline; consent-withdrawal mechanics. This is staffed, ongoing compliance, not a build line item.
- **Security:** resumes encrypted at rest; signed expiring URLs; audit log on every profile view and reveal; per-seat auth.
- **Abuse:** candidate "report company"; 3 upheld reports auto-suspend the seat pending review.
- **Deferred:** automated re-identification adversary (ships with the Redacted tier).

## 10. Monetization (sequenced, not v1-blocking) **[v2 — WTP signal early]**
**Phase 1 (launch → density):** free. Success = pool size, reveal rate, **and a placement-grade signal (§14)**. Collect a lightweight willingness-to-pay signal during seeding so Phase 2 pricing isn't a cold guess.
**Phase 2:** employer reveal credits (pay per accepted reveal; ₹2,000–5,000 indicative). Listings stay free.
**Phase 3:** premium tooling, possible success-fee tier, agency access. Candidates free at every phase.

## 11. Non-Functional Requirements
Performance: search results <1s p95 — **[v2]** including the per-viewer k-anon facet-count path (global precompute + indexed blocklist-exclusion adjustment). Stats cached ≤5 min. Availability 99.5%. Email within 5 min, with delivery confirmation on reveal intros. Accessibility WCAG AA on public pages. Mobile: fully responsive web. Localization: English only v1; INR bands. **[v2]** Non-English resume uploads detected and routed to manual entry rather than mis-parsed.

## 11A. Design & UX Requirements [v2 — from design review]

Design system: see `DESIGN.md` (warm & human / trust through empathy — Fraunces + DM Sans; warm paper/sage/clay palette; editorial-warm hybrid layout). Read it before any UI work.

**Interaction state matrix (required for all 5 core surfaces).** Each surface specs loading / empty / error / success / partial:

| Surface | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| Comp-index landing | skeleton bars (not spinner) | total-pool framing + "notify when this slice fills" (never "no results") | "data unavailable, retry" — never a blank zone | `<5` slices render hatched ("fewer than 5") |
| Parser-confirmation step | "reading your resume…" with progress | n/a (publish blocked until confirmed) | "couldn't read this" → manual entry, never a 500/half-publish | low-confidence employers flagged for explicit confirm |
| Visibility / opt-in-reveal | instant (local state) | n/a | save failure surfaced, selection preserved | per-employer toggles independently saved |
| Reveal-accept (one-way door) | button → in-flight disabled state | n/a | **network failure mid-accept = explicit "not completed, try again", never ambiguous** | accept rejected cleanly if candidate paused/deleted at that moment |
| Interest inbox | skeleton rows | warm empty state + "your profile is live, here's what employers see" | per-request load error isolated | expired requests visually distinct |

**Responsive (mobile-majority India).**
- Comp-index data zone reflows on mobile: percentile cards stack vertically; distribution bars become an accordion or horizontal-scroll group, never a squished table.
- Reveal-accept and parser-confirmation are full-screen on mobile (not cramped modals) — the trust moments get room.
- Touch targets ≥44px; the reveal CTA and decline are well-separated to prevent mis-taps on the irrevocable action.

**Accessibility (trust moments must work for assistive tech).**
- Reveal-accept confirmation: logical keyboard focus order, focus trapped in the dialog, the irrevocability + scoped-purge copy read by screen readers before the confirm button.
- `<5`-suppressed bars: screen reader announces "fewer than 5, suppressed" — never a misleading number, never silence.
- Honor `prefers-reduced-motion` (disable entrance animation, keep instant state changes).
- WCAG AA contrast verified against the warm paper background (`#FAF7F2`) for all ink/neutral pairs.

## 12. Data Model **[v2 — additions marked]**

| Entity | Key fields |
|---|---|
| Candidate | id, email (private), phone (private, opt), status, **reveal_employers (none/past-only/all)** , created_at |
| Resume | candidate_id, file_ref (encrypted), parsed_json, **parse_confidence**, version |
| AnonymizedProfile | candidate_id, display_json, **employer_visibility[] (per-employer flag)** , **schema_version**, published_at |
| Preferences | candidate_id, functions[], industries[], cities[], work_mode, ctc_band, current_band (private), availability_date, seniority |
| Blocklist | candidate_id, company_id or domain, source (auto-confirmed-history / manual) |
| Company | id, legal_name, domain, verification_status, headcount_band, seats[] |
| Seat | company_id, user_email, role, rate_limit_state |
| JobListing | company_id, title, function, city, work_mode, ctc_band, seniority, jd_ref, status, expires_at |
| InterestRequest | company_id, seat_id, candidate_id, listing_id, note, status, decline_reason (private) |
| Reveal | interest_id, revealed_at, resume_version, **intro_delivery_status**, access_log[] |
| Report | candidate_id, company_id, request_id, reason, status |
| StatSnapshot | dimension, slice, count, suppressed_bool, computed_at |

## 13. Tech Approach (recommendation) **[v2 — thin-slice scope + honest estimate]**
Next.js (App Router) on Vercel; Postgres via Supabase (auth, RLS for tier rendering + reveal scoping, encrypted storage); LLM pipeline (Claude API) for resume parsing → structured JSON and note screening (generalization + reid-adversary deferred with the Redacted tier); Resend for transactional email with delivery tracking; a nightly job for stat snapshots + k-anonymity + listing expiry, plus a per-request blocklist-adjustment layer for facet counts. Route groups: `/` + `/for-employers` (public, index), `/me` (candidate), `/hire` (employer), `/admin`.

**Estimate:** the happy-path code is ~4–6 weeks, but the LLM parser is an **eval-and-tune problem** (labeled India-resume corpus, employer-extraction recall bar, fail-closed fallback) and the platform carries **ongoing human ops** (manual <24h approval, abuse adjudication). Budget for the eval work and staff the ops; don't treat them as part of the 4–6 weeks.

## 14. Launch Plan & Metrics **[v2 — placement-grade signals]**
**Seeding (weeks 1–4):** recruit 10–15 design-partner companies to list real roles before public candidate launch. **Don't open candidate signups until ≥20 companies / ≥50 listings exist** so the index is non-zero on day one. Candidate seeding via layoff-cohort outreach (manual "join with your cohort" link).

**North-star:** accepted reveals per week.
**[v2] Placement-grade supporting metrics (the loop actually completing):** employer return rate; revealed→contacted rate; hires marked. Plus: new published profiles/week; publish completion rate (target >70%); listings live; reveal acceptance rate (healthy 25–50%); median time-to-first-interest (<7 days); candidate NPS post-reveal; **parser employer-recall + parse-failure rate; re-identification report count.**

**Kill / pivot signals:** publish completion <40%; acceptance <10% after 200 requests; <30% choosing to reveal *any* employer after 500 profiles (the signal to simplify toward an open board); **[v2]** zero hires after N reveals despite a healthy reveal rate (the loop fires but doesn't place — the most important pivot signal).

## 15. Open Items (decide during build, not blocking start) **[v2]**
- Final name and trademark check (OpenBench is a working title).
- "Verified available" badge (severance/relieving-letter verification): recommendation Phase 2.
- Exact reveal pricing (informed by the seeding WTP signal).
- **No-agencies stance:** a real demand-side constraint — much of India mid-market hiring runs through agencies. Revisit whether excluding them starves demand before Phase 3.
- LLM JSON contract specifics (malformed/empty/refusal/injection handling).

---
*Companion artifacts: concept spec v0.2 (`anonymous-talent-pool-product-spec.md`) and landing-page mocks (`openbench-landing-mocks.jsx`) — not present in this folder; reconcile if they carry additional context. CEO review decision record: `~/.gstack/projects/OpenBench/ceo-plans/2026-06-12-openbench-prd-review.md`. Design system: `DESIGN.md`.*

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | resolved | SELECTIVE EXPANSION; 8 decisions; 2 expansions surfaced (0 accepted, 1 deferred, 1 skipped) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | resolved | 4 issues, all resolved; 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score 3/10 → 8/10; 2 decisions (state matrix, mobile+a11y) |
| Outside Voice | `/codex review` | Independent 2nd opinion | 1 | issues_found | 9 findings (Claude subagent; Codex unavailable — no git repo); folded into v2 |
| Design System | `/design-consultation` | Visual language | 1 | shipped | DESIGN.md written — warm & human (Fraunces + DM Sans, warm paper/sage/clay) |

- **CROSS-MODEL:** Outside voice + CEO review agreed on supply-decay and cold-start risks. Two tensions surfaced (comp-index fork, prove-first) and resolved by the user (keep comp-index tied to the loop; build-first).
- **VERDICT:** CEO + ENG + DESIGN CLEARED — ready to implement. Build order: privacy foundation (RLS + projection + CandidateEmployer) first, then parser/index/reveal-loop in parallel.

NO UNRESOLVED DECISIONS.
