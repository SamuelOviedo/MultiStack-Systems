# Current State Summary — MultiStack Systems (Front-end)

**Fecha:** 2026-10-13
**Rama:** `feat/home-product-ecosystem` (último commit `4460ce1 feat(navbar): add responsive mobile navigation`)
**Estado del árbol:** WIP sin commitear en `HeroSection.tsx`, `EcosystemPreview.tsx`, `index.css` (+421 / −256)
**Fuentes:** índice CodeGraph (103 archivos · 921 nodos · 1,736 aristas) + lectura directa del código.
**Formato:** estructura tipo Spec Kit (contexto → escenarios → requisitos → entidades → riesgos → `[NEEDS CLARIFICATION]`).

---

## 1. Arquitectura general

| Capa | Tecnología | Notas |
|---|---|---|
| Build | Vite 5 + `@vitejs/plugin-react-swc`, TypeScript 5.9 | Alias `@/* → src/*` |
| UI runtime | React 18.3, React Router 6.30 (`BrowserRouter`) | SPA; Vercel reescribe todo a `/index.html` |
| Estado servidor | TanStack Query 5 (`QueryClient` global, sin config) | |
| Backend | Supabase (`@supabase/supabase-js` 2.x) + Edge Functions (Resend) | Auth, tickets, proyectos, contacto |
| Estilos | Tailwind 3.4 + shadcn/ui (HSL tokens) **y** tokens MS inline (`src/lib/msTokens.ts`) | Dos sistemas de diseño conviviendo — ver §5 |
| Tema | `next-themes`, `defaultTheme="dark"`, sin tema de sistema | |
| Calidad | ESLint 9, Vitest 3 + Testing Library, Playwright (1 spec: login) | CI: lint → tsc → test → build en PR a `main` |
| Arquitectura tooling | `scripts/graphify` (dependency-cruiser), ahora también CodeGraph (`.codegraph/`) | |

### Árbol de proveedores (`src/App.tsx`)
```
ThemeProvider → QueryClientProvider → TooltipProvider → Toaster + Sonner
  → BrowserRouter → AuthProvider → Suspense(PageLoader/BrandLoader) → Routes
```

### Rutas
| Ruta | Página | Carga | Protección |
|---|---|---|---|
| `/` | `pages/marketing/Index` | **eager** | pública |
| `/login`, `/signup`, `/auth/callback`, `/auth/reset-password` | `pages/auth/*` | lazy | pública |
| `/dashboard`, `/dashboard/project/:id`, `/dashboard/tickets` | `pages/dashboard/*` | lazy | `ProtectedRoute` |
| `/solicitudes` | `pages/client/MisSolicitudes` | lazy | `ProtectedRoute allowedTypes={[2]}` (cliente) |
| `/client/:token` | `pages/client/ClientPortal` | lazy | token en URL |
| `/politica-de-privacidad`, `/terminos-del-servicio` | `pages/legal/*` | lazy | pública |
| `*` | `NotFound` | lazy | — |

### Organización de `src/`
```
components/
  common/     Navbar (485 LOC), Footer, Logo, BrandLoader, ProtectedRoute
  marketing/  Home: Hero, EcosystemPreview, ProductsShowcase, ProductPreview,
              EcosystemConnect, TechStack, BuiltHonduras, ContactSplit, ContactForm, MsIcon
  dashboard/  dashboard-home/*, project-detail/*, requests/*, tickets/*
  auth/       AuthBrandPanel
  ui/         12 primitivas shadcn (button, dialog, sheet, tabs, toast, tooltip, …)
lib/          products, msTokens, contact, auth, projects, tickets, portal, siteUrl, utils
hooks/        useAuth, use-toast
types/        products, projects, tickets
integrations/supabase/  client + types generados
```

---

## 2. Página de inicio (`/`)

