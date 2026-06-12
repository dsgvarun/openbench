# OpenBench — Product Requirements Document
### An open talent marketplace for laid-off and at-risk professionals, with candidate-controlled visibility
*PRD v1.0 — June 2026 — Owner: Varun*

---

## 1. Summary

OpenBench is a two-sided marketplace connecting professionals who are laid off (or quietly at risk) with companies hiring right now. Candidates upload a resume, declare their terms (roles, industries, locations, salary band, availability), and choose **how visible they want to be** — from fully open to fully redacted. Employers list real open roles, browse a structured pool with live aggregate statistics, and send interest requests attached to a listed role. Identity and contact details flow only on candidate consent, per company.

The product's wedge: **verified availability + declared terms + candidate-controlled visibility.** Every profile is someone genuinely on the market; every salary expectation is stated upfront; every reveal is consented.

## 2. Goals & Non-Goals

**Goals (v1):**
1. Candidates can go from resume upload to a live, visibility-controlled profile in under 10 minutes.
2. Employers can assess pool depth (by city, band, function, availability) before signing up, and search/filter it after verification.
3. The interest → reveal loop works end-to-end with email notifications, with median candidate response under 48 hours.
4. No candidate can be identified without their consent — enforced by redaction tooling, blocklists, employment-history blocking, and k-anonymity on all aggregate counts.

**Non-goals (v1):** in-app chat, interview scheduling, assessments, offers/payments between parties, mobile apps, ATS integrations, referral bonuses, international (non-India) launch. These are explicitly deferred.

## 3. Decisions Already Made

| Decision | Resolution |
|---|---|
| Marketplace scope | **Open** — any verified company, any eligible candidate. Not a DSG/Dream Sports tool. |
| Anonymity model | **Candidate-controlled visibility tiers** (see §6.3), not mandatory redaction. Redaction is a feature, not a constraint. |
| Transparency stats | Live aggregate counts shown to both sides, pre-signup, with **k-anonymity suppression (<5)** on all narrow slices. |
| Interest requests | Must be attached to a **listed job** with title, function, location, and comp band. No fishing. |
| Job listings | Free for companies at launch; they power the candidate-facing stats. |
| Candidate pricing | Free, forever. |
| Employer pricing | Free during seeding; reveal-based pricing in Phase 2 (see §10). |

## 4. Personas

**P1 — The quiet looker (at-risk, still employed).** Senior IC or manager who senses a layoff coming. Cannot signal publicly. Needs full redaction, an ex/current-employer blocklist, and total control over reveals. Highest-stakes user; the anonymity machinery exists primarily for them.

**P2 — The open candidate (laid off, public about it).** Their layoff is known; LinkedIn banner is already on. Wants speed and inbound volume, not secrecy. Will choose open or semi-open visibility for faster matches. Likely the volume majority.

**P3 — The in-house recruiter / hiring manager.** Needs candidates who can join within 30–60 days at a knowable cost. Values declared comp bands and availability above all. Judges the platform in the first session by whether the slice they need exists ("PMs, Mumbai, ₹25–40L").

**P4 — The platform admin (you/ops).** Approves companies, monitors pool health and abuse, manages suppression thresholds and takedowns.

## 5. Core User Journeys

**Candidate journey:** Land on candidate page → see live "other side" stats (roles, companies) → sign up (email/OTP) → upload resume → AI parses to structured profile → choose visibility tier → review/edit redacted output (if applicable) → set preferences (functions, industries, cities, work mode, CTC band, availability date) → set blocklist → publish → receive interest requests by email → view requester (company + listed role + band) → accept (reveal to that company) or decline → mark as placed / pause / delist.

**Employer journey:** Land on employer page → see live pool stats → sign up with work email → submit company for verification → (admin approves) → list open roles → search/filter pool with live counts → open anonymized profiles → send interest (pick one of own listed roles, optional note ≤ 300 chars) → on acceptance, receive full resume + contact → mark outcome (hired / in process / passed).

