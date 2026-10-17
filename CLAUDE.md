# MultiStack Systems

SPA de MultiStack Systems: landing de productos, dashboard del equipo y portal de clientes. Productos: TechOn, Licensing, Development y WhatsApp (fuente única: `src/lib/products.ts`).

**Stack:** Vite 5 + React 18 + TypeScript 5.9 · Supabase (Auth, Postgres con RLS, Edge Functions en Deno con Resend) · Tailwind + shadcn/ui · TanStack Query · Vercel.

**Este repositorio es público.** Todo lo que se commitea lo puede leer cualquiera.

## Comandos
- Desarrollo: `npm run dev`
- Gate completo (el mismo que corre CI): `npm run lint && npx tsc -p tsconfig.app.json --noEmit && npm test && npm run build`
- Tests: `npm test` (Vitest: `src/**/*.test.{ts,tsx}` y `supabase/functions/**/*.test.ts`) · e2e: `npm run test:e2e`
- Base de datos: `supabase test db` (pgTAP en `supabase/tests/database/`; requiere Supabase local con Docker)
- Correos: `npm run email:preview`
- Arquitectura: `codegraph impact <Símbolo>` · `npm run graph:report`

## Seguridad (no negociable)
1. Nunca commitees secretos ni datos personales: `.env*`, `.claude/settings.local.json`, `CLAUDE.local.md`, volcados SQL, logs, correos o teléfonos de clientes. Revisa `git diff --staged` antes de cada commit.
2. Producción la opera solo el propietario. `.claude/settings.json` bloquea `git push`, migraciones remotas, secretos, despliegue de funciones y Vercel. Tú preparas, pruebas y documentas; no ejecutes ni busques otra vía para hacerlo.
3. La documentación operativa y de incidentes es privada y vive fuera de este repo (ver `CLAUDE.local.md`). Nunca copies su contenido, rutas ni identificadores a archivos versionados.
4. Migraciones solo hacia adelante: nunca edites una existente; crea una nueva con su prueba pgTAP.
5. Toda Edge Function falla cerrada: valida la entrada, verifica la sesión o la firma, y no registra en logs correos, IP, claves ni el contenido del visitante.
6. Toda tabla nueva lleva RLS y una prueba pgTAP de lo que pueden y no pueden hacer `anon`, cliente, colaborador y admin.
7. Las variables `VITE_*` son públicas en el navegador: nada secreto ahí.

## Reglas del código
- `src/lib/products.ts` es la única fuente de nombres, estados y enlaces de productos.
- Nunca inventes URLs: las del ecosistema salen de variables `VITE_*`.
- El acceso a datos pasa por `src/lib/*`; los componentes no consultan Supabase directamente.
- No edites a mano `src/integrations/supabase/types.ts`: se regenera.
- Ejecuta `codegraph impact` antes de cambiar símbolos compartidos: `PRODUCTS`, `useMsThemeVars`, `Logo`, `getTechonHref`, `useAuth`, `ProtectedRoute` y los tipos de `src/types/`.
- Colores de estado con `var(--success)` y `var(--warning)`, nunca hex directo.
- Un cambio, un propósito: si una tarea toca 5 o más archivos no relacionados, divídela.
- Commits convencionales (`feat(scope): …`, `fix(security): …`) en ramas `feat/`, `fix/` o `chore/`.

## Zonas delicadas (lee antes de tocar)
| Zona | Riesgo |
| --- | --- |
| `src/hooks/useAuth.tsx` | Estado central de auth; fácil crear condiciones de carrera |
| `src/integrations/supabase/client.ts` | Único cliente de Supabase |
| `src/types/projects.ts` | Sus tipos se usan en todo el dashboard |
| `src/pages/dashboard/ProjectDetail.tsx` | Estados interdependientes |
| `supabase/migrations/` | El orden es irreversible en producción |
| `src/lib/portal.ts` + RPC SQL | Portal público por token |

Detalle en `docs/context/PROJECT_CONTEXT.md` (sección Riesgos).

## Sistema de diseño
- Landing y Navbar: tokens MS (`useMsThemeVars`, clases `.ms-*` en `src/index.css`).
- Dashboard, auth y portal de clientes: shadcn con tokens HSL.
- Las reglas de cada zona están en `.claude/rules/` y se cargan solas al tocar sus archivos.

## Delegación
- UI y sistema de diseño → `ui-system` · textos, CRO y SEO → `marketing` · tests y accesibilidad → `qa`
- Datos, auth y Edge Functions → `supabase` · auditoría de auth, RLS y datos → `security`
- Después de cualquier cambio de código → `revisor`
- Tareas largas → `/godmode` · decisiones de arquitectura → `/l99`
- Inventario de skills por agente: `.claude/SKILLS.md`

## Definición de terminado
- Gate en verde, tests nuevos para lógica nueva y pgTAP si cambia la base de datos.
- `revisor` sin hallazgos críticos; `security` también, si el cambio toca auth o datos.
- Resumen final: qué cambió, cómo se verificó y qué queda pendiente.

## Pregunta antes de
- Cambiar el sistema de tokens o el copy de productos.
- Borrar dependencias, crear rutas nuevas, o modificar CI o `.claude/settings.json`.
- Cualquier paso que deba ejecutarse en producción.

## Continuidad entre sesiones
- Al empezar: lee la última entrada de la bitácora (ubicación en `CLAUDE.local.md`).
- Al terminar una sesión de trabajo, o cuando el usuario diga que cerramos: ejecuta `/bitacora`.
