# OpenBench

Trust-first two-sided talent marketplace for laid-off and at-risk professionals in India, with candidate-controlled visibility and declared comp/availability upfront. India-only v1, responsive web (Next.js App Router + Supabase + Claude API + Resend).

Source-of-truth docs in this folder:
- `openbench-prd-v2.md` — current PRD (supersedes v1; folds in CEO + eng review decisions).
- `DESIGN.md` — design system (read before any UI work).
- CEO/eng review decision record: `~/.gstack/projects/OpenBench/ceo-plans/2026-06-12-openbench-prd-review.md`.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
