# Feature Specification: Landing cinemática + Servicios Productizados de IA

**Feature Branch**: `001-cinematic-ai-landing`
**Created**: 2026-10-13
**Status**: Draft — pendiente de aprobación (no se modifica código hasta aprobar)
**Input**: "Pivotar la oferta de MultiStack Systems hacia Servicios Productizados de IA (chatbots RAG, automatización cero papel) y rediseñar la landing pública como experiencia inmersiva, cinemática y guiada por scroll con fondos de video IA (Image-to-Video), sin romper el Dashboard."
**Base de estado**: `current_state_summary.md` (2026-10-13) + `codegraph impact/callees` re-ejecutados tras `codegraph sync`.

> Estructura Spec Kit: **Parte A = spec.md** (QUÉ y POR QUÉ, agnóstico de tecnología) · **Parte B = plan.md** (CÓMO: contexto técnico, constitution check, estructura, diseño de componentes) · **Parte C = Riesgos** · **Parte D = Clarificaciones**. Se entrega en un único archivo por instrucción explícita; al aprobarse se puede dividir en `spec.md` / `plan.md` / `tasks.md`.

---

# PARTE A — SPEC

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Entender la propuesta de IA en 5 segundos (Priority: P1)

Un dueño/gerente de PyME llega a `/` y, sin hacer scroll, entiende que MultiStack implementa IA que reduce su carga operativa, con una prueba visual de alto nivel (fondo cinemático) y una acción clara.

**Why this priority**: es el pivot de negocio. Sin esto, el resto del rediseño no tiene valor.

**Independent Test**: cargar `/` en móvil 4G simulado; el titular, subtítulo con resultado tangible y CTA primario son visibles y legibles antes de que cargue cualquier video.

**Acceptance Scenarios**:
1. **Given** un visitante nuevo en móvil, **When** la página carga, **Then** ve titular + resultado cuantificado + CTA "Agenda un diagnóstico" en el primer viewport, sobre una imagen poster estática.
2. **Given** conexión rápida y sin preferencia de movimiento reducido, **When** el hero termina de pintar, **Then** el poster transiciona a video en bucle **sin parpadeo ni salto de layout**.
3. **Given** `prefers-reduced-motion: reduce` o `Save-Data`, **When** carga la página, **Then** solo se muestra el poster estático (cero bytes de video descargados).

---

### User Story 2 — Recorrido narrativo por scroll (Priority: P1)

El visitante hace scroll y la página lo guía por 3 escenas: **Hero (IA de alto nivel) → Agente de Atención 24/7 → Automatización Cero Papel (n8n)**. El fondo cambia de escena con transición suave ("steady gimbal") y los textos flotantes aparecen sincronizados.

**Why this priority**: es la experiencia diferencial pedida; comunica los dos servicios productizados principales.

**Independent Test**: scroll lento y rápido de arriba abajo en desktop y móvil; cada escena muestra su fondo y sus 2–3 bloques de texto en orden, sin fondos en negro ni textos ilegibles.

**Acceptance Scenarios**:
1. **Given** el usuario en el hero, **When** hace scroll a la sección "Agente 24/7", **Then** el fondo cambia por fundido cruzado (≤ 600 ms) a la escena del agente y los textos entran escalonados.
2. **Given** una escena en modo *scrub*, **When** el usuario avanza/retrocede el scroll, **Then** el video avanza/retrocede proporcionalmente con suavizado (sin saltos visibles).
3. **Given** scroll muy rápido (flick) hasta el final, **When** se detiene en Contacto, **Then** no quedan videos reproduciéndose fuera de pantalla y la sección se ve con fondo sólido.
4. **Given** un enlace del Navbar desde `/dashboard` (p. ej. "Contacto"), **When** se hace clic, **Then** navega a `/#contacto` y hace scroll al formulario (comportamiento actual preservado).

---

### User Story 3 — Probar un agente de IA en vivo (demo) (Priority: P2)

Un botón flotante (FAB) abre un chat de demostración realista sobre la experiencia cinemática para que el visitante "sienta" el producto.

**Why this priority**: aumenta conversión, pero la landing funciona sin él.

**Independent Test**: abrir el FAB, enviar una pregunta sugerida, ver indicador de escritura y respuesta; cerrar con Esc; foco vuelve al FAB.

**Acceptance Scenarios**:
1. **Given** cualquier punto de la landing, **When** se pulsa el FAB, **Then** se abre un panel de chat con saludo, 3 preguntas sugeridas y la etiqueta visible "Demo — respuestas simuladas".
2. **Given** el chat abierto, **When** el usuario elige una pregunta sugerida, **Then** aparece "escribiendo…" y luego una respuesta guionizada con CTA a `#contacto`.
3. **Given** el chat abierto en móvil, **When** aparece el teclado, **Then** el campo de entrada sigue visible y la página de fondo no hace scroll.
4. **Given** un lector de pantalla, **When** llega una respuesta, **Then** se anuncia (región `aria-live="polite"`).

---

### User Story 4 — Ver y elegir un servicio productizado (Priority: P2)

El visitante ve un catálogo corto de servicios de IA empaquetados (alcance, entregables, plazo) y puede iniciar contacto con el servicio preseleccionado.

**Independent Test**: en `#productos` hay N tarjetas de servicio; el CTA lleva a `#contacto` con el servicio indicado en el mensaje.

**Acceptance Scenarios**:
1. **Given** la sección de servicios, **When** el usuario pulsa "Quiero este servicio" en una tarjeta, **Then** se desplaza a Contacto y el mensaje se prellena con el nombre del servicio.

---

### User Story 5 — El Dashboard y las rutas privadas no cambian (Priority: P1, no-regresión)

Usuarios autenticados usan `/dashboard`, `/dashboard/project/:id`, `/dashboard/tickets`, `/solicitudes`, `/client/:token` exactamente como hoy.

**Independent Test**: suite existente (Vitest + Playwright login) en verde; el tamaño de los chunks del dashboard no crece; navegación por Navbar idéntica.

---

### Edge Cases

