==============================================================================
LOGIN — ESPECIFICACIONES TÉCNICAS (Stack: React + Tailwind CSS v3 + shadcn/ui)
==============================================================================

Variante seleccionada: V2 · Split brand + form (1280 × 820, 2 columnas)
Tema: dark permanente
Tokens: ya definidos en globals.css del rediseño previo

------------------------------------------------------------------------------
1. LAYOUT
------------------------------------------------------------------------------

Estructura general:
- Página de pantalla completa, sin scroll en desktop ≥1280px.
- min-h-screen w-screen, sin padding exterior (las dos columnas llegan a borde).
- Grid de dos columnas: izquierda 1.1fr, derecha 1.0fr.
  Tailwind: grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]
  En mobile (<lg) las columnas se apilan: brand panel arriba (h-auto, py-12),
  form panel abajo (min-h-screen).
- Sin card flotante centrado: el form se sitúa dentro del panel derecho,
  centrado vertical y horizontalmente con max-w-[400px].

Fondo:
- Body: bg-background (#080F1E).
- Panel izquierdo: gradient lineal de top a bottom:
  background: linear-gradient(180deg, hsl(218 56% 14%) 0%, hsl(222 43% 7%) 100%);
  Tailwind arbitrario: bg-[linear-gradient(180deg,_hsl(218_56%_14%)_0%,_hsl(222_43%_7%)_100%)]
- Panel derecho: bg-background liso.
- Línea separadora entre paneles: border-r border-border (1px solid #1E3A5F).

Padding interno de cada panel:
- Ambos paneles: px-12 py-8  (48px / 32px). En mobile: px-6 py-8.
- Headers/footers de cada panel se adhieren a top/bottom; el contenido principal
  ocupa el centro con flex-1 + flex flex-col justify-center.

------------------------------------------------------------------------------
2. CARD / CONTENEDOR
------------------------------------------------------------------------------

NO hay card central tradicional. El form vive directamente sobre el panel
derecho — sin border, sin background, sin radius. Esto es deliberado: la
arquitectura visual es "panel split" no "card flotante".

Sí hay tres elementos contenidos dentro del panel izquierdo:

a) Activity log (terminal mock), abajo del panel izquierdo:
   - bg: rgba(8, 15, 30, 0.7)  →  bg-background/70
   - border: 1px solid var(--border)  →  border border-border
   - border-radius: 12px  →  rounded-lg
   - overflow-hidden
   - Header del terminal: px-3.5 py-2, border-b border-border
   - Body del terminal: p-3.5

b) Glow ambiental del panel izquierdo (decorativo, NO interactivo):
   - Dos esferas blur radial absolute pointer-events-none:
     · Top-left: width/height 480px, radial-gradient(circle, hsl(199 89% 48% / 0.18) 0%, transparent 70%)
       posición: top: -120px, left: -120px
     · Bottom-right: width/height 520px, radial-gradient(circle, hsl(187 92% 43% / 0.12) 0%, transparent 70%)
       posición: bottom: -160px, right: -120px
   - El panel izquierdo necesita position: relative y overflow-hidden para contenerlas.

c) NO hay shadow/glow en el form. Solo focus rings en inputs.

------------------------------------------------------------------------------
3. LOGO / HEADER
------------------------------------------------------------------------------

Posición:
- Logo principal: arriba a la izquierda del panel izquierdo (no del form).
- Panel derecho NO repite el logo. Solo muestra el link "¿Aún no tienes cuenta? → Regístrate" arriba a la derecha.

Composición del logo (lockup):
- Mark cuadrado 28×28, border-radius 6px, gradient diagonal:
    background: linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%);
  Contiene la letra "M" centrada, color #080F1E, font-mono (JetBrains Mono),
  font-weight 700, font-size 13px.
- A la derecha del mark: wordmark "MultiStack." en font-display
  (Space Grotesk), font-weight 700, font-size 18px, color #F0F6FF,
  letter-spacing -0.01em. El punto final está coloreado en #0EA5E9 (primary).
- Gap entre mark y wordmark: 10px (gap-2.5).

