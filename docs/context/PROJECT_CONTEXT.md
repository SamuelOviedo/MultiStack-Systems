# PROJECT_CONTEXT.md — MultiStack Systems

> Documento de referencia técnica persistente. Actualizar cuando cambie arquitectura, patrones o decisiones relevantes.

---

## Overview

### Propósito
Plataforma de gestión de proyectos para una agencia de desarrollo web. Permite al equipo interno gestionar el ciclo de vida completo de proyectos (pipeline, servicios, mantenimiento, tickets), y a los clientes acceder a un portal público sin autenticación para ver el estado de su proyecto y crear solicitudes.

### Arquitectura real
Monolítica full-stack basada en Supabase. Sin API REST propia:

```
React SPA (Vite)
  └─ Llama directamente a Supabase PostgREST + RPC
       └─ PostgreSQL con RLS (seguridad a nivel de fila)
            └─ Edge Functions (Deno) para email/notificaciones
```

Tres contextos de usuario:
- **Admin / Staff** (`user_type: 0, 1`) — acceso completo al dashboard
- **Client interno** (`user_type: 2`) — acceso a MisSolicitudes
- **Client externo** — portal público via token en URL, sin autenticación

### Stack

| Capa | Tecnología | Versión |
|---|---|---|
| UI | React | 18.3.1 |
| Language | TypeScript | 5.8.3 (strict: OFF) |
| Build | Vite + SWC | 5.4.19 |
| Routing | React Router | 6.30.1 |
| Styles | Tailwind CSS | 3.4.17 |
| Components | shadcn-ui + Radix UI | — |
| Backend | Supabase | 2.100.1 |
| DB | PostgreSQL (Supabase) | 14.4 |
| Functions | Deno (Supabase Edge) | — |
| Email | Resend API (vía Edge Function) | — |
| Deploy | Vercel (SPA) | — |

**Instalado pero NO usado:** `@tanstack/react-query`, `react-hook-form` (parcial), `recharts`

---

## Estructura

```
/
├── src/
│   ├── pages/          — Páginas completas (lógica + UI mezcladas)
│   ├── components/
│   │   ├── dashboard/  — Modales y drawers del flujo de proyectos
│   │   ├── ui/         — 70+ componentes shadcn auto-generados (NO EDITAR)
│   │   └── *.tsx       — Componentes globales (Navbar, ProtectedRoute, etc.)
│   ├── hooks/          — useAuth, use-toast, use-mobile
│   ├── lib/            — Capa de acceso a datos (projects.ts, tickets.ts, portal.ts)
│   ├── types/          — Enums y tipos de dominio (projects.ts, tickets.ts)
│   └── integrations/
│       └── supabase/   — client.ts (singleton), types.ts (auto-generado)
│
├── supabase/
│   ├── migrations/     — 6 archivos SQL con esquema + RLS + RPC
│   └── functions/      — send-auth-email, send-notification (Deno)
│
├── docs/
│   ├── context/        — Documentación técnica, arquitectura y guías AI
│   │   └── PROJECT_CONTEXT.md  — Este archivo
│   └── brand/          — Manuales de marca y handoff de diseño
├── claude_design/      — Documentos de diseño de referencia (no código activo)
├── scripts/            — tooling del repositorio
└── vite.config.ts      — Code splitting manual
```

### Responsabilidades por carpeta

| Carpeta | Responsabilidad |
|---|---|
| `src/pages/` | UI + lógica de carga de datos. Cada página es autónoma. |
| `src/lib/` | Todas las llamadas a Supabase. Única fuente de verdad para queries. |
| `src/hooks/` | Estado global (useAuth) y utilidades de React. |
| `src/types/` | Enums, constantes de configuración visual, tipos de dominio. |
| `src/components/dashboard/` | Componentes de UI complejos del flujo principal. |
| `src/components/ui/` | Componentes shadcn. No modificar directamente. |
| `supabase/migrations/` | Schema completo de la base de datos. Orden de ejecución crítico. |
| `supabase/functions/` | Lógica de email. No accesibles desde cliente directamente. |

