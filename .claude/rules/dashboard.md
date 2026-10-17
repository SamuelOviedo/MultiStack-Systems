---
paths:
  - "src/components/dashboard/**"
  - "src/pages/dashboard/**"
  - "src/components/auth/**"
  - "src/pages/auth/**"
  - "src/pages/client/**"
---

# Dashboard, auth y portal de clientes

- Usa las primitivas de `src/components/ui` y los tokens HSL de shadcn.
- El estado de servidor va con TanStack Query; las consultas y mutaciones viven en `src/lib/*`.
- Toda ruta privada pasa por `ProtectedRoute` con el `allowedTypes` correcto (0 admin, 1 colaborador, 2 cliente).
- Los formularios respetan los límites de la base de datos con `maxLength` (por ejemplo, título de ticket ≤ 200 y descripción ≤ 10 000).
- No muestres al usuario el mensaje de error crudo de Supabase: tradúcelo a un mensaje claro en español y deja el detalle técnico fuera de la interfaz.
- Antes de tocar `useAuth.tsx` o `ProjectDetail.tsx`, lee la sección Riesgos de `docs/context/PROJECT_CONTEXT.md`.
