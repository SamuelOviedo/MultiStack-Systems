# ARCHITECTURE_MAP.md — MultiStack Systems

> Mapa técnico de la arquitectura real del sistema. No es el diseño ideal, es lo que existe.

---

## Flujo general del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIOS                                 │
│                                                                 │
│   ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐  │
│   │ Admin / Staff│   │Client interno│   │  Client externo   │  │
│   │ user_type 0,1│   │ user_type 2  │   │  (sin cuenta)     │  │
│   └──────┬───────┘   └──────┬───────┘   └─────────┬─────────┘  │
└──────────┼────────────────┼───────────────────────┼────────────┘
           │                │                       │
           ▼                ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   REACT SPA (Vite)                              │
│                                                                 │
│  /dashboard          /mis-solicitudes       /client/:token      │
│  /project/:id        /login                                     │
│  /tickets            /signup               (portal público)     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    src/lib/                               │  │
│  │   projects.ts    tickets.ts    portal.ts    siteUrl.ts   │  │
│  └───────────────────────┬───────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
┌──────────────┐   ┌──────────────┐  ┌───────────────┐
│  PostgREST   │   │  RPC (SQL)   │  │ Edge Functions│
│  REST API    │   │  (portal)    │  │   (Deno)      │
└──────┬───────┘   └──────┬───────┘  └───────┬───────┘
       │                  │                  │
       └──────────┬────────┘                 │
                  ▼                          ▼
        ┌─────────────────┐        ┌─────────────────┐
        │   PostgreSQL    │        │   Resend API    │
        │   + RLS         │        │   (email)       │
        └─────────────────┘        └─────────────────┘
```

---

## Frontend → Backend

### Flujo de una operación normal (usuario autenticado)

```
User click / form submit
        │
        ▼
Page o Component (src/pages/ o src/components/)
  useState, event handler
        │
        ▼