---

## Frontend

### Flujo de datos

```
User interaction (click/submit)
  → useState local o form handler en Page
    → función de lib/ (projects.ts, tickets.ts, portal.ts)
      → supabase.from(...).select/insert/update/delete()
        → resultado → setState → re-render
          → toast de éxito/error
```

### Estado global

Solo **Context API** via `useAuth`:
- `session` — sesión de Supabase
- `user` — objeto user de Supabase Auth
- `userType` — 0 (admin), 1 (staff), 2 (client) — cargado desde tabla `profiles`
- `loading` — estado de carga inicial

Todo lo demás es `useState` local en el componente que lo necesita.

**No hay Zustand, Redux ni React Query activo.**

### Componentes críticos

| Componente | Rol |
|---|---|
| `ProtectedRoute` | Wrapper RBAC. Acepta `allowedTypes` array. |
| `Navbar` | Navegación condicional por `userType`. |
| `AuthBrandPanel` | Panel lateral visual en Login/Signup. |
| `StageDrawer` | Gestión de etapas del pipeline. Alto acoplamiento con ProjectDetail. |
| `TicketDrawer` | Vista/respuesta de tickets. |
| `NewProjectModal` | Formulario de creación de proyecto. |
| `ClientAccessSection` | Gestión de tokens de acceso para portal. |

### Routing

```tsx
/ → Index (landing)
/login → Login
/signup → Signup
/auth/callback → AuthCallback (OAuth)
/auth/reset-password → ResetPassword
/dashboard → Dashboard [user_type: 0, 1]
/project/:id → ProjectDetail [user_type: 0, 1]
/tickets → TicketsGlobal [user_type: 0, 1]
/mis-solicitudes → MisSolicitudes [user_type: 2]
/client/:token → ClientPortal [público, sin auth]
* → NotFound
```

`ProtectedRoute` envuelve todas las rutas del dashboard. `ClientPortal` es pública.

---

## Backend

### APIs — Supabase RPC (portal sin auth)

Estas funciones corren con `SECURITY DEFINER` y validan el token internamente:

```sql
portal_get_project(p_token text)
portal_get_tickets(p_token text)
portal_create_ticket(p_token, clientName, clientEmail, type, title, description)
portal_get_messages(p_token, ticket_id)
portal_add_message(p_token, ticket_id, senderName, message)
```

Usadas en `src/lib/portal.ts`. No requieren sesión de Supabase.

### Edge Functions

| Función | Trigger | Descripción |
|---|---|---|
| `send-auth-email` | Supabase Auth hook | Emails de confirmación y recovery con HTML styled |
| `send-notification` | Manual desde tickets.ts | Notifica team y cliente en cambios de ticket |

Las notificaciones fallan silenciosamente si Resend API cae. **No hay retry ni queue.**

### Auth

- Providers: email/password, GitHub OAuth, Google OAuth
- Email confirmation requerido antes de acceder al dashboard (OAuth lo setea automáticamente)
- Trigger en `auth.users` crea registro en `profiles` automáticamente con `user_type=2`
- `ProtectedRoute` bloquea si `email_confirmed_at` es null
- OAuth callback manejado en `src/pages/AuthCallback.tsx` — dos `useEffect` separados: exchange del code y redirect por userType
- `ProtectedRoute` redirige `user_type: 2` a `/solicitudes`, no a `/`
- Todos los usuarios nuevos (incluyendo OAuth) empiezan con `user_type: 2` — admins requieren actualización manual en Supabase
- Documentación completa: `docs/auth-flow.md` y `docs/oauth-setup.md`

### Modelos de negocio (tipos TypeScript en `src/types/`)

