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
  - Excepción acotada (aprobada por el propietario el 2026-11-11): los datos personales de terceros que el panel carga con la sesión iniciada (hoy, los del prospecto en Cotizaciones) no usan la caché compartida de TanStack Query, porque cerrar sesión no la limpia. Se cargan con un hook local por componente con aislamiento de sesión (`src/components/admin/cotizaciones/useRecursoCotizacion.ts` y sus pruebas de cierre y cambio de sesión), y otro módulo con datos así usa ese mismo patrón con pruebas equivalentes. Las consultas siguen en `src/lib/*` y la autorización en `ProtectedRoute` y RLS: el hook no autoriza. No es una prohibición general de TanStack Query.
- Toda ruta privada pasa por `ProtectedRoute` con el `allowedTypes` correcto (0 admin, 1 colaborador, 2 cliente).
- Los formularios respetan los límites de la base de datos con `maxLength` (por ejemplo, título de ticket ≤ 200 y descripción ≤ 10 000).
- No muestres al usuario el mensaje de error crudo de Supabase: tradúcelo a un mensaje claro en español y deja el detalle técnico fuera de la interfaz.
- Antes de tocar `useAuth.tsx` o `ProjectDetail.tsx`, lee la sección Riesgos de `docs/context/PROJECT_CONTEXT.md`.