**Composición** (`codegraph callees Index`):
```
Index
├─ Navbar                 (fuera del wrapper de tokens; aplica useMsThemeVars por su cuenta)
└─ <div style={msVars}>   ← tokens MS inline (bg, text, primary, accent, hairline…)
   ├─ HeroSection         #hero        → EcosystemPreview (WIP)
   ├─ ProductsShowcase    #productos   → ProductPreview ×3
   ├─ EcosystemConnect    #ecosistema  → PRODUCTS
   ├─ TechStack           #stack
   ├─ BuiltHonduras       (envuelto en #empresa)
   ├─ ContactSplit        #contacto    → ContactForm → lib/contact → Supabase
   └─ Footer
```
- `Index` gestiona scroll por hash (`location.hash` → `scrollIntoView` smooth).
- Tipografía: Hanken Grotesk (cuerpo), Sora (titulares), JetBrains Mono (etiquetas/eyebrows).
- Estilo: **casi todo inline** (`style={{…}}`: ~121 bloques en `marketing/`) + clases utilitarias propias en `index.css` (`.ms-hero-grid`, `.ms-showcase-*`, `.ms-eco-*`, `.ms-cc-*`, `.ms-cta`). Tailwind prácticamente no se usa en la home.

### HeroSection (WIP)
- Cambio en curso: de layout **centrado** a **grid 2 columnas** (`.ms-hero-grid` 0.92fr / 1.08fr) — copy a la izquierda, "command center" a la derecha.
- Titular: *"High-Level Engineering behind real products."* + CTAs (scroll a `#productos`, enlace TechOn vía `getTechonHref()`).
- Responsive: ≤1024px columna única; ≤640px el command center oculta sidebar y detalles (`.ms-cc-sidebar`, `.ms-cc-detail`).

### EcosystemPreview (WIP, 286 LOC)
- Mock tipo dashboard "Centro de Control del Ecosistema": sidebar + 4 tarjetas de módulo + barra de estado. `role="img"` con `aria-label` descriptivo.
- Datos: array local `CARDS` (ficticio a propósito) **más** `PRODUCTS.map` en dos lugares (L115, L249).

---

## 3. Catálogo de servicios / productos

### Fuente de verdad: `src/lib/products.ts` + `src/types/products.ts`
```ts
type ProductStatus = "live" | "soon" | "dev";
type ProductSlug   = "techon" | "licensing" | "development" | "whatsapp";
interface Product { slug; name; tagline; description; status; statusLabel; href?; ctaLabel? }
```
| Slug | Nombre | Estado | `statusLabel` | CTA / href |
|---|---|---|---|---|
| techon | TechOn | live | Disponible | "Abrir TechOn" → `VITE_TECHON_URL` ?? `/login` |
| licensing | Licensing | soon | En preparación | ninguno |
| development | Development | live | Desde MultiStack | "Iniciar proyecto" → `#contacto` |
| whatsapp | WhatsApp | dev | En desarrollo | ninguno |

- URLs del ecosistema por env (`VITE_TECHON_URL`, `VITE_LICENSING_URL`, `VITE_WHATSAPP_PLATFORM_URL`); regla explícita: **sin URLs inventadas**. `LICENSING_URL` y `WHATSAPP_PLATFORM_URL` se exportan pero aún no se consumen.
- Helpers: `getProduct(slug)` (lanza si no existe), `getTechonHref()`, `isExternalHref()`.
- Cubierto por `src/test/products.test.ts` (4 productos, sin href en licensing/whatsapp, fallback `/login`).

### Consumidores (CodeGraph `impact`)
| Símbolo | Afecta a |
|---|---|
| `PRODUCTS` | EcosystemConnect, EcosystemPreview → HeroSection → Index |
| `getProduct` | ProductsShowcase, ProductPreview → Index |
| `getTechonHref` | HeroSection, ContactSplit, Footer → Index |
| `useMsThemeVars` | Index, Navbar, Dashboard, ProjectDetail, TicketsGlobal, MisSolicitudes, páginas legales (12 símbolos) |
| `Logo` | 24 símbolos (Navbar, Footer, BrandLoader, PageLoader, ProtectedRoute, auth, dashboard…) |

### ProductsShowcase (`#productos`)
Layout editorial: TechOn protagonista (`.ms-showcase-techon`), Licensing invertido, Development, WhatsApp como fila discreta full-width. Cada bloque = `ProductCopy` + `ProductPreview` (mock de ventana con `DEMO_ROWS` ficticios por slug; WhatsApp tiene preview propio). Productos sin CTA muestran "Próximamente — la gestionamos directo con el equipo."

---

## 4. Dependencias clave

