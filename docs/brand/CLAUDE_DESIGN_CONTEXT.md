# TL;DR — One-Page Overview

> Quick brief for Claude Design. Full detail follows below; **copy this whole file**, this section is just the map.

**What:** Rebuild & re-style the entire MultiStack Systems site (Vite + React + TS SPA, shadcn/ui, Tailwind, Supabase) into a **dual-mode Notion (Light) + Kiro.dev (Dark) hybrid** with a working theme toggle. Site language is **Spanish (es-HN)** — never translate or invent copy; reuse every string verbatim (accents, `…`, `“ ”`, `—`, `[ … ]` bracket buttons, `$`/`>` prompts).

**Current state:** dark-only, no toggle, fonts Inter/Space Grotesk/JetBrains Mono. **Target adds** a light mode + toggle + new fonts. The dark palette = keep existing repo tokens; the light palette + Sora/Hanken Grotesk fonts are **new** (defined in §1.2–1.3).

**Hybrid in one line:** Light = pure white, near-black ink, hairline borders, airy flat grids, **no glow**. Dark = deep navy, cyan/sky glows, neon highlights, visible tech borders, glassmorphism.

**Fonts (target):** `Sora` (display/headings) · `Hanken Grotesk` (body) · `JetBrains Mono` (code/IDs/bracket buttons/prompts).

**Brand colors:** primary sky-blue (`#0EA5E9` dark / `#0284C7` light), accent cyan (`#06B6D4` dark / `#0891B2` light). Keep recognizable in both modes.

**13 routes:** `/` landing · `/login` · `/signup` · `/dashboard` · `/dashboard/project/:id` · `/dashboard/tickets` · `/solicitudes` · `/client/:token` · `/auth/callback` · `/auth/reset-password` · `/politica-de-privacidad` · `/terminos-del-servicio` · `*` (404). Plus 8 sub-views (NewProjectModal, ProjectScopingModal, ServiceForm, ClientAccessSection, MaintenanceSection, StageDrawer, TicketDrawer, ProtectedRoute guard). Roles: 0/1 = team → /dashboard, 2 = client → /solicitudes.

**Universal layouts:** landing shell · auth split (`AuthBrandPanel` left + form right) · dashboard shell · legal article shell · client portal (no navbar).

**3 must-do gotchas:**
1. **Logo:** `logo-white.png` is invisible on white — swap to `logo-black.png` in light mode.
2. **Overlay:** ClientPortal uses `bg-black/70` — change to `bg-background/80` (system rule).
3. **Brand panel:** keep `AuthBrandPanel` dark in **both** modes (dark column beside white form = clean Notion split).

**Anti-patterns:** no pill buttons (except dots/progress/avatars) · no neon in light mode · no glow on every card · mono only for code/IDs/prompts · green only for `success` · Lucide icons only · one `<h1>` per page.

**How to read below:** §1 global system (tokens, fonts, toggle, components) · §2 every route + sub-view (layout + verbatim copy + light/dark treatment) · §3 assets, UI states, shared data maps.

---

# MultiStack Systems — Definitive Design & Structure Blueprint

> **Purpose:** zero-loss handoff spec for Claude Design to fully rebuild and re-style the entire site (all 13 routes, sub-views, components, auth states) using the **Notion (Light) + Kiro.dev (Dark) hybrid** design system.
> **Rule #1:** Every verbatim string in this file is from the live code. Do **not** invent, translate, or "improve" copy. Reuse it exactly (Spanish, accents, ellipses `…`, curly quotes `“ ”`, em-dashes `—`, bracket buttons `[ … ]`, `$`/`>` prompt glyphs).
> **Rule #2:** Layout and visuals are the redesign surface. Copy, routes, data maps, and interaction logic are fixed contracts.

---

## 0. Current vs. Target (read first)

The **current** repo is **dark-only "professional dark-tech"** (Vercel/Linear style): navy surfaces, sky-blue primary, cyan accent, fonts Inter / Space Grotesk / JetBrains Mono, single `:root` (no light mode), and **no theme toggle** (`next-themes` is present but only powers the `sonner` toast).

The **target** (this document) is a **dual-mode hybrid** with a working theme toggle:

- **Light Mode = Notion** — pure white, minimalist grids, near-black text, soft hairline borders, almost no glow, fonts **Sora** (display) + **Hanken Grotesk** (body) + JetBrains Mono (code).
- **Dark Mode = Kiro.dev** — deep dark hexes, cyan/sky glows, neon highlights, visible "tech" boundaries, glassmorphism (`backdrop-blur`).

The dark palette below is the existing repo palette (keep it). The light palette is **new** and defined here for the first time. Sora + Hanken Grotesk are **new** — they must be added to the font `@import` and Tailwind config.

---

# 1. GLOBAL SYSTEM SPECIFICATION

## 1.1 Hybrid architecture rules

Everything is token-driven. A component never hard-codes a hex — it reads a CSS variable that resolves differently per mode. The **same DOM** produces a Notion look under `:root` (light) and a Kiro look under `.dark`.

| Dimension | **Light = Notion** | **Dark = Kiro.dev** |
| --- | --- | --- |
| Page background | Pure white `#FFFFFF` | Deep navy `#080F1E` |
| Surface / card | White `#FFFFFF` or warm gray `#F7F7F5`, 1px hairline `#E9E9E7` | Lifted navy `#0F1C35`, border `#1E3A5F`, optional `backdrop-blur` glass |
| Text (headings) | Near-black `#191919` | Cool white `#F0F6FF` |
| Text (body) | Notion ink `#37352F` / muted `#6B6B6B` | Slate `#94A3B8` |
| Borders | Faint, hairline, no glow | Visible tech boundary, hover lifts to primary |
| Glow / shadow | Minimal — soft `0 1px 2px rgba(0,0,0,.05)`; **no neon** | Cyan/sky neon on focus + hero CTA; ambient radial blobs |
| Eyebrows/labels | Quiet uppercase, muted gray | Mono/accent, terminal flavor allowed |
| Density | Airy, generous whitespace, flat grids | Compact, bordered, layered |
| Motion | Subtle fades, short | Same timings, plus glow transitions |

**Brand constants (both modes):** primary sky-blue and cyan accent stay recognizable. In light mode use the AA-safe darker stops on white (`#0284C7` / `#0891B2`) for text/icons; in dark mode use the bright stops (`#0EA5E9` / `#06B6D4`).

## 1.2 Typography (target)

Add to the global CSS `@import` and `tailwind.config.ts > theme.extend.fontFamily`:

```
font-display → 'Sora'            (h1–h4, hero, page titles, eyebrows)
font-sans    → 'Hanken Grotesk'  (body, paragraphs, labels, buttons)
font-mono    → 'JetBrains Mono'  (code, IDs, status keys, bracket buttons, $/> prompts, timestamps)
```

Scale (keep current sizing, swap families):

| Element | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- |
| h1 / hero | 36–60px (clamp) | 600 | 1.05 | -0.02em |
| h2 / section | 28–36px | 600 | 1.10 | -0.02em |
| h3 / card title | 20px | 600 | 1.20 | -0.01em |
| h4 | 14px | 600 | 1.30 | normal |
| body `p` | 15px | 400 | 1.7 | normal |
| label / meta | 12px | 500 | 1.4 | normal |
| `.eyebrow` | 12px | 600 | 1.0 | 0.08em uppercase |
| `.bracket` / mono | 12px | 500 | 1.0 | 0.02em uppercase |

Mono is **only** for: code, IDs (`#proj-007`), status keys (`en_desarrollo`), CLI chrome (`[ NUEVO ]`, `$ multistack ...`), timestamps. Never nav links, marketing prose, or paragraphs.

## 1.3 Color tokens — both modes (shadcn HSL convention)

Define a light `:root` and a `.dark` block. `darkMode: ["class"]` is already set in Tailwind.

### Dark (`.dark`) — existing repo palette, keep verbatim

| Token | HSL | Hex | Use |
| --- | --- | --- | --- |
| `--background` | `222 43% 7%` | `#080F1E` | Body |
| `--foreground` | `216 100% 97%` | `#F0F6FF` | Headings |
| `--card` / `--popover` | `218 56% 14%` | `#0F1C35` | Cards/modals |
| `--body-foreground` | `215 20% 65%` | `#94A3B8` | Paragraphs |
| `--muted-foreground` | `215 16% 47%` | `#64748B` | Chrome/labels |
| `--border` / `--input` | `213 52% 24%` | `#1E3A5F` | Hairline |
| `--primary` / `--ring` | `199 89% 48%` | `#0EA5E9` | CTA, focus |
| `--accent` | `187 92% 43%` | `#06B6D4` | Eyebrows, accent |
| `--success` | `158 84% 39%` | `#10B981` | activo/resuelto |
| `--warning` | `38 92% 50%` | `#F59E0B` | pendiente |
| `--destructive` | `0 84% 60%` | `#EF4444` | cancelado/error |

### Light (`:root`) — new Notion palette (proposed, AA-checked)

