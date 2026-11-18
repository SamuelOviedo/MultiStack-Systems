# MultiStack Systems — Complete Brand & Product Manual

> **Version 1.0 · © 2026 multistacksystems.com**
> The single source of truth for MultiStack Systems' visual identity, voice, and design-to-code implementation. This manual merges the visual specification authored in Claude Design (`MultiStack Systems - Brand & UI Manual.dc.html`) with the actual production implementation in this repository.
>
> **Status:** Stable · **Themes:** Dark + Light · **Compliance:** WCAG 2.1 AA · **Type system:** Sora · Hanken Grotesk · JetBrains Mono

---

## Table of contents

1. [Brand strategy & voice](#1--brand-strategy--voice)
2. [Logo & isotype](#2--logo--isotype) — *official isotipo and full logo*
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

> ### Current identity
> The official identity is the **isotipo** (an angular "M" with a terminal prompt `>_`) and the **full logo** (isotipo above the "MultiStack SYSTEMS" wordmark), each in a **light** and a **dark** version. The earlier mark described in previous revisions of this manual (a three-layer isometric chevron stack, shipped as `public/logo-white.png` and `public/logo-black.png`) is **obsolete**. It must not be used in new work. The two files stay in `public/` only because e-mails already sent load them from there; no site code, script or page metadata references them. E-mail doesn't either: the transactional layout (`supabase/functions/_shared/email/layout.ts`) and the contingency templates under `supabase/email-templates/` (used only if the Send Email Hook is disabled) use `public/brand/email-logo-v2.png`.

### Versions

| Version | When | Colors | Where it lives |
|---|---|---|---|
| **Isotipo** | Small boxes, under 24px tall | Light: full color. Dark: teal and white | `src/assets/brand/isotipo-{claro,oscuro}*.png` |
| **Lockup** (isotipo + "MultiStack SYSTEMS" wordmark, side by side) | Site navigation bar, footer, sign-in loader: from 24px tall | Same two versions | `isotipo-*-2x.png` + `wordmark-*-2x.png` |
| **Full logo** (isotipo above the wordmark) | Boxes at least 64px tall: sign-in brand panel, 404 | Same two versions | `src/assets/brand/logo-completo-{claro,oscuro}*.png` |

- **Light** (`claro`) is for a light interface (dark ink on a light background). **Dark** (`oscuro`) is for a dark interface (teal and white on a dark background). Pick the version that matches the surface behind it.
- The wordmark alone is not shown as a standalone asset in the official manual. It is used only as part of the lockup next to the isotipo, which the owner approved for the site navigation bar.
- Official midnight blue (the solid behind the app icon and the dark brand surfaces) is `#080C13`.

### Size rule

| Box height | Variant |
|---|---|
| under 24px (e.g. `h-4` next to a heading) | Isotipo only |
| 24px and up (navbar `h-7`, footer `h-[26px]`, sign-in loader `h-9`) | Lockup (the default) |
| 64px and up (sign-in brand panel, 404) | Full logo |

At 28px tall the "MultiStack" line of the wordmark reads at about 16–17px; the "SYSTEMS" line is about 6.5px and works as texture, not as readable text. That is why the lockup starts at 24px and never goes below.

### Production assets (this repo)

All files are derived from the official masters with a single resample (Lanczos), transparent PNG, tight crop (no margin), true proportions (no stretching). The masters themselves are **not** in this repository.

| Asset | Path | Size (px) | Use |
|---|---|---|---|
| Isotipo, light / dark | `src/assets/brand/isotipo-claro.png`, `isotipo-oscuro.png` | 121×96 | Admin panel (`BrandMark`) |
| Full logo, light / dark | `src/assets/brand/logo-completo-claro.png`, `logo-completo-oscuro.png` | 290×200 | Admin panel (`BrandMark`) |
| Isotipo @2x, light / dark | `src/assets/brand/isotipo-claro-2x.png`, `isotipo-oscuro-2x.png` | 242×191 | Site `Logo` (isotipo and lockup) |
| Wordmark @2x, light / dark | `src/assets/brand/wordmark-claro-2x.png`, `wordmark-oscuro-2x.png` | 580×141 | Site `Logo` (lockup) |
| Full logo @2x, light / dark | `src/assets/brand/logo-completo-claro-2x.png`, `logo-completo-oscuro-2x.png` | 580×400 | Site `Logo` (`variant="full"`) |
| Isotipo @4x, dark | `src/assets/brand/isotipo-oscuro-4x.png` | 484×382 | Source of the icon and social-image generators (not bundled) |

Vite imports them with a content hash. The admin panel's four 1x files are canonical and are not replaced by the 2x ones.

**Which official master each one comes from** (checked by cropping the master to its content and resampling it to the derivative's size; mean absolute difference under 0.4 out of 255, i.e. the same pixels):

| Derivative | Official master version | Crop of the master |
|---|---|---|
| `isotipo-claro*`, `logo-completo-claro*`, `wordmark-claro*` | Full color, transparent | Isotipo / full logo: content box. Wordmark: the two text lines of the full logo (isotipo excluded) |
| `isotipo-oscuro*`, `logo-completo-oscuro*`, `wordmark-oscuro*` | Teal and white, transparent | Same crops |
| Icons in `public/` | Isotipo on midnight blue (`#080C13`) | Isotipo content box, placed as described in §10 |

### Components

- **`src/components/common/Logo.tsx`**: the site (landing, sign-in, client portal, loaders). Props: `className` (set the height, e.g. `h-7`; width follows the files), `alt` (the one accessible name, default "MultiStack Systems"), `tone` (`"light"` forces the dark version for dark scenes in a light theme), `variant` (`"lockup"` default, `"isotipo"`, `"full"`), `priority` (above-the-fold logo: the active theme's version loads eagerly), `decorative` (hides the mark from screen readers; use it only when another element on the same screen already gives the name, e.g. the isotipo next to the heading of `/solicitudes`).
- **`src/components/admin/BrandMark.tsx`**: the admin panel only (`logo` and `isotipo` variants).

Both pick the version with the `dark` class on `<html>` (no state, no flash) and render the hidden version with `display: none` and `loading="lazy"`, so the browser only downloads the active one. The container is `role="img"` with a single `aria-label`; the images are decorative (`alt=""`, `aria-hidden`), so the name exists in both themes and text is never repeated next to the logo. Exception: with `decorative` the container has no `role="img"` and no name (it is `aria-hidden`, and `alt` is ignored).

### Clear space & lockup spacing

The official manual does not fix a clear space or a minimum size. Project conventions: keep other text and borders at least one wordmark cap height away from the logo, and in the lockup keep the gap between isotipo and wordmark at about 0.28 of the box height (8px at 28px, `gap-2` in `Logo`).

### Misuse — never

- Don't recolor the logo or use a version that does not match its background.
- Don't stretch, compress, or change the aspect ratio (always size by one dimension).
- Don't add shadows, glows, filters or outlines to the mark. The loader pulse is the one exception, and it only fades the whole mark.
- Don't change the composition (e.g. move the wordmark, or set the lockup's pieces at different heights).
- Don't place it on low-contrast backgrounds or busy imagery without a protection layer.
- Don't use the obsolete chevron-stack mark (`logo-white.png`, `logo-black.png`).

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
- The logo's accessible name is the `aria-label` of its `role="img"` container; the images inside (including the theme twin) are decorative and use `aria-hidden`.
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
| **Brand logo / lockup** | `src/components/common/Logo.tsx` (site), `src/components/admin/BrandMark.tsx` (admin) | Theme-aware official isotipo, lockup and full logo (see §2). |
| **Developer credit** («Desarrollado por MultiStack Systems») | `snippets/credito-multistack/DevCredit.tsx` | Footer credit for the sites we build, our own included (`ownSite` mode). Single source and rules in [`docs/standards/CREDITO-MULTISTACK.md`](../standards/CREDITO-MULTISTACK.md); the monochrome, animated isotipo is an approved exception limited to this credit (standard §11). |
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
- **Rule:** uniform line icons only. The **official isotipo is the *only* filled brand shape.** Never mix filled + line icons, mismatched stroke widths, or emoji as UI icons.

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

The favicon and PWA/app-icon set are **generated from the official isotipo**, not hand-drawn.

- **Generator:** `scripts/generate-favicons.mjs` (`node scripts/generate-favicons.mjs`, optional `--out <dir>`). Uses `sharp` + `png-to-ico`.
- **Source:** `src/assets/brand/isotipo-oscuro-4x.png` (official isotipo, dark version, 484×382, transparent).
- **Treatment:** the isotipo is centered, undistorted, on a solid square of official midnight blue `#080C13`. Margin: standard icons use 17% per side (isotipo = 66% of the side), maskable uses 20% (60%, inside the circular safe zone), and the browser-tab sizes use 8% per side (84%) for better legibility at 16px.
- **Files in `public/`:** they are the master derivatives, resampled once from the official file. The generator starts from the 4x isotipo, so its output differs slightly from them (mean absolute difference 0.2–0.8 out of 255 from 96px up, 1.4 at 48px, 5.0–5.6 at the 32/16px sizes of the `.ico`; edges only). If you need the exact file, the one in `public/` wins.

**Output set** (in `public/`, wired in `index.html` + `site.webmanifest`):

| File | Size(s) | Treatment | Purpose |
|---|---|---|---|
| `favicon.ico` | 16 / 32 / 48 | tab (8% margin) | Legacy multi-res |
| `favicon-48x48.png` | 48 | tab (8% margin) | Modern tab (Google reads sizes in multiples of 48) |
| `favicon-96x96.png` | 96 | standard (17%) | High-DPI tab |
| `apple-touch-icon.png` | 180 | standard (17%) | iOS home screen |
| `icon-192.png` | 192 | standard (17%) | PWA (any) |
| `icon-512.png` | 512 | standard (17%) | PWA (any) |
| `icon-maskable-512.png` | 512 | maskable (20%) | PWA (maskable) |

**Manifest** (`site.webmanifest`): name "MultiStack Systems", short name "MultiStack", `display: standalone`, `background_color` / `theme_color: #080F1E`. By decision of the owner these two stay on the site navy `#080F1E` (the app icons are on official midnight blue `#080C13`).

**Social images** (`public/assets/images/og/`): `og-ai.v2.1200x630.png` / `.webp` (home, generated by `scripts/generate-og-image.mjs`) and `og-paginas-web.v2.png` (`/paginas-web`, generated by `scripts/generate-og-paginas-web.mjs`). Both carry the official isotipo (dark version); the file names are versioned (`v2`) so that platforms that cached the old image fetch the new one. The v1 files stay on disk for links already shared.

> **Favicon minimum:** 16px, see the [§2 size rule](#2--logo--isotype).

---

### Appendix — source of record

| Domain | Source of truth |
|---|---|
| Visual spec (this manual's parent) | `MultiStack Systems - Brand & UI Manual.dc.html` (Claude Design project `b7ec8bb4…`) |
| Color / radius / glow / motion tokens | `src/index.css` |
| Tailwind token & font mapping | `tailwind.config.ts` |
| Logo component | `src/components/common/Logo.tsx`, `src/components/admin/BrandMark.tsx` |
| Logo assets | `src/assets/brand/` (see §2) |
| Favicon generation | `scripts/generate-favicons.mjs` → `public/` |
| UI components | `src/components/ui/` (shadcn/ui) |
| Brand/business metadata | `index.html` (schema.org), `site.webmanifest`, `README.md` |

*Manual de marca · v1.0 · © 2026 multistacksystems.com*
