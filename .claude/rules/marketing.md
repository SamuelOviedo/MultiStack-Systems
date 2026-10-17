---
paths:
  - "src/components/marketing/**"
  - "src/pages/marketing/**"
  - "src/components/common/Navbar*"
  - "src/components/common/Footer*"
---

# Landing y Navbar

- Usa los tokens MS de `src/lib/msTokens.ts` a través de `useMsThemeVars`; no uses los tokens HSL de shadcn aquí.
- Hover, focus y media queries van en clases `.ms-*` de `src/index.css`, no en estilos inline nuevos.
- Tipografías: Hanken Grotesk (cuerpo), Sora (titulares), JetBrains Mono (etiquetas). Importa la constante `MONO` desde un solo módulo; no crees copias nuevas.
- Los mocks de producto usan datos ficticios y llevan `role="img"` con un `aria-label` descriptivo.
- Nombres, estados y enlaces de productos salen de `PRODUCTS`; un producto `soon` o `dev` nunca se presenta como disponible.
- Nunca inventes testimonios, clientes, cifras ni logos.
