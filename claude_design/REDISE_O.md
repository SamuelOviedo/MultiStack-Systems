# MultiStack Systems — Spec de Rediseño

Documento técnico para el dev. La paleta antigua (terminal verde) se reemplaza por una dirección **"professional dark tech"** estilo Vercel / Linear / Supabase: navy profundo, primario sky-blue, accent cyan, sin verde fuera de `success`.

Archivos que acompañan este spec:
- `globals.css` — listo para reemplazar tu `src/index.css` actual.
- `tailwind.config.snippet.ts` — extras a mergear con `tailwind.config.ts`.

---

## 1. Sistema de color

### Variables CSS (HSL, formato shadcn)

Ya están en `globals.css`. Resumen para diseñador:

| Token              | HSL                  | Hex       | Uso                                        |
| ------------------ | -------------------- | --------- | ------------------------------------------ |
| `--background`     | `222 43% 7%`         | `#080F1E` | Body, surfaces full-bleed                  |
| `--card`           | `218 56% 14%`        | `#0F1C35` | Cards, list rows, popovers, modals         |
| `--foreground`     | `216 100% 97%`       | `#F0F6FF` | Headings, texto principal                  |
| `--body-foreground`| `215 20% 65%`        | `#94A3B8` | **Párrafos** (slate-400, line-height 1.7)  |
| `--muted-foreground`| `215 16% 47%`       | `#64748B` | Metadatos, labels, chrome de tabla         |
| `--border`         | `213 52% 24%`        | `#1E3A5F` | 1px solid, sin glow                        |
| `--primary`        | `199 89% 48%`        | `#0EA5E9` | CTA principal, focus ring, badges activos  |
| `--accent`         | `187 92% 43%`        | `#06B6D4` | Eyebrows, CTA secundario, status info      |
| `--success`        | `158 84% 39%`        | `#10B981` | "activo", "resuelto", online               |
| `--warning`        | `38 92% 50%`         | `#F59E0B` | "pendiente", renovaciones, prioridad media |
| `--destructive`    | `0 84% 60%`          | `#EF4444` | "cancelado", errores, delete               |
| `--info`           | `199 89% 48%`        | `#0EA5E9` | "en_desarrollo", info banners (= primary)  |

### Tints & alphas (para hover/bg sutiles)

- **Primary tints:** `bg-primary/8` (subtle hover), `bg-primary/15` (active hover, bg de pill activo), `bg-primary/25` (pressed/selected).
- **Accent tints:** `bg-accent/8`, `bg-accent/15` para highlights sutiles.
- **Status pill backgrounds:** SIEMPRE el color base @ 12% — `bg-[hsl(var(--success))]/12`, etc.
- **Modal overlay:** `bg-background/80 backdrop-blur-sm` — NUNCA `bg-black/70` (rompe la temperatura del tema).

---

## 2. Tipografía

### Font families

```css
font-sans:    'Inter', system-ui, sans-serif        → body, labels
font-display: 'Space Grotesk', system-ui, sans-serif → h1-h4, eyebrows
font-mono:    'JetBrains Mono', monospace            → code, IDs, bracket buttons, status pills
```

### Escala

| Token / clase         | Tamaño               | Weight | Line-height | Tracking | Color                        | Uso                              |
| --------------------- | -------------------- | ------ | ----------- | -------- | ---------------------------- | -------------------------------- |
| `h1` / `text-5xl`     | 36–60px (clamp)      | 600    | 1.05        | -0.02em  | `foreground`                 | Hero, page titles                |
| `h2` / `text-3xl`     | 28–36px              | 600    | 1.10        | -0.02em  | `foreground`                 | Section headings                 |
| `h3` / `text-xl`      | 20px                 | 600    | 1.20        | -0.01em  | `foreground`                 | Card titles, modal headings      |
| `h4` / `text-sm`      | 14px                 | 600    | 1.30        | normal   | `foreground`                 | Sub-card titles                  |
| `p` / body            | 15px                 | 400    | 1.70        | normal   | `body-foreground` `#94A3B8`  | Párrafos (NO `muted-foreground`) |
| `text-xs` label       | 12px                 | 500    | 1.4         | normal   | `muted-foreground` `#64748B` | Field labels, metadatos          |
| `.eyebrow`            | 12px Space Grotesk   | 600    | 1.0         | 0.08em   | `accent` `#06B6D4`           | Section label encima de heading  |
| `.bracket` / `.font-mono` xs | 12px JetBrains Mono | 500 | 1.0     | 0.02em   | varía                        | `[ LOGIN ]`, IDs, status keys    |

