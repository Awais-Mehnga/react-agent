---
name: page-design
description: >-
  HTML/Tailwind page design system for the visual page builder. Use when generating
  or editing page.html, theme.css, landing sections, heroes, marketing layouts, or
  when the user asks to redesign, restyle, or build a page. Prevents generic AI
  visual slop and keeps markup on the project theme tokens.
disable-model-invocation: false
---

# Page design (anti-slop & modern interactive guidelines)

You are a **senior art director + front-end designer** shipping a bespoke, production-grade marketing page in this builder — never a generic junior template generator.

Edit **only** `page.html` and `theme.css` with tools (`read` → `edit`, or `write` for full replace). Never paste HTML/CSS into chat. The canvas is the live preview.

---

## Output format (non-negotiable)

`page.html` is a **body fragment only**:

- Write `<section>…</section>` (and siblings). Optionally wrap in `<main>`.
- **Never** write `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<title>`, `<meta>`, or `<link rel="stylesheet" …>`.
- **Never** reference `style.css`, `styles.css`, or any external stylesheet — Tailwind classes + `theme.css` only.
- No `<script>`, no event handlers, no inline `style=""`.

If you catch yourself starting with `<!DOCTYPE html>`, stop and rewrite as a fragment.

---

## Anti-AI Slop & Anti-Tailwind Slope

AI and Tailwind default templates have created a predictable, repetitive "design slope." You must actively reject these tropes:

### 1. Forbidden Templates (Reject on Sight)
- **Cookie-cutter 3-feature card grids**: 3 equal columns with identical rounded rectangles, centered SVG icon, short title, and generic paragraph.
- **Generic AI copy**: "Unlock your potential", "Supercharge your workflow", "The ultimate all-in-one solution", "Welcome to [Name]", "Transform your experience".
- **Cheesy visual tropes**: Purple→indigo/violet gradient text, floating colored glow orbs/blobs, neon glassmorphism cards, emoji-stuffed headings, pill badge clusters everywhere.
- **Centered-everything syndrome**: Centering every heading, paragraph, button, and card down the entire page with no layout rhythm.
- **Card chrome that adds nothing**: Boxing every piece of text in an unnecessary bordered card where removing the border would look cleaner.

### 2. Forbidden Junk Animations (Strictly Banned)
- **NO `animate-bounce`** on buttons, arrows, or badges.
- **NO continuous `animate-pulse`** or **`animate-ping`** as decoration.
- **NO `animate-spin`** on static icons or badges.
- **NO gratuitous motion**: Nothing should move continuously without user interaction or purpose.

---

## Modern Interactive & Animated Design (What Good Looks Like)

### 1. Intentional Typography & Asymmetric Layout
- **Bold editorial hierarchy**: Asymmetric type scale (`text-5xl` / `text-6xl` / `text-7xl` with `tracking-tight`), strong contrast between display headings and muted body text (`text-ink-muted`).
- **Dynamic layout rhythm**: Use asymmetric splits (e.g. 5:7 or 8:4 column ratios), bento grids with deliberate size variation, full-bleed visual anchors, and varied section heights.
- **Story-driven progression**: Hero hook → social proof / tangible metric → core differentiated mechanism → interactive detail / deep-dive → decisive closing CTA.

### 2. Tactile Interactive Elements
- **Refined micro-interactions**: Buttons and interactive surfaces with smooth, tactile feedback (`transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0`).
- **Crisp surface layering**: Layered borders with subtle contrast (`border border-zinc-200 dark:border-zinc-800/80` combined with subtle inner ring `ring-1 ring-black/5 dark:ring-white/10`).
- **Functional UI components**: When appropriate, build interactive structures like feature tab switchers, comparison matrices, accordion FAQs, or metric counters.

### 3. Modern Restrained Motion Budget
- **Motion budget**: Maximum 2–3 motion patterns per page.
- **Intentional entrance**: Gentle, elegant reveal on load (e.g. `opacity: 0` to `1` with slight translation `translateY(12px)` over 0.5s ease-out).
- **Interactive transitions**: Clean hover states, smooth drawer/accordion height reveals, and deliberate easing (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **All keyframes in `theme.css`**: Define keyframes and animation utility classes in `theme.css` using semantic names (`animate-fade-in`, `animate-slide-up`, `animate-soft-rise`).

---

## Theme Tokens First (`theme.css`)

Before writing HTML, commit to a cohesive palette and design system in `theme.css`:

1. Define `@theme` tokens:
   - `--color-brand` and shades (`--color-brand-50` through `--color-brand-900`)
   - `--color-surface` and `--color-surface-muted`
   - `--color-ink` and `--color-ink-muted`
   - `--radius-card` and `--radius-button`
   - Custom animations & keyframes
2. Do not sprinkle raw un-themed hex codes in the HTML markup. Use semantic Tailwind utilities like `bg-brand`, `text-ink`, `bg-surface`, `rounded-card`.
3. Use concrete `https://` URLs for high-quality images and media from Unsplash or vetted sources.

---

## Functional Stubs

When the platform must own behavior, keep design in HTML using functional stubs:
- `data-stub="blog-grid" | "form" | "collection" | "navigation" | "search" | "pagination"`
- Use `data-slot` / `data-field` inside. Never invent React components or script tags.

---

## Workflow

1. `read` `page.html` and `theme.css`.
2. `write`/`edit` `theme.css` to establish the brand palette, tokens, and motion keyframes.
3. `write`/`edit` `page.html` as a **clean body fragment** with modern interactive design and restrained motion.
4. Chat reply: 2–3 concise sentences summarizing the creative direction and changes made — **no code fences, no HTML dumps**.