**Admin journey:** review company verification queue → approve/reject with reason → monitor dashboard (profiles/week, listings/week, interest sent, reveal rate, time-to-reveal, report volume) → act on abuse reports (warn / suspend company seat / suspend company) → manage candidate takedown and full-purge requests.

## 6. Feature Requirements — Candidate Side

### 6.1 Onboarding & resume ingestion
- Auth: email + OTP (no passwords v1). Phone optional, never shown.
- Resume upload: PDF/DOCX, ≤ 10 MB. Stored encrypted; original is **never** shown to any employer pre-reveal.
- LLM parsing to structured JSON: roles held, employers, durations, skills, education, certifications, seniority estimate. Candidate reviews and corrects parsed output — parsing errors must be fixable field-by-field before publish.

### 6.2 Declared preferences (required to publish)
Target functions (≤3), target industries (≤5), cities (multi-select + "remote-only" option), work mode, expected CTC band (predefined bands: ₹4–8L, 8–15L, 15–25L, 25–40L, 40–60L, 60–80L, 80L+), current CTC band (optional, never shown to employers — used only for internal match-quality scoring), availability (available now / serving notice — date / from date), seniority level.

### 6.3 Visibility tiers (the core mechanic)
Candidate picks one tier at publish; can change anytime (changes propagate within minutes).

| Tier | Name shown | Employers shown | Education shown | Resume file pre-reveal | Who it's for |
|---|---|---|---|---|---|
| **Open** | Yes | Yes | Yes | Redacted contact only | P2 wanting max speed |
| **Semi-open** | No | **Yes** (company names visible) | Yes | No | Default. Preserves pedigree signal, hides identity |
| **Redacted** | No | Generalized ("Series-B fintech, 1,000+ employees") | Generalized ("Tier-1 engineering college") | No | P1 at-risk users |

- Generalization is AI-generated and **candidate-reviewed before publish** — the review step is mandatory for the Redacted tier, with inline editing of every generalized string.
- Contact details (email/phone/LinkedIn URL) are hidden at every tier until reveal.
- UI must explain each tier's trade-off honestly at selection time: "Open profiles receive interest ~X% faster" (populate once data exists; omit the claim until then).

### 6.4 Blocklist & employment-history blocking
- Auto-block: every employer parsed from the resume is blocked by default (candidate can unblock, e.g., a company from 10 years ago).
- Manual blocklist: candidate adds any company by name/domain. Blocked companies never see the profile in search, in counts they contribute to at fine granularity, or via direct link.
- Blocking is silent — blocked companies get no indication the candidate exists.

### 6.5 Interest inbox & reveal
- Each request shows: company name, logo, the attached job listing (title, function, location, band, JD link), optional note, and request date.
- Actions: **Accept** (reveals full profile + resume + contact to that company only), **Decline** (optional reason: band too low / role mismatch / location / other — fed back to employer as aggregate only), **Ignore** (auto-expires in 14 days).
- A reveal is per-company and irrevocable by design — the UI must state this plainly before first accept.
- Candidate statuses: Active / Paused (invisible in search, profile retained) / Placed (prompted when accepting; triggers a delist nudge after 30 days) / Deleted (full purge, §11).

### 6.6 Candidate-facing transparency stats
Public (pre-signup) page shows: total open roles, total verified companies, roles by function / city / band / seniority. Post-signup dashboard shows the same filtered to *their* declared preferences ("31 roles match your terms"). All counts obey k-anonymity (§9).

## 7. Feature Requirements — Employer Side

### 7.1 Verification
- Signup with work email (domain must match claimed company; free-mail domains rejected).
- Manual admin approval in v1 (target < 24h). Collect: company legal name, website, LinkedIn page, approximate headcount, who is signing up (name, role).
- Recruiting agencies: **excluded in v1.** Direct employers only — agencies dilute the "companies come to you" promise. Revisit Phase 3.

