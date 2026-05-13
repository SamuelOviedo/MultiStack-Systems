# MultiStack Systems

Plataforma de gestión de proyectos para agencia de desarrollo web. Permite al equipo gestionar el ciclo de vida de proyectos (pipeline, servicios, mantenimiento, tickets) y a los clientes acceder a un portal público sin cuenta.

---

## Inicio rápido

```bash
# 1. Clonar e instalar
git clone <repo-url>
cd MultiStack-Systems
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales de Supabase

# 3. Levantar servidor de desarrollo
npm run dev
# → http://localhost:8080
```

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS + shadcn-ui |
| Routing | React Router 6 |
| Backend / DB | Supabase (PostgreSQL + Auth + Edge Functions) |
| Deploy | Vercel |

---

## Comandos

```bash
npm run dev          # Servidor de desarrollo (puerto 8080)
npm run build        # Build de producción
npm run lint         # ESLint

npm run test         # Tests unitarios (Vitest)
npm run test:watch   # Tests en modo watch
npm run test:e2e     # Tests end-to-end (Playwright) — requiere dev server activo

# Supabase
supabase start       # Levantar DB local
supabase db push     # Aplicar migraciones pendientes
supabase db reset    # Reset completo y re-run de migraciones
supabase gen types   # Regenerar src/integrations/supabase/types.ts
```

Para correr Playwright por primera vez:
```bash
npx playwright install chromium
npm run test:e2e
```

---

## Estructura principal

```
src/
  pages/       — páginas de la app
  components/  — componentes UI reutilizables
  hooks/       — useAuth, use-toast
  lib/         — acceso a Supabase (projects, tickets, portal)
  types/       — tipos y enums de dominio

supabase/
  migrations/  — schema SQL + RLS + RPC
  functions/   — Edge Functions (email con Resend)
```

---

## Roles de usuario

| user_type | Rol | Acceso |
|---|---|---|
| `0` | Admin | Dashboard completo |
| `1` | Staff | Dashboard completo |
| `2` | Client | Solo `/solicitudes` |

Los usuarios nuevos (incluyendo OAuth) empiezan con `user_type: 2`. Los admin/staff se actualizan manualmente en Supabase Dashboard → Table Editor → profiles.

---

## Autenticación

Soporta email/password, GitHub OAuth y Google OAuth vía Supabase Auth.

Para activar OAuth en un entorno nuevo: ver [`docs/oauth-setup.md`](docs/oauth-setup.md).

---

## Testing

```bash
# Unitarios (Vitest + Testing Library)
npm run test

# E2E (Playwright)
npx playwright install chromium   # primera vez
npm run test:e2e
```

Estrategia y estructura de tests: [`docs/testing-strategy.md`](docs/testing-strategy.md)

---

## AI-First Workflow

Este proyecto está optimizado para trabajar con Claude Code. Guía completa: [`CONTRIBUTING_AI.md`](CONTRIBUTING_AI.md)

**Antes de implementar, siempre analizar:**
```
Lee QUICK_CONTEXT.md antes de empezar.
Área: [componente / módulo concreto].
Objetivo: [una sola cosa].
No tocar: [archivos fuera de scope].
```

**Reglas clave:**
- Supabase solo desde `src/lib/` — nunca directo en componentes
- Un cambio = un archivo principal — si toca 5+ archivos no relacionados, está mal encuadrado
- Migraciones SQL solo hacia adelante — nunca editar las existentes
- `npm run build` antes de commitear — atrapa errores reales
- Cambio mínimo — no refactorizar alrededor del fix

**Zonas peligrosas — confirmar antes de tocar:**

| Archivo | Riesgo |
|---|---|
| `src/hooks/useAuth.tsx` | Auth global, race conditions |
| `src/types/projects.ts` | Cambiar enums rompe en cascada |
| `src/pages/ProjectDetail.tsx` | 686 líneas entrelazadas |
| `supabase/migrations/` | Irreversible en producción |

---

## Documentación

| Archivo | Contenido |
|---|---|
| [`QUICK_CONTEXT.md`](QUICK_CONTEXT.md) | Resumen del proyecto en 5 minutos |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Referencia técnica completa |
| [`ARCHITECTURE_MAP.md`](ARCHITECTURE_MAP.md) | Flujos, dependencias y capas |
| [`CONTRIBUTING_AI.md`](CONTRIBUTING_AI.md) | Cómo trabajar con Claude Code |
| [`PROMPTS.md`](PROMPTS.md) | Prompts reutilizables para Claude Code |
| [`docs/auth-flow.md`](docs/auth-flow.md) | Auth flow completo |
| [`docs/oauth-setup.md`](docs/oauth-setup.md) | Setup de GitHub y Google OAuth |
| [`docs/testing-strategy.md`](docs/testing-strategy.md) | Estrategia de tests |