- `Project` — proyecto con status, client info, fechas
- `ProjectStage` — etapa del pipeline (6 etapas fijas)
- `ProjectService` — servicios contratados (hosting, dominio, etc.)
- `ProjectMaintenance` — registro mensual de mantenimiento
- `Ticket` — soporte/solicitud con type, priority, status
- `TicketMessage` — mensajes en un ticket
- `ClientAccessToken` — token para portal público

---

## Base de datos

### Tablas y relaciones

```
auth.users (Supabase)
  ├── profiles (1:1) — user_type, nombre_usuario
  └── proyectos_clientes (1:N) — proyectos del usuario
        ├── project_stages (1:N) — etapas del pipeline
        ├── project_services (1:N) — servicios contratados
        ├── project_maintenance (1:N) — registros mensuales
        ├── client_access_tokens (1:N) — tokens del portal
        └── tickets (1:N, project_id nullable)
              └── ticket_messages (1:N) — conversación
```

### Enums en base de datos (CHECK constraints, no ENUM type)

```sql
-- proyectos_clientes.estado
'en_analisis' | 'en_desarrollo' | 'activo' | 'mantenimiento' | 'pausado' | 'cancelado'

-- project_stages.stage_key
'analisis' | 'dominio' | 'desarrollo' | 'despliegue' | 'entrega' | 'mantenimiento'

-- project_services.service_type
'domain' | 'hosting' | 'database' | 'cdn' | 'other'

-- project_maintenance.status
'pendiente' | 'en_proceso' | 'completado'

-- tickets.type
'modificacion' | 'bug' | 'consulta' | 'pago' | 'mantenimiento' | 'otro' | 'solicitud'

-- tickets.priority
'baja' | 'media' | 'alta' | 'urgente'

-- tickets.status
'abierto' | 'en_revision' | 'en_progreso' | 'resuelto' | 'cerrado'
```

**Estos enums deben mantenerse sincronizados con los tipos en `src/types/`.**

### RLS

Todas las tablas tienen RLS activo. Políticas basadas en `auth.uid() = user_id`. Las funciones RPC del portal usan `SECURITY DEFINER` y validan token internamente.

### No hay ORM

Queries directas vía Supabase JS SDK (`supabase.from(...)`). Los tipos se definen manualmente en `src/types/` y `src/integrations/supabase/types.ts` (este último auto-generado e incompleto).

---

## Convenciones

### Naming

| Contexto | Convención | Ejemplo |
|---|---|---|
| Tablas SQL | snake_case | `proyectos_clientes` |
| Columnas SQL | snake_case | `fecha_creacion`, `client_name` |
| Tipos TypeScript | PascalCase | `ProjectStatus`, `Ticket` |
| Variables/props | camelCase | `projectId`, `clientName` |
| Constantes config | UPPER_SNAKE_CASE | `PIPELINE_STAGES`, `STATUS_CONFIG` |
| Archivos componentes | PascalCase | `StageDrawer.tsx` |
| Archivos lib/utils | camelCase | `projects.ts`, `siteUrl.ts` |

**Inconsistencia conocida:** `estado` / `status` / `state` se usan para el mismo concepto en distintos archivos.

### Patrones establecidos

1. **Acceso a Supabase solo desde `src/lib/`** — pages y componentes no llaman a Supabase directamente (aunque en la práctica no siempre se cumple)
2. **Estado local con `useState`** — no hay estado global excepto auth
3. **Toasts para feedback** — `useToast()` para errores, `sonner` para notificaciones rápidas
4. **Modales con estado boolean local** — `const [open, setOpen] = useState(false)`
5. **Tipos con configuración visual acoplada** — `STATUS_CONFIG` incluye label, color y icon

### Estructura de componente

```tsx
// Imports: React → libs → @/components → @/lib → @/types → @/hooks
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getProjects } from '@/lib/projects'
import type { Project } from '@/types/projects'

interface Props { ... }

export default function MyComponent({ prop }: Props) {
  const [state, setState] = useState(...)

  async function handleAction() {
    try {
      await libFunction(...)
      toast({ title: 'Éxito', ... })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return ( ... )
}
```