### 7.2 Job listings
- Required fields: title, function, city (or remote), work mode, CTC band (same predefined bands), seniority, JD link or pasted JD. Status: open / filled / closed.
- Listings are public (they feed candidate-facing stats) and free in v1. Stale listings auto-expire at 60 days with a renewal nudge.

### 7.3 Search & browse
- Filters: function, skills (free-text match against parsed skills), city, CTC band, seniority, availability window, work mode, visibility tier.
- **Live filter counts** on every facet ("Mumbai (84)"), with k-anonymity suppression.
- Profile cards render per the candidate's visibility tier. Bulk export, scraping, and screenshots of lists are prohibited by ToS; paginate at 20 and rate-limit per seat as friction.

### 7.4 Interest requests
- Must attach one of the company's own open listings. Optional note ≤ 300 chars (no contact details allowed in the note — regex/LLM screened).
- Rate limit: 25 outstanding (unanswered) requests per seat; configurable per company by admin.
- Statuses visible to employer: sent / accepted (→ reveal) / declined / expired. Decline reasons shown only as aggregates across ≥5 declines.

### 7.5 Reveals & outcomes
- On accept: employer sees full profile, original resume, and contact details for that candidate; both parties get an email introduction.
- Employer marks outcomes (in process / hired / passed). "Hired" feeds platform success metrics and future pricing.

### 7.6 Employer-facing transparency stats
Public page: total candidates; distributions by city, band, function, seniority, availability. Post-verification: the same as live filter counts inside search. All k-anonymized.

## 8. Interest → Reveal Flow (canonical spec)

1. Employer opens anonymized profile → clicks "Send interest" → selects one open listing → optional note → confirm. State: `pending`.
2. Candidate notified by email within 5 minutes. Inbox shows full requester context.
3. Candidate accepts → state `accepted`; reveal record created; employer notified; intro email sent to both. OR declines → state `declined`; employer sees decline (no reason individually). OR 14 days pass → state `expired`.
4. One company may send at most **one** request per candidate per listing; max 3 total per candidate across listings, then locked for 90 days (anti-pestering).
5. Reveal grants are scoped: company seat(s) of that company only; resume file served via expiring signed URLs.

## 9. Privacy, Anonymity & Trust Requirements

- **k-anonymity on all aggregates:** any count derived from filters that would return < 5 candidates displays as "<5"; distribution bars for suppressed cells render in a hatched style. Applies to public stats, in-search facet counts, and any future API.
- **Employment-history shielding:** companies in a candidate's parsed work history can never view that profile (any tier), even via direct URL.
- **Re-identification review:** for Redacted-tier profiles, run an automated re-identification check before publish (LLM adversary attempts to guess employer/identity from the generalized profile; flag high-confidence guesses to the candidate with suggested edits).
- **Data protection (DPDP Act):** explicit consent at upload covering parsing, anonymization, and disclosure-on-accept; granular consent log per reveal; full purge on delete (originals, parsed JSON, embeddings, backups within 30 days); data residency in India region.
- **Security:** resumes encrypted at rest; signed expiring URLs for any file access; audit log on every profile view and reveal; employer seats individually authenticated (no shared logins).
- **Abuse handling:** candidate "report company" on any request; 3 upheld reports auto-suspends the seat pending admin review.

## 10. Monetization (sequenced, not v1-blocking)

**Phase 1 (launch → density):** everything free. Success = pool size and reveal rate, not revenue.
**Phase 2:** employer reveal credits — pay per accepted reveal (value-aligned: you pay only when a candidate says yes). Indicative: ₹2,000–5,000 per reveal or monthly seats with bundled credits. Listings stay free.
**Phase 3:** premium employer tooling (saved searches, new-match alerts, multi-seat admin, analytics), possible success-fee tier for ₹60L+ placements, agency access (decided then, not now). Candidates free at every phase.

