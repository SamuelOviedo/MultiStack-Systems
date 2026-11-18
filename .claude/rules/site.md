---
paths:
  - "src/components/site/**"
  - "src/pages/marketing/Index.tsx"
  - "src/pages/marketing/Planes.tsx"
  - "src/pages/marketing/Servicios.tsx"
  - "src/pages/marketing/Contacto.tsx"
  - "src/pages/marketing/siteContent.ts"
  - "src/pages/marketing/siteLayoutProps.ts"
  - "src/test/site-*"
---

# Sitio público (/, /planes, /servicios y /contacto)

Esta regla manda sobre `marketing.md` en estos archivos: el sitio público nuevo no usa los tokens MS de la landing anterior (`useMsThemeVars`, `.ms-*` de `src/index.css`, Hanken Grotesk y Sora). `/paginas-web` y las páginas legales siguen con `marketing.md`.

## Sistema de diseño
- Los tokens `--site-*` y los colores `site.*` de `tailwind.config.ts` existen solo bajo `.ms-site` (lo abre `SiteLayout`). Todo selector de `site.css` va dentro de `.ms-site`; sin `:root`, `html` ni `body`, y los `@keyframes` llevan el prefijo `ms-site-`. No uses `--background`, `--primary`… (shadcn) ni `useMsThemeVars` aquí.
- Tipografías: Poppins, local (`site-fonts.css`, woff2 del repo, pesos 400, 500, 600 y 700), y JetBrains Mono para etiquetas y código, que llega del `@import` de Google Fonts de `src/index.css` (no es local). No añadas pesos sin su woff2.
- Sin librería de animación (`motion`, `framer-motion`…). El movimiento es CSS (`@keyframes` y transiciones en `site.css`) o un temporizador de React.
- Colores con `oklch()` desde los tokens. Un hex antes de `oklch(var(--x))` no sirve de respaldo (queda `unset`): los respaldos van en el bloque `@supports not (color: oklch(0 0 0))` o, para texto con degradado, en `@supports` con `background-clip`.
- Hover, foco y media queries en clases de `site.css` o utilidades de Tailwind, no en estilos inline nuevos.

## Texto y números
- Todo el texto sale de `src/pages/marketing/siteContent.ts`; los componentes no escriben copy propio (ni etiquetas de accesibilidad: el botón de pausa y el del menú también salen de ahí).
- Todo número sale de una constante: precios de `SITE_PLANS`, meses, días y horas de `COMMITMENTS`, teléfono y WhatsApp de `CHANNELS`, porcentajes de `PAYMENT_TERMS`. Nada se teclea a mano.
- Nombres, estados y enlaces de productos salen de `PRODUCTS`. Sin testimonios, clientes, cifras ni logos inventados. Los enlaces de campaña pasan por `siteLinks.ts`.
- El texto de un botón con `aria-expanded` o `aria-pressed` no lleva el estado («Menú», no «Abrir menú»).

## Accesibilidad
- Contraste AA (4,5:1 en texto, 3:1 en componentes): el teal como texto es `site.primary-text`, no `site.primary` (solo fondos, bordes, brillos e íconos). El texto atenuado del hero es `site.hero-muted`. `site-a11y-tokens.test.ts` lo mide; si cambias un token, corre esa prueba.
- Foco visible en todo control, objetivo de 24 px o más y nada tapado por la cabecera `sticky`.
- Toda animación que no termina (`infinite`, un temporizador en bucle, el shader) respeta la pausa y el movimiento reducido:
  - Pausa (WCAG 2.2.2): el interruptor es `useMotionPaused` (`motionPause.ts`); `SiteLayout` pone `data-motion="paused"` en `.ms-site` y `site.css` detiene los `@keyframes` infinitos con él. Un bucle nuevo en React lee `useMotionPaused`; un `infinite` nuevo en CSS se añade a la regla de pausa (una prueba lo exige).
  - Movimiento reducido: `useReducedMotion` en React y el bloque `prefers-reduced-motion` de `site.css`. Todo queda visible y quieto, sin contenido que empiece oculto.
- Lo decorativo (píldoras, terminal, chat, ondas) lleva `aria-hidden` y el H1 da su texto plano.

## Pruebas
- Tailwind escanea los tests: un literal con forma de clase (`ring`, `flex`…) en una prueba de `src/` añade CSS muerto a la hoja inicial. Arma esas clases en ejecución (`["r", "ing"].join("")`) y comprueba en el build que no aparecen.
- Las pruebas del sitio no nombran la herramienta con la que se hizo el diseño de referencia; refiérete a él como «el diseño de referencia».

## Crédito
- «Desarrollado por MultiStack Systems» usa `DevCredit` de `snippets/credito-multistack/` en modo `ownSite` y sigue `docs/standards/CREDITO-MULTISTACK.md`. Su ubicación en el pie (`.site-foot-*` de `site.css`) usa una container query en `em`, no en `ch`: `ch` depende de la fuente de reserva en la primera carga y provoca scroll horizontal.