---

## Workflows

### Crear una nueva feature de UI

1. Crear el componente en `src/components/` o `src/pages/`
2. Si necesita datos: crear función en `src/lib/` que llame a Supabase
3. Si necesita tipos nuevos: agregarlos en `src/types/`
4. Si necesita tabla nueva: crear migración en `supabase/migrations/` con nombre `YYYYMMDDHHMMSS_descripcion.sql`
5. Agregar RLS policies en la misma migración
6. Registrar ruta en `src/App.tsx` si es página
7. Si requiere auth: envolver en `<ProtectedRoute allowedTypes={[0, 1]}>`

### Crear un componente

```tsx
// En src/components/NombreComponente.tsx
// - Default export
// - Props tipadas con interface
// - Estado local con useState
// - Llamadas a lib/ para datos
// - useToast para feedback
// - NO llamar a supabase directamente desde el componente
```

### Crear un endpoint (función en lib/)

```ts
// En src/lib/dominio.ts
import { supabase } from '@/integrations/supabase/client'
import type { MiTipo } from '@/types/dominio'

export async function getFoo(id: string): Promise<MiTipo[]> {
  const { data, error } = await supabase
    .from('mi_tabla')
    .select('*')
    .eq('id', id)

  if (error) throw error
  return data
}
```

### Crear una migración SQL

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_descripcion.sql
-- 1. CREATE TABLE con todas las columnas y constraints
-- 2. ALTER TABLE ENABLE ROW LEVEL SECURITY
-- 3. CREATE POLICY para SELECT, INSERT, UPDATE, DELETE
-- 4. CREATE INDEX si hay queries por columna específica
-- 5. Si es RPC pública: SECURITY DEFINER + GRANT EXECUTE TO anon
```

### Hacer un fix

1. Identificar el archivo en `src/lib/` o el componente
2. Cambio mínimo — no refactorizar alrededor del fix
3. Verificar que los tipos de `src/types/` no cambien (si cambian, actualizar todos los usos)
4. Si toca `useAuth.tsx` o `client.ts`: máxima precaución, probar flujo completo de auth
5. Si toca migraciones SQL: **no editar migraciones existentes**, crear una nueva

---

## Riesgos

### Zonas delicadas

| Zona | Riesgo | Por qué |
|---|---|---|
| `useAuth.tsx` | Alto | Auth state central. Tiene `setTimeout(0)` workaround. Fácil crear race conditions. |
| `client.ts` | Alto | Único singleton de Supabase. Tiene credenciales fallback hardcodeadas. |
| `src/types/projects.ts` | Alto | Cambiar los union types rompe `STATUS_CONFIG`, filtros y componentes en cascada. |
| `ProjectDetail.tsx` | Alto | 686 líneas entrelazadas. Múltiples estados interdependientes. |
| `supabase/migrations/` | Alto | Orden de ejecución es irreversible en producción. |
| `portal.ts` + RPC SQL | Medio | Portal público sin auth. Token en URL. Sin rate limiting. |

### Side effects frecuentes

- Cambiar un enum en `src/types/` → rompe `STATUS_CONFIG` → rompe badges visuales
- Cambiar nombre de tabla/columna en migración sin actualizar `src/lib/` → silent fail con TypeScript permisivo
- Agregar campo a `proyectos_clientes` sin actualizar el select en `getProject()` → campo no llega al frontend
- Modificar `send-auth-email` Edge Function → puede romper confirmación de emails en registro

### Partes acopladas

- `ProjectDetail.tsx` ↔ `StageDrawer.tsx` ↔ `lib/projects.ts` (tipos compartidos, callbacks anidados)
- `useAuth.tsx` ↔ `ProtectedRoute.tsx` ↔ `Navbar.tsx` (todos leen `userType`)
- `portal.ts` ↔ RPC SQL functions (si cambia firma de RPC, hay que actualizar ambos)
- `src/types/projects.ts` ↔ TODO el dashboard (STATUS_CONFIG, PIPELINE_STAGES usados en 6+ archivos)

---

## Tech Debt

### Problemas activos

| Severidad | Problema | Ubicación |
|---|---|---|
| Crítica | TypeScript permisivo: `strict:false`, `noImplicitAny:false`, 57+ `as any` | tsconfig.json |
| Crítica | Credenciales Supabase hardcodeadas como fallback | `client.ts` |
| Crítica | `ProjectDetail.tsx` — 686 líneas, monolito inmanejable | `src/pages/ProjectDetail.tsx` |
| Alta | `@tanstack/react-query` instalado, nunca usado | package.json |
| Alta | Cero tests escritos (Vitest + Playwright configurados) | — |
| Alta | Email notifications fallan silenciosamente | `tickets.ts`, `send-notification` |
| Alta | Sin pagination en queries — cliff de performance | `lib/tickets.ts`, `lib/projects.ts` |
| Alta | Sin monitoring/observabilidad en producción | — |
| Media | Migración `20260326` duplica `20260324` | `supabase/migrations/` |
| Media | Portal token expuesto en URL del browser | `ClientPortal.tsx` |
| Media | `setTimeout(0)` workaround en auth | `useAuth.tsx` |
| Media | Sin soft deletes — datos irrecuperables | Todas las tablas |
| Baja | `react-hook-form` importado pero no usado consistentemente | varios |
| Baja | `recharts` instalado, sin uso visible | package.json |

**Resuelto:**
- ~~`AuthCallback` redirigía hardcoded a `/dashboard`~~ — corregido con redirect por `userType`
- ~~`ProtectedRoute` mandaba `user_type: 2` a `/` (landing)~~ — corregido a `/solicitudes`
- ~~Cero tests escritos~~ — base de tests funcional: 12 tests Vitest + 6 tests Playwright
- ~~`playwright.config.ts` roto~~ (`lovable-agent-playwright-config` no instalado) — reemplazado con config estándar

### Inconsistencias conocidas

- `estado` / `status` / `state` — mismo concepto, 3 nombres distintos
- Form handling con 3 patrones distintos en 3 componentes distintos
- Error handling: a veces toast, a veces silent catch, a veces re-throw
- Fechas: a veces inline `toLocaleDateString("es-HN")`, a veces helper `formatMonth()`
- SQL usa `text CHECK (...)` para enums; TypeScript usa union types — pueden desincronizarse

### Duplicaciones

- Lógica de filtros/sort en Dashboard y TicketsGlobal
- Patrón `toast({ title: "Error", description: e.message, variant: "destructive" })` — 15+ lugares
- HTML de emails en 3 funciones casi idénticas
- RLS `EXISTS` subquery repetida 6 veces en migraciones
- Configuración label+color+icon repetida para cada tipo de enum

---

## Reglas para IA

### NO modificar sin instrucción explícita

- `src/components/ui/` — componentes shadcn auto-generados
- `src/integrations/supabase/types.ts` — auto-generado por Supabase CLI
- `supabase/migrations/` existentes — nunca editar, solo agregar nuevas
- `tailwind.config.ts` — custom fonts y colores establecidos
- `vite.config.ts` — code splitting configurado deliberadamente

### Patrones a respetar

- Acceso a Supabase **solo desde `src/lib/`**, nunca directo en componentes
- Default exports en todos los archivos de componentes y páginas
- Path aliases `@/` en todos los imports internos
- Tipos de dominio definidos en `src/types/`, no inline en componentes
- Constantes de configuración visual (`STATUS_CONFIG`, `PIPELINE_STAGES`) en `src/types/`
- Toasts con `useToast()` para errores destructivos
- `ProtectedRoute` con `allowedTypes` para control de acceso

### Cómo hacer cambios mínimos

- Un fix = tocar solo el archivo que tiene el bug, no refactorizar alrededor
- No agregar abstracciones si no hay 3+ usos del patrón
- No cambiar convenciones existentes aunque sean inconsistentes — documentarlas aquí
- Si hay que tocar `src/types/`, buscar todos los usos antes de cambiar
- Si hay que tocar auth, probar el flujo completo: registro → confirmación → login → dashboard
- Si hay que agregar tabla: crear migración nueva, no editar existentes

---

## Comandos útiles

```bash
# Desarrollo
npm run dev           # Vite dev server (puerto 8080 según vite.config.ts)