| Token | HSL | Hex | Use |
| --- | --- | --- | --- |
| `--background` | `0 0% 100%` | `#FFFFFF` | Body (pure white) |
| `--foreground` | `40 4% 10%` | `#191919` | Headings (near-black) |
| `--card` | `0 0% 100%` | `#FFFFFF` | Cards (white, rely on border) |
| `--card-muted` | `40 11% 96%` | `#F7F7F5` | Warm gray surface / hover |
| `--popover` | `0 0% 100%` | `#FFFFFF` | Popovers/modals |
| `--body-foreground` | `35 6% 25%` | `#37352F` | Paragraphs (Notion ink) |
| `--muted-foreground` | `40 2% 60%` | `#9B9A97` | Metadata/labels |
| `--border` / `--input` | `40 8% 91%` | `#E9E9E7` | Hairline (no glow) |
| `--primary` / `--ring` | `200 98% 39%` | `#0284C7` | CTA, focus (AA on white) |
| `--accent` | `192 91% 36%` | `#0891B2` | Eyebrows, accent |
| `--success` | `160 84% 31%` | `#059669` | activo/resuelto |
| `--warning` | `32 95% 44%` | `#D97706` | pendiente |
| `--destructive` | `0 72% 51%` | `#DC2626` | cancelado/error |

Shared (mode-agnostic): radii `sm 4 / md 8 / lg 12 / xl 16`; motion `--ease-brand: cubic-bezier(0.2,0,0,1)`, durations `150/300/500ms`. Glow tokens stay defined but in **light mode reduce to near-zero** (neon reads as a smudge on white) — e.g. `--glow-primary` light = `0 1px 2px rgba(2,132,199,.12)`, dark = `0 0 16px rgba(14,165,233,.30)`.

## 1.4 Theme toggle infrastructure (new)

1. Wrap the app (in `src/App.tsx`, outside `BrowserRouter` or just inside it) with `next-themes`:
   `ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}` (or `enableSystem` if you want OS-follow). Class strategy matches Tailwind `darkMode: ["class"]`.
2. Add a **theme toggle control** — sun/moon Lucide icons (`Sun` / `Moon`), placed in the Navbar (desktop + the auth/legal headers). It calls `setTheme(theme === 'dark' ? 'light' : 'dark')`.
3. Persist via `next-themes` localStorage default. Avoid hydration flash: gate icon render on a `mounted` flag.
4. The existing `sonner` toaster already reads `useTheme()` — it will follow automatically.
5. Every component must read tokens (not literal dark hexes) so both modes resolve correctly with zero per-component conditionals.

## 1.5 Global components

### Navbar (`src/components/Navbar.tsx`)
- Fixed top, full width. Transparent at scroll top → on scroll (`scrollY > 20`) becomes `bg-background/60 backdrop-blur-md` + hairline bottom border.
  - Light: blurred white; Dark: blurred navy glass.
- Left: `logo-white.png` (h-7) + wordmark "MultiStack Systems" (display font). **Light mode needs a dark logo** — use `logo-black.png` (already in `public/`) via a mode swap, since `logo-white.png` is invisible on white.
- Center (home only): section nav buttons — **Inicio / Servicios / Stack / Contacto** (scroll to `#hero / #servicios / #stack / #footer`).
- Right: **theme toggle** + auth-state command buttons (bracketed mono):
  - Logged out: `[ ACCEDER ]` → /login, `[ REGISTRARSE ]` → /signup.
  - Team (role 0/1): `[ PANEL ]` → /dashboard, `[ SOPORTE ]` → /dashboard/tickets (+ open-ticket count badge), `[ SALIR ]`.
  - Client (role 2): `[ SOLICITUDES ]` → /solicitudes, `[ SALIR ]`.
  - Loading: `[ ... ]`.
- Icons: `LayoutDashboard`, `Ticket`, `LogOut`.

### Footer (`src/components/Footer.tsx`) — shared, id `footer`
4-column grid `[2fr_1fr_1fr_1.5fr]`. See §2.8 for full copy.

### Universal layouts
- **Landing shell:** Navbar → stacked sections → Footer (`src/pages/Index.tsx`). Smooth-scrolls to `location.hash` on load.
- **Auth split shell:** 2-col `lg:grid-cols-[1.1fr_1fr]` — `AuthBrandPanel` (left) + form panel (right). Used by Login, Signup, ResetPassword.
- **Dashboard shell:** Navbar + centered container (`max-w-7xl`/`max-w-5xl`, `pt-24`).
- **Legal shell:** Navbar + `max-w-3xl` article + back link + `// legal` eyebrow + sibling cross-link + fixed scroll-top button.
- **Client portal shell:** standalone (no Navbar), token-gated.

## 1.6 Component dual-mode behavior

| Component | Light (Notion) | Dark (Kiro) |
| --- | --- | --- |
| **Card** | White bg, 1px `#E9E9E7` border, no glow; hover → `#F7F7F5` bg or border darkens slightly, optional `-translate-y-0.5` | `bg-card` navy (often `/50` + `backdrop-blur-md`), border `#1E3A5F`; hover → `border-primary/40`, soft cyan shadow |
| **Feature grid** | Flat, airy, generous gap, hairline dividers | Bordered cells, ambient radial glow behind header |
| **Form input** | White bg, `#E9E9E7` border; focus → primary border + faint 2px ring | `bg-background/60` glass, `#1E3A5F` border; focus → primary border + cyan glow ring |
| **Button (primary)** | Solid `#0284C7`, white text, subtle shadow on hover | Solid `#0EA5E9`, navy text, cyan glow on hover |
| **Button (bracketed secondary)** | Transparent, gray text + border, mono `[ LABEL ]`; hover → ink text, light gray bg | Same, hover → foreground text, `bg-primary/5`, primary border |
| **Table / data list** | White rows, hairline row separators, gray header text, hover `#F7F7F5` | navy rows, `border-border` separators, hover `bg-card/60` |
| **Status badge** | base color @ ~12% tint on white, 1px same-color border, mono uppercase | identical pattern on navy |
| **Tabs** | underline active in primary, muted inactive | same; active also tints `bg-primary/10` |
| **Modal / Drawer** | White panel, `#E9E9E7` border, overlay `rgba(0,0,0,.4)` blur | navy panel, overlay `bg-background/80 backdrop-blur-sm` (never `bg-black/70`) |
| **Terminal mocks** (hero, auth log) | Keep the dark terminal even in light mode (a dark code block on white is a Notion-valid pattern) | Native dark |

**Anti-patterns (both modes):** ❌ pill buttons (`rounded-full`) except dots/progress/avatars · ❌ glow on every card · ❌ neon in light mode · ❌ mono on nav/paragraphs · ❌ green outside `success` · ❌ icons other than Lucide (brand SVGs excepted) · ❌ multiple `<h1>` per page.

---

# 2. COMPLETE VIEW-BY-VIEW INVENTORY

13 routes (`src/App.tsx`):

| Path | Component | Access |
| --- | --- | --- |
| `/` | Index (landing) | Public |
| `/login` | Login | Public |
| `/signup` | Signup | Public |
| `/dashboard` | Dashboard | Protected (role 0/1) |
| `/dashboard/project/:id` | ProjectDetail | Protected (role 0/1) |
| `/dashboard/tickets` | TicketsGlobal | Protected (role 0/1) |
| `/solicitudes` | MisSolicitudes | Protected (role 2) |
| `/client/:token` | ClientPortal | Public (token) |
| `/auth/callback` | AuthCallback | Public |
| `/auth/reset-password` | ResetPassword | Public |
| `/politica-de-privacidad` | PoliticaDePrivacidad | Public |
| `/terminos-del-servicio` | TerminosDelServicio | Public |
| `*` | NotFound | Public |

Roles: `0`/`1` = team/admin → /dashboard; `2` = client → /solicitudes.

---

## 2.1 `/` Landing — Hero (`HeroSection.tsx` + `TerminalHero.tsx`)

**Blocks:** full-height centered section (id `hero`) → ambient radial glow (dark only) → eyebrow → H1 → subhead → CTA button → animated terminal card.

**Verbatim copy:**
- Eyebrow (mono): `Siguatepeque, HN — Remote First`
- H1: `MultiStack Systems:` / `High-Level Engineering` (in primary) ` Solutions.`
- Subhead: `Desarrollo, Soporte y Licenciamiento con ADN de Ingeniero.` / `Construimos la infraestructura que tu crecimiento exige.`
- CTA button: `[ EXPLORAR_SERVICIOS ]` (→ scroll `#servicios`)

**TerminalHero (animated):** title bar `bash — 80×24`; typed command `npm install multistack-success`; output: `# MultiStack Systems Initialized` / `Installing high_level_engineering...` / `✔ Success: Engineering DNA injected.` / `added 42 packages in 2.1s`.

**Light vs dark:** Light → white hero, drop radial blobs, near-black H1, primary phrase in `#0284C7`; keep terminal card dark. Dark → navy, cyan/sky ambient blobs, glass terminal with `glow-border`.