- Autoplay bloqueado (iOS modo de bajo consumo, políticas del navegador) → queda el poster; nunca un rectángulo negro ni un botón "play" nativo.
- Video falla al cargar (404/red) → poster permanece; error se ignora silenciosamente (sin toast).
- Pestaña en segundo plano → videos en pausa; al volver, reanudan sin parpadeo.
- Ventana redimensionada / rotación de móvil → el fondo sigue cubriendo 100% (16:9 recortado con `cover`), sin CLS.
- Tema claro activo → las escenas cinemáticas se fuerzan a tokens oscuros (ver Clarificación C-3).
- Usuario entra con hash (`/#contacto`) → salta directo a Contacto; las escenas superiores no descargan video.
- JavaScript lento/fallido → texto del hero visible (no depende de animaciones para ser legible).

## Requirements *(mandatory)*

### Functional Requirements

**Capa 1 — Assets y marca**
- **FR-001**: Todos los assets visuales nuevos de la landing DEBEN vivir bajo `public/assets/` con la estructura definida en Parte B §3.
- **FR-002**: Todo video de fondo DEBE publicarse en `.webm` y `.mp4`, sin pista de audio, relación 16:9, con variante móvil de menor resolución.
- **FR-003**: Toda imagen estática nueva (posters, ilustraciones) DEBE ser `.webp`.
- **FR-004**: Cada escena de video DEBE tener un poster `.webp` que sea el primer frame exacto del video (transición poster→video sin salto visual).
- **FR-005**: Los colores sobre fondos cinemáticos DEBEN derivarse de los tokens MS existentes (`msTokens.ts`) más tokens nuevos de scrim/vidrio, con contraste de texto ≥ 4.5:1 (WCAG AA) medido contra el frame más claro de cada video.

**Capa 2–3 — Fondo cinemático**
- **FR-006**: El sistema DEBE proveer un fondo cinemático reutilizable que reproduzca video 16:9, siempre silenciado, en línea (sin pantalla completa en iOS), sin controles.
- **FR-007**: El fondo DEBE soportar dos modos por escena: **loop** (reproducción continua) y **scrub** (la posición del video sigue el progreso del scroll).
- **FR-008**: El cambio de escena DEBE hacerse por fundido cruzado entre dos capas, revelando la nueva solo cuando su primer frame está decodificado (anti-flicker).
- **FR-009**: El movimiento en modo scrub DEBE suavizarse (interpolación) para emular un "steady gimbal": sin saltos aunque el scroll sea brusco.
- **FR-010**: El fondo DEBE pausar video fuera de pantalla y en pestañas ocultas.
- **FR-011**: Con `prefers-reduced-motion`, `Save-Data` o conexión `2g/slow-2g`, el fondo DEBE mostrar solo posters.
- **FR-012**: El fondo es decorativo: DEBE estar oculto a tecnologías asistivas.

**Capa 4 — Maquetación por scroll**
- **FR-013**: La landing DEBE presentar, en orden: Hero (declaración IA) → Propuesta de Valor (Agente 24/7) → Automatización Cero Papel (n8n) → Catálogo de servicios → Stack/Empresa → Contacto → Footer.
- **FR-014**: Los textos flotantes de cada escena DEBEN aparecer sincronizados con el progreso de scroll de su sección.
- **FR-015**: El copy DEBE orientarse a resultados tangibles y cuantificados (p. ej. "Reduce hasta 70% tu carga operativa"); toda cifra DEBE tener respaldo documentado (ver C-1).
- **FR-016**: Se DEBEN conservar los anchors `#hero`, `#productos`, `#stack`, `#empresa`, `#contacto` (usados por Navbar en 7 páginas) y `#ecosistema` (Footer), o actualizar Footer en el mismo cambio.
- **FR-017**: El titular y CTA del hero DEBEN ser legibles sin depender de que carguen animaciones ni video.

**Capa 5 — Demo de IA**
- **FR-018**: La landing DEBE incluir un FAB que abra una interfaz de chat de demostración construida con primitivas shadcn/ui.
- **FR-019**: La demo DEBE estar claramente rotulada como simulada y NO DEBE enviar datos del usuario a ningún servicio externo en esta fase.
- **FR-020**: El chat DEBE ser accesible: trampa de foco, cierre con Esc, retorno de foco al FAB, mensajes anunciados por `aria-live`.
- **FR-021**: El código del chat DEBE cargarse de forma diferida (no forma parte de la carga inicial).

**No-regresión**
- **FR-022**: Ninguna ruta fuera de `/` puede cambiar comportamiento ni aumentar su JS inicial.
- **FR-023**: La API pública de `Navbar` (sin props) DEBE seguir funcionando para las 6 páginas no-landing que la usan.
- **FR-024**: El formulario de contacto (Supabase `send-contact-email`) DEBE seguir funcionando igual.

### Key Entities

