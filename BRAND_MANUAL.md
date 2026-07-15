# MultiStack Systems — Complete Brand & Product Manual

> **Version 1.0 · © 2026 multistacksystems.com**
> The single source of truth for MultiStack Systems' visual identity, voice, and design-to-code implementation. This manual merges the visual specification authored in Claude Design (`MultiStack Systems - Brand & UI Manual.dc.html`) with the actual production implementation in this repository.
>
> **Status:** Stable · **Themes:** Dark + Light · **Compliance:** WCAG 2.1 AA · **Type system:** Sora · Hanken Grotesk · JetBrains Mono

---

## Table of contents

1. [Brand strategy & voice](#1--brand-strategy--voice)
2. [Logo & isotype](#2--logo--isotype) — *corrected against the official asset*
3. [Color system & UI states](#3--color-system--ui-states)
4. [Theme support — dark & light](#4--theme-support--dark--light)
5. [Accessibility — WCAG 2.1 AA](#5--accessibility--wcag-21-aa)
6. [Typography](#6--typography)
7. [Design-to-code tokens](#7--design-to-code-tokens)
8. [Component reference](#8--component-reference)
9. [Iconography, spacing, radii & motion](#9--iconography-spacing-radii--motion)
10. [Favicon & app icons](#10--favicon--app-icons)

---

## 1 — Brand strategy & voice

*Deduced from repository metadata: `index.html` (schema.org `Organization`/`ProfessionalService`), `README.md`, `site.webmanifest`, and the product surface itself.*

### Who we are

**MultiStack Systems** is a software-engineering company based in **Siguatepeque, Comayagua, Honduras** (founded 2024), serving Honduras and Latin America. We build custom software and the operational platform that runs it: a project-management system covering the full project lifecycle (pipeline, services, maintenance, tickets) plus a public client portal.

**Service pillars** (from structured metadata `knowsAbout`):

- Custom web development (Next.js + React)
- Specialized technical support
- Official software licensing
- AI automation
- Cybersecurity

### Mission

Build the software infrastructure that a business's growth demands — custom web development, support, licensing, and AI automation — delivered with engineering rigor and made accessible to companies across Honduras and Latin America.

### Vision

To be the reference software-engineering partner in the region: a single, multi-stack team a company can trust from first line of code to long-term maintenance.

### Values

| Value | What it means in practice |
|---|---|
| **Engineering rigor** | `npm run build` before commit; migrations only move forward; one change = one main file (see `README.md` → AI-First Workflow). |
| **Clarity over noise** | A near-black canvas, a single luminous accent, generous reading measure (60–66 chars). The interface stays neutral and technical. |
| **Accessibility as a baseline** | Every documented color pairing is validated to WCAG 2.1 AA — not retrofitted. |
| **Multi-stack pragmatism** | The name is the promise: the right stack per layer (React/TS front end, Supabase back end, Vercel deploy). |
| **Transparency with clients** | A public portal lets clients track work without an account. |

### Tone of voice

The voice is **technical but accessible** — an engineer who explains clearly, never a marketer who oversells. Spanish-first (`es-HN`), since the product and audience are Honduran.

**Principles**

- **Precise, not flowery.** State the fact, name the value, give the next step.
- **Calm authority.** We don't shout. The single accent color does the emphasis; copy stays level.
- **Developer-native register.** Mono type, bracket motifs (`[ CTA ]`), and a terminal cursor (`_`) are part of the voice, used sparingly as seasoning — not on every surface.

**Copy patterns by surface**

| Surface | Rule | Example |
|---|---|---|
| **Technical copy / marketing** | Lead with the outcome, then the mechanism. Spanish, second person. | "Construimos la infraestructura que tu crecimiento exige." |
| **System errors** | Say what happened, why, and the recovery action. No blame, no `Error: undefined`. | ✅ "No pudimos guardar los cambios. Revisa tu conexión e inténtalo de nuevo." ✗ "Algo salió mal." |
| **Tooltips** | One line, ≤ 8 words, describe the action not the control. | "Convertir esta solicitud en proyecto" |
| **Notifications / toasts** | Confirm the result in past tense; keep it short. Use the matching status color. | "Ticket creado." / "Proyecto archivado." |
| **Badges / status pills** | Single word or short phrase, UPPERCASE, mono. | `ESTABLE` · `EN DESARROLLO` · `ALTA` |
| **Empty states** | Acknowledge + point to the one action that fills it. | "Aún no hay tickets. Crea el primero para empezar." |

**Lexicon**

- Spell it **MultiStack Systems** — "Multi" + "Stack" capitalized, "Systems" always present in the formal wordmark.
- Prefer *solicitud, proyecto, ticket, mantenimiento, pipeline* (the product's domain nouns).
- Avoid hype adjectives ("revolucionario", "el mejor"). Let specs speak.

---

## 2 — Logo & isotype

> ### ⚠️ CORRECTION — official isotype
> Earlier generated documentation rendered the mark as a **generic placeholder**. That is **wrong**. The description below reflects the **official MultiStack Systems isotype** (reference: `image_9efd26.jpg`) and the production asset shipped in this repo.

### The official isotype — isometric layer stack

The MultiStack mark is a **3D isometric stack of three overlapping diamond/rhombus layers**. The layers are stacked **vertically**, reading as a *stack* of technology layers — the literal meaning of the brand name.

- **Three layers**, each a flattened rhombus (isometric diamond) seen in 3D perspective, overlapping front-to-back as they descend.
- A **smooth cyan-to-blue gradient** runs through the stack. The **top layer is the brightest** (luminous cyan), each lower layer steps down in luminosity toward a deeper blue — giving the depth/elevation read.
- The vertical stacking gives the official asset a **portrait aspect ratio** (the production source `public/logo-white.png` is `727 × 845`), distinct from a flat square icon.

**Do not** describe this as a generic "cube", "folder", or single shape. It is specifically a **three-layer isometric rhombus stack with a top-bright cyan→blue gradient.**

### Production assets (this repo)

The logo is implemented as a theme-aware raster asset, not redrawn inline:

| Asset | Path | Use |
|---|---|---|
| White mark | `public/logo-white.png` | Shown on **dark** UI; source for the generated favicon/app-icon set |
| Black mark | `public/logo-black.png` | Shown on **light** UI; also the OG/Twitter share image |

Rendered through the shared component **`src/components/Logo.tsx`**, which swaps the mark by theme using Tailwind's `dark:` class strategy and sizes by height (`className="h-7"`, width auto-tracks aspect ratio):

```tsx
// src/components/Logo.tsx
<img src="/logo-white.png" className="hidden h-full w-auto object-contain dark:block" />  // dark UI
<img src="/logo-black.png" className="block  h-full w-auto object-contain dark:hidden" />  // light UI
```

### Wordmark lockup

When paired with type, the wordmark is set in **Sora 700** with `"Systems"` in **Sora 600 / Slate** (`#94a3b8`), gap ≈ 13–14px from the mark:

> **MultiStack** Systems

### Clear space & minimum sizes

- **Clear space:** keep a free margin of `x` on all four sides, where `x = round(mark_height / 3)` (≈ one layer of the stack). No text, borders, or imagery inside it.
- **Minimum sizes:**

| Size | Use | Note |
|---|---|---|
| 16px | Favicon / mark in browser tab | Absolute minimum |
| 24–28px | Mark in navbar (lockup) | Standard height |
| 120px | Horizontal lockup, legible | Minimum width |

### Misuse — never

- Don't recolor the layers or alter the cyan→blue gradient / layer opacities.
- Don't stretch, compress, or change the mark's aspect ratio.
- Don't rotate or skew the isometric stack.
- Don't add shadows, extra gradients, or bevels beyond the asset's own.
- Don't place it on low-contrast backgrounds or busy imagery without a protection layer.
- Don't shrink below 16px or change the mark↔wordmark gap.

---

## 3 — Color system & UI states

Engineering blue on deep ink. A near-black canvas with a single luminous **sky/cyan** accent: color communicates action; everything else stays neutral and technical.

### Brand & surfaces (dark-mode reference hex)

| Token | Name | Hex | Role |
|---|---|---|---|
| `primary` | Sky 500 | `#0ea5e9` | Primary action, links, brand |
| `accent` | Cyan 500 | `#06b6d4` | Eyebrows, code labels, info |
| `bg` | Canvas / Ink 950 | `#080f1e` | App background |
| `surface` | Surface / Ink 900 | `#0f1c35` | Cards, panels, inputs |
| `surface-2` | Ink 925 | `#0b1424` | Alternating sections, footer |
| `border` | Border | `#1e3a5f` | Card & input borders |
| `text` | Frost | `#f0f6ff` | Primary text / headings |
| `text2` | Slate 400 | `#94a3b8` | Body / secondary text |
| `muted` | Slate 500 | `#64748b` | Meta, mono labels, hints |

### System / feedback colors

| Color | Hex | Role | Soft |
|---|---|---|---|
| Success | `#10b981` | Success, confirmations, online | α 0.10 |
| Warning | `#f59e0b` | Renewals, notices, upcoming | α 0.10 |
| Error / Destructive | `#ef4444` | Errors, sign-out, destructive | α 0.10 |
| Info | `#06b6d4` | Informational (= accent cyan) | α 0.10 |

> These hex values are the dark-theme reference. In code they live as **HSL CSS variables** — see [§7 Design-to-code tokens](#7--design-to-code-tokens) for the exact `--token` ↔ hex mapping and where they're defined.

### Button variants & interaction states

Three button intents, documented in the visual manual and implemented in `src/components/ui/button.tsx`:

| Intent | Look | Use |
|---|---|---|
| **Terminal / ghost-accent** | Mono, brackets `[ CTA ]`, accent text on `α.09` fill, subtle glow | Brand-signature CTA |
| **Solid primary** | Ink text on solid sky `#0ea5e9`, soft glow | Form submit, definitive action |
| **Ghost / nav** | No fill, appears on hover | Navigation, tertiary actions |

**Interaction states** (terminal-primary reference):

| State | Spec |
|---|---|
| Normal | bg `α.09` · border `α.32` · glow 30px `α.12` |
| Hover | bg `α.18` · `translateY(-2px)` · glow 36px `α.22` |
| Active | bg `α.22` · border `α.45` · `translateY(0)` |
| Focus | bg `α.09` · ring `3px α.18` |
| Disabled | `opacity .4` · no glow · `cursor:not-allowed` |

---

## 4 — Theme support — dark & light

Both themes are first-class. The default is **dark**; the active theme is the `dark` class on `<html>` (applied before paint to avoid flash — see `index.html`), and theme persistence is handled via `next-themes` + a toggle.

- **Dark = "Kiro.dev":** deep navy, cyan/sky glows, neon highlights, visible tech borders, glassmorphism.
- **Light = "Notion":** pure white, near-black ink, hairline borders, airy flat grids, **no glow** (neon reads as a smudge on white, so glows drop to near-zero).

### Token map (dark ↔ light)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--background` | `#080f1e` | `#ffffff` | Page background |
| `--card` / surface | `#0f1c35` | `#ffffff` | Cards & panels |
| `--surface-2` | `#0b1424` | `#f7f7f5` | Alternating sections |
| `--foreground` (text) | `#f0f6ff` | `#191919` | Primary text |
| text2 / body | `#94a3b8` | `#37352f` | Secondary text |
| `--muted-foreground` | `#64748b` | `#9b9a97` | Meta / hints |
| `--primary` | `#0ea5e9` (Sky 500) | `#0284c7` (Sky 700) | Action / brand |
| `--accent` | `#06b6d4` (Cyan 500) | `#0891b2` (Cyan 700) | Accent / info |
| `--border` | `#1e3a5f` | `#e9e9e7` | Borders |

> **Why the brand stops differ:** light mode uses **darker** brand stops (Sky-700 / Cyan-700) so the accent keeps adequate contrast on white. Dark mode uses the brighter Sky-500 / Cyan-500.

The glow tokens (`--glow-focus`, `--glow-primary`, `--glow-cyan`) are **neon** in dark mode and reduced to a 1–2px shadow in light mode. Definitions: `src/index.css` (`:root` = light, `.dark` = dark).

---

## 5 — Accessibility — WCAG 2.1 AA

All text and UI pairings target **WCAG 2.1 AA** (≥ 4.5:1 for body text, ≥ 3:1 for large text and UI elements). Validated combinations:

| Combination | Ratio | Level |
|---|---|---|
| Frost `#f0f6ff` on Canvas `#080f1e` | 18.1:1 | **AAA** |
| Slate-400 `#94a3b8` on Canvas | 7.7:1 | **AA** |
| Slate-500 `#64748b` on Canvas | 4.1:1 | **AA (large only)** |
| Sky `#0ea5e9` (link) on Canvas | 6.8:1 | **AA** |
| Ink `#06121f` on Sky button | 6.9:1 | **AA** |
| Ink `#191919` on White (light) | 16.9:1 | **AAA** |
| Sky-700 `#0284c7` on White (light) | 4.1:1 | **AA (large only)** |

> **Rule:** Slate-500 (`#64748b`) and the primary on white only pass AA for text ≥ 18px (or 14px bold) or as UI elements (≥ 3:1). **Never** use them for small body copy.

**Implementation guarantees**

- Focus is always visible: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` on interactive components (`button.tsx`, `input.tsx`).
- Disabled controls keep shape but drop to `opacity-50` and `cursor-not-allowed`.
- The logo carries a real `alt`; decorative theme-twin uses `aria-hidden`.
- The grid/scan-line decoration is `pointer-events:none` and purely cosmetic.

---

## 6 — Typography

Three families, one system with technical DNA. Loaded via Google Fonts (`@import` in `src/index.css`) and mapped in `tailwind.config.ts`.

| Family | Tailwind | Role | Weights |
|---|---|---|---|
| **Sora** | `font-display` | Headings & wordmark. Geometric, negative tracking. | 400 · 500 · 600 · 700 · 800 |
| **Hanken Grotesk** | `font-sans` (default body) | Body & interface text. Humanist, legible. | 400 · 500 · 600 · 700 |
| **JetBrains Mono** | `font-mono` | Eyebrows, labels, code, technical data. | 400 · 500 · 600 · 700 |

### Type scale

| Level | Family | Weight | Size | Line-h | Tracking |
|---|---|---|---|---|---|
| Display / H1 | Sora | 600 | clamp 38–64px | 1.05 | −0.025em |
| H2 section | Sora | 600 | clamp 30–44px | 1.06 | −0.025em |
| H3 card | Sora | 600 | 21px | 1.22 | normal |
| Body L | Hanken Grotesk | 400 | 17–19px | 1.65 | normal |
| Body | Hanken Grotesk | 400 | 14.5–16px | 1.6–1.65 | normal |
| Small / label | Hanken Grotesk | 500 | 13px | 1.5 | normal |
| Eyebrow | JetBrains Mono | 500 | 13px | 1 | 0.1–0.3em |
| Code / meta | JetBrains Mono | 400 | 11–12px | 1.85 | 0.04em |

The base element styling lives in `src/index.css` `@layer base`: `h1–h6` → Sora semibold, `−0.02em`; `p` → 15px / 1.7 in `--body-foreground`; `code, pre, .font-mono` → JetBrains Mono. Helper utilities: `.eyebrow` (Sora, uppercase, accent) and `.bracket` (mono, uppercase).

> **Note on the eyebrow:** the visual manual specimens render eyebrows in JetBrains Mono; the repo's `.eyebrow` utility uses Sora while `.bracket` carries the mono treatment. Both are valid eyebrow styles — use `.bracket` for the terminal/mono variant, `.eyebrow` for the type-led variant.

---

## 7 — Design-to-code tokens

Where every value in this manual physically lives in the codebase.

### Color tokens — `src/index.css`

Colors are **HSL triplets** in CSS custom properties, defined twice: `:root` (light / Notion) and `.dark` (dark / Kiro). Tailwind consumes them via `hsl(var(--token))`.

| Manual token (hex) | CSS variable | `:root` (light) | `.dark` |
|---|---|---|---|
| primary (`#0ea5e9` / `#0284c7`) | `--primary` | `200 98% 39%` | `199 89% 48%` |
| accent (`#06b6d4` / `#0891b2`) | `--accent` | `192 91% 36%` | `187 92% 43%` |
| bg (`#080f1e` / white) | `--background` | `0 0% 100%` | `222 43% 7%` |
| surface (`#0f1c35`) | `--card` | `0 0% 100%` | `218 56% 14%` |
| text (`#f0f6ff` / `#191919`) | `--foreground` | `40 4% 10%` | `216 100% 97%` |
| body text | `--body-foreground` | `35 6% 25%` | `215 20% 65%` |
| muted | `--muted-foreground` | `40 2% 60%` | `215 16% 47%` |
| border | `--border` / `--input` | `40 8% 91%` | `213 52% 24%` |
| ring (focus) | `--ring` | `200 98% 39%` | `199 89% 48%` |
| success | `--success` | `160 84% 31%` | `158 84% 39%` |
| warning | `--warning` | `32 95% 44%` | `38 92% 50%` |
| error | `--destructive` | `0 72% 51%` | `0 84% 60%` |

Also defined in `src/index.css`: **glow tokens** (`--glow-focus/-primary/-cyan`), **radius** (`--radius: 0.5rem`), and **motion** (`--ease-brand: cubic-bezier(0.2,0,0,1)`, `--dur-fast 150ms / --dur-base 300ms / --dur-slow 500ms`).

### Tailwind mapping — `tailwind.config.ts`

- `darkMode: ["class"]` — theme via `dark` class on `<html>`.
- `theme.extend.colors` maps every semantic name (`primary`, `accent`, `success`, `warning`, `destructive`, `card`, `sidebar`, …) to `hsl(var(--token))`.
- `theme.extend.fontFamily`: `display → Sora`, `sans → Hanken Grotesk`, `mono → JetBrains Mono`.
- `theme.extend.borderRadius`: `xl 16px · lg 12px · md 8px · sm 4px`.

### Font loading

- `@import` Google Fonts URL: top of `src/index.css`.
- Family stacks: `tailwind.config.ts` → `fontFamily`.
- Applied globally in `src/index.css` `@layer base` (`html, body` → Hanken; `h1–h6` → Sora; `code/pre` → JetBrains Mono).

---

## 8 — Component reference

The product is built on **shadcn/ui** primitives (Radix + CVA + `tailwind-merge`) in `src/components/ui/`. Each maps to the visual manual as follows.

| Manual element | Component file | Notes |
|---|---|---|
| **Brand logo / lockup** | `src/components/Logo.tsx` | Theme-aware official mark (`logo-white/black.png`). |
| **Buttons & states** | `src/components/ui/button.tsx` | CVA variants: `default` (solid primary), `outline`, `secondary`, `ghost`, `link`, `destructive`. Sizes `sm/default/lg/icon`. Focus ring + `disabled:opacity-50` built in. |
| **Inputs** | `src/components/ui/input.tsx` | `h-10`, `rounded-md`, `border-input`, `bg-background`, focus-visible ring, `disabled` states. |
| **Textarea / Select / Checkbox / Radio / Switch** | `src/components/ui/{textarea,select,checkbox,radio-group,switch}.tsx` | Same token + focus conventions. |
| **Forms** | `src/components/ui/form.tsx` + `react-hook-form` + `zod` | Label/description/error wiring. |
| **Cards / surfaces** | `src/components/ui/card.tsx` | `rounded-lg border bg-card text-card-foreground shadow-sm` + `CardHeader/Title/Description/Content/Footer`. |
| **Badges / status pills** | `src/components/ui/badge.tsx` | Mono, `text-[10px] uppercase tracking-wider`, `rounded-sm`. Variants `default/secondary/destructive/success/warning/outline` use the `*/12` fill + `*/30` border recipe. |
| **Toasts / notifications** | `src/components/ui/{toast,toaster,sonner}.tsx` + `use-toast.ts` | Status-colored, short past-tense copy (see §1 voice). |
| **Tooltips** | `src/components/ui/tooltip.tsx` | One-line action copy. |
| **Dialog / Alert dialog / Sheet / Drawer** | `src/components/ui/{dialog,alert-dialog,sheet,drawer}.tsx` | Destructive confirmations use `destructive` variant. |
| **Tabs / Accordion / Navigation / Sidebar** | `src/components/ui/{tabs,accordion,navigation-menu,sidebar}.tsx` | Layout & nav primitives. |
| **Tables / Charts** | `src/components/ui/{table,chart}.tsx` | `chart.tsx` wraps `recharts`. |

**Badge pill recipe** (matches the manual): `color: C · border: C/30 · background: C/12`, mono, uppercase, 10px, `rounded-sm`. A pulsing dot (`@keyframes ms-pulse` / `blink` in `index.css`) signals live state.

**Glass card (dark, hover):** translucent `surface` + `backdrop-blur(12px)`, border `#1e3a5f`; on hover → accent border + 32px glow + `translateY(-3px)` (utility `.ms-bento` in `src/index.css`).

---

## 9 — Iconography, spacing, radii & motion

### Iconography

- Library: **Lucide** (`lucide-react`) — line icons.
- Spec: `viewBox 24×24`, stroke style (no fill), `stroke-width 2`, `currentColor`, `linecap/linejoin: round`.
- Render: 22px glyph inside a 46–48px chip, radius 11px, accent-tinted background (`bg-primary/10 text-primary`).
- **Rule:** uniform line icons only. The **isometric stack mark is the *only* filled brand shape.** Never mix filled + line icons, mismatched stroke widths, or emoji as UI icons.

### Radius scale

| Token / px | Use |
|---|---|
| `sm` 4px / 5px | Badges, pills |
| `md` 8px | Small inputs, chips |
| 11px | Buttons, icon chips |
| `lg` 12px / 14px | Cards & panels |
| `xl` 16px | Large panels |
| `999px` | Toggles, FAB, nav pills |

(Tailwind: `sm 4 · md 8 · lg 12 · xl 16`; base `--radius: 0.5rem`.)

### Depth & overlays

- Background grid: `rgba(255,255,255,0.045)` with a radial mask (dark only).
- Brand glows: `0.10–0.16` alpha.
- Image/screenshot containers: radius 14px, border `#1e3a5f`, elevation shadow `0 30px 80px −24px rgba(0,0,0,0.85)`.

### Motion

- Easing: `--ease-brand: cubic-bezier(0.2, 0, 0, 1)`.
- Durations: `--dur-fast 150ms` · `--dur-base 300ms` · `--dur-slow 500ms`.
- Library: `framer-motion` available; CSS keyframes for ambient motion (`ms-rise`, `ms-pulse`, `ms-loadbar`, `blink`, `animate-scroll`) in `src/index.css`.
- Hover transforms: CTAs lift `translateY(-2px)`; bento cards `translateY(-3px)`.

---

## 10 — Favicon & app icons

The favicon and PWA/app-icon set are **generated from the official logo**, not hand-drawn — guaranteeing the isometric stack mark is always the icon.

- **Generator:** `scripts/generate-favicons.mjs` (`npm run favicons`). Uses `sharp` + `png-to-ico`.
- **Source:** `public/logo-white.png` (white isometric stack, 727×845, transparent).
- **Treatment:** the trimmed white mark is centered, with 16% padding, on a solid **brand-navy `#080F1E`** square (matches `<meta name="theme-color">`) so it stays visible on light *and* dark browser chrome.

**Output set** (in `public/`, wired in `index.html` + `site.webmanifest`):

| File | Size(s) | Purpose |
|---|---|---|
| `favicon.ico` | 16 / 32 / 48 | Legacy multi-res |
| `favicon-48x48.png` | 48 | Modern tab (Google reads sizes in multiples of 48) |
| `favicon-96x96.png` | 96 | High-DPI tab |
| `apple-touch-icon.png` | 180 | iOS home screen |
| `icon-192.png` | 192 | PWA (any) |
| `icon-512.png` | 512 | PWA (any + **maskable**) |

**Manifest** (`site.webmanifest`): name "MultiStack Systems", short name "MultiStack", `display: standalone`, `background_color` / `theme_color: #080F1E`.

> **Favicon minimum:** 16px. Below that the three-layer stack loses legibility — see [§2 minimum sizes](#2--logo--isotype).

---

### Appendix — source of record

| Domain | Source of truth |
|---|---|
| Visual spec (this manual's parent) | `MultiStack Systems - Brand & UI Manual.dc.html` (Claude Design project `b7ec8bb4…`) |
| Color / radius / glow / motion tokens | `src/index.css` |
| Tailwind token & font mapping | `tailwind.config.ts` |
| Logo component | `src/components/Logo.tsx` |
| Logo assets | `public/logo-white.png`, `public/logo-black.png` |
| Favicon generation | `scripts/generate-favicons.mjs` → `public/` |
| UI components | `src/components/ui/` (shadcn/ui) |
| Brand/business metadata | `index.html` (schema.org), `site.webmanifest`, `README.md` |

*Manual de marca · v1.0 · © 2026 multistacksystems.com*
