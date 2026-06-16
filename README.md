# OpenBench

A trust-first, two-sided talent marketplace for laid-off and at-risk professionals in
India. Candidates declare their terms (roles, comp band, availability) and control
exactly how visible they are; **their name and employers stay hidden by default** and no
company sees who they are until the candidate accepts a reveal. India v1, responsive web.

> Status: v1 thin slice, feature-complete against the PRD. Runs in **demo mode** with zero
> keys; connect Supabase to go live with data. Live demo: https://openbench-chi.vercel.app

## The wedge

Declared comp bands + verified availability + **candidate-controlled visibility**. Every
profile is someone genuinely on the market; every reveal is consented. The durable asset
is the comp/availability index — ground truth for what Indian tech talent costs and how
fast it can start.

## The privacy model (the core of the product)

Two layers enforce "a blocked company sees nothing; names are hidden until you say yes":

1. **RLS (rows)** — Postgres row-level security. Employers get no direct read of
   candidate tables; blocked and no-reveal companies are denied.
2. **Projection (fields)** — `profile_card()`, a `SECURITY DEFINER` function, is the only
   path employers read candidate data. It redacts field-by-field (name + employers hidden
   by default, full data only with a `reveal` row). The rendered cache is non-authoritative,
   so a render bug can't leak.

Plus: fail-closed resume parsing (candidate must confirm the employer list before
publishing), per-viewer k-anonymity (`<5` slices suppressed), an irreversible consented
reveal, and DPDP scoped deletion. All enforced in the database and covered by tests.

## Stack

Next.js 15 (App Router) · Tailwind v4 · Supabase (Postgres + RLS + Auth + Storage) ·
resume parsing via any OpenAI-compatible LLM (Groq/Gemini/Ollama — or none) ·
Resend (email) · Vercel (hosting + cron).

## Quickstart (run locally with real data)

```bash
cp .env.example .env.local        # fill the 3 Supabase keys (Settings → API)
npm install
supabase login && supabase link --project-ref <ref> && supabase db push
node --env-file=.env.local supabase/tests/rls_live_test.mjs   # verify the privacy gate
npm run dev
```

Then sign up once, find your user UUID in Supabase → Auth → Users, and run
`insert into app_admin (user_id) values ('<uuid>');` to access `/admin`.

Resume auto-fill is optional (candidates can type employers manually). To enable a free
model, set `PARSE_LLM_BASE_URL` + `PARSE_LLM_MODEL` — see [docs/PARSING.md](docs/PARSING.md).

## Routes

| Route | Who | What |
|-------|-----|------|
| `/`, `/for-employers` | public | landings |
| `/me/onboarding` | candidate | upload → confirm employers → preferences → visibility → publish |
| `/me/inbox` | candidate | interest requests → accept (reveal) / decline |
| `/hire` | employer | comp/availability index |
| `/hire/search` | employer | candidate search → send interest |
| `/admin` | admin | company verification queue |
| `/api/jobs/*` | cron | intro-emails, expire-interests, stat-snapshot |

## Tests

```bash
npm test            # unit tests (parse contract, publish gate, email delivery, recall)
npm run db:validate # apply all migrations in PGLite
npm run db:test     # projection redaction tests
```
Plus SQL behavior tests in `supabase/tests/` (projection, index, reveal loop, phase 6).

## Layout

```
src/app/            routes (App Router) + /api/jobs cron handlers
src/components/      onboarding, employer, candidate, admin UI
src/lib/parse/       resume parse: contract, provider seam (OpenAI-compat / Anthropic), recall eval
src/lib/candidate/   server actions + fail-closed publish gate
src/lib/reveal/      reveal-loop actions
src/lib/email/       email seam + intro delivery
supabase/migrations/ schema, RLS, projection, index, reveal loop, admin, consent/purge, metrics
```

## Docs

- `openbench-prd-v2.md` — product requirements (source of truth)
- `DESIGN.md` — design system
- `BUILD-CHECKLIST.md` — phased build plan + status
- `docs/PARSING.md` — resume-parse provider options
- `supabase/README.md` — DB apply + live RLS verification

## Deploy

```bash
vercel --prod         # CLI deploy
```
Set the env vars in Vercel (Settings → Environment Variables) + `CRON_SECRET`. Crons
auto-register from `vercel.json` (daily on Hobby; bump to `*/5` for intro-emails on Pro).
