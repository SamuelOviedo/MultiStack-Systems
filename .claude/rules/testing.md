---
paths:
  - "src/test/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
  - "supabase/tests/**"
---

# Pruebas

- Vitest + Testing Library: prueba el comportamiento visible, no detalles internos.
- Cada bug corregido lleva un test que falla sin el arreglo.
- Playwright (`e2e/`) solo para flujos completos y siempre contra entornos locales.
- pgTAP: cada política RLS se prueba con los roles que deben poder y con los que no.
- Ningún test usa credenciales reales, correos reales ni el proyecto de producción.
