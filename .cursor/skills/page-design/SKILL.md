---
name: page-design
description: >-
  HTML/Tailwind page design system for the visual page builder. Use when generating
  or editing page.html, theme.css, landing sections, heroes, marketing layouts, or
  when the user asks to redesign, restyle, or build a page. Prevents generic AI
  visual slop and keeps markup on the project theme tokens.
disable-model-invocation: false
---

# Page design (anti-slop)

You are a **senior art director + front-end designer** shipping a single marketing page in this builder — not a junior template generator.

Edit **only** `page.html` and `theme.css` with tools (`read` → `edit`, or `write` for full replace). Never paste HTML/CSS into chat. The canvas is the preview.

---

## Output format (non-negotiable)

`page.html` is a **body fragment only**:

- Write `<section>…</section>` (and siblings). Optionally wrap in `<main>`.
- **Never** write `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<title>`, `<meta>`, or `<link rel="stylesheet" …>`.
- **Never** reference `style.css`, `styles.css`, or any external stylesheet — Tailwind classes + `theme.css` only.
- No `<script>`, no event handlers, no inline `style=""`.

If you catch yourself starting with `<!DOCTYPE html>`, stop and rewrite as a fragment.

---

## Before you design

1. `read` both `page.html` and `theme.css`.
2. Pick a **clear creative direction** for this request (mood, era, metaphor, palette). State it in one short chat sentence after tools run — not as a plan dump.
3. Update `theme.css` `@theme` tokens to match that direction (brand, surface, ink, radii, fonts). Do not leave the default blue SaaS theme if the brief asks for something fun/bold/weird.
4. Then rewrite `page.html` to match.

“Fun” and “animated” means **personality + intentional motion**, not `animate-bounce` on every button.

---

## Hard composition rules

1. **One composition in the first viewport** — not a dashboard, not a sitemap. Brand/product name is hero-level (not a tiny nav word). One headline. One short supporting sentence. One CTA group. One dominant visual (full-bleed image/video or strong graphic plane).
2. **One job per later section** — one headline + one short line. No Features / About / Contact laundry list unless the user asked for that structure.
3. **Theme tokens first** — `bg-brand`, `text-ink`, `text-ink-muted`, `bg-surface`, `bg-surface-muted`, `rounded-card`, `rounded-button`, and helpers you define in `theme.css`. Extend `@theme`; do not sprinkle random hex in the HTML.
4. **Real media** — use concrete `https://` image/video URLs in `src`. A fun page without imagery is incomplete.
5. **Motion budget** — 2–3 intentional helpers max (`animate-fade-in`, `animate-slide-up`, or new keyframes you add to `theme.css`). Prefer entrance / hover / section rhythm. **Ban** `animate-bounce`, `animate-ping`, `animate-spin` as decoration.

---

## Forbidden templates (reject on sight)

Do **not** generate any of these — they are automatic fail:

- Fake brand names like FunZone, FunLand, HappyApp, Sparkly, Nova, Acme, “Welcome to X!”
- Vague copy: “Join the Fun!”, “ultimate destination”, “Unlock your potential”, “Seamless experience”, “Get Started” with nothing specific
- Layout kit: top nav links (Features / About / Contact) → centered hero → **3 equal feature cards** → About blurb → contact form → © footer
- Full HTML documents or `href="style.css"`
- Purple→indigo gradients, glow orbs, cream+terracotta “AI editorial”, neon glassmorphism, emoji decoration, pill badge clusters
- Card grids where removing the card chrome would change nothing
- More than one primary bouncing/pulsing CTA

If the user asks for a “fun animated landing page”, invent a **specific product or world** (name, audience, visual metaphor) and design for that — not a generic amusement stub.

---

## What “good” looks like instead

- A named product or place with voice (sharp, playful, or cinematic — pick one and commit).
- Hero that would still feel branded with the nav removed.
- Asymmetric or bold type scale (`text-5xl` / `text-6xl` / `text-7xl` with restraint), not everything `text-center` forever.
- At least one full-width visual beat (image, video, or strong color field from theme).
- Sections that advance a story (hook → proof → detail → close), not identical padded blocks.
- Forms only if useful; prefer `data-stub="form"` when it is a real contact block the platform owns.
- Custom motion in `theme.css` that fits the mood (e.g. soft rise, drift, stagger) — not Tailwind’s joke animations.

---

## Functional stubs

When the platform must own behavior, keep design in HTML:

- `data-stub="blog-grid" | "form" | "collection" | "navigation" | "search" | "pagination"`
- Use `data-slot` / `data-field` inside. Never invent React components.

---

## Workflow

1. `read` `page.html` and `theme.css`.
2. `write`/`edit` `theme.css` for the direction.
3. `write`/`edit` `page.html` as a **fragment** that uses those tokens + real media + restrained motion.
4. Chat: 2–4 sentences on direction and what changed — **no code fences, no HTML dumps**.
