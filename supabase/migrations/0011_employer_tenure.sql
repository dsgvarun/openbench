-- OpenBench v1 — employer tenure (Phase 7 polish)
-- Store the human-readable tenure per employer (e.g. "Jul 2025 – Current", "2019 – 2021")
-- so the candidate sees years of work per company on the Safety Check + Visibility steps.

alter table candidate_employer add column tenure text;