Junto al logo (lado derecho del header del panel izquierdo) va un status pill:
- Pill "v2.4 · ESTABLE" en color success (#10B981).
  · Estilo: inline-flex items-center gap-1.5 px-2 py-1 rounded-sm
    border border-success bg-success/12
    text-success text-[10px] font-mono font-medium uppercase tracking-[0.05em]
  · Dot de 6×6 rounded-full bg-current con animación blink (1.6s ease-in-out infinite).

------------------------------------------------------------------------------
4. TIPOGRAFÍA DEL FORM
------------------------------------------------------------------------------

Heading principal del form (lado derecho):
- Texto: "Iniciar sesión"
- Fuente: Space Grotesk (font-display)
- Tamaño: 30px  →  text-3xl
- Peso: 600  →  font-semibold
- Line-height: 1.1
- Letter-spacing: -0.02em  →  tracking-tight
- Color: #F0F6FF  →  text-foreground

Subtítulo / descripción del form:
- Texto: "Bienvenido de vuelta. Continúa con tu cuenta."
- Fuente: Inter (font-sans)
- Tamaño: 14px  →  text-sm
- Peso: 400 (normal)
- Line-height: 1.6
- Color: #94A3B8  →  text-[hsl(var(--body-foreground))]
- Margin-top respecto al heading: 8px  →  mt-2

Labels de campos:
- Fuente: Inter (font-sans)
- Tamaño: 12px  →  text-xs
- Peso: 500  →  font-medium
- Color: #64748B  →  text-muted-foreground
- Margin-bottom respecto al input: 6px  →  mb-1.5
- Texto en sentence-case español: "Email de trabajo", "Contraseña".

Heading principal del panel izquierdo (brand side):
- Texto: "Tu stack de proyectos, en una sola consola."
- Fuente: Space Grotesk
- Tamaño: 44px  →  text-[44px]  o  text-4xl/text-5xl
- Peso: 600
- Line-height: 1.05
- La segunda línea ("en una sola consola.") va en color primary (#0EA5E9).

Body del panel izquierdo:
- Inter, 16px (text-base), color #94A3B8 (body-foreground), line-height 1.6.

------------------------------------------------------------------------------
5. INPUTS
------------------------------------------------------------------------------

Estado base:
- Altura: 42px  →  h-[42px]  (no h-10 ni h-11)
- Width: 100%  →  w-full
- Background: rgba(8, 15, 30, 0.6)  →  bg-background/60
- Border: 1px solid #1E3A5F  →  border border-border
- Border-radius: 8px  →  rounded-md
- Padding horizontal: 14px  →  px-3.5
- Color del texto: #F0F6FF  →  text-foreground
- Fuente: Inter
- Tamaño texto: 14px  →  text-sm
- Transición: border-color 150ms, box-shadow 150ms

Placeholder:
- Color: #64748B  →  placeholder:text-muted-foreground

Estado focus:
- outline: none
- border-color: #0EA5E9  →  focus:border-primary
- box-shadow ring de 3px:
    box-shadow: 0 0 0 3px rgba(14,165,233,0.20);
  Tailwind: focus:ring-2 focus:ring-primary/20 focus:ring-offset-0
  (o usar focus-visible:[box-shadow:0_0_0_3px_rgba(14,165,233,0.20)])

Estado disabled:
- opacity-50, cursor-not-allowed.

Estado error:
- border-destructive
- helper text debajo del input: text-xs text-destructive mt-1.5

Input con icono (ej. ojo de password):
- Wrapper: position: relative
- Input: padding-right 40px  →  pr-10
- Icono: position absolute, right 12px, top 50%, translate-y -50%
  color #64748B (muted-foreground), hover #F0F6FF, cursor-pointer.
  Tamaño icono: 16×16. Usar Lucide (Eye / EyeOff).

------------------------------------------------------------------------------
6. BOTÓN PRIMARIO (CTA "Iniciar sesión")
------------------------------------------------------------------------------

Estado base:
- Altura: 44px  →  h-11
- Width: 100%  →  w-full
- Border-radius: 8px  →  rounded-md
- Border: ninguno
- Background: #0EA5E9  →  bg-primary
- Color del texto: #080F1E  →  text-primary-foreground
- Fuente: Inter (font-sans), NO mono, NO display
- Tamaño: 14px  →  text-sm
- Peso: 500  →  font-medium
- Sentence-case: "Iniciar sesión" — sin icono, sin brackets, sin uppercase.
- display: inline-flex, items-center, justify-content center, gap 10px
- Transición: background 150ms, box-shadow 150ms

Estado hover:
- Background sube un punto en lightness:
    background: hsl(199 89% 53%);
  Tailwind: hover:bg-primary/90  (aproximación válida)
- Glow sutil:
    box-shadow: 0 0 16px rgba(14,165,233,0.30);
  Tailwind: hover:shadow-[0_0_16px_rgba(14,165,233,0.30)]
- Sin lift (sin translate-y).

Estado focus-visible (accesibilidad):
- Ring de 3px exterior: focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background

Estado pressed (active):
- Background un toque más oscuro: active:bg-primary/95.

Estado loading:
- Reemplaza el label por: spinner (Lucide Loader2 con animate-spin, 16px) +
  texto "Iniciando sesión…"
- Botón disabled durante la carga: disabled:opacity-70 disabled:cursor-not-allowed
- NO cambiar el ancho del botón (mantener w-full para evitar layout shift).

Estado disabled (form inválido):
- disabled:opacity-50, disabled:cursor-not-allowed, sin hover effects.

------------------------------------------------------------------------------
7. LINK "¿No tienes cuenta?" / "Regístrate"
------------------------------------------------------------------------------

Posición:
- Arriba a la derecha del panel derecho (no dentro del card, no debajo del form).
- Wrapper: flex justify-end items-center gap-4

Composición:
- Texto plano "¿Aún no tienes cuenta?"
  · Inter, 13px, color #64748B (muted-foreground), font-weight 400
- Seguido del link "Regístrate →"
  · Inter, 13px, color #0EA5E9 (primary), font-weight 500
  · text-decoration: none por defecto
  · hover: text-decoration: underline
  · Icono Arrow-Right (Lucide) 14×14 a la derecha del texto, gap-1.5
  · El link entero es <a href="/signup">

Estado del link:
- Color normal: #0EA5E9
- Color hover: hsl(199 89% 58%)  →  hover:text-primary/90 (o hover:underline)
- focus-visible: outline-2 outline-primary outline-offset-2

------------------------------------------------------------------------------
8. ELEMENTOS EXTRA
------------------------------------------------------------------------------

8.1 Link "¿Olvidaste tu contraseña?"
- Posición: en la misma línea del label "Contraseña", alineado a la derecha
  con flex justify-between items-center.
- Estilo: text-xs text-primary, font-weight 400, sin underline por defecto,
  hover:underline.

8.2 Botones de SSO (Google + GitHub)
- Posicionamiento: arriba del form de email, en grid 2 cols con gap 10px.
  Tailwind: grid grid-cols-2 gap-2.5
- Cada botón:
  · Altura 44px, h-11
  · Background: transparent
  · Border: 1px solid #1E3A5F  →  border border-border
  · Color texto: #F0F6FF  →  text-foreground
  · Border-radius: 8px  →  rounded-md
  · Fuente: Inter 14px font-medium
  · Icono brand a la izquierda (16×16), gap 10px (gap-2.5)
  · Hover: border-color hsl(213 52% 35%), background rgba(255,255,255,0.02)
    Tailwind: hover:border-border/80 hover:bg-foreground/5
- Labels: "Google", "GitHub" (sin "Continuar con" para mantener el botón corto).

8.3 Separador "o"
- Posición: entre los botones SSO y el form de email.
- Estructura: flex items-center gap-3
  · Línea izquierda: flex-1 h-px bg-border
  · Texto centro: text-[11px] uppercase tracking-[0.1em] font-mono
    text-muted-foreground, contenido "o"
  · Línea derecha: flex-1 h-px bg-border

8.4 Toggle de visibilidad de contraseña
- Icono Lucide Eye / EyeOff, 16×16, dentro del input password (ver §5).
- aria-label="Mostrar contraseña" / "Ocultar contraseña" (cambia con estado).

8.5 Footer del panel derecho
- Posición: bottom del panel, alineado al borde inferior con padding heredado.
- flex justify-between items-center, color #64748B text-xs.
- Izquierda: "© 2026 multistack.dev" en font-mono.
- Derecha: tres links inline (Soporte / Estado / Docs), gap 14px,
  color heredado, hover:text-foreground.

8.6 Activity log decorativo (panel izquierdo)
- Card terminal abajo del panel izquierdo (ver §2.a).
- Header: tres dots Mac (#FF5F56, #FFBD2E, #27C93F), 9×9 rounded-full,
  seguidos del path "~/multistack/activity.log" en font-mono text-[11px]
  uppercase tracking-[0.1em] color muted-foreground.
- Body: 3 líneas de log en font-mono text-xs, line-height 1.8:
    · timestamp en muted-foreground
    · símbolo de estado coloreado (✓ success, ↻ primary, ⚠ warning)
    · acción en body-foreground, identificadores en foreground o primary.

8.7 Checklist de features (panel izquierdo, debajo del heading)
- <ul> sin estilo, flex flex-col gap-3.
- Cada item: flex items-center gap-3
  · Bullet: 22×22 rounded-md bg-success/15, contiene icono Lucide Check 14×14
    en color #10B981.
  · Texto: text-sm text-foreground.
- 3 items máximo, copys cortos.

8.8 Status pill "v2.4 · ESTABLE" — ver §3.

------------------------------------------------------------------------------
9. COLORES NUEVOS USADOS
------------------------------------------------------------------------------

Todos los colores existían en el sistema base (globals.css), no se introducen
hex nuevos. Se documenta el uso específico en esta pantalla:

| Hex      | Token               | Uso en login                                  |
|----------|---------------------|-----------------------------------------------|
| #080F1E  | --background        | Fondo del panel derecho, texto sobre primary  |
| #0F1C35  | --card              | Top del gradient del panel izquierdo          |
| #F0F6FF  | --foreground        | Headings, texto de inputs, labels SSO         |
| #94A3B8  | --body-foreground   | Subtítulo del form, body del panel izquierdo  |
| #64748B  | --muted-foreground  | Labels, "¿No tienes cuenta?", footer, dots    |
| #1E3A5F  | --border            | Borders de inputs, SSO, terminal, divider     |
| #0EA5E9  | --primary           | CTA, link Regístrate, focus ring, glows       |
| #06B6D4  | --accent            | Segunda parada del gradient del logo mark     |
| #10B981  | --success           | Pill v2.4, bullets del checklist, ✓ del log   |
| #F59E0B  | --warning           | ⚠ en el log de actividad                      |
| #FF5F56  |   —                 | Dot rojo del terminal mock (no semántico)     |
| #FFBD2E  |   —                 | Dot ámbar del terminal mock (no semántico)    |
| #27C93F  |   —                 | Dot verde del terminal mock (no semántico)    |

Alphas usados (siempre sobre el color base):
- bg-primary/12   →  badges/pills info, fondo de tabs activos
- bg-success/12   →  pill v2.4
- bg-success/15   →  bullets del checklist
- bg-background/60 →  inputs
- bg-background/70 →  card del activity log
- ring/shadow primary @ 20% → focus de inputs
- ring/shadow primary @ 30% → hover del CTA primario
- glow primary @ 18% / accent @ 12% → esferas ambientales del panel izquierdo

==============================================================================
NOTAS DE IMPLEMENTACIÓN
==============================================================================

- Usar componentes de shadcn/ui como base donde aplique:
  · <Input> de shadcn → reemplazar las clases base con las del §5.
  · <Button variant="default"> para el CTA primario.
  · <Button variant="outline"> para los botones de SSO.
  · NO usar <Card> de shadcn — el form va sin contenedor.

- Iconografía: SOLO Lucide React (lucide-react). Iconos usados en esta pantalla:
  Eye, EyeOff, Loader2, ArrowRight, Check, Mail (opcional dentro del input email).

- El logo del Google SSO se inyecta como SVG inline (4 paths con colores brand
  oficiales de Google) — Lucide no lo provee.

- Responsive (<lg / 1024px):
  · Grid colapsa a 1 columna; brand panel arriba, form debajo.
  · El brand panel reduce su altura (auto, py-12) y oculta la
    activity-log para ahorrar scroll.
  · El form panel mantiene min-h-screen y centra su contenido vertical.

- Accesibilidad:
  · Todos los inputs con <label htmlFor>.
  · Toggle del password con aria-label dinámico.
  · El CTA dispara submit del <form>; el botón mantiene type="submit".
  · Focus rings visibles con keyboard (focus-visible).
  · Color contrast: foreground/background ≥ 14:1, body/background ≥ 7:1.