---

## 2.2 `/` Landing — HookSection (`landing/HookSection.tsx`, `ServiceCard.tsx`, `ServiceCTA.tsx`)

**Blocks:** section (id `servicios`) → centered header (eyebrow + H2 + intro) → 3-col grid of expandable cards. Card = icon tile + chevron + eyebrow + headline + teaser (always) + expandable benefits list + CTA. Hover (hover devices) expands; tap toggles on touch. Left accent bar.

**Header copy:**
- Eyebrow: `// servicios principales`
- H2: `Soluciones diseñadas para escalar.`
- Intro: `Más que proveedor — somos el equipo técnico que tu empresa necesita para crecer con confianza.`

**Card 1 — icon `Layers`:** eyebrow `Desarrollo a Medida` · headline `Tu negocio merece software que trabaje como tú.` · teaser `Sistemas hechos a la medida de tu operación — no plantillas, no compromisos.` · benefits: `Sistemas internos que eliminan procesos manuales` / `Plataformas web y móviles listas para escalar` / `Entrega por fases: pagas por resultados, no por promesas` · CTA `Comenzar mi proyecto`.

**Card 2 — icon `Server`:** eyebrow `Web & Soporte TI` · headline `Infraestructura que no te falla cuando más importa.` · teaser `Hosting, redes y soporte técnico con garantía de respuesta — desde Honduras.` · benefits: `Hosting administrado con monitoreo activo` / `Soporte técnico remoto y presencial en Honduras` / `SLA con tiempo de respuesta garantizado` · CTA `Solicitar soporte ahora`.

**Card 3 — icon `BrainCircuit`:** eyebrow `IA & Automatización` · headline `Automatiza lo repetitivo. Enfócate en crecer.` · teaser `Integra inteligencia artificial donde más duele: flujos lentos, errores humanos, tareas repetitivas.` · benefits: `Chatbots empresariales integrados a tu operación` / `Flujos automáticos que reducen carga operativa` / `Integración con herramientas que ya usas` · CTA `Ver cómo funciona`.

**ServiceCTA** (shared button): label + `ArrowRight`; routes logged-in users to /dashboard (role 0/1) or /solicitudes (role 2), else stores `postLoginIntent` and → /login.

**Light vs dark:** Light → flat white cards, hairline border, accent bar in `#0891B2`, no shadow, hover bg `#F7F7F5`. Dark → glass `bg-card/50 backdrop-blur-md`, accent bar cyan with glow, soft shadow when open.

---

## 2.3 `/` Landing — ServicesSection (`ServicesSection.tsx`)

**Blocks:** section (id `services`) → centered header → 2-col master/detail `[5fr_7fr]`: left vertical service nav (5 buttons), right animated detail panel (icon tile + title + optional partner badge + description + CTA/coming-soon).

**Header:** eyebrow `// catálogo de servicios` · H2 `Todo lo que hacemos, en detalle.` · left-nav label `Servicios`.

**Catalog (5 items):**
1. icon `KeyRound` — title `Licenciamiento de Software` — badge `Socio Oficial` — desc: `Proveedor oficial de Windows, Office 365 y Kaspersky. Gestionamos la adquisición, activación y renovación de licencias empresariales, garantizando cumplimiento legal y continuidad operativa para su organización.`
2. icon `Code2` — title `Desarrollo Web a Medida` — desc: `Plataformas web y sistemas internos desarrollados con las tecnologías más sólidas del ecosistema moderno. Diseñados para escalar, optimizados para el rendimiento y orientados a experiencias de usuario excepcionales.`
3. icon `Cpu` — title `Soporte Técnico 2.0` — desc: `Soporte técnico especializado para laptops, equipos de escritorio e impresoras. Atención presencial en Siguatepeque y asistencia remota a nivel nacional, con tiempos de respuesta definidos y garantizados.`
4. icon `Bot` — title `IA y Automatización` — desc: `Implementación de flujos de trabajo inteligentes, chatbots corporativos y automatización de procesos empresariales. Reducimos la carga operativa para que su equipo se concentre en decisiones de alto impacto.` — **coming soon**
5. icon `ShieldCheck` — title `Auditoría en Ciberseguridad` — desc: `Análisis de vulnerabilidades, blindaje de activos digitales y consultoría estratégica en seguridad informática. Protegemos su infraestructura con metodologías de clase mundial adaptadas al contexto regional.` — **coming soon**

- Detail CTA (active services): `Solicitar este servicio`
- Coming-soon pill: `Disponible próximamente`

**States:** active nav item → `bg-primary/10` + inset left primary bar; inactive → hover bg. Detail panel cross-fades (framer `AnimatePresence`) on tab change.

**Light vs dark:** Light → white panel, hairline divider between columns, active item tinted light-blue, partner badge as quiet light-blue chip. Dark → `bg-card/20 backdrop-blur-sm` glass, inset glow on active.

---

## 2.4 `/` Landing — TechStack (`TechStack.tsx`)

**Blocks:** section (id `stack`) → centered header → full-bleed auto-scrolling marquee (duplicated list), edge fade masks.

**Copy:** eyebrow (mono) `tech.stack` · H2 `Stack Tecnológico`.
**Marquee items (verbatim, in order):** React, TypeScript, Vite, TailwindCSS, Claude design, Supabase, PostgreSQL, Node.js, AWS, Vercel, Render, Git, GitHub, Claude, Figma, Kali Linux, Kaspersky, Windows Server, Linux, Flutter, Discord, Notion, Trello.

**Light vs dark:** Light → white chips, hairline border, `●` dot in `#0284C7`, edge fade to white. Dark → `bg-card` chips with `glow-border`, dot in primary, edge fade to navy.

---

## 2.5 `/` Landing — Footer (`Footer.tsx`, id `footer`)

**Blocks:** 4-col grid `[2fr_1fr_1fr_1.5fr]` → (1) brand: logo + location + social icons; (2) "Navegación"; (3) "Legal"; (4) "Contacto": micro-form + WhatsApp button. Bottom bar: copyright.