- **CinematicScene**: id, fuentes de video (desktop/móvil × webm/mp4), poster, modo (`loop`|`scrub`), intensidad de scrim, sección asociada.
- **ScrollSection**: id/anchor, escena asociada, bloques de texto flotante (orden, rango de progreso en que aparecen).
- **AiService** (servicio productizado): slug, nombre, resultado prometido, entregables, plazo estimado, estado, CTA.
- **DemoConversation**: guion de intercambios (pregunta sugerida → respuesta), mensajes de UI, estado (`idle`|`typing`|`answered`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: LCP p75 ≤ **2.5 s** en móvil (Lighthouse "Moto G Power / Slow 4G"); el elemento LCP es el titular o el poster, **nunca** un video.
- **SC-002**: CLS ≤ **0.05**; INP ≤ **200 ms** con el chat abierto.
- **SC-003**: **0 bytes de video** descargados antes del evento `load` + idle.
- **SC-004**: JS inicial de `/` crece ≤ **40 KB gzip** vs. `main` actual; JS inicial de `/dashboard` crece **0 KB**.
- **SC-005**: Peso total de video para el recorrido completo ≤ **6 MB** desktop / **3 MB** móvil.
- **SC-006**: 0 parpadeos (frames negros) en QA manual de transiciones en Chrome, Safari iOS y Firefox.
- **SC-007**: Lighthouse Accesibilidad ≥ **95**; contraste AA en todos los textos sobre video.
- **SC-008**: Lint, typecheck, Vitest y Playwright existentes en verde + nuevas pruebas de Parte B §8.

---

# PARTE B — PLAN (implementación)

## 1. Technical Context

| Ítem | Valor |
|---|---|
| Lenguaje / build | TypeScript 5.9, React 18.3, Vite 5 (SWC) — **sin cambios** |
| Routing | React Router 6, `BrowserRouter`; `Index` es import **eager** en `App.tsx` |
| Animación | **framer-motion `^12.42.2` ya está en `package.json` con 0 usos** → **no requiere instalación**. Se usará `LazyMotion` + componentes `m.*` + `useScroll`/`useTransform`/`useSpring`/`useMotionValueEvent` |
| UI | shadcn/ui existentes: `button`, `sheet`, `textarea`, `input`, `tooltip`. A agregar vía `npx shadcn add`: `scroll-area`, `avatar`, `badge` (paquetes Radix ya instalados) |
| Backend | Supabase sin cambios (solo `send-contact-email` existente) |
| Deploy | Vercel (rewrite SPA). Videos servidos como estáticos desde `public/` (ver R-6) |
| Testing | Vitest + Testing Library + jsdom; Playwright |
| Restricción de bundle | Todo lo que importe `Index` va al chunk de entrada, compartido con `/dashboard` → ver §6 |

## 2. Constitution Check

No existe `.specify/memory/constitution.md`. Se aplican los principios ya vigentes en el repo:

| Principio | Cumplimiento |
|---|---|
| No romper Dashboard/auth | ✅ Cambios confinados a `components/marketing/*`, `pages/marketing/Index.tsx`, `lib/` nuevo, `index.css` (clases `.ms-cine-*`). `Navbar` solo recibe un prop opcional |
| Sin URLs ni datos inventados (`products.ts`) | ✅ Demo rotulada "simulada"; cifras de copy requieren respaldo (C-1) |
| Tokens MS aislados del sistema shadcn HSL | ✅ Nuevos tokens se agregan a `MS_DARK`/`MS_LIGHT`, inyectados inline como hoy |
| CI: lint → tsc → test → build | ✅ Sin cambios al pipeline |

### Análisis de impacto (CodeGraph, tras `codegraph sync`)

| Símbolo | `codegraph impact` | Decisión |
|---|---|---|
| `Index` | → `App` (4 símbolos) | Seguro reestructurar internamente |
| `HeroSection` | → `Index` → `App` | Reescritura completa segura |
| `EcosystemPreview` | → `HeroSection` → `Index` | Se retira del hero (se elimina o reubica, ver C-4) |
| `ProductsShowcase` | → `Index` | Sustituible por `AiServicesCatalog` conservando `id="productos"` |
| `Footer` | → `Index` únicamente | Editable (link `#ecosistema`) sin riesgo para dashboard |
| `ContactSplit` | → `Index` | Solo se añade prefill opcional de mensaje |
| **`Navbar`** | **17 símbolos: Dashboard, ProjectDetail, TicketsGlobal, MisSolicitudes, 2 legales, Index** | **NO cambiar comportamiento por defecto.** Solo prop opcional `variant="overlay"` (transparente sobre video). Ítems y anchors intactos |
| **`useMsThemeVars`** | **12 símbolos (dashboard, legales, Navbar)** | **NO modificar su firma.** Nueva función aparte `useCinematicVars()` |
| `PRODUCTS` / `getProduct` / `getTechonHref` | Showcase, Preview, Connect, Hero, ContactSplit, Footer + `products.test.ts` | **No mutar `PRODUCTS`** (tipos `ProductSlug` usados en `Record<>` y tests). Catálogo IA en archivo nuevo `lib/aiServices.ts` |

`codegraph callees App` confirma que las 13 rutas restantes no dependen de ningún componente `marketing/*`.

## 3. Capa 1 — Assets y contexto de marca

### Estructura

```
public/assets/
├── video/
│   ├── hero/            hero.1080.webm  hero.1080.mp4  hero.720.webm  hero.720.mp4
│   ├── agent/           agent.1080.webm … agent.720.mp4           (escena Agente 24/7)
│   └── automation/      automation.1080.webm … automation.720.mp4 (escena n8n)
│       └── *.scrub.*    variante all-intra solo si la escena usa modo scrub
├── posters/             hero.1080.webp  hero.720.webp  agent.*.webp  automation.*.webp
└── images/
    ├── services/        <slug>.webp   (tarjetas del catálogo)
    └── og/              og-ai.1200x630.webp (+ .png para redes que no aceptan webp)
```
- Las imágenes fuente para Image-to-Video y los masters **no** van en `public/` (no se despliegan). Se guardan fuera del repo o en `assets-src/` con `.gitignore`/Git LFS (C-6).
- Nombres: `<escena>.<altura>.<ext>`; sin espacios; rutas centralizadas en `src/lib/cinematicScenes.ts` (nunca hardcodeadas en componentes).

### Especificación de codificación

| Parámetro | Loop | Scrub |
|---|---|---|
| Duración | 6–10 s, bucle sin costura | 4–8 s |
| FPS | 24 | 24 |
| Audio | eliminado (`-an`) | eliminado |
| WebM | VP9 (o AV1), CRF 34–38 | VP9, keyframe cada frame (`-g 1`) |
| MP4 | H.264 High, CRF 24–28, `-movflags +faststart` | H.264, `-g 1` / `-x264-params keyint=1` |
| Presupuesto | ≤ 2 MB @1080 · ≤ 900 KB @720 | ≤ 3 MB @1080 · ≤ 1.5 MB @720 |
| Poster | WebP q≈75, ≤ 120 KB @1080 · ≤ 60 KB @720 | igual |

Orden de `<source>`: `webm` primero, `mp4` como fallback (Safari antiguo). Selección 720/1080 por `matchMedia("(max-width: 768px)")` en JS antes de asignar fuentes.

### Mapeo de tokens MS sobre fondos cinemáticos

Las escenas cinemáticas usan **siempre** la paleta `MS_DARK` (ver C-3). Tokens nuevos, agregados a `MS_DARK` (y espejados en `MS_LIGHT` con los mismos valores para no romper la forma del mapa):

| Token nuevo | Valor | Uso |
|---|---|---|
| `--scrim-strong` | `linear-gradient(180deg, rgba(8,15,30,.20) 0%, rgba(8,15,30,.65) 55%, #080f1e 100%)` | Base de cada escena; funde al `--bg` (#080f1e) en el borde inferior para empalmar con secciones sólidas |
| `--scrim-side` | `linear-gradient(90deg, rgba(8,15,30,.85) 0%, rgba(8,15,30,0) 60%)` | Detrás de columnas de texto a la izquierda |
| `--glass-bg` | `rgba(15,28,53,.55)` (deriva de `--surface` #0f1c35) + `backdrop-filter: blur(14px)` | Tarjetas/textos flotantes |
| `--glass-border` | `rgba(14,165,233,.22)` (deriva de `--primary`) | Borde de tarjetas flotantes |
| `--glow-primary` | `0 0 80px rgba(14,165,233,.35)` | Halo de CTA y FAB |

Reglas: titulares en `--text` (#f0f6ff); cuerpo en `--text2` (#94a3b8) **solo** sobre `--glass-bg` o `--scrim-*`; acentos y eyebrows en `--accent` (#06b6d4); CTA primario `--primary` (#0ea5e9) con texto `--btn-primary-text`. Dirección de arte de los videos: paleta fría azul/cian coherente con `--primary`/`--accent`, alta exposición solo en el tercio derecho (espacio negativo a la izquierda para el copy).

## 4. Capa 2–3 — `CinematicBackground.tsx`

**Ubicación**: `src/components/marketing/cinematic/CinematicBackground.tsx`

```ts
// src/types/cinematic.ts
export type SceneMode = "loop" | "scrub";
export interface SceneSources { webm: string; mp4: string }
export interface CinematicScene {
  id: "hero" | "agent" | "automation";
  mode: SceneMode;
  desktop: SceneSources;
  mobile: SceneSources;
  poster: { desktop: string; mobile: string };
  scrim?: "strong" | "side";
}

// props
interface CinematicBackgroundProps {
  scenes: CinematicScene[];
  activeSceneId: CinematicScene["id"];   // modo keyframe: cambia por sección
  progress?: MotionValue<number>;         // 0..1, requerido si la escena activa es "scrub"
  enabled?: boolean;                      // false → solo posters (reduced motion / save-data)
}
```

**Mecánica**
1. **Capa fija**: `position: fixed; inset: 0; z-index: 0`, contenido por encima con `z-index: 1`. `<video>` con `object-fit: cover` → 16:9 recortado a cualquier viewport sin CLS. `aria-hidden="true"`.
2. **Atributos**: `muted playsInline autoPlay(loop) loop(loop) preload="none" disablePictureInPicture disableRemotePlayback` + `defaultMuted` asignado por ref (iOS ignora `muted` en hidratación de React).
3. **Anti-flicker — doble búfer A/B**: dos `<video>` montados permanentemente. El inactivo recibe las fuentes de la siguiente escena, se espera `loadeddata` + `requestVideoFrameCallback` (fallback: `canplay`), y **solo entonces** se hace crossfade de opacidad (500–600 ms, `ease-out`). Nunca se cambia `src` del video visible. El poster `.webp` vive como `<img>` debajo de ambas capas → si algo falla, se ve el poster, nunca negro.
4. **Modo scrub ("steady gimbal")**: video en pausa; un `useMotionValueEvent(progress)` fija `target = progress × duration`; un bucle `requestAnimationFrame` interpola `current += (target − current) × 0.12` y solo asigna `currentTime` si `|Δ| > 1/24 s`. Usa `fastSeek` si existe. Requiere variante all-intra (§3) para seeks fluidos.
5. **Modo keyframe**: `activeSceneId` lo decide `Index` vía `useInView` de cada sección (umbral 0.5).
6. **Ciclo de vida**: `IntersectionObserver` + `visibilitychange` → `pause()`/`play()`; `play()` siempre con `.catch(() => {})` (autoplay bloqueado → queda poster).
7. **Gating** (`useCinematicEnabled()`): `false` si `prefers-reduced-motion`, `navigator.connection.saveData`, `effectiveType ∈ {slow-2g, 2g}`.
8. **Escala**: solo se cargan fuentes de la escena activa y la siguiente (prefetch) — nunca las 3.

## 5. Capa 4 — Estructura de página y animación por scroll

### Árbol propuesto

```
Index (pages/marketing/Index.tsx)
├─ Navbar variant="overlay"                       ← prop opcional nuevo; default intacto
├─ <div style={cinematicVars}>                     ← MS_DARK + tokens nuevos
│  ├─ CinematicBackground scenes activeSceneId progress
│  ├─ HeroSection            id="hero"           escena: hero (loop)
│  ├─ AgentValueSection      id="agente"         escena: agent (scrub)
│  └─ ZeroPaperSection       id="automatizacion" escena: automation (loop|scrub)
├─ <div style={msVars}> (fondo sólido, theme-aware como hoy)
│  ├─ AiServicesCatalog      id="productos"      ← reemplaza ProductsShowcase
│  ├─ EcosystemConnect       id="ecosistema"     ← se conserva/adapta (C-4)
│  ├─ TechStack              id="stack"
│  ├─ BuiltHonduras          id="empresa"
│  ├─ ContactSplit           id="contacto"       ← + prefill opcional por servicio
│  └─ Footer
└─ AiChatWidgetDemo (lazy, montado tras idle)
```

Archivos nuevos: `components/marketing/cinematic/{CinematicBackground,ScrollScene,FloatingCopy}.tsx`, `components/marketing/{AgentValueSection,ZeroPaperSection,AiServicesCatalog}.tsx`, `lib/{cinematicScenes,aiServices,useCinematicEnabled}.ts`, `types/{cinematic,aiServices}.ts`.

### Patrón de sección (`ScrollScene`)

- Contenedor `height: 200vh` (hero: `140vh`) con hijo `position: sticky; top: 0; height: 100vh`.
- `useScroll({ target: ref, offset: ["start start", "end end"] })` → `scrollYProgress`.
- `useSpring(scrollYProgress, { stiffness: 120, damping: 30 })` → progreso suavizado compartido con `CinematicBackground` (scrub) y `FloatingCopy`.
- `FloatingCopy` recibe `range: [inicio, fin]` y aplica `useTransform` → `opacity` 0→1→0 y `y` 24px→0→−24px. Solo `transform`/`opacity` (compositor, sin layout).
- Móvil (≤ 640px): secciones `100vh` sin sticky largo, textos con `whileInView` simple (menos scroll-jacking percibido).
- Reduced motion: `MotionConfig reducedMotion="user"` + textos visibles estáticamente.

### Copy propuesto (borrador, sujeto a C-1)

| Sección | Eyebrow | Titular | Bajada | CTA |
|---|---|---|---|---|
| Hero | `// inteligencia artificial aplicada` | **Tu operación, en piloto automático.** | Agentes de IA y automatizaciones que reducen hasta un 70% la carga operativa. Implementados en semanas, no en meses. | Agenda un diagnóstico · Probar el agente → |
| Agente 24/7 | `// agente de atención` | **Responde en segundos. A cualquier hora.** | Un agente entrenado con tus documentos (RAG) que atiende el 80% de las consultas repetitivas y escala lo complejo a tu equipo. | Ver demo en vivo |
| Cero Papel | `// automatización n8n` | **Cero papel. Cero recaptura.** | Formularios, facturas y aprobaciones fluyen solos entre tus sistemas. Tu equipo deja de copiar y pegar. | Calcular mi ahorro |
| Catálogo | `// servicios productizados` | **Precio claro. Alcance claro. Entrega en semanas.** | — | Quiero este servicio |

Bloques flotantes por escena: 2–3 métricas tipo "chip" (p. ej. `24/7`, `< 5 s respuesta`, `−70% captura manual`).

### Catálogo IA (`lib/aiServices.ts`, separado de `PRODUCTS`)

```ts
export interface AiService {
  slug: "agente-rag" | "cero-papel" | "integracion-a-medida";   // provisional (C-2)
  name: string; outcome: string; deliverables: string[];
  timeline: string; priceFrom?: string; ctaLabel: string;
}
```

## 6. Estrategia de bundle (crítica para FR-022 / SC-004)

`Index` es import eager en `App.tsx`, por lo que todo lo que importe termina en el chunk de entrada **que también descarga `/dashboard`**. Mitigación:

1. `LazyMotion features={() => import("./motionFeatures").then(m => m.default)}` + `m.*` (≈ 5 KB síncronos; `domAnimation` ≈ 15 KB llega async). Prohibido importar `motion` (no-lazy) en marketing — regla ESLint `no-restricted-imports`.
2. Secciones bajo el hero (`AgentValueSection`, `ZeroPaperSection`, `AiServicesCatalog`) y `AiChatWidgetDemo` vía `React.lazy` → chunks propios.
3. Verificación: comparar `dist/assets/*.js` (`vite build`) antes/después; el chunk de entrada no debe contener `framer-motion` salvo el núcleo `m`/`LazyMotion`.
4. (Alternativa a evaluar si (1) no alcanza: convertir `Index` en lazy — penaliza LCP de `/` con un round-trip extra, por eso no es la opción por defecto.)

## 7. Capa 5 — `AiChatWidgetDemo.tsx`

**Ubicación**: `src/components/marketing/ai-demo/` → `AiChatWidgetDemo.tsx`, `ChatMessage.tsx`, `demoScript.ts`.

| Elemento | Implementación |
|---|---|
| FAB | `Button` shadcn, `size="icon"`, 56px, `position: fixed; bottom: 24px; right: 24px; z-index: 40` (debajo de Toaster/Sonner), `--glow-primary`, `Tooltip` "Prueba nuestro agente", `aria-label`, `aria-expanded` |
| Panel | `Sheet` shadcn (`side="right"` ≥ 768px, `side="bottom"` móvil, altura 85dvh). Radix aporta trampa de foco, Esc y retorno de foco |
| Encabezado | `Avatar` + nombre del agente + `Badge` "Demo — respuestas simuladas" + estado "en línea" |
| Mensajes | `ScrollArea` con `role="log" aria-live="polite"`; burbujas usuario/agente; auto-scroll al último |
| Entrada | `Textarea` autoexpandible (Enter envía, Shift+Enter salto) + `Button` enviar; chips de preguntas sugeridas |
| Lógica | Máquina de estados `idle → typing (700–1400 ms) → answered`; `demoScript.ts` mapea intención (palabras clave) → respuesta; fallback genérico con CTA a `#contacto` |
| Estética | Panel con `--glass-bg` + blur sobre el video; tokens MS dark |
| Carga | `React.lazy` + montaje en `requestIdleCallback` o primer hover/focus del FAB (el FAB en sí es ligero y síncrono) |
| Privacidad | Sin red, sin almacenamiento; nada sale del navegador (FR-019) |
| Fase 2 (fuera de alcance) | Respuestas reales vía Supabase Edge Function proxy → proveedor LLM/RAG; la API key nunca en el cliente |

## 8. Plan de pruebas

- **Vitest**: `useCinematicEnabled` (reduced-motion / saveData → false); `CinematicBackground` con `enabled=false` renderiza solo posters y ningún `<source>`; crossfade no cambia `src` del video activo; `AiChatWidgetDemo` abre/cierra, Esc, respuesta guionizada y `aria-live`; `aiServices` sin URLs inventadas; `products.test.ts` intacto.
- **Playwright**: `/` carga y muestra el titular; navegación Navbar desde `/dashboard` (mock auth) a `/#contacto`; FAB abre chat; emulación `reducedMotion: "reduce"` → 0 peticiones `.webm/.mp4`; `login.spec.ts` existente en verde.
- **Manual / Lighthouse**: SC-001…SC-007 en Chrome móvil emulado, Safari iOS real, Firefox.

## 9. Fases de entrega (para `tasks.md`)

1. **F0** — Tokens nuevos, `cinematicScenes.ts`, `useCinematicEnabled`, estructura `public/assets/` con posters placeholder.
2. **F1** — `CinematicBackground` (loop + doble búfer) + Hero nuevo. *Checkpoint LCP.*
3. **F2** — `ScrollScene`/`FloatingCopy` + secciones Agente y Cero Papel + modo scrub.
4. **F3** — `AiServicesCatalog` + prefill de Contacto + `Navbar variant="overlay"`.
5. **F4** — `AiChatWidgetDemo`.
6. **F5** — Pruebas, auditoría de bundle, Lighthouse, metadatos SEO/OG del pivot en `index.html`.

---

# PARTE C — RIESGOS Y MITIGACIONES

| ID | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| **R-1** | **Videos degradan LCP** de `/` | Alta | Alto | Ver estrategia detallada abajo |
| R-2 | framer-motion entra al chunk de entrada y engorda `/dashboard` | Alta | Medio | §6: `LazyMotion` async + `m.*` + lazy de secciones + regla ESLint + diff de `dist/` en revisión |
| R-3 | Scrub entrecortado (seeks lentos, sobre todo en Safari/Firefox) | Media | Medio | Encodes all-intra solo para escenas scrub; interpolación rAF; si una escena no pasa QA, degradar a `loop` por config (sin cambiar código) |
| R-4 | Autoplay bloqueado (iOS bajo consumo, políticas) | Media | Bajo | Poster siempre debajo; `play().catch()`; nunca controles nativos |
| R-5 | Texto ilegible sobre frames claros del video IA | Media | Alto | Scrims obligatorios, `--glass-bg` detrás del cuerpo, verificación de contraste contra el frame más claro (SC-007); dirección de arte con espacio negativo oscuro |
| R-6 | Ancho de banda/costos de Vercel por videos estáticos | Media | Medio | Presupuestos SC-005, `Cache-Control: public, max-age=31536000, immutable` en `vercel.json` para `/assets/*` con nombres versionados; evaluar CDN/Blob si el tráfico crece (C-6) |
| R-7 | Romper anchors del Navbar compartido (7 páginas) | Baja | Alto | FR-016 + test e2e de navegación; `Navbar` solo prop opcional |
| R-8 | Claims de copy ("70%") sin sustento → riesgo legal/reputacional | Media | Alto | Usar "hasta", documentar fuente/caso por cifra antes de publicar (C-1) |
| R-9 | Mareo/accesibilidad por movimiento | Baja | Medio | `prefers-reduced-motion` → posters estáticos y textos sin animación; scroll nativo (sin scroll-jacking) |
| R-10 | Artefactos de video IA (deformaciones, inconsistencia de marca) | Media | Medio | Revisión de arte por escena antes de exportar; tomas con movimiento de cámara lento ("gimbal"), sin personas/texto generado |
| R-11 | SEO: `index.html` sigue describiendo la oferta anterior | Alta | Medio | Actualizar `title`, `description`, OG, JSON-LD en F5 |
| R-12 | El `<video>` se vuelve el candidato LCP | Media | Alto | El poster `<img>` a pantalla completa se pinta temprano con el mismo tamaño que el video; LCP solo se reemplaza por un elemento **mayor**, así que el video revelado después no lo desplaza. Verificar en el panel Performance de DevTools durante F1 |

### R-1 en detalle — Carga inicial de video vs. LCP

1. **El LCP nunca es un video.** El candidato LCP es el `h1` del hero (texto en el HTML renderizado por el bundle de entrada) o el poster `.webp`.
2. **Poster prioritario**: `<link rel="preload" as="image" type="image/webp" href="/assets/posters/hero.1080.webp" imagesrcset="…720.webp 1280w, …1080.webp 1920w" fetchpriority="high">` en `index.html`; `<img fetchpriority="high" decoding="async">` con `width/height` explícitos → 0 CLS.
3. **Video diferido**: `preload="none"` y **sin** `src` en el HTML inicial. Las fuentes se asignan por JS solo cuando (a) ocurrió `window.load`, (b) `requestIdleCallback` (fallback 1.5 s) y (c) `useCinematicEnabled()` es `true`. Se cumple SC-003.
4. **Solo lo necesario**: escena activa + siguiente; variante 720p en móvil; las escenas inferiores se cargan cuando su sección está a ≤ 1 viewport (`IntersectionObserver rootMargin: "100% 0px"`).
5. **Revelado sin parpadeo**: el video arranca en `opacity: 0` y se funde sobre el poster solo tras `requestVideoFrameCallback` (primer frame pintado).
6. **Red lenta**: `saveData`/`2g` → nunca se cargan videos.
7. **`+faststart` en MP4** para que el primer frame llegue sin descargar el archivo completo.
8. **Medición**: Lighthouse móvil en CI local y `web-vitals` (opcional) para LCP/CLS/INP reales tras el deploy; umbral de aceptación SC-001.

---

# PARTE D — [NEEDS CLARIFICATION]

| ID | Pregunta | Propuesta por defecto |
|---|---|---|
| **C-1** | ¿Qué respaldo existe para "70% menos carga operativa", "80% de consultas", etc.? | Usar "hasta X%" y solo cifras con caso/fuente documentada; si no hay, copy cualitativo |
| **C-2** | Catálogo final de servicios productizados: nombres, paquetes, ¿se publica precio "desde"? | 3 servicios: Agente RAG, Cero Papel (n8n), Integración a medida; sin precio hasta confirmar |
| **C-3** | ¿Las escenas cinemáticas ignoran el tema claro (siempre dark) o se diseña variante clara? | Siempre dark en escenas cinemáticas; secciones sólidas siguen el tema |
| **C-4** | ¿Qué pasa con TechOn / Licensing / Development / WhatsApp en la landing? ¿Se retiran `EcosystemPreview`/`ProductsShowcase`? | Mover el ecosistema actual a `EcosystemConnect` (`#ecosistema`) como sección secundaria; retirar `EcosystemPreview` del hero; TechOn sigue como acceso de clientes en el Navbar |
| **C-5** | ¿Quién produce los videos Image-to-Video y con qué herramienta? ¿Hay imágenes base de marca? | El equipo entrega masters 1080p 16:9; el pipeline de encode (ffmpeg) se documenta en F0 |
| **C-6** | ¿Dónde se versionan los masters y si los videos van en `public/` o en un CDN/Blob? | `public/assets/` para el lanzamiento; masters fuera del repo |
| **C-7** | ¿La demo del chat debe evolucionar a un agente real (Fase 2) y con qué proveedor? | Fuera de alcance; diseñado para enchufar una Edge Function |
| **C-8** | ¿Qué hacemos con los cambios WIP sin commit en `HeroSection`/`EcosystemPreview`/`index.css`? | Commitear o guardar en un stash/rama antes de F1, ya que el Hero se reescribe |

---

# PARTE E — Registro de implementación

## F0 + F1 (2026-10-13) — Aprobado C-1…C-8

Entregado: `public/assets/` (estructura + posters placeholder generados con `npm run assets:placeholders`), `types/cinematic.ts`, `lib/cinematicScenes.ts`, `MS_CINEMATIC` + `CINEMATIC_VARS` en `msTokens.ts`, `hooks/useCinematicEnabled.ts`, `CinematicBackground.tsx` (A/B), nuevo `HeroSection.tsx`, preload del poster en `index.html` (solo `/`), `EcosystemPreview.tsx` retirado (C-4), `src/test/cinematic.test.tsx`.

Desviaciones respecto del plan (justificadas):
- **Capa fija → stage `absolute` + pin `sticky`** (`.ms-cine-stage` / `.ms-cine-stage-pin`). Un `position: fixed` (o sticky con margen negativo) cubría las secciones sólidas inferiores; así el fondo queda acotado a las escenas cinemáticas.
- **Tokens con prefijo `cine-`** (`--cine-scrim`, `--cine-glass-*`, `--cine-glow`) en un mapa aparte `MS_CINEMATIC`, en vez de agregarlos a `MS_DARK`/`MS_LIGHT`: `--glass-bg` y `--glow-primary` ya existían con otro valor/uso. `useMsThemeVars` intacto.
- **Flag `videoReady` por escena**: mientras sea `false` no se solicita ningún video (sin 404). Activarlo al colocar los 4 archivos de la escena.
- **Fundido sin bajón de brillo**: la capa entrante aparece encima (0→1) mientras la saliente permanece opaca debajo.
- `DevSceneSwitcher` (solo `import.meta.env.DEV`, eliminado del build de producción) para revisar el A/B antes de F2. Retirar en F2.

Mediciones: chunk de entrada `index-*.js` 26.16 → 27.36 KB gzip (+1.2 KB; SC-004 ≤ 40 KB). 0 solicitudes de video con `videoReady=false` y con reduced motion. Sin dependencias nuevas.

Pendiente para F2: modo `scrub`, `activeSceneId` derivado del scroll, Navbar `variant="overlay"` (hoy en tema claro el Navbar es claro sobre el hero oscuro).

## F2 + F3 (2026-10-13)

Entregado:
- **F2**: `ScrollScene` (sección alta + panel sticky, progreso `useScroll` → `useSpring` 120/30), `FloatingCopy` (opacity + y sincronizados al progreso; modo propio por viewport en layouts apilados; estático con reduced motion), `AgentValueSection` (`#agente`, escena `agent` en modo scrub) y `ZeroPaperSection` (`#automatizacion`, escena `automation`), `CinematicChapters` (único punto de entrada a framer-motion: `React.lazy` + `<LazyMotion strict>` con `domAnimation` asíncrono). Modo scrub en `CinematicBackground`: video en pausa, `currentTime` = progreso suavizado × duración, umbral de 1 frame y sin encolar seeks. `useActiveScene` (IntersectionObserver en la línea media del viewport) reemplaza al `DevSceneSwitcher` (eliminado).
- **F3**: `AiServicesCatalog` (`#productos`, 3 servicios de `lib/aiServices.ts`, sin precios) reemplaza `ProductsShowcase` + `ProductPreview` (eliminados). Prefill de contacto vía prop `prefill {text, nonce}` (Index → ContactSplit → ContactForm), usado por el catálogo y por los CTA de los capítulos; el foco queda en el email. `Navbar variant="overlay"` (solo landing): vidrio oscuro + tokens dark + logo blanco (`Logo tone="light"`) mientras `[data-nav-overlay]` está bajo la barra; el toggle de tema conserva el estado real. Default sin cambios en las otras 6 páginas.
- Regla ESLint `no-restricted-imports`: prohibido importar `motion` de framer-motion (solo `m` + LazyMotion).

Decisiones:
- Layout apilado (sin sticky) en `max-width: 1023px` **o** `max-height: 620px`, no solo en móvil: en tablets y pantallas bajas el panel de 100vh recortaba contenido.
- Suspense con placeholder de alto equivalente (`.ms-chapters-placeholder`) + re-scroll al hash cuando montan los capítulos.
- CTA de "Cero Papel" es "Quiero automatizar mis procesos" (no "Calcular mi ahorro": no existe calculadora).

Mediciones: entrada `index-*.js` 27.97 KB gzip (+0.6 KB vs F1; +1.8 KB vs base); framer-motion solo en `CinematicChapters` (25.5 KB gzip) + `motionFeatures` (9.3 KB gzip), ambos lazy. Rutas no-landing: 0 solicitudes cinemáticas.

Pendiente: F4 (`AiChatWidgetDemo`), F5 (Lighthouse, SEO/OG del pivot). QA de scrub con videos reales (all-intra).

## Ajustes F2/F3 + F4 + F5 (2026-10-13)

- **Navbar**: etiqueta "Productos" → "Servicios". Los anchors de la landing viven en la constante `MARKETING_SECTIONS`, que solo se renderiza con `isHome`; el menú de dashboard/cliente/legales no cambia. Plazos del catálogo confirmados. Commit `315b87b`.
- **F4 — `AiChatWidgetDemo`** (`components/marketing/ai-demo/`):
  - `AiChatLauncher` (eager, mínimo): FAB + etiqueta solo-CSS. El panel (`React.lazy`) se monta con lo primero de: `load` + `requestIdleCallback`, primera intención (pointerenter/focus/touchstart sobre el FAB o el CTA "Probar el agente" del hero) o clic. Medido en navegador: el chunk se solicita **después** del evento `load`.
  - `chatMachine.ts` (reducer idle ⇄ typing, un turno a la vez) + `demoScript.ts` (intenciones sin acentos/mayúsculas, retardo 700–1400 ms). Sin red ni almacenamiento.
  - shadcn: `Sheet` (derecha en desktop / bottom 85dvh en móvil; se añadieron props opcionales `overlayClassName` y `closeLabel`, compatibles con los 4 usos del dashboard), `ScrollArea`, `Avatar`, `Badge` (nuevos, código canónico shadcn), `Button`, `Textarea`.
  - a11y: trampa de foco y Esc (Radix), `role="log"` + `aria-live="polite"`, foco devuelto al disparador (sin `SheetTrigger`, Radix no sabe a quién devolverlo), CTA "Agenda un diagnóstico" → cierra y prellena el contacto con el foco en el email.
  - Tema: clase `dark` en el panel (tokens HSL shadcn). **No** se aplican tokens MS en el portal: `--primary` hex rompía `hsl(var(--primary))` (botones invisibles); el CSS propio usa `--chat-*`.
  - Bundle: Radix ScrollArea/Avatar (+ `use-is-hydrated`, `number`) excluidos de `vendor-ui` en `vite.config.ts` para que viajen en el chunk lazy; el Radix Tooltip del FAB se reemplazó por CSS porque arrastraba código a `vendor-ui` (compartido con /dashboard).
- **F5 — SEO**: `title`, `description`, `keywords`, Open Graph y Twitter orientados a "Servicios Productizados de IA y Automatización B2B"; imagen OG 1200×630 (`npm run assets:og`, PNG + WebP) en `public/assets/images/og/`; JSON-LD con `slogan`, `knowsAbout` actualizado y `hasOfferCatalog` (3 servicios, sin precios); `site.webmanifest` y `lastmod` del sitemap actualizados.

Mediciones: entrada 28.37 KB gzip (+0.40 KB vs F3: FAB + wrapper lazy); `vendor-ui` 37.56 KB (+0.03 KB); chat en chunk lazy de 8.06 KB gzip.

Pendiente: QA de scrub con videos reales; Lighthouse sobre build de producción desplegado (SC-001…SC-007); regenerar la imagen OG cuando exista el poster definitivo del hero.

## Auditoría Navbar (2026-10-13)

Hallazgos (medidos con Playwright antes del cambio): (1) hamburguesa visible en desktop — el `display:flex` inline anulaba `md:hidden`; (2) breakpoint `md` → a 800px la barra desbordaba 133px; (3) `offsetTop - 60` dejaba las secciones 12px bajo la barra de 72px; (4) panel móvil sin semántica de diálogo; (5) sin estado activo.

Cambios: enlaces y auth desktop desde `lg` (1024px), debajo solo hamburguesa; drawer con shadcn `Sheet` (`MobileNavDrawer`, lazy al primer hover/focus/touch del botón para no sumar react-remove-scroll al chunk de entrada), cierre automático al elegir enlace, cierre al crecer a desktop, foco devuelto al botón; `useScrollSpy` (línea al 40% del viewport) → `aria-current="location"` en desktop y drawer; hover con subrayado `scaleX` (sin layout shift) y `transition-colors duration-200`; navegación por rect (`top − 72`); overlay solo si `variant="overlay"` **y** ruta `/`. Entrada +0.66 KB gzip.

## Pivote: video → secuencia de imágenes (2026-10-13)

Se descarta `<video>` (.webm/.mp4) por rendimiento y memoria. **Sustituye** a FR-002/FR-004/FR-006/FR-007 y a la estructura `public/assets/video|posters`.

- **Tipos**: `CinematicScene.images: SceneImage[]` (`{ desktop, mobile }` = 1920w/1280w, srcset compartido), sin `video`/`poster`/`videoReady`. `ScrubSource = MotionValue<number>` (type-only).
- **Assets**: `public/assets/scenes/<escena>/<escena>-NN.<1080|720>.webp`, 3 frames por escena. Placeholders procedurales (`npm run assets:placeholders`): red neuronal (hero), anillos de señal + forma de onda (agent), tuberías de flujo (automation). 18 archivos, 193 KB.
- **Arquitectura** (restricción de bundle): `CinematicBackground` (entrada, sin framer-motion) mantiene el A/B, el gating y la pausa, y pinta el **primer frame estático** (LCP, y experiencia completa con reduced motion / Save-Data). La animación vive en `AnimatedSequence` (lazy, `LazyMotion strict` + `m.img`), que comparte el chunk de framer-motion con `CinematicChapters` → /dashboard paga 0.
  - **loop**: slideshow con doble búfer interno (el frame saliente queda opaco debajo; el siguiente se pre-decodifica con `img.decode()` antes del fundido de 1.4 s) + **Ken Burns** por frame (escala 1→1.06 y paneo sutil, `transform` en string → WAAPI/compositor). Avanza solo con la escena visible y la pestaña activa.
  - **scrub**: el progreso suavizado (spring de `ScrollScene`) controla un fundido **acumulativo** entre frames (sin bajón de brillo) + **parallax Y** (±2.5 %, escala 1.08).
- **Medido en navegador**: Ken Burns continuo, cambio a `hero-02` a ~8 s, scrub 1/0.82/0 → 1/1/1 con parallax +4 → −22 px; reduced motion = 1 frame y 1 request. Entrada 29.41 KB gzip (−0.58 KB al quitar el código de video); `AnimatedSequence` 1.24 KB.

## Secuencias por tema claro/oscuro (2026-10-13)

**Sustituye a C-3** ("escenas siempre oscuras"): cada escena sigue el tema activo — imágenes, scrims y tokens de texto cambian juntos.

- **Tipos/rutas**: `CinematicScene.imagesLight: string[]` / `imagesDark: string[]` → `/assets/scenes/<escena>/<escena>-<light|dark>-<n>.webp` (1920×1080, mismo nº de frames por tema). `sceneImages(scene, theme)` = `currentImages`.
- **Tema**: `useCinematicTheme()` sobre `next-themes` (`resolvedTheme`, síncrono desde localStorage en el primer render → sin swap oscuro→claro ni doble descarga). Preload LCP en `index.html` elige `hero-<tema>-1.webp` con la misma regla que el script de tema.
- **Cambio de tema sin parpadeo**: el doble búfer A/B se indexa por **escena + tema**. El tema nuevo se decodifica en la capa oculta y entra con fundido de **0.8 s**; la saliente queda opaca debajo y **mantiene su secuencia montada** (corrige además un salto al frame 1 en los cambios de escena). Cada capa lleva **sus propios scrims y tokens**, así imagen y scrim se funden juntos; los colores de texto/vidrio transicionan 0.8 s a la par. La capa solo se declara lista tras dos `requestAnimationFrame` (garantiza que el estado opacity 0 se pintó → el fundido corre siempre, aunque el frame venga de caché). Retoma el **mismo índice de frame** (mismo plano, otra iluminación).
  - El fundido lo hace la capa A/B en CSS (chunk de entrada) y no framer-motion: así funciona también sin la capa animada (reduced motion, antes de idle, Save-Data) y framer-motion sigue fuera de /dashboard. framer-motion mantiene Ken Burns y scrub dentro de cada capa.
- **Precarga silenciosa**: tras `load` + idle (no con Save-Data) se precarga el frame del tema opuesto del plano en pantalla (`lib/preloadImage.ts`, deduplicado).
- **Tokens**: `MS_CINEMATIC_DARK` / `MS_CINEMATIC_LIGHT` (+ `cinematicVars(theme)`); en claro `--primary #0369a1`, `--accent #0e7490`, `--muted #64748b`; en oscuro `--muted #7d8ca1`. Navbar overlay usa el vidrio y logo del tema de la escena.
- **Auditoría AA** (`npm run audit:contrast`, servidor dev arriba): mide cada línea de texto contra los píxeles reales del fondo (texto oculto, percentil 5) por tema × viewport × escena × frame. Resultado con placeholders: **190/190 pass** (612 mediciones); encontró y se corrigió `--muted` en tarjetas de vidrio oscuras (3.57:1 → 4.97:1). **Re-ejecutar al colocar el arte final de Higgsfield.**
