-- OpenBench v1 — employer designation/title (Phase 7 polish)
-- The role the candidate held at each company, so multiple stints at the same employer
-- (e.g. Senior PM vs PM at Dream11) are distinguishable on the Safety Check + Visibility.

alter table candidate_employer add column title text;
