# Design System — OpenBench

## Product Context
- **What this is:** A trust-first, two-sided talent marketplace for laid-off and at-risk professionals in India, with candidate-controlled visibility and declared comp/availability upfront.
- **Who it's for:** P1 at-risk professionals (afraid of exposure — highest stakes), P2 laid-off candidates (want speed), P3 in-house recruiters/hiring managers (want competence + knowable cost).
- **Space/industry:** Tech hiring / talent marketplace. Peers: Instahyre, Cutshort, Hirist (all cold, polished, interchangeable).
- **Project type:** Responsive web app (Next.js App Router).

## Memorable thing
Someone should feel **cared-for and safe** in the first 3 seconds — "a person built this for people," not a faceless portal. Every design decision serves warmth + discretion, while keeping enough credibility that recruiters trust the data.

## Aesthetic Direction
- **Direction:** Editorial-warm (humane, calm, careful).
- **Decoration level:** Intentional — subtle paper texture, soft shadows, rounded-not-bubbly corners.
- **Mood:** Warm, discreet, trustworthy. Premium-but-human. Never hype, never cold-corporate, never alarm.
- **Deliberate risks (the product's face):** warm paper background instead of stark white; soft-serif display (Fraunces) instead of universal SaaS sans; softened clay error color instead of alarm-red (anxious users).

## Typography
- **Display/Hero:** Fraunces (soft optical serif, wght 400–600) — warmth, care, editorial trust.
- **Body:** DM Sans (wght 400–700) — warm humanist sans, highly readable, friendly-but-professional.
- **UI/Labels:** DM Sans (same as body).
- **Data/Tables:** DM Sans with `font-variant-numeric: tabular-nums` — aligned figures for the comp-index columns. MUST use tabular-nums anywhere numbers stack.
- **Code:** JetBrains Mono (rare; admin/debug only).
- **Loading:** Google Fonts — `Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600` + `DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700`. Self-host before launch for performance + India data-residency comfort.
- **Scale (rem, 16px base):** display 3.375 (54px) / h1 2.25 / h2 1.625 / h3 1.25 / body 1.0 / small 0.875 / micro 0.75. Display uses Fraunces optical sizing.

## Color
- **Approach:** Balanced, warm-grounded. Color is meaningful, not decorative.
- **Background (paper):** `#FAF7F2` — warm paper, NOT stark white.
- **Ink (text):** `#1F1B16` — warm near-black, never pure `#000`.
- **Primary (sage):** `#2E6B5B` — safety, trust, growth. Primary CTAs, links, data bars. Soft tint `#E3EDE9`.
- **Secondary (clay):** `#C8693F` — human/empathetic accents, candidate-controlled affordances. Soft tint `#F4E5DC`.
- **Neutrals (warm taupe-gray):** `#6B6259` / `#8A8178` / `#B8AFA3` / `#E8E2D8` (darkest → lightest border).
- **Semantic:** success `#3E7C5A`, warning `#C8923F`, **error `#B5544A` (muted clay — softened on purpose for anxious users, never alarm-red)**, info `#4A6B82`.
- **k-anon suppression:** hatched fill (repeating 45° stripes in neutrals `#B8AFA3`/`#E8E2D8`) for `<5` cells — see preview.
- **Dark mode:** redesign surfaces (warm charcoal `#1F1B16` base, `#2A251F` surfaces); reduce sage/clay saturation ~15%; keep error softened. Not v1-blocking.
- **Contrast:** all text/background pairs must pass WCAG AA (the warm paper makes this a real check — verify ink and neutrals on `#FAF7F2`).

## Spacing
- **Base unit:** 8px.
- **Density:** comfortable-to-spacious — generous whitespace IS the calm/trust signal.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64) 4xl(96).

## Layout
- **Approach:** Hybrid — editorial-warm on candidate/marketing pages; grid-disciplined data tables on the employer comp-index zone.
- **Grid:** 12-col desktop / 6-col tablet / 4-col mobile.
- **Max content width:** 1080px.
- **Border radius:** sm 6px, md 10px, lg 16px, full 9999px (avatars/pills only). Rounded-not-bubbly — never uniform bubble-radius everywhere.
- **Shadow:** `0 1px 2px rgba(31,27,22,.04), 0 8px 24px rgba(31,27,22,.06)` — soft, warm-tinted.

## Motion
- **Approach:** Intentional but gentle. No bounce (bounce undercuts trust).
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`.
- **Duration:** micro 80ms / short 200ms / medium 320ms / long 500ms.
- **Accessibility:** honor `prefers-reduced-motion` — disable entrance animation, keep instant state changes.

## Trust-specific UI rules (product-critical)
- Names and employers are **hidden by default** on candidate cards; reveal is an explicit candidate opt-in (use clay accent for candidate-controlled affordances).
- The reveal-accept confirmation is a one-way-door moment: plain-language irrevocability + the scoped-purge copy, in a clay-bordered warning block.
- The comp-index empty/`<5`-suppressed state is a designed surface (total-pool framing + hatched bars), never a bare "no results."
- The parser employer-confirmation step ("companies we'll hide you from") gets visual weight — it's safety-critical, not a generic form field.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-12 | Initial design system created | /design-consultation. Posture: warm & human / trust through empathy. Fraunces + DM Sans; warm paper/sage/clay palette; editorial-warm hybrid layout. Grounded in the OpenBench PRD v2 and the CEO+eng review decisions (names-hidden-by-default, scoped purge, comp-index-led). |