**Copy:**
- Location (mono): `Siguatepeque, HN` / `14.5951° N, 87.8321° W`
- Col "Navegación": Inicio (#hero), Servicios (#servicios), Stack (#stack), Soporte (/login)
- Col "Legal": Política de Privacidad (/politica-de-privacidad), Términos del Servicio (/terminos-del-servicio)
- Col "Contacto" form: email placeholder `tu@email.com`; message placeholder `Escribe tu mensaje o consulta aquí...`; submit `Enviar mensaje` / loading `Enviando...`; success `¡Mensaje enviado con éxito! Te responderemos a la brevedad.`; error `No se pudo enviar. Intenta de nuevo.`
- WhatsApp button: `Escríbenos por WhatsApp` → `https://wa.me/50433023042` (icon `MessageCircle`)
- Social: Facebook `https://www.facebook.com/multistacksystems`, Instagram `https://www.instagram.com/multistacksystems/`
- Bottom bar: `© {año} MultiStack Systems. Todos los derechos reservados.` (blinking `_`)
- Validation: email regex + message ≥ 5 chars; posts to Supabase function `send-contact-email`.

**Light vs dark:** Light → white, hairline top border, dark logo swap, muted column labels, blue links on hover ink. Dark → navy, `border-foreground/5`, glow on WhatsApp/contact buttons.

---

## 2.6 `/login` (`Login.tsx` + `AuthBrandPanel.tsx`)

**Blocks:** 2-col `[1.1fr_1fr]` → left `AuthBrandPanel`, right form. Form: top row (back link + signup prompt) → centered form (`max-w-[400px]`): H2 + subhead → 2-col SSO grid → "o" divider → email field → password field (with show/hide + forgot link) → submit → bottom footer.

**Form copy:**
- Back link: `Volver al inicio` (icon `ArrowLeft`)
- Top-right: `¿Aún no tienes cuenta?` + link `Regístrate` (icon `ArrowRight`)
- H2: `Iniciar sesión` · subhead: `Bienvenido de vuelta. Continúa con tu cuenta.`
- SSO buttons: `Google`, `GitHub` (custom brand SVGs; `Loader2` while loading) · divider word `o`
- Email label `Email de trabajo`, placeholder `tu@empresa.com`
- Password label `Contraseña`, placeholder `••••••••`, forgot link `¿Olvidaste tu contraseña?` (→ /auth/reset-password), toggle aria `Mostrar contraseña` / `Ocultar contraseña`
- Submit: `Iniciar sesión` / loading `Iniciando sesión…`
- Footer: `© 2026 multistack.dev` · `Soporte` · `Estado` · `Docs`
- Loading screen (auth resolving): mono `multistack-auth@secure:~$` + `MultiStack Systems`
- Toast error: title `Error de autenticación`, desc = Supabase message.

**AuthBrandPanel (left, shared by Login/Signup/ResetPassword):**
- Status pill (success, blinking dot): `v2.4 · ESTABLE`
- H1: `Tu stack de proyectos,` / `en una sola consola.` (2nd line primary)
- Body: `Gestiona proyectos, servicios y clientes desde un solo panel. Hecho para equipos que entregan.`
- Feature checklist (icon `Check` in success tile): `Gestiona pipelines y entregas en tiempo real` / `Tickets, servicios y accesos centralizados` / `Portal de cliente con actualizaciones automáticas`
- Activity log (mono, path `~/multistack/activity.log`, Mac dots `#FF5F56/#FFBD2E/#27C93F`):
  - `14:23 ✓ deploy proyecto-matys completado`
  - `14:19 ↻ ticket #t-089 asignado a dev-01`
  - `14:11 ⚠ ssl-cert vence en 12d`
- Panel bg: `linear-gradient(180deg, #0F1C35 0%, #080F1E 100%)` + two radial ambient glows (sky 18%, cyan 12%).

**Light vs dark:** The brand panel is intrinsically "Kiro" (dark gradient + glow + terminal) — keep it dark in **both** modes (a dark hero column beside a white form is a clean Notion-split look). Form panel: Light → white, near-black labels-as-ink, `#E9E9E7` inputs, faint focus ring; Dark → navy, glass inputs, cyan focus glow.

---

## 2.7 `/signup` (`Signup.tsx`)

Same split shell + `AuthBrandPanel`. Form mirrors Login.

**Copy:**
- Top row: `¿Ya tienes cuenta?` + link `Iniciar sesión`
- H2: `Crear cuenta` · subhead: `Únete a la plataforma MultiStack.`
- SSO: `Google`, `GitHub`; divider `o`
- Email label `Email de trabajo`, placeholder `tu@empresa.com`
- Password label `Contraseña`, placeholder `Mínimo 6 caracteres`, toggle aria `Mostrar contraseña` / `Ocultar contraseña`
- Helper: `Al crear tu cuenta aceptas los términos del servicio.`
- Submit: `Crear cuenta` / loading `Creando cuenta…`
- Footer: `© 2026 multistack.dev` · `Soporte` · `Estado` · `Docs`
- Toasts: OAuth error title `Error de autenticación`; signup error title `Error al crear cuenta`; success title `¡Cuenta creada!`, desc `Revisa tu email para confirmar tu cuenta.`
- Icons: `Eye`, `EyeOff`, `Loader2`, `ArrowLeft`.

---

## 2.8 `/auth/reset-password` (`ResetPassword.tsx`)

Same split shell + `AuthBrandPanel`. Two states.

**Copy:**
- Back link: `Volver al inicio de sesión`
- **Form state:** H2 `Recuperar contraseña` · subhead `Ingresa tu email y te enviamos un enlace para restablecer tu contraseña.` · email label `Email de trabajo`, placeholder `tu@empresa.com` · submit `Enviar enlace de recuperación` / loading `Enviando…`
- **Success state (`sent`):** icon tile `Mail` · H2 `Revisa tu email` · paragraph `Enviamos un enlace de recuperación a {email}. Revisa tu bandeja de entrada y carpeta de spam.` ({email} in mono) · outline button `Intentar con otro email`
- Footer: `© 2026 multistack.dev` · `Soporte` · `Estado` · `Docs`
- Toast error: title `Error`, desc = Supabase message. Icons: `Mail`, `ArrowLeft`, `Loader2`.

---

## 2.9 `/auth/callback` (`AuthCallback.tsx`)

**Blocks:** full-screen centered → `<BrandLoader />` only. No copy. Exchanges OAuth code → routes to /login, /dashboard, or /solicitudes. **Light vs dark:** centered pulsing logo (swap to dark logo in light mode).

---

## 2.10 `/dashboard` (`Dashboard.tsx`)

**Blocks:** Navbar → `max-w-7xl pt-24` → header row (prompt + H1 + session line | `[ NUEVO ]`) → 4 stat cards → renewal-alerts panel (conditional) → project-requests panel (admin, conditional) → projects grid (loading / empty / cards with pipeline bars) → NewProjectModal + ProjectScopingModal.

**Copy:**
- Header eyebrow (mono): `$ multistack dashboard --list-projects`
- H1: `Proyectos` (icon `FolderKanban`) · session line: `session: {user.email}`
- Primary button: `[ NUEVO ]` (icon `Plus`)
- Stat cards: `Total` (FolderKanban), `Activos` (Activity), `En progreso` (Clock), `Pausados` (PauseCircle)
- Renewals panel heading: `Renovaciones próximas (30 días)`; row `{nombre_proyecto} — {servicio}`, suffix `{n}d` (icon `AlertTriangle`)
- Requests panel heading: `Solicitudes de proyecto pendientes ({n})`; row meta `{client_name} · {client_email} · {date}` (fallback `—`); button `[ CONFIRMAR PROYECTO ]` (icon `FolderGit2`)
- Empty: `No hay proyectos todavía.` / `Crea tu primer proyecto para comenzar.` (icon `Inbox`)
- Project card: name, status badge (`STATUS_CONFIG`), pipeline bar with `{pct}%`, hover → title/chevron primary (`ChevronRight`)
- Stat logic: activos = `activo`/`mantenimiento`; en progreso = `en_analisis`/`en_desarrollo`/`en_despliegue`; pausados = `pausado`/`cancelado`. Date locale `es-HN`.

**Light vs dark:** Light → white stat cards with hairline border + near-black numbers, renewal panel as soft amber-tinted white card, project cards flat. Dark → navy cards, primary/accent number accents, glow on hover, glass renewal callout.

---

## 2.11 `/dashboard/project/:id` (`ProjectDetail.tsx`) — core screen

**Blocks:** Navbar → `max-w-5xl pt-24` → breadcrumb → PipelineHeader (collapsible, 6 stages) → ProjectIdentityCard (status + title + desc + client bar + Google-Docs row, editable) → ContentTabs (Servicios | Tickets | Acceso) → TicketDrawer + StageDrawer + ServiceForm sheet.

**Copy:**
- Breadcrumb: `Dashboard` (icon `ArrowLeft`) ‹ `{project.nombre_proyecto}`
- PipelineHeader label: `PIPELINE · {completed}/{total} · etapas` + `{progress}%`; completed-stage meta `{date} · {completed_by}`; incomplete shows stage description. Auto-collapses when near-complete.
- Identity card: status badge `{label.toUpperCase()}`; desc placeholder `Descripción del proyecto...`; buttons `Editar` (Edit2) / `Guardar` (Save, loading `...`) / cancel X; client edit placeholders `Nombre` / `Email` / `Teléfono` (User/Mail/Phone); empty `Sin datos de cliente registrados`; Google-Docs url placeholder `https://docs.google.com/document/d/...`, link text `Documento de requerimientos` (FileText/ExternalLink), empty `Sin documento de requerimientos vinculado`
- **STATUS_OPTIONS** (select): `En análisis`, `En desarrollo`, `En despliegue`, `Activo`, `Mantenimiento`, `Pausado`, `Cancelado`
- SubTicketForm: trigger `+ nuevo ticket del proyecto`; title placeholder `Título del ticket (ej: diseño del módulo de pagos)`; desc placeholder `Detalle opcional...`; buttons `Cancelar` / `Creando...` / `[ CREAR ]` (disabled if title < 3); toast success `Ticket creado` / `Micro-ticket añadido al proyecto.`, error `Error`
- Tabs: `Servicios` (Server) + count, `Tickets` (Ticket) + open-count (pulse), `Acceso` (Link2) + count
- Servicios tab: header `$ servicios externos` (Terminal) + `Agregar` (Plus); empty `Sin servicios registrados` / `Agrega dominios, hosting, bases de datos...`; row `{name}` · `{provider} · {tipo}` · `{days}d` · `{cost}/año` · delete (Trash2)
- Tickets tab: header `$ tickets del proyecto` + filter (`Todos` + status labels); empty `Sin tickets`; row title · `{tipo} · {date}` · priority badge · status badge · `{n}msg`
- Page toasts: load error `Error` (→ /dashboard); save success `Proyecto actualizado`; save error `Error`.

**MetaSummary one-liners (joined by ` · `):** dominio `{dominio}, {proveedor}, {precio_anual} {moneda}/año`; desarrollo `{stack}, {desarrollador}`; despliegue `{plataforma}, {url}`; entrega `Accesos ✓ · Docs ✓ · Factura ✓`; mantenimiento `{precio_mensual} {moneda}/mes`.

**Light vs dark:** Light → white cards, hairline pipeline rows, completed-stage check in `#059669`/`#0284C7`, tabs underline blue; identity card white with light-gray edit inputs. Dark → navy glass, glowing active tab, pulsing open-ticket badge.

---

## 2.12 `/dashboard/tickets` (`TicketsGlobal.tsx`)

**Blocks:** Navbar → `pt-24` → header (`$ tickets` H1 + subline) → filter bar (5 selects) → sortable table → TicketDrawer.

**Copy:**
- H1: `$ tickets` · subline (mono): `{openCount} abiertos · {total} total`
- Filter labels: `estado:` `tipo:` `prioridad:` `proyecto:` `asignado:` (proyecto only if projects exist; asignado admins only)
- Filter defaults: `todos` (estado/tipo/proyecto/asignado), `todas` (prioridad); asignado extra `sin asignar`
- Table headers: `proyecto` `título` `tipo` `estado` `asignado` `prioridad`(sort) `creado`(sort) `actividad`(sort) `msg`
- Loading row: `cargando...` · empty row: `sin tickets.` · cell fallbacks `—`
- Toast error: title `Error`. Icons: `ChevronDown/ChevronUp/ChevronsUpDown` (sort). `urgente` badge pulses. Rows clickable → drawer. Date `es-HN {month:short, day:numeric}`. `openCount` = `abierto`/`en_revision`/`en_progreso`.

**Light vs dark:** Light → white table, hairline row separators, gray header labels, hover `#F7F7F5`. Dark → navy rows, `border-border`, hover `bg-card/60`.

---

## 2.13 `/solicitudes` (`MisSolicitudes.tsx`) — client role 2

**Blocks:** Navbar → `max-w-3xl pt-28` → header (logo + H1 | toggle button) → collapsible new-request form → list (loading / empty / accordion rows).

**Copy:**
- H1: `MIS SOLICITUDES` (logo alt `MultiStack Systems Logo`)
- Toggle button: `[ NUEVA SOLICITUD ]` (Plus) / open `[ CANCELAR ]` (X)
- Form heading: `> Nueva solicitud de desarrollo`
- Field `Tipo de servicio` (select, required)
- Field `Título / nombre del proyecto (opcional)` — placeholder `Ej: Tienda online para ropa deportiva`
- Field `Descripción y requerimientos` (required) — placeholder `Describe qué necesitas, funcionalidades deseadas, referencias, etc.`
- Submit: `[ ENVIAR SOLICITUD ]` / `[ ENVIANDO... ]`
- Empty: `No hay solicitudes aún.` / `Usá el botón “Nueva solicitud” para comenzar.` (curly quotes)
- Toasts: success `Solicitud enviada` / `Nos pondremos en contacto pronto.`; load error `Error`; submit error `Error al enviar`
- **SERVICE_OPTIONS (select):** `Página web corporativa`, `E-commerce / tienda online`, `Landing page`, `Aplicación web a medida`, `Sistema de gestión (CRM/ERP)`, `Integración de API / backend`, `Rediseño de sitio existente`, `Otro`
- Submitted description prefix: `Tipo de servicio: {serviceType}\n\n{description}`. Row date `es-AR`. Accordion chevrons `ChevronDown/ChevronUp`; status badge from `TICKET_STATUS_CONFIG`.

**Light vs dark:** Light → white accordion rows, hairline, blue accents; Dark → navy glass rows.

---

## 2.14 `/client/:token` (`ClientPortal.tsx`) — token-gated, no Navbar

**Blocks:** loading screen / not-found screen / portal (top bar → project card → ticket list OR ticket thread) + NewTicketModal overlay.

**Copy:**
- Loading: `verificando acceso...` (pulse)
- Not-found: heading `acceso_no_válido` · subtext `Este enlace no es válido o ha expirado.`
- Top bar (mono): `$ multistack / portal_cliente`
- Project card: H1 `{nombre_proyecto}`, optional descripción, status badge (`STATUS_MAP`), optional client_name
- **Ticket list:** H2 `mis tickets` + `[ NUEVO TICKET ]` (Plus); empty `sin tickets todavía.` / `Crea uno si tienes alguna consulta o solicitud.`; card msg count `{n} msg` + priority/type/status badges
- **TicketThread:** back `volver` (ChevronLeft); header `{title}` + type/status badges + description; empty `sin mensajes todavía.`; message meta `{sender_name} · {date}`; reply label `responder`, name placeholder `Tu nombre`, textarea `Escribe tu mensaje...`, helper `Ctrl+Enter para enviar`, send `[ ENVIAR ]` / `Enviando...` (hidden if status `cerrado`/`resuelto`)
- **NewTicketModal:** H2 `nuevo ticket`; labels `nombre*` (placeholder `Tu nombre`), `email` (placeholder `tu@email.com`), `tipo`, `título*` (placeholder `Resumen breve del problema`), `descripción` (placeholder `Detalla el problema o solicitud...`); validation `Nombre y título requeridos.`; create error fallback `Error al crear ticket.`; buttons `Cancelar` / `[ ENVIAR ]` / `Enviando...`; default type `consulta`
- `STATUS_MAP`: en_analisis→`En análisis`, en_desarrollo→`En desarrollo`, en_despliegue→`En despliegue`, activo→`Activo`, mantenimiento→`Mantenimiento`, pausado→`Pausado`, cancelado→`Cancelado`
- Modal overlay currently `bg-black/70 backdrop-blur-sm` → **change to `bg-background/80`** per system rule. Bubbles: team right (`bg-primary/20`), client left (`bg-card`). Date `es-HN`. Icons: `Send`, `Plus`, `X`, `ChevronLeft`.

**Light vs dark:** This is the client-facing surface — make light mode genuinely Notion (white, airy, friendly), dark mode Kiro (navy glass). Keep the `$ multistack / portal_cliente` mono bar in both.

---

## 2.15 `*` NotFound (`NotFound.tsx`)

**Blocks:** full-screen centered → logo → mono prompt → H1 → subtext → home link.
**Copy:** prompt `multistack@secure:~$ cd {pathname}` · H1 `404` · subtext `bash: ruta no encontrada` · link `[ VOLVER AL INICIO ]` (→ /). Logo swap for light mode.

---

## 2.16 `/politica-de-privacidad` (`PoliticaDePrivacidad.tsx`)

**Blocks (legal shell):** Navbar → `max-w-3xl pt-28 pb-28` → back link `Volver al inicio` (ArrowLeft) → header (`// legal` eyebrow + H1 + version line) → `space-y-14` body (10 sections) → footer cross-link → fixed ScrollTopButton (`ArrowUp`, aria `Volver arriba`). Helpers: `SectionTitle` (mono number + h2), `SubHeading` (h3), `BulletList` (accent-dot ul).

**Meta:** browser title `Política de Privacidad — MultiStack Systems`; description `Conoce cómo MultiStack Systems recopila, usa y protege tus datos personales. Plataforma digital de tecnología e ingeniería de software con sede en Honduras.`; canonical `https://multistacksystems.com/politica-de-privacidad`.
**Header:** eyebrow `// legal` · H1 `Política de Privacidad` · version `Vigente desde: Junio 2026  |  Versión 1.0`.

**Full body (verbatim):**

**01 — Responsable del Tratamiento de Datos**
- "El responsable del tratamiento de los datos personales recopilados a través de esta plataforma es **MultiStack Systems**, plataforma digital de tecnología e ingeniería de software, con operaciones en Siguatepeque, Comayagua, Honduras."
- "Para consultas relacionadas con esta Política, puede contactarnos a través de nuestro canal oficial de **WhatsApp Business** [https://wa.me/50433023042], o bien ingresando a nuestra plataforma en **multistacksystems.com** [https://multistacksystems.com] donde, una vez autenticado, podrá enviarnos una solicitud directamente desde su cuenta seleccionando el tipo de solicitud **«Otro»** e incluyendo sus observaciones, notas o recomendaciones en el campo de comentarios."

**02 — Datos que Recopilamos**
- *2.1 Datos proporcionados mediante autenticación OAuth* — "Al iniciar sesión con Google, recopilamos automáticamente: nombre completo, dirección de correo electrónico, identificador único de cuenta (UID) y fotografía de perfil pública asociada a la cuenta de Google."
- *2.2 Datos de uso y operación* — "Información técnica como dirección IP, tipo de navegador, sistema operativo, páginas visitadas dentro de la plataforma y marcas de tiempo de acceso. Estos datos se recopilan de forma automática para garantizar la seguridad y el correcto funcionamiento del sistema."
- *2.3 Datos de proyectos y tickets* — "Información que usted provee voluntariamente al crear solicitudes de soporte técnico, tickets de servicio o requerimientos de desarrollo de software, incluyendo descripciones, archivos adjuntos y datos de contacto empresarial."
- *2.4 Datos de facturación* — "Información necesaria para la emisión de cotizaciones y contratos de servicio. MultiStack Systems **NO** almacena datos de tarjetas de crédito ni información bancaria directamente en su plataforma."

**03 — Finalidad del Tratamiento**
- Intro: "Los datos recopilados se utilizan exclusivamente para:"
- Bullets: "Gestionar la autenticación segura de usuarios en la plataforma." / "Atender solicitudes de soporte técnico y proyectos de desarrollo de software." / "Emitir propuestas, cotizaciones y contratos de servicio." / "Enviar comunicaciones relacionadas con el estado de sus proyectos activos." / "Garantizar la seguridad e integridad de la plataforma y sus usuarios." / "Cumplir con obligaciones legales aplicables bajo la legislación hondureña."
- Closing: "MultiStack Systems **NO** vende, arrienda ni cede sus datos personales a terceros con fines comerciales o publicitarios."

**04 — Proveedores de Servicio (Procesadores de Datos de Terceros)**
- Intro: "Para operar esta plataforma, MultiStack Systems utiliza los siguientes servicios de terceros de confianza, los cuales pueden procesar datos en su nombre:"
- Table (Proveedor | Función | Política):
  - Vercel Inc. | Hosting y despliegue de la plataforma web | vercel.com/legal/privacy-policy
  - Render Inc. | Despliegue y hosting de servicios backend | render.com/privacy
  - Supabase Inc. | Base de datos (PostgreSQL), autenticación y almacenamiento | supabase.com/privacy
  - Google LLC | Autenticación OAuth 2.0 | policies.google.com/privacy
- Closing: "Todos estos proveedores cuentan con certificaciones de seguridad reconocidas internacionalmente. Le recomendamos revisar sus políticas individualmente."

**05 — Conservación de Datos** — "Sus datos personales se conservarán mientras mantenga una cuenta activa en la plataforma o mientras exista una relación comercial vigente. Una vez finalizada la relación, los datos se eliminarán dentro de un plazo máximo de **90 días**, salvo que la legislación hondureña exija su conservación por un período mayor."

**06 — Derechos del Usuario**
- Intro: "Como usuario de nuestra plataforma, usted tiene derecho a:"
- Bullets: "Acceso: Solicitar información sobre los datos personales que almacenamos sobre usted." / "Rectificación: Solicitar la corrección de datos inexactos o incompletos." / "Eliminación: Solicitar la supresión de sus datos, sujeto a las obligaciones legales." / "Portabilidad: Recibir sus datos en un formato estructurado y legible." / "Oposición: Oponerse al tratamiento de sus datos para determinadas finalidades."
- Closing: "Para ejercer cualquiera de estos derechos, contáctenos a través de nuestros canales oficiales."

**07 — Seguridad**
- "MultiStack Systems implementa medidas técnicas y organizativas apropiadas para proteger sus datos contra acceso no autorizado, pérdida, alteración o divulgación. Esto incluye comunicaciones cifradas mediante HTTPS/TLS, autenticación segura mediante OAuth 2.0 y controles de acceso por roles dentro de la plataforma."
- "Sin embargo, ningún sistema de transmisión por Internet es 100% seguro. El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso."

**08 — Menores de Edad** — "Nuestra plataforma está dirigida exclusivamente a personas mayores de 18 años o a representantes legales de empresas. No recopilamos intencionalmente datos de menores."

**09 — Cambios a Esta Política** — "MultiStack Systems se reserva el derecho de actualizar esta Política de Privacidad en cualquier momento. Los cambios sustanciales serán notificados mediante aviso visible en la plataforma. El uso continuado de los servicios tras la publicación de cambios implica la aceptación de la nueva versión."

**10 — Jurisdicción Aplicable** — "Esta Política se rige por las leyes vigentes de la República de Honduras. Cualquier controversia derivada de la interpretación o aplicación de esta Política será sometida a la jurisdicción de los tribunales competentes de Honduras."

**Footer link:** `Términos del Servicio →` (→ /terminos-del-servicio) + back link `Volver al inicio`.

---

## 2.17 `/terminos-del-servicio` (`TerminosDelServicio.tsx`)

**Blocks:** identical legal shell; no providers table (body inline). Footer cross-link `← Política de Privacidad`.

**Meta:** browser title `Términos del Servicio — MultiStack Systems`; description `Términos y condiciones de uso de MultiStack Systems. Conoce tus derechos, obligaciones y la jurisdicción aplicable como usuario de nuestra plataforma.`; canonical `https://multistacksystems.com/terminos-del-servicio`.
**Header:** eyebrow `// legal` · H1 `Términos del Servicio` · version `Vigentes desde: Junio 2026  |  Versión 1.0`.

**Full body (verbatim):**

**01 — Aceptación de los Términos**
- "Al acceder, registrarse o utilizar cualquier servicio ofrecido a través de la plataforma de MultiStack Systems (**multistacksystems.com** [https://multistacksystems.com]), usted declara haber leído, comprendido y aceptado íntegramente los presentes Términos del Servicio. Si no está de acuerdo con alguna de estas condiciones, deberá abstenerse de utilizar la plataforma."
- "Estos términos constituyen un acuerdo legalmente vinculante entre usted (el \"Cliente\" o \"Usuario\") y **MultiStack Systems** (el \"Proveedor\"), plataforma digital de tecnología e ingeniería de software, conforme a las leyes de la República de Honduras."

**02 — Descripción de los Servicios**
- Intro: "MultiStack Systems es una plataforma tecnológica multiservicios que ofrece:"
- Bullets: "Soporte técnico: diagnóstico, mantenimiento preventivo y correctivo de equipos, redes e infraestructura tecnológica." / "Desarrollo de software: creación de sistemas web, móviles y aplicaciones a medida." / "Consultoría tecnológica: análisis, planificación y modernización de infraestructura digital." / "Licenciamiento de software: reventa autorizada de herramientas como Microsoft Office, Windows y Kaspersky." / "Integración de Inteligencia Artificial: automatización de procesos empresariales." / "Ciberseguridad: auditorías de vulnerabilidades y fortalecimiento de infraestructura."
- Closing: "La disponibilidad de servicios específicos puede variar según la modalidad contratada y las condiciones del mercado."

**03 — Cuentas de Usuario**
- *3.1 Registro* — "Para acceder a funcionalidades avanzadas de la plataforma, el usuario debe crear una cuenta mediante autenticación OAuth con Google. El usuario es responsable de proporcionar información veraz y mantenerla actualizada."
- *3.2 Seguridad* — "El usuario es el único responsable de la confidencialidad de su cuenta y de todas las actividades realizadas bajo la misma. Cualquier acceso no autorizado debe reportarse inmediatamente a MultiStack Systems."
- *3.3 Prohibiciones* — Intro: "Queda expresamente prohibido:" · Bullets: "Intentar acceder sin autorización a sistemas, servidores o bases de datos de MultiStack Systems." / "Realizar ingeniería inversa sobre la plataforma." / "Transmitir malware, virus o código malicioso." / "Suplantar la identidad de otros usuarios." / "Utilizar la plataforma con fines ilegales." · Closing: "El incumplimiento podrá resultar en la suspensión inmediata de la cuenta y en las acciones legales correspondientes."

**04 — Contratación de Servicios**
- *4.1 Propuestas y cotizaciones* — "Ningún servicio de desarrollo de software o consultoría se iniciará sin una propuesta formal aprobada y firmada por ambas partes. Las cotizaciones tienen validez de **15 días calendario** desde su emisión."
- *4.2 Pagos* — "Los términos de pago se especifican en cada propuesta o contrato de servicio. Los contratos de mantenimiento mensual (SLA) se facturan por adelantado. Los proyectos de desarrollo se facturan en hitos acordados."
- *4.3 Retrasos por parte del cliente* — "Si el cliente no provee información, accesos o retroalimentación necesaria dentro de los plazos acordados, MultiStack Systems no será responsable de retrasos en la entrega y podrá ajustar los tiempos del proyecto."

**05 — Propiedad Intelectual**
- *5.1 Plataforma y código base* — "Todos los derechos sobre la plataforma MultiStack Systems, su diseño, arquitectura, código fuente y marca son propiedad exclusiva de MultiStack Systems. Queda prohibida su reproducción, distribución o modificación sin autorización expresa y por escrito."
- *5.2 Software a medida* — "El software desarrollado a medida para un cliente específico, una vez liquidado el pago total acordado, transfiere al cliente los derechos de uso sobre los entregables finales acordados en el contrato. MultiStack Systems se reserva el derecho de utilizar las metodologías, frameworks y componentes genéricos empleados en futuros proyectos."
- *5.3 Contenido del cliente* — "El cliente conserva la titularidad sobre todos los datos, contenidos e información que provea para la realización del proyecto. Al compartirlos con MultiStack Systems, otorga una licencia limitada para utilizarlos exclusivamente en la ejecución del servicio contratado."

**06 — Garantía Limitada y Limitación de Responsabilidad**
- Intro: "MultiStack Systems garantiza que los servicios serán ejecutados con profesionalismo y conforme a los estándares técnicos acordados. Sin embargo:"
- Bullets: "No garantizamos disponibilidad ininterrumpida ni libre de errores de la plataforma." / "No somos responsables de pérdidas de datos causadas por factores externos (fallos del proveedor de hosting, desastres naturales, ataques de terceros)." / "La responsabilidad total de MultiStack Systems por cualquier reclamación no excederá el monto pagado por el cliente por el servicio específico en los 30 días anteriores al incidente."

**07 — Confidencialidad** — "Ambas partes se comprometen a mantener confidencial toda información técnica, comercial o estratégica compartida durante la prestación del servicio. Esta obligación se extiende por un período de **2 años** tras la finalización del contrato."

**08 — Suspensión y Terminación**
- "MultiStack Systems se reserva el derecho de suspender o cancelar el acceso a la plataforma o los servicios en caso de: incumplimiento de estos Términos, falta de pago, uso fraudulento o actividad que ponga en riesgo la seguridad de la plataforma."
- "En casos de terminación justificada por parte del cliente, se facturarán los trabajos realizados hasta la fecha de notificación formal."

**09 — Modificaciones** — "MultiStack Systems podrá modificar estos Términos del Servicio en cualquier momento. Las modificaciones entrarán en vigor a los **15 días** de su publicación en la plataforma. El uso continuado de los servicios constituye aceptación de los nuevos términos."

**10 — Jurisdicción y Resolución de Disputas** — "Estos Términos del Servicio se rigen por las leyes vigentes de la República de Honduras. Ante cualquier controversia derivada de la interpretación, ejecución o incumplimiento de estos Términos, las partes se someten a la jurisdicción de los tribunales competentes de la ciudad de **Comayagua, Honduras**, renunciando expresamente a cualquier otro fuero que pudiera corresponderles."

**Legal pages light vs dark:** Light is the natural home for these — Notion long-form: white, `max-w-3xl`, near-black ink body at 1.8 line-height, hairline section rules, blue links. Dark → navy, `// legal` accent eyebrow, muted body.

---

## 2.18 Sub-views / overlays (modals, drawers, sheets)

These are not routes but are critical screens. Full copy is in §2.11; summary of each below.

- **NewProjectModal** (Dialog `max-w-md`): title `$ multistack create --project`; fields (trailing `:`) `nombre_proyecto *` (placeholder `Mi nuevo proyecto`), `descripcion` (placeholder `Descripción breve del proyecto`), divider `— datos del cliente —`, `client_name` (`Nombre del cliente`), `client_email` (`cliente@email.com`), `client_phone` (`+504 0000-0000`); buttons `[ CREAR PROYECTO ]` / `Creando...` / `Cancelar`; toasts `Proyecto creado` / `Error`.
- **ProjectScopingModal** (Dialog `sm:max-w-xl`): title `$ convertir a proyecto oficial` (FolderGit2); labels (uppercase tracking-widest) `Título del proyecto`, `Descripción objetivo`, `Lead developer` (default `— sin asignar —`), `Fecha límite`, `Google Docs de requerimientos` (placeholder `https://docs.google.com/document/d/...`); panel `// requerimientos técnicos` with `Stack propuesto` (`React + Supabase + Vercel...`), `Alcance / especificaciones` (`Módulos, features, integraciones...`), `Entregables` (`App en producción, documentación, accesos...`); buttons `Cancelar` / `[ CREAR PROYECTO ]` / `Convirtiendo...`; toasts `Proyecto creado` / `Ticket convertido a proyecto oficial.`, error `Error en la conversión`.
- **ServiceForm** (right Sheet `sm:max-w-md`): title `+ Agregar Servicio Externo`; fields (`:`) `tipo`, `proveedor *` (first option `Seleccionar...`), `nombre *` (`confeccionesmatys.com`), `url` (`https://...`), `costo_mensual`/`costo_anual` (`0.00`), `moneda` (USD/HNL), `fecha_renovacion`, `notas`; buttons `[ GUARDAR ]` / `Guardando...` / `Cancelar`; toasts `Servicio agregado` / `Error`. SERVICE_TYPES: `Dominio`/`Hosting`/`Base de datos`/`CDN`/`Otro`. PROVIDERS: `Cloudflare`, `Namecheap`, `GoDaddy`, `Vercel`, `Render`, `Railway`, `Supabase`, `DigitalOcean`, `Otro`.
- **ClientAccessSection** (Acceso tab): heading `$ acceso del cliente`; `Enlace activo` (Link2) with meta `cliente:`/`email:`/`creado:`/`último acceso:`; empty `Sin enlace activo para este proyecto.`; generate caption `— generar enlace de acceso —` / `— regenerar enlace (desactiva el anterior) —`; fields `nombre_cliente:` (`Juan Pérez`), `email_cliente:` (`juan@email.com`); button `[ GENERAR ENLACE ]` / `[ REGENERAR ENLACE ]` / `Generando...`; history caption `historial:`, row `{token16}… {date} · inactivo`; toasts `Enlace generado`, `URL copiada`, `Error`. URL `{origin}/client/{token}`. Icons `Copy`, `RefreshCw`, `Link2`, `Clock`.
- **MaintenanceSection** (Servicios tab, when active/mantenimiento): heading `$ registro de mantenimiento`; add `Registrar mes` (Plus); empty `Sin registros de mantenimiento todavía.`; row `{n} tarea(s)` + billed amount + status; Sheet title `$ Nuevo registro de mantenimiento` / `$ Editar — {mes}`; fields `mes:`, `estado:`, `tareas_realizadas (una por línea):` (placeholder lines `Actualización de plugins` / `Backup realizado` / `Monitoreo de uptime`), `notas:`, checkbox `Cobrado al cliente`, `monto_cobrado:` (`500.00`); buttons `[ GUARDAR ]` / `Guardando...` / `Cancelar`; toasts `Mantenimiento guardado` / `Error`. STATUS_LABEL: `Completado`/`En proceso`/`Pendiente`.
- **StageDrawer** (right Sheet `sm:max-w-lg`): title `✓ {stage.label}` + subtitle `{stage.description}`; common `fecha_completado:` / `completado_por:` (`Nombre`); buttons `[ GUARDAR ETAPA ]` / `Guardando...` / `Cancelar`; toast `{stage.label} — guardado` / `Error`; generic select first option `Seleccionar...`. Stage-specific forms:
  - Análisis: checkboxes `Reunión inicial con cliente`, `Definición de requerimientos`, `Cotización aprobada` + `notas:`
  - Dominio: helper `💡 Buscar precio en tld-list.com`; `dominio:` (`confeccionesmatys.com`), `proveedor:`, `precio_anual:` (`12.00`), `moneda:`, `fecha_compra:`, `fecha_renovacion:`, `notas:`
  - Desarrollo: `stack:` (chips), `repo_url:` (`https://github.com/...`), `desarrollador:` (`Nombre del desarrollador`), `fecha_estimada_entrega:`, `notas:`
  - Despliegue: `plataforma:`, `url_produccion:` (`https://miapp.vercel.app`), `base_de_datos:`, checkboxes `DNS configurado`, `SSL activo`, `notas:`
  - Entrega: checkboxes `Accesos entregados al cliente`, `Documentación entregada`, `Factura emitida`, `notas:`
  - Mantenimiento: `precio_mensual:` (`500.00`), `moneda:`, `notas:`
  - STACKS: `Next.js`, `React`, `Vue`, `Laravel`, `WordPress`, `Supabase`, `MySQL`, `PostgreSQL`, `MongoDB`, `Node.js`, `Otro`. DEPLOY_PLATFORMS: `Vercel`, `Render`, `Railway`, `DigitalOcean`, `VPS propio`, `Cloudflare Pages`, `Otro`. DB_OPTIONS: `Supabase`, `PlanetScale`, `Railway MySQL`, `Amazon RDS`, `Ninguna`, `Otro`. DOMAIN_PROVIDERS: `Cloudflare`, `Namecheap`, `GoDaddy`, `Otro`.
- **TicketDrawer** (right Sheet `sm:max-w-lg`): header `{title}` + type/status/priority badges; controls `estado:` / `prioridad:` selects, `Resolver` (CheckCircle2), `[ CONVERTIR A PROYECTO OFICIAL ]` (FolderGit2, admin + en_revision + no project), `asignar a:` (UserCheck, default `— sin asignar —`); description block; client line `cliente: {name} · {email}`; chat bubbles meta `{sender} · {date}`, team label `MultiStack Team`; empty `Sin mensajes todavía.`; reply placeholder `Escribe una respuesta al cliente...`, helper `Ctrl+Enter para enviar`, send `[ RESPONDER ]` / `Enviando...`; toasts `Estado actualizado`, `Ticket asignado` / `Asignación removida` (`Responsable: {email}`), `Error`.

**ProtectedRoute (guard states):** email-not-confirmed screen — status `[ EMAIL_NOT_CONFIRMED ]`, message `Confirmá tu cuenta antes de continuar.`, helper `Te enviamos un enlace de confirmación a {email}. Revisá tu bandeja de entrada y carpeta de spam.`, button `[ VOLVER AL LOGIN ]` (icon `Mail`). (Note voseo: `Confirmá`/`Revisá` — keep verbatim.)

---

# 3. TECH STACK, ACCENTS & ASSETS HANDOFF

## 3.1 Stack

React 18 + TypeScript + **Vite** SPA (not Next.js). Routing `react-router-dom` v6. Server state `@tanstack/react-query`. Auth/backend **Supabase**. UI primitives **shadcn/ui** (Radix). Animation **framer-motion**. Icons **lucide-react**. Forms `react-hook-form` + `zod`. Toasts `sonner` + shadcn toaster. Styling Tailwind v3, `darkMode: ["class"]`, container centered `padding 2rem`, `2xl: 1400px`.

**State management:** auth via `useAuth` (Supabase session → `user`, `userType` 0/1/2, `loading`, `signOut`); cross-page CTA intent via `sessionStorage` key `postLoginIntent`; local UI via `useState` (`useServiceExpand`, tab index, form status, navbar scroll). **Theme:** to be added via `next-themes` `ThemeProvider` (see §1.4) — currently only consumed by `sonner`.

## 3.2 `public/` asset map

| Asset | Purpose | Notes for redesign |
| --- | --- | --- |
| `logo-white.png` | Primary logo (Navbar, Footer, auth, loaders, 404, MisSolicitudes) | White glyph — **invisible on white**; in light mode swap to `logo-black.png` |
| `logo-black.png` | Social/OG card image | Reuse as the **light-mode logo** |
| `favicon.svg` | Browser favicon (primary) | — |
| `favicon.ico` | Legacy favicon fallback | — |
| `logo-black.png` | Variante clara del logo oficial | Reusar en superficies blancas y OG/social |
| `robots.txt` | Crawler directives | — |
| `sitemap.xml` | SEO sitemap | Update if routes/URLs change |

Logo lockup (from LOGIN-SPEC): square mark 28×28, radius 6, gradient `linear-gradient(135deg,#0EA5E9,#06B6D4)`, letter "M" in `#080F1E` JetBrains Mono 700; wordmark "MultiStack." Sora/display 700, final `.` in primary. (In light mode the wordmark ink → `#191919`.)

## 3.3 UI states (define for every interactive element, both modes)

- **Buttons — primary:** rest (solid primary, contrast text) → hover (light: subtle shadow; dark: cyan glow `0 0 16px`) → focus-visible (3px primary ring) → active (slightly darker) → loading (`Loader2` spin + verb, width preserved) → disabled (`opacity-50/70`, `cursor-not-allowed`).
- **Buttons — bracketed secondary:** rest (transparent + border + mono label) → hover (light: `#F7F7F5` bg + ink; dark: `bg-primary/5` + foreground + primary border).
- **Inputs:** rest (surface bg + hairline border) → focus (primary border + ring — light faint, dark cyan glow) → error (`destructive` border + helper) → disabled (`opacity-50`). Password fields: `Eye`/`EyeOff` toggle with dynamic aria-label.
- **Tabs:** active = primary text + 2px primary underline (dark also tints bg); inactive = muted; hover = foreground. Icon left of label; count badges; open-ticket badge `animate-pulse`.
- **Cards (interactive):** hover lifts border to primary (dark) or warm-gray bg (light), optional `-translate-y-0.5`; expandable cards animate height via framer-motion.
- **Table rows / list rows:** hover bg (`#F7F7F5` / `bg-card/60`), `cursor-pointer`, click → drawer. Sort headers toggle `ChevronUp/Down`, idle `ChevronsUpDown` (opacity-30).
- **Status badges:** `inline-flex rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider`, color = `text-{c} border-{c} bg-{c}/12`; `urgente` pulses.
- **Animations:** `animate-scroll` (marquee 30s linear infinite), `animate-blink` (cursor/dot/`_` step-end 1s), `animate-pulse` (loaders, urgent, coming-soon dot), `animate-spin` (`Loader2`/`RefreshCw`). Entrance: framer `initial opacity/y → whileInView`, ease `[0.4,0,0.2,1]`, stagger by index.
- **Glows/accents:** dark mode — ambient radial blobs behind hero/section headers, `glow-border` on terminal/marquee chips, focus rings cyan. Light mode — replace all neon with flat hairlines + at most a 1px soft shadow.

## 3.4 Shared data maps (status/type/priority — single source of truth)

**`PIPELINE_STAGES`** (6): `analisis` "Análisis" — "Reunión, requerimientos, cotización"; `dominio` "Adquisición de Dominio" — "Compra y configuración del dominio"; `desarrollo` "Desarrollo" — "Stack, repo, QA con cliente"; `despliegue` "Despliegue" — "Hosting, DNS, SSL, producción"; `entrega` "Entrega" — "Accesos, documentación, factura"; `mantenimiento` "Mantenimiento Activo" — "Seguimiento mensual".

**`STATUS_CONFIG`** (project): en_analisis→`En análisis`, en_desarrollo→`En desarrollo`, en_despliegue→`En despliegue`, activo→`Activo`, mantenimiento→`Mantenimiento`, pausado→`Pausado`, cancelado→`Cancelado`.

**`TICKET_TYPE_LABELS`:** modificacion→`Modificación`, bug→`Bug / Error`, consulta→`Consulta`, pago→`Pago`, mantenimiento→`Mantenimiento`, otro→`Otro`, solicitud→`Solicitud de Proyecto`.

**`TICKET_STATUS_CONFIG`** (label / color): abierto→`Recibido` (accent), en_revision→`En revisión` (yellow-400), asignado→`Asignado` (violet-400), en_progreso→`En progreso` (primary), resuelto→`Resuelto` (muted), cerrado→`Cerrado` (muted/50), convertido→`Convertido a Proyecto` (emerald-400). Open-ticket statuses: abierto, en_revision, en_progreso.

**`TICKET_PRIORITY_CONFIG`:** baja→`Baja` (muted), media→`Media` (yellow-400), alta→`Alta` (orange-400), urgente→`Urgente` (red-400, **pulse**). Sort order: urgente 4 / alta 3 / media 2 / baja 1.

**`SERVICE_TYPE_LABELS`:** domain→`Dominio`, hosting→`Hosting`, database→`Base de datos`, cdn→`CDN`, other→`Otro`.

**`ROLE_LABELS`:** 0→`Admin`, 1→`Colaborador`, 2→`Cliente`.

> Status colors above are the dark-mode values. In light mode, map each to its AA-safe darker stop (e.g. yellow-400 → amber-600, violet-400 → violet-600) so badges stay legible on white. Keep the label text identical.

## 3.5 Conventions to preserve

- **Language:** Spanish (es-HN). Dates: mostly `es-HN`; MisSolicitudes rows use `es-AR`. Phone format `+504`.
- **Bracket buttons** `[ LABEL ]` (mono, uppercase, often underscored commands) are the primary-action idiom across the app — keep in both modes; in Notion-light they read as quiet mono pills, in Kiro-dark as glowing command chips.
- **Terminal/`$`/`>` prompts** (`$ multistack ...`, `> Nueva solicitud`, `multistack@secure:~$`) — part of brand voice; keep verbatim.
- Voseo vs tuteo inconsistency exists in copy (`Revisa` vs `Revisá`/`Confirmá`/`Usá`) — **do not "fix"**; reproduce as-is.
- One `<h1>` per page.

---

## Appendix — File index

| Concern | File(s) |
| --- | --- |
| Routes | `src/App.tsx` |
| Landing shell | `src/pages/Index.tsx` |
| Hero | `src/components/HeroSection.tsx`, `TerminalHero.tsx` |
| Hook cards | `src/components/landing/HookSection.tsx`, `ServiceCard.tsx`, `ServiceCTA.tsx`, `hooks/useServiceExpand.ts` |
| Catalog | `src/components/ServicesSection.tsx` |
| Marquee | `src/components/TechStack.tsx` |
| Footer | `src/components/Footer.tsx` |
| Navbar | `src/components/Navbar.tsx` |
| Auth | `src/pages/Login.tsx`, `Signup.tsx`, `ResetPassword.tsx`, `AuthCallback.tsx`, `src/components/AuthBrandPanel.tsx`, `ProtectedRoute.tsx`, `BrandLoader.tsx` |
| Dashboard | `src/pages/Dashboard.tsx`, `ProjectDetail.tsx`, `TicketsGlobal.tsx` |
| Client/requests | `src/pages/MisSolicitudes.tsx`, `ClientPortal.tsx` |
| Dashboard sub-views | `src/components/dashboard/NewProjectModal.tsx`, `ProjectScopingModal.tsx`, `ServiceForm.tsx`, `ClientAccessSection.tsx`, `MaintenanceSection.tsx`, `StageDrawer.tsx`, `TicketDrawer.tsx` |
| Legal | `src/pages/PoliticaDePrivacidad.tsx`, `TerminosDelServicio.tsx` |
| Data maps | `src/types/tickets.ts`, `src/types/projects.ts` |
| Tokens / CSS | `src/index.css` |
| Tailwind | `tailwind.config.ts` |
| Auth/state | `src/hooks/useAuth.tsx`, `src/integrations/supabase/client.ts` |
| Existing dark spec | `claude_design/REDISE_O.md`, `claude_design/globals.css`, `claude_design/tailwind.config.snippet.ts`, `claude_design/LOGIN-SPEC.md` |
| Assets | `public/logo-white.png`, `public/logo-black.png`, `public/favicon.svg`, `public/favicon.ico`, `public/robots.txt`, `public/sitemap.xml` |