## 11. Non-Functional Requirements

Performance: search results < 1s p95; stats counts cached ≤ 5 min. Availability: 99.5% v1. Email delivery: transactional within 5 min. Accessibility: WCAG AA on public pages. Mobile: fully responsive web (no native apps v1). Localization: English only v1; INR-only bands.

## 12. Data Model

| Entity | Key fields |
|---|---|
| Candidate | id, email (private), phone (private, opt), status (active/paused/placed/deleted), visibility_tier, created_at |
| Resume | candidate_id, file_ref (encrypted), parsed_json, version |
| AnonymizedProfile | candidate_id, tier, display_json (per-tier render), generalizations[], reid_check_score, published_at |
| Preferences | candidate_id, functions[], industries[], cities[], work_mode, ctc_band, current_band (private), availability_date, seniority |
| Blocklist | candidate_id, company_id or domain, source (auto-history / manual) |
| Company | id, legal_name, domain, verification_status, headcount_band, seats[] |
| Seat | company_id, user_email, role, rate_limit_state |
| JobListing | company_id, title, function, city, work_mode, ctc_band, seniority, jd_ref, status, expires_at |
| InterestRequest | company_id, seat_id, candidate_id, listing_id, note, status (pending/accepted/declined/expired), decline_reason (private) |
| Reveal | interest_id, revealed_at, resume_version, access_log[] |
| Report | candidate_id, company_id, request_id, reason, status |
| StatSnapshot | dimension, slice, count, suppressed_bool, computed_at |

## 13. Tech Approach (recommendation)

Next.js (App Router) on Vercel; Postgres via Supabase (auth, row-level security for tier rendering and reveal scoping, storage for encrypted resumes); LLM pipeline (Claude API) for resume parsing → structured JSON, generalization generation, re-identification adversary check, and note screening; Resend for transactional email; a nightly job for stat snapshots + k-anonymity computation and listing expiry. Three route groups in one app: `/` + `/for-employers` (public, stats), `/me` (candidate), `/hire` (employer), plus `/admin`. Estimated build for v1 scope at your pace: **4–6 weeks**, candidate-side first.

## 14. Launch Plan & Metrics

**Seeding (weeks 1–4 post-build):** recruit 10–15 design-partner companies from your network to list real roles before public candidate launch, so the candidate-facing stats are non-zero on day one. Target at launch: ≥ 50 listings, ≥ 20 companies. Candidate seeding via layoff-cohort outreach (entire affected teams onboard together — design a "join with your cohort" link).

**North-star metric:** accepted reveals per week.
**Supporting:** new published profiles/week; profile publish completion rate (target > 70% of uploads); listings live; interest requests sent/seat; reveal acceptance rate (healthy band: 25–50% — below 25% means low-quality interest, above 50% may mean candidates are under-protected or desperate); median time-to-first-interest for new profiles (target < 7 days); candidate NPS post-reveal.

**Kill / pivot signals:** publish completion < 40% (onboarding too heavy); acceptance rate < 10% after 200 requests (interest quality broken); < 30% of candidates choosing any redacted tier after 500 profiles (anonymity machinery may be over-built — simplify toward an open board with consent-gated contact).

## 15. Open Items (decide during build, not blocking start)

Final name and trademark check (OpenBench is a working title); whether "verified available" badge (severance/relieving-letter verification) ships in v1 or Phase 2 (recommendation: Phase 2 — self-declaration plus the placed/delist loop is enough signal at launch); exact reveal pricing; whether semi-open tier shows employer names for *all* past employers or only those > 2 years back (privacy edge: the most recent employer is the most identifying — consider always generalizing the latest employer even in semi-open).

---
*Companion artifacts: concept spec v0.2 (`anonymous-talent-pool-product-spec.md`) and landing-page mocks (`openbench-landing-mocks.jsx`). The visibility-tier model in §6.3 supersedes the mandatory-redaction framing in the concept spec.*
