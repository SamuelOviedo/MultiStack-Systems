# QUICK_CONTEXT.md — MultiStack Systems

> Lectura de 5 minutos. Para detalle completo: `PROJECT_CONTEXT.md`, `ARCHITECTURE_MAP.md`, `CONTRIBUTING_AI.md`.

---

## Qué es el proyecto

Plataforma interna de una agencia de desarrollo web. Tiene dos lados:

- **Team (admin/staff):** gestiona proyectos, pipeline de etapas, servicios, mantenimiento y tickets.
- **Clientes:** acceden a un portal público via link con token — sin cuenta, sin login.

Tres tipos de usuario: `admin (0)`, `staff (1)`, `client (2)`.

---

## Stack

```
React 18 + TypeScript 5.8 (strict: OFF)    → frontend
Vite 5 + SWC                               → build
Tailwind CSS 3 + shadcn-ui                 → estilos y componentes
React Router 6                             → routing
Supabase JS 2                              → DB + auth + storage
PostgreSQL (Supabase) + RLS                → base de datos con seguridad a nivel fila
Deno (Supabase Edge Functions)             → email via Resend API
Vercel                                     → deploy
```

**Librerías instaladas pero NO usadas:** `@tanstack/react-query`, `recharts`.

---

## Arquitectura

```
React SPA
  └─ src/lib/*.ts          ← ÚNICA capa que habla con Supabase
       └─ Supabase PostgREST / RPC
            └─ PostgreSQL + RLS
```

Sin API REST propia. Sin estado global salvo auth. Sin cache de queries.

**Portal público:** `ClientPortal.tsx` → `lib/portal.ts` → RPC SQL con `SECURITY DEFINER` (sin JWT, valida token contra tabla).

---

## Convenciones

| Qué | Convención |
|---|---|
| Tablas SQL | `snake_case` |
| Tipos TypeScript | `PascalCase` |
| Variables / props | `camelCase` |
| Constantes de config | `UPPER_SNAKE_CASE` |
| Archivos componentes | `PascalCase.tsx` |
| Archivos lib/utils | `camelCase.ts` |
| Imports internos | siempre `@/`, nunca rutas relativas |
| Exports | siempre default |

**Inconsistencia conocida:** `estado` / `status` / `state` se usan para el mismo concepto en distintos archivos. No "arreglar" sin acordarlo.

---

## Flujo principal

**Autenticado (team):**
```
Componente → lib/projects.ts o tickets.ts → supabase.from() → RLS → dato/error → toast
```

**Portal (sin auth):**
```
/client/:token → lib/portal.ts → supabase.rpc('portal_*', { token }) → SQL valida token → dato
```

**Auth:**
```
signInWithPassword → onAuthStateChange → fetchUserType(profiles) → setUserType → ProtectedRoute
```

---

## Comandos importantes

```bash
npm run dev          # Dev server (puerto 8080)
npm run build        # Build producción — usa esto para verificar TypeScript
npm run lint         # ESLint
npm run test         # Vitest (suite actual del proyecto)

supabase start       # Levantar DB local (Docker)
supabase db push     # Aplicar migraciones pendientes
supabase db reset    # Reset completo + re-run migraciones
supabase gen types   # Regenerar src/integrations/supabase/types.ts
```

---

## Zonas peligrosas

| Archivo | Por qué es peligroso |
|---|---|
| `src/integrations/supabase/client.ts` | Singleton. Todo depende de aquí. |
| `src/hooks/useAuth.tsx` | Auth global. Tiene un `setTimeout(0)` como workaround de deadlock. |
| `src/types/projects.ts` | Cambiar un enum rompe dashboard + filtros + badges en cascada. |
| `src/pages/ProjectDetail.tsx` | 686 líneas, 5 estados interdependientes. Muy frágil. |
| `supabase/migrations/` | Nunca editar las existentes. Solo agregar nuevas. |
| `src/components/ui/` | shadcn auto-generado. No editar directo. Crear wrapper si necesitas cambiar. |

---

## Patrones dominantes

**1. Acceso a datos solo desde `src/lib/`**
```ts
// ✓ Correcto — en una página
const projects = await getProjects(userId)

// ✗ Incorrecto — en una página
const { data } = await supabase.from('proyectos_clientes').select(...)
```

**2. Error handling estándar**
```ts
// En lib/
const { data, error } = await supabase.from(...)...
if (error) throw error

// En componente
} catch (e: any) {
  toast({ title: 'Error', description: e.message, variant: 'destructive' })
}
```

**3. Estado local con useState — sin excepciones**
```ts
// Cada página/componente maneja su propio estado
const [tickets, setTickets] = useState<Ticket[]>([])
const [open, setOpen] = useState(false)
```

**4. Configuración visual acoplada a tipos**
```ts
// En src/types/ viven los enums Y su presentación visual
export const STATUS_CONFIG = {
  en_analisis: { label: 'En análisis', color: 'text-yellow-400', icon: Clock },
  ...
}
```

**5. Migraciones solo hacia adelante**
```
supabase/migrations/20260512000000_mi_cambio.sql  ← nueva
supabase/migrations/20260423200000_tickets.sql    ← nunca tocar
```

---

## Cómo trabajar correctamente aquí

**Reglas rápidas:**

1. **Supabase solo en `src/lib/`** — nunca importar `supabase` en componentes o páginas.
2. **Tipos de dominio en `src/types/`** — no definir tipos inline en componentes.
3. **Migraciones nuevas, nunca editar existentes** — el orden de ejecución es irreversible.
4. **`npm run build` antes de commitear** — TypeScript es permisivo pero el build atrapa errores reales.
5. **Cambio mínimo** — no refactorizar lo que está alrededor del fix.
6. **Si tocas `src/types/`** — buscar todos los usos antes de cambiar.

**Flujo para agregar algo nuevo:**

```
1. Tipo en src/types/ (si es modelo de dominio)
2. Función en src/lib/ (si necesita Supabase)
3. Componente en src/components/ o página en src/pages/
4. Ruta en App.tsx con ProtectedRoute si aplica
5. Migración nueva en supabase/migrations/ si hay cambio de schema
```

**Antes de tocar algo:**
```
¿Qué otros archivos importan esto?
¿Hay un patrón ya establecido para lo que voy a hacer?
¿Estoy tocando más de un archivo crítico a la vez?
```