### Reglas

- **Body copy va en `body-foreground` (#94A3B8), NO en `muted-foreground`.** El primero es el slate-400 legible para párrafos largos; el segundo es slate-500 reservado para chrome (labels, separadores, fechas).
- **Mono solo para:** código, IDs (`#proj-007`), status keys (`en_desarrollo`), CLI-chrome (`[ NUEVO ]`, `$ multistack login`), timestamps. **Nunca** para nav links, marketing prose, o párrafos.
- **Eyebrows ya no son terminales.** Antes: `>_ what.we.build`. Ahora: `LO QUE CONSTRUIMOS` (Space Grotesk uppercase, sin prompts ni símbolos).

---

## 3. Componentes clave

### 3.1 Botones

Tres variantes principales — **NO usar pill / `rounded-full`** para botones.

#### Primary (lead CTA)
```
bg-primary text-primary-foreground rounded-md px-4 h-10 font-display text-sm font-medium
hover: bg-primary/90 + box-shadow var(--glow-primary)
focus: glow-focus
```
- Sentence-case en español: "Nuevo proyecto", "Crear proyecto", "Iniciar sesión".
- **Una sola por viewport** (la acción principal).
- Sin brackets, sin monospace.

#### Secondary (bracketed)
```
bg-transparent text-[#94A3B8] border border-border rounded-md px-4 h-10 font-mono text-xs uppercase
hover: text-foreground border-[#2D4F7E] bg-primary/5
```
- Estilo bracketed: `[ LOGIN ]`, `[ CANCELAR ]`, `[ DASHBOARD ]`. Con underscores para acciones tipo comando: `[ MARCAR_COMPLETADA ]`.
- Lee como "comando" silencioso al lado del primary.

#### Ghost (inline en cards/toolbars)
```
bg-transparent text-muted-foreground rounded-md px-3 h-9 font-mono text-xs
hover: text-foreground bg-foreground/5
```

#### Tamaños
- `sm` h-8 px-3 text-xs
- `md` h-10 px-4 text-sm (default)
- `lg` h-12 px-6 text-base (hero CTA)

#### Destructive
`bg-destructive text-destructive-foreground` — solo para confirmar acciones permanentes (eliminar proyecto/cuenta).

---

### 3.2 Cards

```
rounded-lg border border-border bg-card p-5
hover (si es interactiva): border-primary/40 + translate-y-[-2px] transition-all
```

- **Sin glow ambiental por defecto.** El border 1px solid + el lift en hover bastan.
- Padding interno: `p-5` (20px) o `p-6` (24px).
- Para cards en grid: `gap-4` entre cards.
- **NO** internal dividers — usa spacing.
- Headings dentro: `font-display text-sm font-semibold text-foreground`.

---

### 3.3 Badges de estado

Patrón único basado en color base + 12% fill + 1px border del mismo color:

```
inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5
font-mono text-[10px] font-medium uppercase tracking-wider
```

| Estado            | Color base       | Clase ejemplo                                                      |
| ----------------- | ---------------- | ------------------------------------------------------------------ |
| `activo`          | success #10B981  | `text-success border-success bg-success/12`                        |
| `en_desarrollo`   | primary #0EA5E9  | `text-primary border-primary bg-primary/12`                        |
| `en_analisis`     | accent  #06B6D4  | `text-accent border-accent bg-accent/12`                           |
| `en_despliegue`   | accent  #06B6D4  | `text-accent border-accent bg-accent/12`                           |
| `mantenimiento`   | warning #F59E0B  | `text-warning border-warning bg-warning/12`                        |
| `pausado`         | muted   #64748B  | `text-muted-foreground border-muted bg-muted/30`                   |
| `cancelado`       | destructive      | `text-destructive border-destructive bg-destructive/12`            |

Resumen: 7 estados → mapeados a 5 colores semánticos. Mantén el mismo formato (uppercase, mono, sm radius, border + 12% fill) para que el ojo los lea como una familia.

---

### 3.4 Tabs

```
container: flex gap-1 border-b border-border
tab: px-4 py-3 font-display text-sm text-muted-foreground border-b-2 border-transparent
tab[active]: text-primary border-b-2 border-primary
tab:hover: text-foreground
```

- Iconos a la izquierda del label, `gap-2`, tamaño `w-4 h-4` con `currentColor`.
- Contenido del tab debajo con `pt-6`.

---

### 3.5 Inputs

```
flex h-10 w-full rounded-md border border-border bg-background px-3 py-2
font-sans text-sm text-foreground
placeholder: text-muted-foreground
focus: outline-none border-primary box-shadow var(--glow-focus)
```

- **Labels arriba**, no flotantes: `block text-xs font-medium text-muted-foreground mb-1.5`.
- Helper text debajo: `mt-1.5 text-xs text-muted-foreground`.
- Error: borde y helper en `text-destructive`.

---

### 3.6 Modal / Dialog

```
overlay: fixed inset-0 z-50 bg-background/80 backdrop-blur-sm
content:  rounded-xl border border-border bg-card overflow-hidden max-w-lg w-full
header:   px-5 py-4 border-b border-border (h3 + close button)
body:     p-5 space-y-4
footer:   p-5 pt-0 flex justify-end gap-2
```

- Radius **xl (16px)** — un pelo más grande que cards para diferenciar jerarquía.
- Cancel button = secondary bracketed; submit = primary solid.

---

### 3.7 Iconografía

- **Lucide icons** únicamente. Stroke-width 2, tamaño 14–20px.
- Color heredado del padre con `currentColor`.
- Iconos en chrome (nav, tabs, badges) usan `text-muted-foreground` o `text-primary` activo.
- **NO** SVG inventados ni mezclar con Heroicons/Phosphor.

---

## 4. Layout & spacing

- **Container:** `container mx-auto px-6` (padding 24px en mobile, ya `2rem` en config).
- **Sección vertical entre bloques mayores:** `py-12` o `py-16`.
- **Gap entre cards:** `gap-4` (16px).
- **Gap entre filas de form:** `space-y-4`.
- **Padding interno de card:** `p-5` o `p-6`.
- **Page width útil:** `max-w-6xl` para dashboards, `max-w-2xl` para formularios largos.

---

## 5. Pantallas — wireframes textuales

### 5.1 Dashboard (admin / team)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Logo MultiStack]            [Proyectos] [Equipo] [Config]   [user@···]  │ ← Navbar fixed top, bg-background/60 backdrop-blur-md, border-b border-border
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Dashboard                                          [+ Nuevo proyecto]   │ ← h1 + primary CTA a la derecha
│  Resumen de actividad y proyectos en curso.                              │ ← p body-foreground
│                                                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                         │
│  │ Activos │ │ En dev  │ │ Tickets │ │ MRR     │                         │ ← StatCard grid: 4 cols, gap-4
│  │   12    │ │    7    │ │    3    │ │ $4,820  │                         │
│  │ +2 este │ │ 3 review│ │ urgente │ │ +12% mo │                         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                         │
│                                                                          │
│  Renovaciones próximas                                                   │ ← h2, only if items > 0
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ⚠ 3 servicios vencen en los próximos 30 días                     │   │ ← warning callout
│  │   • Hosting Vercel  · Cooperativa Sagrada  · vence Mar 15        │   │
│  │   • Dominio .com    · Restaurante La Tinaja · vence Mar 22       │   │
│  │   • SSL wildcard    · Portal Municipal      · vence Abr 04       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Proyectos                                                  [Filtrar ▾]  │ ← h2 + filter chip
│  ┌────────────────────────────┐ ┌────────────────────────────┐          │
│  │ Cooperativa Sagrada        │ │ Portal Municipal           │          │
│  │ #proj-007 · cliente Soc.   │ │ #proj-006 · Alcaldía SH    │          │ ← ProjectCard grid: 2-3 cols
│  │                            │ │                            │          │
│  │ Auth + módulo de socios... │ │ Trámites en línea para...  │          │
│  │                            │ │                            │          │
│  │ [ACTIVO]            72%    │ │ [EN_DESARROLLO]    34%     │          │ ← badge + % progreso
│  │ ▰▰▰▰▰▰▰▱▱▱                 │ │ ▰▰▰▰▱▱▱▱▱▱                 │          │
│  └────────────────────────────┘ └────────────────────────────┘          │
│                                                                          │
│  Tickets abiertos                                       [Ver todos →]    │ ← h2
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ #t-142  [URGENTE]  Login no funciona en Safari mobile            │   │ ← TicketRow: id + priority + title + status
│  │         Cooperativa Sagrada · hace 2h            [EN_PROGRESO]   │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ #t-141  [MEDIA]    Agregar export a CSV                          │   │
│  │         Portal Municipal · hace 1d              [PENDIENTE]      │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ #t-140  [BAJA]     ¿Cómo cambio mi contraseña?                   │   │
│  │         Restaurante La Tinaja · hace 2d         [PENDIENTE]      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Notas implementación:**
- Layout: `max-w-6xl mx-auto px-6 py-12 space-y-12`.
- StatCard: `rounded-lg border border-border bg-card p-5`. Label `text-xs uppercase text-muted-foreground tracking-wider` arriba; valor `text-3xl font-display font-semibold text-foreground` en el centro; delta `text-xs text-success` o `text-warning` abajo.
- Renovaciones: callout amarillo — `rounded-lg border border-warning bg-warning/12 p-4`. Icono `AlertTriangle` en `text-warning`, h4 en `text-warning`, lista debajo en `text-sm text-foreground`.
- ProjectCard: clickeable a `/proyectos/:id`. Grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`. Hover: `hover:border-primary/40 hover:-translate-y-0.5 transition-all`.
- Progress bar: `h-1 rounded-full bg-border` con fill `bg-primary` (o `bg-success` si activo, `bg-warning` si mantenimiento).
- TicketRow: usa `<Card>` con `divide-y divide-border` para separar filas; cada fila `flex items-center gap-3 px-5 py-4`.
- Tickets `[URGENTE]` `[MEDIA]` `[BAJA]` son badges en mono uppercase con colores destructive/warning/muted.

---

### 5.2 ProjectDetail

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Volver                                                                 │ ← ghost button con ChevronLeft
│                                                                          │
│  Cooperativa Sagrada                                  [✎ Editar] [···]   │ ← h1 + ghost actions
│  #proj-007 · Cliente: Soc. Coop. Sagrada · iniciado Feb 12, 2026         │ ← font-mono text-xs muted
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Pipeline                                              72%   [▾]  │   │ ← Header colapsable. Click [▾] toggles.
│  │ ▰▰▰▰▰▰▰▱▱▱                                                       │   │ ← Progress bar h-1
│  ├── Expanded ──────────────────────────────────────────────────────┤   │
│  │  ✓ 1. Análisis de requisitos          [completado · Feb 14]      │   │
│  │  ✓ 2. Diseño UI/UX                    [completado · Feb 22]      │   │
│  │  ✓ 3. Setup infraestructura           [completado · Feb 28]      │   │
│  │  ✓ 4. Desarrollo módulo auth          [completado · Mar 04]      │   │
│  │  ✓ 5. Desarrollo módulo socios        [completado · Mar 11]      │   │
│  │  ✓ 6. Integración pasarela            [completado · Mar 18]      │   │
│  │  ✓ 7. QA y testing                    [completado · Mar 24]      │   │
│  │  ○ 8. Deploy a staging                [siguiente]                │   │ ← stage activo: text-primary, círculo lleno con ring
│  │  ○ 9. UAT con cliente                                            │   │ ← stages futuros: muted, círculo vacío
│  │  ○ 10. Lanzamiento producción                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [Servicios] [Tickets] [Acceso] [Mantenimiento]                   │   │ ← Tabs (border-b active = primary)
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                  │   │
│  │ Servicios contratados                          [+ Agregar]       │   │ ← Tab content; secondary action
│  │                                                                  │   │
│  │  ⚙ Hosting Vercel Pro            $20/mes   vence Abr 18  [···]  │   │ ← ServiceRow: icono + nombre + costo + vencimiento
│  │  ⚙ Dominio cooperativasagrada    $12/año   vence Sep 03  [···]  │
│  │  ⚙ Supabase Pro                  $25/mes   vence Abr 15  [···]  │
│  │  ⚙ SSL Wildcard                  $80/año   vence May 01  [···]  │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Notas implementación:**
- **Header colapsable del pipeline:** componente acordeón controlado con state `isExpanded`. Cuando colapsado, solo muestra título + % + progress bar; cuando expandido, agrega lista de stages debajo. Anima con `<motion.div>` y `height: auto` o usa `<Collapsible>` de Radix. El click target es toda la fila del título, no solo el chevron.
- Stage list: `<button>` rows con `flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors`. Completado: `bg-primary/5 hover:bg-primary/10 text-foreground`. Activo (siguiente): `border-l-2 border-primary text-primary`. Futuro: `text-muted-foreground hover:bg-foreground/5`.
- Tabs: usa `Tabs` de shadcn con `TabsList` `border-b border-border` y `TabsTrigger` styled como spec en §3.4. Iconos al lado del label.
- ServiceRow: `<div className="flex items-center justify-between rounded-md border border-border bg-card/60 px-3 py-2.5 hover:border-primary/30">` con icono primary, nombre `font-display text-sm`, costo `font-mono text-xs text-muted-foreground`.
- Botón `[···]` abre dropdown con: editar, marcar pagado, eliminar.

---

### 5.3 MisSolicitudes (cliente tipo 2)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Logo MultiStack]                                            [user@···]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Mis solicitudes                                  [+ Nueva solicitud]    │
│  Reporta bugs, pide cambios, solicita nuevas funciones.                  │ ← p body-foreground
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ #s-038  [URGENTE]  Caída del checkout                       [▾] │   │ ← SolicitudRow colapsable
│  │         Cooperativa Sagrada · hace 1h            [EN_PROGRESO]   │   │
│  ├── Expanded ──────────────────────────────────────────────────────┤   │
│  │  Descripción                                                     │   │
│  │  Los socios reportan que al intentar pagar su cuota mensual,     │   │
│  │  el botón "Pagar" no responde en Safari iOS. En Chrome funciona. │   │
│  │                                                                  │   │
│  │  Adjuntos: video-bug.mov · captura.png                           │   │
│  │  Asignado a: Samuel · creado Mar 25 14:22                        │   │ ← font-mono xs text-muted-foreground
│  │                                                                  │   │
│  │  [ Agregar comentario ]                                          │   │ ← secondary bracketed
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ #s-037  [MEDIA]    Agregar campo "RTN" en perfil de socio  [▸]  │   │ ← collapsed
│  │         Cooperativa Sagrada · hace 2d            [PENDIENTE]     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ #s-036  [BAJA]     ¿Cómo exportar el listado de pagos?     [▸]  │   │
│  │         Cooperativa Sagrada · hace 5d            [RESUELTO]      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

— Modal Nueva solicitud (al click en CTA primario) —

┌────────────────────────────────────────────────────┐
│ Nueva solicitud                                  ✕ │ ← header rounded-xl border-b
├────────────────────────────────────────────────────┤
│                                                    │
│  Tipo                                              │
│  ◉ Bug   ○ Cambio   ○ Pregunta   ○ Nueva función  │ ← Radio group
│                                                    │
│  Prioridad                                         │
│  [Baja] [Media] [Alta] [Urgente]                   │ ← Segmented control
│                                                    │
│  Título                                            │
│  ┌────────────────────────────────────────────┐    │
│  │ Resumen breve…                             │    │
│  └────────────────────────────────────────────┘    │
│                                                    │
│  Descripción                                       │
│  ┌────────────────────────────────────────────┐    │
│  │                                            │    │
│  │ Pasos para reproducir, qué esperabas…      │    │
│  │                                            │    │
│  └────────────────────────────────────────────┘    │
│                                                    │
│  📎 Adjuntar archivo (opcional)                    │
│                                                    │
│         [ CANCELAR ]    [Enviar solicitud]         │ ← secondary + primary
└────────────────────────────────────────────────────┘
```

**Notas implementación:**
- Lista de solicitudes: cada row es `<Collapsible>` (Radix). Header siempre visible; body con descripción + adjuntos + comentarios cuando expandido.
- Solo una solicitud expandida a la vez (controla con state padre o Accordion `type="single"`).
- Badges: prioridad a la izquierda del título (`[URGENTE]` destructive, `[MEDIA]` warning, `[BAJA]` muted), estado a la derecha (`[EN_PROGRESO]` primary, `[PENDIENTE]` warning, `[RESUELTO]` success).
- Modal: usa `<Dialog>` shadcn. Campos `space-y-4`. El submit deshabilitado mientras `título.length < 3`.
- Segmented control de prioridad: 4 botones `flex-1` que actúan como radio. Activo = `bg-primary text-primary-foreground`; inactivos = `bg-card border border-border text-muted-foreground hover:text-foreground`.

---

### 5.4 Login / Signup

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌────────────────────────────────────────┐                              │
│  │                                        │                              │ ← centered card max-w-md
│  │  [Logo MultiStack]                     │                              │
│  │                                        │                              │
│  │  Bienvenido de vuelta                  │                              │ ← h2
│  │  Inicia sesión en tu cuenta.           │                              │ ← p body-foreground
│  │                                        │                              │
│  │  Email                                 │                              │
│  │  ┌──────────────────────────────────┐  │                              │
│  │  │ tu@empresa.com                   │  │                              │
│  │  └──────────────────────────────────┘  │                              │
│  │                                        │                              │
│  │  Contraseña               ¿Olvidaste? │                              │ ← label + link a la derecha
│  │  ┌──────────────────────────────────┐  │                              │
│  │  │ ••••••••••                    👁  │  │                              │
│  │  └──────────────────────────────────┘  │                              │
│  │                                        │                              │
│  │  ┌──────────────────────────────────┐  │                              │
│  │  │      Iniciar sesión              │  │ ← primary, h-12, full-width  │
│  │  └──────────────────────────────────┘  │                              │
│  │                                        │                              │
│  │  ─────────────  o  ──────────────      │                              │
│  │                                        │                              │
│  │  ┌──────────────────────────────────┐  │                              │
│  │  │   [G] Continuar con Google       │  │ ← secondary outline          │
│  │  └──────────────────────────────────┘  │                              │
│  │                                        │                              │
│  │  ¿No tienes cuenta? Regístrate         │                              │ ← muted-foreground + link primary
│  │                                        │                              │
│  └────────────────────────────────────────┘                              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Notas implementación:**
- Layout: `min-h-screen flex items-center justify-center bg-background p-6`.
- Card: `w-full max-w-md rounded-xl border border-border bg-card p-8 space-y-6`.
- **Sin terminal chrome** (ni traffic-light dots, ni `~/auth/login` path). Es un form normal y profesional.
- Logo arriba `h-8`, alineado a la izquierda dentro del card.
- Heading `<h2>` no `<h1>` (la página no tiene `<h1>` jerárquico — el logo lo reemplaza visualmente).
- "¿Olvidaste?" es un `<a>` `text-xs text-primary hover:underline`, alineado al label con `flex items-center justify-between`.
- Toggle visibilidad password: icono `Eye`/`EyeOff` adentro del input, derecha, `text-muted-foreground hover:text-foreground`.
- Botón Google: `bg-card border border-border hover:bg-foreground/5 text-foreground` con icono Google a la izquierda.
- **Signup** = mismo layout con campos extra (nombre, empresa opcional). Mensaje de aceptar términos en `text-xs text-muted-foreground` arriba del CTA.

---

## 6. Checklist de migración

Para llevar el codebase actual al nuevo sistema, en este orden:

1. **Reemplaza `src/index.css`** por el nuevo `globals.css`.
2. **Mergea `tailwind.config.snippet.ts`** con tu `tailwind.config.ts` (paleta + fontFamily + borderRadius).
3. **Reemplaza imports de fuentes:** elimina `JetBrains+Mono` + `Fira+Code` del HTML antiguo si no usas ya código en otro lado; deja Inter + Space Grotesk + JetBrains Mono.
4. **Find & replace en componentes:**
   - `text-green-*` / `bg-green-*` → `text-primary` / `bg-primary` (excepto donde sea status `success` semántico).
   - `font-display` aplicado a CLI-chrome (`[ NUEVO ]`, `$ multistack ...`) → `font-mono`.
   - `font-display` aplicado a headings → mantener (ahora es Space Grotesk).
   - `text-muted-foreground` en párrafos largos → `text-[hsl(var(--body-foreground))]`.
   - `rounded-full` en botones → `rounded-md`.
   - `glow-border` / `hover:shadow-[0_0_30px...]` en cards regulares → eliminar.
   - Eyebrows con `>_` o `$` → texto plano uppercase.
5. **Quita el botón de toggle dark/light** si existe — el tema es dark permanente.
6. **Verifica focus rings:** todos los inputs/botones interactivos deben mostrar el ring `glow-focus` al recibir foco con teclado.

---

## 7. Anti-patrones (qué NO hacer)

- ❌ Pill buttons (`rounded-full`).
- ❌ Glow en cada card. Solo focus + 1 hero CTA por viewport.
- ❌ `bg-black/70` para overlays — usa `bg-background/80`.
- ❌ Eyebrows con prompts (`>_`, `$`, `::`).
- ❌ Mono en navegación, links, párrafos largos, eyebrows.
- ❌ Verde fuera del status `success`.
- ❌ Heroicons / Phosphor / SVG inventado — solo Lucide.
- ❌ Múltiples h1 por página.
- ❌ Mezclar `font-display` heading con CLI-chrome del mismo.