**Usadas activamente:** react / react-dom, react-router-dom, @tanstack/react-query, @supabase/supabase-js, next-themes, lucide-react, sonner, class-variance-authority, clsx, tailwind-merge, tailwindcss-animate (plugin Tailwind), Radix: checkbox, dialog, label, slot, tabs, toast, tooltip.

**Declaradas pero sin import en `src/` (0 usos):**
`@hookform/resolvers`, `react-hook-form`, `zod`, `framer-motion`, `recharts`, `date-fns`, `react-day-picker`, `cmdk`, `vaul`, `embla-carousel-react`, `input-otp`, `react-resizable-panels`, y 21 paquetes `@radix-ui/*` (accordion, alert-dialog, aspect-ratio, avatar, collapsible, context-menu, dropdown-menu, hover-card, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, switch, toggle, toggle-group).
→ Herencia de la plantilla shadcn completa. No afectan el bundle (tree-shaking) pero sí `npm ci`, Dependabot y superficie de auditoría.

---

## 5. Hallazgos y deuda técnica (priorizados)

1. **Datos de producto duplicados en `EcosystemPreview`** — `CARDS` reescribe nombre/estado ("Licenciamiento", "Desarrollo", "Activo") en lugar de derivarlos de `PRODUCTS` ("Licensing", "Development", "Desde MultiStack"). Riesgo de deriva de copy entre Hero y Showcase.
2. **Dos sistemas de tokens** — shadcn HSL (dashboard/auth) vs. tokens MS hex inline (landing + Navbar + dashboard vía `useMsThemeVars`). Nombres colisionan (`--primary`, `--accent`, `--border`, `--muted`), por eso se aíslan inline. Funciona, pero cada nueva pantalla debe elegir sistema.
3. **Estilos inline masivos** en `marketing/` — difícil de tematizar, sin hover/focus/media queries salvo vía clases `.ms-*` en `index.css`. Colores de estado hardcodeados (`#10b981`, `#f59e0b`) repetidos en ProductsShowcase y EcosystemPreview en vez de `var(--success)` / `var(--warning)`.
4. **Constante `MONO` duplicada** en ~9 archivos.
5. **Parámetro sin uso**: `statusPill(status)` en `ProductsShowcase.tsx` ignora `status`.
6. **Navbar de 485 LOC** — candidato a dividir (desktop / móvil / acciones de usuario).
7. **Cobertura de pruebas**: sin tests de componentes para la home; e2e solo cubre login.
8. **Dependencias muertas** (§4).
9. **`.codegraph/` no está en `.gitignore`** (creado en este análisis).

---

## 6. Escenarios actuales (comportamiento observable)

- **Visitante anónimo** entra a `/` → ve hero + command center, recorre productos, envía contacto (Supabase `send-contact-email`).
- **Clic en "Abrir TechOn"** → `/login` (o URL externa si `VITE_TECHON_URL` existe, en nueva pestaña).
- **Clic en "Iniciar proyecto"** (Development) → scroll a `#contacto`.
- **Licensing / WhatsApp** → sin CTA, solo estado.
- **Móvil (≤640px)** → hero en columna, command center simplificado, navegación móvil (commit `4460ce1`).

---

## 7. `[NEEDS CLARIFICATION]` para próximas iteraciones

- ¿`EcosystemPreview` debe leer nombres/estados de `PRODUCTS` (fuente única) o mantener copy de marketing distinto a propósito?
- ¿Se unifica el sistema de tokens (migrar landing a Tailwind con tokens MS en `tailwind.config`) o se mantiene el aislamiento inline?
- ¿El catálogo crecerá más allá de 4 productos? Si sí, `ProductsShowcase` está maquetado a mano por slug y no escala.
- ¿Habrá páginas de detalle por producto (`/productos/:slug`)?
- ¿Se eliminan las dependencias sin uso o se reservan para el dashboard?

---

## 8. Comandos de referencia

```bash
codegraph status .                 # estado del índice
codegraph sync .                   # reindexar tras cambios
codegraph impact <Símbolo>         # radio de impacto
codegraph callees Index            # composición de la home
npm run graph:report               # reporte Graphify (dependency-cruiser)
npm run lint && npx tsc -p tsconfig.app.json --noEmit && npm test && npm run build   # gate de CI local
```