# Build
npm run build         # Build producción
npm run build:dev     # Build en modo development
npm run preview       # Preview del build

# Tests
npm run test          # Vitest run (un solo pase)
npm run test:watch    # Vitest en modo watch

# Lint
npm run lint          # ESLint

# Supabase
supabase start        # Levantar Supabase local (Docker)
supabase db push      # Aplicar migraciones pendientes
supabase db reset     # Reset completo + re-run todas las migraciones
supabase gen types    # Regenerar src/integrations/supabase/types.ts
supabase functions serve  # Servir Edge Functions localmente

# npm (toolchain canónico)
npm run dev
npm run build
```

---

## Dependencias críticas

| Librería | Rol | Impacto si falla |
|---|---|---|
| `@supabase/supabase-js` | DB + Auth + RPC | App completamente inoperativa |
| `react-router-dom` | Navegación SPA | Sin routing, app rota |
| `@radix-ui/*` | Primitivos de UI | Componentes sin accesibilidad/funcionalidad |
| `tailwind-merge` + `clsx` | Utilidades CSS | Clases Tailwind rotas |
| `lucide-react` | Iconografía | Visual degradado |
| `framer-motion` | Animaciones UI | Visual degradado |
| `sonner` | Toast notifications | Sin feedback visual rápido |
| Resend API (externo) | Emails auth + notificaciones | Sin confirmación de email, sin notificaciones |
| Vercel (externo) | Deploy | Sin frontend en producción |

---

## Checklist antes de hacer commits

### Cambios en componentes / páginas
- [ ] El componente no llama a Supabase directamente (usa `src/lib/`)
- [ ] Los tipos están importados desde `src/types/`, no definidos inline
- [ ] El error handling usa `toast()`, no `console.error` ni silent fail
- [ ] Las rutas nuevas están en `App.tsx` con `ProtectedRoute` si aplica

### Cambios en `src/lib/`
- [ ] Cada función exportada tiene tipo de retorno explícito
- [ ] Los errores de Supabase se propagan con `if (error) throw error`
- [ ] No hay `as any` innecesarios

### Cambios en `src/types/`
- [ ] Todos los archivos que importan el tipo modificado fueron revisados
- [ ] El enum en TypeScript sigue sincronizado con el CHECK constraint en SQL

### Cambios en `supabase/migrations/`
- [ ] El archivo es NUEVO, no una edición de migración existente
- [ ] Incluye `ALTER TABLE ENABLE ROW LEVEL SECURITY`
- [ ] Incluye políticas RLS para todos los roles necesarios
- [ ] Nombre de archivo: `YYYYMMDDHHMMSS_descripcion.sql`

### Cambios en Edge Functions
- [ ] La función maneja errores con respuesta HTTP apropiada (no solo `throw`)
- [ ] No hay secrets hardcodeados (usar `Deno.env.get(...)`)

### General
- [ ] `npm run lint` sin errores
- [ ] `npm run build` compila sin errores de TypeScript
- [ ] `npm run test` — todos los tests de Vitest pasan
- [ ] Si tocaste auth: probaste flujo completo login → dashboard → logout
- [ ] Si tocaste portal: probaste acceso con token válido e inválido
- [ ] Variables de entorno nuevas están en `.env.example`
