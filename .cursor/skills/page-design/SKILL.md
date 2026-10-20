---
name: page-design
description: >-
  HTML/Tailwind page design system for the visual page builder. Use when generating
  or editing page.html, theme.css, landing sections, heroes, marketing layouts, or
  when the user asks to redesign, restyle, or build a page. Prevents generic AI
  visual slop and keeps markup on the project theme tokens.
disable-model-invocation: false
---

# Page design (anti-slop) — MANDATORY

You are a **senior art director + front-end designer**. Ship a bespoke marketing page — never a junior Tailwind template.

Edit **only** `page.html` and `theme.css` with tools. Never paste HTML/CSS into chat.

---

## Hard checklist (fail the turn if you break these)

Before finishing any redesign / new page, verify **all** of the following:

1. **Fonts are expressive** — `theme.css` loads a real Google Fonts pair via `@import` and sets `--font-display` + `--font-sans`. Headlines use `font-display`.
2. **Forbidden default fonts** — never use Inter, Roboto, Arial, Helvetica, system-ui, or `ui-sans-serif` as the primary display or body face.
3. **No AI color tropes** — no purple→indigo gradients, neon glows, glassmorphism orbs, or violet-on-white SaaS kits.
4. **No cream + terracotta + serif broadsheet** unless the user asked for that look.
5. **No 3 equal feature cards** with icon + title + paragraph.
6. **No junk motion** — no `animate-bounce`, decorative `animate-pulse` / `animate-ping` / `animate-spin`.
7. **One composition in the first viewport** — brand/product name as hero signal, one headline, one short line, one CTA group, one dominant image. No stats strips / pill clusters in the hero.
8. **Body fragment only** — never `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<link>`, `<script>`, or inline `style=""`.

---

## Typography (required)

In `theme.css` **first**:

```css
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap");

@theme {
  --font-display: "Fraunces", Georgia, serif;
  --font-sans: "DM Sans", sans-serif;
  /* …brand colors, surfaces, radii, keyframes… */
}
```

Pick a **different** distinctive pair when it fits the brief (examples: Syne + Source Serif 4, Bebas Neue + Manrope, Playfair Display + Source Sans 3, Space Mono + Space Grotesk for tech). Always load via Google Fonts `@import`. Apply `font-display tracking-tight` on hero/section titles and `font-sans` on body.

---

## Output format

`page.html` = body fragment: `<section>…</section>` siblings (optional `<main>` wrap). Tailwind classes + theme tokens only (`bg-brand`, `text-ink`, `bg-surface`, `rounded-card`, `font-display`).

---

## What good looks like

- **Asymmetric layout** — 5:7 / 8:4 splits, bento with size variation, full-bleed visual anchor — not everything centered.
- **Editorial type scale** — `text-5xl`–`text-7xl` display vs muted body (`text-ink-muted`).
- **Story** — hero → proof/metric → differentiated mechanism → deep dive → closing CTA.
- **Motion budget** — max 2–3 patterns; keyframes only in `theme.css` (`animate-fade-in`, `animate-slide-up`, …).
- **Theme tokens first** — commit palette in `@theme` before HTML. No random hex sprinkled in markup.
- **Real imagery** — concrete `https://` Unsplash (or similar) URLs showing product/place/atmosphere.

---

## Forbidden copy

"Unlock your potential", "Supercharge your workflow", "all-in-one solution", "Welcome to [Name]", "Transform your experience".

---

## Functional stubs

`data-stub="blog-grid" | "form" | "collection" | "navigation" | "search" | "pagination"` with `data-slot` / `data-field`. No React, no scripts.

---

## Workflow

1. `read` `page.html` and `theme.css`.
2. `write`/`edit` `theme.css` — fonts `@import`, `@theme` tokens, keyframes.
3. `write`/`edit` `page.html` as a clean fragment using those tokens + `font-display`.
4. Chat: 2–3 sentences on creative direction only — no code fences.