src/lib/*.ts  ──────────────────────────────────────────────────┐
  projects.ts / tickets.ts                                      │
        │                                                       │
        ▼                                                       │
supabase.from('tabla')                                          │
  .select() / .insert() / .update() / .delete()                 │
        │                                                       │
        ▼                                                       │
Supabase PostgREST                                              │
  Valida JWT en Authorization header                            │
        │                                                       │
        ▼                                                       │
PostgreSQL RLS Policies                                         │
  auth.uid() = user_id  ──────────────────── DENY ─────────────┘
        │                                      │
       ALLOW                               error thrown
        │                                      │
        ▼                                      ▼
  { data, error }                     catch(e) → toast error
        │
        ▼
setState() → re-render
  + toast de éxito
```

### Flujo del portal público (sin autenticación)

```
Browser → /client/:token
        │
        ▼
ClientPortal.tsx (src/pages/)
  Extrae token de URL params
        │
        ▼
src/lib/portal.ts
  supabase.rpc('portal_get_project', { p_token: token })
        │
        ▼
Supabase RPC (SECURITY DEFINER)
  No requiere JWT — ejecuta con privilegios del owner
        │
        ▼
SQL function: portal_get_project(p_token)
  SELECT * FROM client_access_tokens WHERE token = p_token AND active = true
        │
   ┌────┴────┐
  found   not found
   │          │
   ▼          ▼
datos      NULL → error "token inválido"
   │
   ▼
Retorna project + tickets al componente
```

---

## Auth Flow

### Registro

```
Signup.tsx
  supabase.auth.signUp({ email, password })
        │
        ▼
Supabase Auth
  Crea registro en auth.users
  email_confirmed_at = NULL
        │
        ▼
Edge Function: send-auth-email
  Genera HTML styled + link de confirmación
  Resend API → email al usuario
        │
        ▼
Trigger: handle_new_user() (SQL)
  INSERT INTO profiles (id, email, user_type=2)
  ← se ejecuta automáticamente en INSERT a auth.users
        │
        ▼
Usuario confirma email
  auth.users.email_confirmed_at = timestamp
```

### Login

```
Login.tsx
  supabase.auth.signInWithPassword({ email, password })
  o supabase.auth.signInWithOAuth({ provider })
        │
        ▼
Supabase Auth
  Valida credenciales
  Retorna { session, user }
        │
        ▼
AuthProvider (useAuth.tsx)
  onAuthStateChange listener recibe SIGNED_IN
  setSession(session)
  setUser(user)
        │
        ▼
setTimeout(0)  ← workaround deadlock Supabase JS
  fetchUserType(user.id)
    SELECT user_type FROM profiles WHERE id = user.id
        │
        ▼
  setUserType(type)   ← 0=admin, 1=staff, 2=client
        │
        ▼
ProtectedRoute.tsx
  Verifica: session existe
  Verifica: user.email_confirmed_at != null
  Verifica: userType en allowedTypes[]
        │
   ┌────┴────┐
  pass      fail
   │          │
   ▼          ▼
children   redirect /login o warning
```

### Recovery de contraseña

```
Login.tsx → "¿Olvidaste tu contraseña?"
  supabase.auth.resetPasswordForEmail(email, { redirectTo })
        │
        ▼
Edge Function: send-auth-email (recovery type)
  Email con link de recovery
        │
        ▼
Usuario hace click → /auth/reset-password?token=...
  ResetPassword.tsx
    supabase.auth.updateUser({ password: newPassword })
        │
        ▼
Supabase actualiza encrypted_password
Redirect → /dashboard
```

### OAuth (Google / GitHub)

```
Login.tsx → botón OAuth
  supabase.auth.signInWithOAuth({ provider, redirectTo })
        │
        ▼
Redirect a provider → usuario autoriza
        │
        ▼
Redirect a /auth/callback
  AuthCallback.tsx
    supabase.auth.exchangeCodeForSession(code)
        │
        ▼
AuthProvider detecta SIGNED_IN
Redirect → /dashboard
```

---

## Estado global

Solo hay un estado verdaderamente global: la sesión de autenticación.

```
┌─────────────────────────────────────────────────────┐
│              AuthContext (useAuth.tsx)               │
│                                                     │
│  session: Session | null                            │
│  user: User | null                                  │
│  userType: 0 | 1 | 2 | null                        │
│  loading: boolean                                   │
│                                                     │
│  Persistencia: Supabase JS maneja localStorage      │
│  Refresh: automático via onAuthStateChange          │
└──────────────────────┬──────────────────────────────┘
                       │  useAuth() hook
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  Navbar.tsx    ProtectedRoute   cualquier componente
  (nav links)   (acceso RBAC)    que necesite user info
```

**Todo lo demás es estado local:**

```
Cada página/componente maneja su propio estado con useState:

ProjectDetail.tsx ──┐
                    ├── project: Project
                    ├── stages: ProjectStage[]
                    ├── services: ProjectService[]
                    ├── maintenance: ProjectMaintenance[]
                    ├── editing: boolean
                    ├── saving: boolean
                    └── drawerOpen: boolean

TicketsGlobal.tsx ──┐
                    ├── tickets: Ticket[]
                    ├── filters: FilterState
                    └── selectedTicket: Ticket | null

Dashboard.tsx ──────┐
                    ├── projects: Project[]
                    └── loading: boolean
```

---

## APIs

### PostgREST (Supabase REST — requiere auth)

Todas las requests llevan `Authorization: Bearer <JWT>` automáticamente via Supabase JS.

```
Tabla                    Operaciones          Usado en
────────────────────────────────────────────────────────────────
proyectos_clientes       SELECT, INSERT,      lib/projects.ts
                         UPDATE, DELETE

project_stages           SELECT, INSERT,      lib/projects.ts
                         UPDATE

project_services         SELECT, INSERT,      lib/projects.ts
                         UPDATE, DELETE

project_maintenance      SELECT, INSERT,      lib/projects.ts
                         UPDATE

tickets                  SELECT, INSERT,      lib/tickets.ts
                         UPDATE

ticket_messages          SELECT, INSERT       lib/tickets.ts

client_access_tokens     SELECT, INSERT,      ProjectDetail.tsx
                         UPDATE               ClientAccessSection.tsx

profiles                 SELECT              useAuth.tsx
```

### RPC Functions (portal — sin auth)

```
Función                         Archivo cliente         Descripción
────────────────────────────────────────────────────────────────────────
portal_get_project(token)       lib/portal.ts           Datos del proyecto
portal_get_tickets(token)       lib/portal.ts           Tickets del cliente
portal_create_ticket(token,...) lib/portal.ts           Crear solicitud
portal_get_messages(token,id)   lib/portal.ts           Mensajes de ticket
portal_add_message(token,id,..) lib/portal.ts           Responder ticket
```

Todas usan `SECURITY DEFINER` y validan el token contra `client_access_tokens` internamente.

### Edge Functions (Deno — invocadas via supabase.functions.invoke)

```
Función                  Trigger                  Descripción
────────────────────────────────────────────────────────────────────
send-auth-email          Supabase Auth hook       Email confirmación / recovery
                                                  HTML styled con Resend API

send-notification        lib/tickets.ts           Notifica cambios de tickets
                         (manual)                 al equipo y al cliente
                                                  Falla silenciosamente si Resend cae
```

---

## Base de datos

### Esquema de relaciones

```
auth.users (Supabase interno)
    │ id (UUID)
    │
    ├──► profiles (1:1)
    │        id, email, user_type (0=admin, 1=staff, 2=client), nombre_usuario
    │
    └──► proyectos_clientes (1:N)
             id, user_id, nombre_proyecto, descripcion
             estado: en_analisis | en_desarrollo | activo | mantenimiento | pausado | cancelado
             client_name, client_email, client_phone
             fecha_creacion, updated_at
             │
             ├──► project_stages (1:N, máximo 6 por proyecto)
             │        stage_key: analisis | dominio | desarrollo | despliegue | entrega | mantenimiento
             │        completed_at, completed_by, notes, metadata (JSONB)
             │
             ├──► project_services (1:N)
             │        service_type: domain | hosting | database | cdn | other
             │        provider, name, url, cost_monthly, cost_yearly
             │        renewal_date, currency, notes
             │
             ├──► project_maintenance (1:N, uno por mes)
             │        month (date), status: pendiente | en_proceso | completado
             │        tasks_done (text[]), notes, billed, billed_amount
             │
             ├──► client_access_tokens (1:N)
             │        token (UUID único), client_name, client_email
             │        active, last_accessed_at
             │
             └──► tickets (1:N, project_id nullable)
                      type: modificacion | bug | consulta | pago | mantenimiento | otro | solicitud
                      priority: baja | media | alta | urgente
                      status: abierto | en_revision | en_progreso | resuelto | cerrado
                      client_name, client_email, title, description
                      created_at, updated_at, resolved_at
                      │
                      └──► ticket_messages (1:N)
                               sender_type: client | team
                               sender_name, message, created_at
```

### RLS — Políticas de seguridad

```
Tabla                    Política principal
────────────────────────────────────────────────────────────────────
proyectos_clientes       user_id = auth.uid()
project_stages           project_id → proyectos_clientes.user_id = auth.uid()
project_services         project_id → proyectos_clientes.user_id = auth.uid()
project_maintenance      project_id → proyectos_clientes.user_id = auth.uid()
client_access_tokens     project_id → proyectos_clientes.user_id = auth.uid()
tickets                  project_id → proyectos_clientes.user_id = auth.uid()
                         + tickets sin project_id con client_email = auth.email()
ticket_messages          ticket_id → tickets → proyectos_clientes.user_id = auth.uid()
profiles                 id = auth.uid() (solo lectura propia)
```

Las funciones RPC del portal omiten RLS al ser `SECURITY DEFINER`.

### Triggers

```
Trigger: on_auth_user_created
  AFTER INSERT ON auth.users
  → INSERT INTO profiles (id, email, user_type=2)
  Se ejecuta automáticamente en cada registro
```

---

## Eventos importantes

Eventos del sistema que disparan efectos secundarios:

```
Evento                          Efecto inmediato              Efecto diferido
──────────────────────────────────────────────────────────────────────────────
usuario se registra             perfil creado (trigger SQL)   email confirmación (Resend)

usuario confirma email          email_confirmed_at set        acceso al dashboard habilitado

ticket creado                   INSERT en tickets             send-notification (equipo)
                                                              ← puede fallar silenciosamente

ticket actualizado (status)     UPDATE en tickets             send-notification (cliente)
                                                              ← puede fallar silenciosamente

mensaje en ticket               INSERT en ticket_messages     send-notification (contraparte)
                                                              ← puede fallar silenciosamente

token de portal creado          INSERT client_access_tokens   URL enviada manualmente al cliente

token de portal usado           UPDATE last_accessed_at       ninguno

stage completado                UPDATE project_stages         ninguno (sin side effects)

proyecto eliminado              CASCADE DELETE:               ninguno
                                  → stages, services,
                                    maintenance, tokens,
                                    tickets, messages
```

---

## Lifecycle de datos

### Lifecycle de un proyecto

```
CREAR                        GESTIONAR                     ARCHIVAR
────────────────────────────────────────────────────────────────────
1. NewProjectModal             ProjectDetail.tsx
   createProject()               ├── Editar metadata
   → INSERT proyectos_clientes   ├── Completar stages (pipeline)
   estado: en_analisis           ├── Agregar services
                                 ├── Registrar maintenance
                                 ├── Gestionar tickets
                                 └── Crear tokens de portal

                               Estado progresa:
                               en_analisis → en_desarrollo
                               → activo → mantenimiento
                               → pausado / cancelado

                                                           (no hay soft delete)
                                                           DELETE → CASCADE elimina todo
```

### Lifecycle de un ticket

```
ORIGEN                ESTADOS                        CIERRE
──────────────────────────────────────────────────────────────
Portal público:         abierto
  portal_create_ticket    │
  (sin auth)              ▼
                        en_revision ──── equipo lo ve
Client tipo 2:          │
  MisSolicitudes         ▼
  INSERT ticket        en_progreso ──── equipo trabaja
  (con auth)             │
                         ▼
Team interno:          resuelto ──── cliente notificado(*)
  Dashboard/Tickets      │
  INSERT ticket          ▼
                       cerrado ──── fin del ciclo

                    (*) solo si send-notification no falla
```

### Lifecycle de un token de portal

```
1. Admin crea token en ClientAccessSection
   INSERT client_access_tokens (active=true, token=UUID)

2. Admin envía URL /client/:token al cliente (manual, fuera del sistema)

3. Cliente accede → portal_get_project(token)
   UPDATE last_accessed_at

4. Cliente crea tickets, ve estados, envía mensajes
   (todas las operaciones via RPC, sin crear cuenta)

5. Admin puede desactivar: UPDATE active=false
   → token inválido → error en portal
```

---

## Módulos principales

```
┌─────────────────────────────────────────────────────────────────┐
│                     MÓDULO DE AUTH                              │
│                                                                 │
│  useAuth.tsx ──── AuthContext ──── AuthProvider                │
│       │                                                         │
│       ├── ProtectedRoute.tsx  (RBAC guard)                      │
│       ├── Navbar.tsx          (nav condicional)                 │
│       └── Login/Signup/ResetPassword/AuthCallback               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   MÓDULO DE PROYECTOS                           │
│                                                                 │
│  lib/projects.ts ─────────────────────────────────────────────┐│
│       │                                                        ││
│       ├── Dashboard.tsx      (lista + stats)                   ││
│       ├── ProjectDetail.tsx  (CRUD completo, pipeline, etc.)   ││
│       │     ├── StageDrawer.tsx                                ││
│       │     ├── ServiceForm.tsx                                ││
│       │     ├── MaintenanceSection.tsx                         ││
│       │     ├── ClientAccessSection.tsx                        ││
│       │     └── NewProjectModal.tsx (desde Dashboard)          ││
│       └── types/projects.ts  (Project, Stage, Service, etc.)   ││
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   MÓDULO DE TICKETS                             │
│                                                                 │
│  lib/tickets.ts ──────────────────────────────────────────────┐│
│       │                                                        ││
│       ├── TicketsGlobal.tsx  (vista team, todos los tickets)   ││
│       ├── TicketDrawer.tsx   (detalle + mensajes)              ││
│       ├── ProjectDetail.tsx  (tickets por proyecto)            ││
│       ├── MisSolicitudes.tsx (cliente tipo 2)                  ││
│       └── types/tickets.ts   (Ticket, TicketMessage, etc.)     ││
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   MÓDULO DE PORTAL                              │
│                                                                 │
│  lib/portal.ts (RPC wrappers) ────────────────────────────────┐│
│       │                                                        ││
│       └── ClientPortal.tsx   (página pública /client/:token)  ││
│                                                                 ││
│  Sin auth — validación vía token en SQL                        ││
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 MÓDULO DE NOTIFICACIONES                        │
│                                                                 │
│  supabase/functions/send-auth-email/     (auth emails)         │
│  supabase/functions/send-notification/  (ticket updates)       │
│       │                                                         │
│       └── Resend API (externo)                                  │
│                                                                 │
│  Invocados via supabase.functions.invoke()                      │
│  Fallan silenciosamente — sin retry, sin queue                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dependencias entre capas

### Mapa de dependencias (de más alto a más bajo nivel)

```
CAPA 1 — PÁGINAS (máximo acoplamiento, más cambian)
  src/pages/*.tsx
    depende de → CAPA 2 (lib), CAPA 3 (types), CAPA 4 (components), CAPA 5 (hooks)

CAPA 2 — DATOS (acceso a Supabase)
  src/lib/projects.ts
  src/lib/tickets.ts
  src/lib/portal.ts
  src/lib/siteUrl.ts
    depende de → CAPA 3 (types), CAPA 6 (supabase client)
    NO debe depender de → CAPA 1 (páginas) ni CAPA 4 (componentes)

CAPA 3 — TIPOS (fuente de verdad de dominio)
  src/types/projects.ts
  src/types/tickets.ts
    depende de → nada interno
    ES DEPENDENCIA DE → todo lo demás

CAPA 4 — COMPONENTES UI
  src/components/dashboard/*.tsx
  src/components/*.tsx (excepto ui/)
    depende de → CAPA 2 (lib), CAPA 3 (types), CAPA 5 (hooks)
    src/components/ui/ → NO depende de nada interno

CAPA 5 — HOOKS
  src/hooks/useAuth.tsx
  src/hooks/use-toast.ts
    depende de → CAPA 6 (supabase client)
    ES DEPENDENCIA DE → CAPA 1 y CAPA 4

CAPA 6 — INFRAESTRUCTURA (mínimo cambio)
  src/integrations/supabase/client.ts
    depende de → variables de entorno
    ES DEPENDENCIA DE → todo lo que accede a Supabase
```

### Diagrama de dependencias críticas

```
pages/ProjectDetail.tsx
    │
    ├──► lib/projects.ts ──────────────► supabase/client.ts
    │         │                                │
    │         └──► types/projects.ts           └──► SUPABASE (externo)
    │
    ├──► components/dashboard/StageDrawer.tsx
    │         └──► lib/projects.ts (mismo)
    │
    ├──► components/dashboard/TicketDrawer.tsx
    │         └──► lib/tickets.ts ─────────────► supabase/client.ts
    │                   └──► types/tickets.ts
    │
    └──► hooks/useAuth.tsx
              └──► supabase/client.ts


pages/ClientPortal.tsx
    │
    └──► lib/portal.ts ────────────────► supabase/client.ts
              │                               │
              └──► (sin tipos propios)        └──► SUPABASE RPC (externo)
```

### Qué rompe qué

```
Si cambia...                    Se rompe...
──────────────────────────────────────────────────────────────────
supabase/client.ts              TODA la app (acceso a DB)

useAuth.tsx                     ProtectedRoute, Navbar, cualquier
                                componente que use useAuth()

types/projects.ts (enums)       Dashboard, ProjectDetail, StageDrawer,
                                lib/projects.ts, STATUS_CONFIG

types/tickets.ts (enums)        TicketsGlobal, TicketDrawer, MisSolicitudes,
                                lib/tickets.ts, ClientPortal

lib/projects.ts (firma)         Dashboard, ProjectDetail, StageDrawer

lib/tickets.ts (firma)          TicketsGlobal, TicketDrawer, ProjectDetail,
                                MisSolicitudes

lib/portal.ts (firma)           ClientPortal (única dependencia)

RPC SQL portal_*                lib/portal.ts → ClientPortal

Migración SQL (schema)          Cualquier query en lib/ que use esa tabla
```

---

## Notas de arquitectura

**Por qué no hay React Query activo:**
Instalado pero nunca integrado. Todo el data fetching es manual con `useState` + `useEffect` implícito dentro de handlers. Deuda técnica activa.

**Por qué el portal no tiene auth:**
Decisión de producto: clientes externos no crean cuentas. Acceden via token único por proyecto. El trade-off es token en URL (historial del browser) vs fricción de registro.

**Por qué `setTimeout(0)` en useAuth:**
Workaround para un deadlock entre el listener `onAuthStateChange` de Supabase JS y la llamada inmediata a `fetchUserType`. Sin el timeout, la query de `profiles` corre antes de que la sesión esté completamente inicializada.

**Por qué RLS con EXISTS subqueries en vez de JWT claims:**
Las policies usan `EXISTS (SELECT 1 FROM proyectos_clientes WHERE user_id = auth.uid())` en vez de custom claims en el JWT. Más simple de implementar pero más costoso en queries concurrentes.
