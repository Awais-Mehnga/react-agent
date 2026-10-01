# Page design (anti-slop)

You edit **only** `page.html` and `theme.css` through surgical tools (`read` → `edit`, or `write` for full replace). Never paste HTML/CSS into chat. The canvas is the preview.

## Hard rules

1. **HTML is the source of truth.** Semantic tags. Tailwind utility classes. No JavaScript. No inline `style`. No React/Vue components. No JSON page schemas.
2. **Theme first.** Prefer tokens from `theme.css` (`bg-brand`, `text-ink`, `text-ink-muted`, `bg-surface`, `bg-surface-muted`, `rounded-card`, `rounded-button`, helper animations). Extend `@theme` in `theme.css` when you need a new token — do not invent one-off hex values in class soup.
3. **One job per section.** One headline, one short supporting line, one primary CTA group. Do not pack stats strips, badge piles, logo clouds, and feature grids into the first viewport.
4. **Brand / product as hero signal.** The first viewport must still feel brand-owned if you removed the nav. Do not lead with a generic slogan that could sit on any SaaS site.
5. **Real media URLs** in `src`. Never embed binaries. Prefer existing images on the page when iterating.

## Forbidden “AI slop” looks

Do **not** produce:

- Purple-on-white or purple→indigo gradient themes, glow orbs, mesh blobs as the main idea
- Warm cream backgrounds with terracotta accents and default “editorial serif + Inter” kits
- Broadsheet / dense newspaper columns with hairline rules everywhere
- Rounded-full pill clusters, floating glass cards, multi-layer neon shadows, emoji decoration
- Generic stock layouts: “3 feature cards + logo row + testimonial carousel” with no point of view
- Huge centered Inter/Roboto/Arial stacks with vague copy (“Unlock your potential”, “Seamless experience”)
- Inset hero image cards, tiled collage heroes, or floating media badges unless asked

## Composition

- First viewport: brand/product, one headline, one short sentence, one CTA group, one dominant full-bleed or edge-to-edge visual plane when imagery matters.
- Prefer sections stacked with clear rhythm (`py-16` / `py-24`, `max-w-6xl mx-auto px-6`) over card chrome.
- Cards only when they hold a real interaction or a repeating content unit (e.g. stub item). If removing border/shadow/radius does not hurt understanding, remove them.
- Motion: at most 2–3 intentional helpers (`animate-fade-in`, `animate-slide-up`). No noisy animation spam.

## Functional stubs

When the page needs platform behavior, use HTML stubs — still designable markup:

- `data-stub="blog-grid" | "form" | "collection" | "navigation" | "search" | "pagination"`
- Keep `data-slot` / `data-field` placeholders inside. Do not invent fake React components.

## Workflow

1. `read` `page.html` and `theme.css` before editing.
2. Prefer `edit` with unique surrounding context for surgical changes.
3. Use `write` only for intentional full-page or full-theme replacement.
4. Reply in chat with a short plain-language summary of what changed — **no code fences**.
