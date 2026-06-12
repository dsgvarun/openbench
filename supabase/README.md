# OpenBench — database

Privacy foundation (Phase 1). Two layers enforce the trust model:

1. **RLS (rows)** — `0002_rls_and_projection.sql`. Who can touch which rows. Employers get **no direct read** of candidate-side tables; blocked and no-reveal companies are denied.
2. **Projection (fields)** — `profile_card(cand uuid)`, a SECURITY DEFINER function. The **only** path employers read candidate data. Redacts field-by-field: name + employers hidden by default, full data only with a `reveal` row. `anonymized_profile.display_json` is a non-authoritative cache.

## Apply migrations

No local Postgres needed to author them. To apply against a real project:

```bash
# one-time: install the Supabase CLI, then link your project (India region)
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations/*.sql in order
```

Or paste each `migrations/*.sql` into the Supabase SQL editor in filename order.

## Tests

```bash
npm run db:validate   # DDL smoke test — applies both migrations in PGLite
npm run db:test       # projection redaction tests (16 assertions)
```

`db:test` proves the **field-level redaction** in `profile_card()`:
hidden-by-default, blocked-company-sees-nothing (employment-history shielding via
employer-domain match), per-employer opt-in, the `past_only` current-employer guard,
reveal-unlocks-identity, and `current_band` never leaking.

## RLS role enforcement — verify against LIVE Supabase (PGLite can't)

PGLite runs as a superuser and bypasses RLS, so the projection tests cover field
redaction but NOT row-policy *role* enforcement. Before launch, verify on a real
instance that a blocked/no-reveal company genuinely cannot read the underlying rows
**directly** (not just through `profile_card`):

Checklist (run as two distinct authenticated JWTs against the linked project):
- [ ] Blocked company `select * from candidate where id=<cand>` → 0 rows (RLS denies).
- [ ] Blocked company `select * from resume`/`candidate_employer`/`preferences` for that candidate → 0 rows.
- [ ] Blocked company `select profile_card('<cand>')` → `null`.
- [ ] No-reveal company `select * from resume where candidate_id=<cand>` → 0 rows; gets full data only after a `reveal` row exists.
- [ ] Any authenticated user `select * from stat_snapshot` → 0 rows (deny-all; raw counts are SECURITY-DEFINER-only).
- [ ] Candidate A cannot read Candidate B's `candidate`/`preferences`/`blocklist` rows.

A runnable version of this lives in `tests/rls_live_test.mjs` (requires env + two seeded test users).
