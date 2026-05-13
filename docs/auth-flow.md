# Auth Flow — MultiStack Systems

> Documentación técnica del sistema de autenticación completo.
> Última actualización: rama Hector — GitHub OAuth implementado.

---

## Arquitectura actual de auth

El sistema usa **Supabase Auth** como único proveedor de autenticación. No hay servidor de auth propio. La validación de acceso ocurre en dos capas:

```
1. Frontend — ProtectedRoute.tsx verifica session + email_confirmed_at + userType
2. Base de datos — RLS policies verifican auth.uid() en cada query
```

No existe middleware de servidor. La SPA es completamente estática (Vercel).

**Providers activos:**
- Email/password (`signInWithPassword`)
- Google OAuth (`signInWithOAuth`)
- GitHub OAuth (`signInWithOAuth`)

**Almacenamiento de sesión:** `localStorage` via Supabase JS (`persistSession: true`)

**Refresh automático:** `autoRefreshToken: true` — Supabase JS renueva el JWT antes de que expire

**Estado global:** `AuthContext` en `src/hooks/useAuth.tsx`, disponible via `useAuth()`

---

## Roles de usuario

```
user_type: 0  →  Admin     →  acceso total: /dashboard, /dashboard/project/:id, /dashboard/tickets
user_type: 1  →  Staff     →  igual que admin
user_type: 2  →  Client    →  solo /solicitudes
```

El `user_type` viene de la tabla `profiles` en PostgreSQL, no del JWT. Se carga después de que la sesión se establece.

**Todos los usuarios nuevos** (incluyendo OAuth) empiezan con `user_type: 2` por el trigger `handle_new_user` en SQL. Los admin/staff necesitan actualización manual en Supabase Dashboard → Table Editor → profiles.

---

## Flujo: Login email/password

```
src/pages/Login.tsx

1. User ingresa email + password
2. handleLogin() → supabase.auth.signInWithPassword({ email, password })
3. Supabase valida credenciales
   └─ Error → toast destructivo + setLoading(false) → fin
   └─ OK → onAuthStateChange(SIGNED_IN) dispara en useAuth.tsx
4. useAuth: setSession, setUser
5. setTimeout(0) → fetchUserType(userId) → SELECT user_type FROM profiles
6. setUserType(type)
7. Login.tsx useEffect detecta user + userType resueltos:
   └─ userType 0|1 → navigate("/dashboard")
   └─ userType 2   → navigate("/solicitudes")
```

**Nota:** `handleLogin` no resetea `loading` en caso de éxito porque el componente hace navigate antes de que sea necesario.

---

## Flujo: OAuth (GitHub / Google)

```
src/pages/Login.tsx → src/pages/AuthCallback.tsx

1. User hace click en botón GitHub o Google
2. handleOAuth(provider) → setOauthLoading(provider)
3. supabase.auth.signInWithOAuth({
     provider,
     options: { redirectTo: "${window.location.origin}/auth/callback" }
   })
4. Supabase redirige al browser a la URL de autorización del provider
   └─ Error inmediato → toast + setOauthLoading(null) → fin
   └─ OK → browser navega a GitHub/Google (SPA se descarga)

  [En GitHub/Google]
5. User autoriza la app
   └─ Cancela → GitHub redirige a /auth/callback?error=access_denied
   └─ Acepta → GitHub redirige a /auth/callback?code=XXXX

  [SPA carga en /auth/callback]
6. AuthCallback monta — AuthProvider initializa:
   a. supabase.auth.getSession() → null (aún no hay sesión) → loading: false
   b. onAuthStateChange listener registrado

7. AuthCallback Step 1 useEffect:
   └─ Lee code de URL query params
   └─ Si no hay code (error u otro caso) → navigate("/login")
   └─ supabase.auth.exchangeCodeForSession(code)
      └─ Error → navigate("/login?error=auth_failed")
      └─ OK → onAuthStateChange(SIGNED_IN) dispara

8. useAuth: setSession, setUser
   setTimeout(0) → fetchUserType(userId) → setUserType(type)

9. AuthCallback Step 2 useEffect (deps: [user, userType, loading]):
   └─ Espera: loading=false, user≠null, userType≠null
   └─ userType 0|1 → navigate("/dashboard")
   └─ userType 2   → navigate("/solicitudes")
```

**Para usuarios nuevos vía OAuth:** Supabase crea `auth.users`, el trigger crea `profiles` con `user_type: 2`, y Supabase setea `email_confirmed_at` automáticamente (email verificado por el provider).

---

## Flujo: Callback OAuth — detalle de sincronización

El mayor riesgo de AuthCallback era una race condition entre el exchange del code y la resolución de `userType`. El diseño con dos `useEffect` separados la evita:

```
Timeline en la página /auth/callback:

t=0   AuthProvider inicia  → loading: true
t=1   getSession() → null  → loading: false, user: null
t=2   Step 1 effect corre  → exchangeCodeForSession(code) [network request]
t=3   Step 2 effect corre  → loading=false, user=null → espera (guarda)

t=N   exchangeCodeForSession responde OK
t=N+1 onAuthStateChange(SIGNED_IN) → setSession, setUser
t=N+2 setTimeout(0) → fetchUserType → setUserType
t=N+3 Re-render → Step 2 re-evalúa: loading=false, user≠null, userType≠null → redirect ✓
```

No hay ventana donde `userType` pueda redirigir antes de estar resuelto porque el Step 2 verifica `userType !== null` explícitamente.

**Guard `useRef(exchanged)`:** previene que `exchangeCodeForSession` se llame dos veces si el componente re-renderiza entre el mount y la resolución del promise. Defensivo.

---

## Flujo: Registro email/password

```
src/pages/Signup.tsx

1. supabase.auth.signUp({ email, password, options: { emailRedirectTo: getAuthEmailRedirectUrl() } })
2. Supabase crea auth.users con email_confirmed_at = null
3. Trigger handle_new_user → INSERT INTO profiles (user_type: 2)
4. Edge Function send-auth-email envía email de confirmación con HTML styled
5. Usuario confirma → email_confirmed_at se setea
6. Login normal desde ese punto
```

`getAuthEmailRedirectUrl()` retorna `${VITE_SITE_URL}/solicitudes`. Solo aplica al flujo email/password.

---

## Flujo: Password reset

```
1. /auth/reset-password → ResetPassword.tsx
2. supabase.auth.resetPasswordForEmail(email, { redirectTo })
3. Edge Function send-auth-email envía email de recovery
4. Usuario hace click → vuelve a /auth/reset-password?token=...
5. supabase.auth.updateUser({ password: newPassword })
6. Redirect a /dashboard
```

---

## Flujo: Logout

```
Cualquier componente con useAuth()

1. signOut() → supabase.auth.signOut()
2. Supabase borra sesión de localStorage
3. onAuthStateChange(SIGNED_OUT) → setSession(null), setUser(null), setUserType(null)
4. ProtectedRoute: !session → <Navigate to="/login" replace />
```

El `setUserType(null)` en `signOut()` es redundante (también lo hace `onAuthStateChange`), pero inofensivo.

---

## Flujo: Sesión persistente (reload / nueva pestaña)

```
1. Usuario abre app con sesión activa en localStorage
2. AuthProvider: supabase.auth.getSession() lee de localStorage (sin red)
3. session existe → setSession, setUser
4. fetchUserType(userId) → SELECT user_type FROM profiles [red]
5. setUserType, setLoading(false)
6. ProtectedRoute: session✓, email_confirmed_at✓, userType en allowedTypes✓ → renders

Si el JWT está expirado:
   autoRefreshToken: true → Supabase JS lo renueva automáticamente
   onAuthStateChange(TOKEN_REFRESHED) → setSession (nuevo JWT)
   Nota: fetchUserType se ejecuta de nuevo en cada TOKEN_REFRESHED (DB call extra, inofensivo)
```

---

## ProtectedRoute — comportamiento completo

```tsx
// src/components/ProtectedRoute.tsx
// Props: allowedTypes (default: [0, 1])
```

**Árbol de decisiones:**

```
loading: true
  → Spinner (Terminal pulsante)

loading: false, !session
  → <Navigate to="/login" replace />

loading: false, session, !email_confirmed_at
  → Pantalla de advertencia "Confirmá tu cuenta"
  → Botón "VOLVER AL LOGIN" → signOut()
  (aplica solo a email/password — OAuth siempre tiene email_confirmed_at)

loading: false, session, email_confirmed_at, userType null
  → Render children (espera a que userType resuelva en siguiente render)
  ← Nota: ProtectedRoute renderiza hijos si userType es null, con condición de !allowedTypes.includes(userType)
     que es false si userType === null. Esto es correcto — muestra el loader hasta que loading resuelve.

loading: false, session, email_confirmed_at, userType en allowedTypes
  → Render children ✓

loading: false, session, email_confirmed_at, userType NOT en allowedTypes
  → userType === 2 → <Navigate to="/solicitudes" replace />
  → otro        → <Navigate to="/" replace />
```

**Rutas y sus allowedTypes:**

| Ruta | allowedTypes | user_type 0 | user_type 1 | user_type 2 |
|---|---|---|---|---|
| `/dashboard` | `[0, 1]` | ✓ | ✓ | → `/solicitudes` |
| `/dashboard/project/:id` | `[0, 1]` | ✓ | ✓ | → `/solicitudes` |
| `/dashboard/tickets` | `[0, 1]` | ✓ | ✓ | → `/solicitudes` |
| `/solicitudes` | `[2]` | → `/` | → `/` | ✓ |

---

## userType routing — tabla completa

| Situación | user_type | Destino final |
|---|---|---|
| Login email/password exitoso | 0 | `/dashboard` |
| Login email/password exitoso | 1 | `/dashboard` |
| Login email/password exitoso | 2 | `/solicitudes` |
| OAuth callback exitoso | 0 | `/dashboard` |
| OAuth callback exitoso | 1 | `/dashboard` |
| OAuth callback exitoso | 2 | `/solicitudes` |
| Nuevo usuario OAuth (sin actualizar) | 2 (default) | `/solicitudes` |
| Usuario sin email confirmado | cualquiera | Pantalla warning |
| Sin sesión en ruta protegida | — | `/login` |
| user_type 2 visita `/dashboard` | 2 | → `/solicitudes` |
| user_type 0/1 visita `/solicitudes` | 0 o 1 | → `/` |

**Sin loops posibles:** `/` (Index) no redirige a usuarios autenticados. Todas las rutas tienen un destino terminal.

---

## Dependencias involucradas

| Dependencia | Versión | Uso en auth |
|---|---|---|
| `@supabase/supabase-js` | 2.100.1 | Toda la lógica de auth |
| `react-router-dom` | 6.30.1 | Navegación y rutas protegidas |
| React Context API | — | Estado global de auth |

No se usa JWT manualmente. No se usa Redux, Zustand ni React Query para auth.

---

## Archivos críticos del sistema auth

| Archivo | Toca este archivo si... | Riesgo de modificar |
|---|---|---|
| `src/hooks/useAuth.tsx` | Necesitas cambiar cómo se carga el estado de auth | MUY ALTO — afecta toda la app |
| `src/components/ProtectedRoute.tsx` | Necesitas cambiar reglas de acceso | ALTO — afecta todas las rutas |
| `src/pages/AuthCallback.tsx` | Necesitas cambiar el flujo post-OAuth | MEDIO — flujo delicado de dos efectos |
| `src/pages/Login.tsx` | Necesitas cambiar UI de login o agregar providers | BAJO — bien aislado |
| `src/integrations/supabase/client.ts` | Necesitas cambiar config de Supabase | MUY ALTO — único punto de acceso |
| `src/lib/siteUrl.ts` | Necesitas cambiar URL de redirect post-email | BAJO |
| `supabase/migrations/*.sql` | Necesitas cambiar schema de profiles o triggers | ALTO — irreversible |

---

## Riesgos conocidos

### 1. user_type default 2 para todos los usuarios nuevos
**Síntoma:** Admin/staff que usa OAuth por primera vez llega a `/solicitudes`
**Causa:** Trigger `handle_new_user` asigna `user_type: 2` a todos los registros nuevos
**Solución:** Actualizar manualmente en Supabase Dashboard → Table Editor → profiles

### 2. fetchUserType en cada TOKEN_REFRESHED
**Síntoma:** Query extra a `profiles` en cada refresh del JWT (cada ~1 hora)
**Causa:** `onAuthStateChange` corre `fetchUserType` para cualquier evento de sesión
**Impacto:** Performance mínimo. No es un bug.

### 3. OAuth error callback sin mensaje específico
**Síntoma:** Si el usuario cancela OAuth en GitHub, vuelve a `/login` sin explicación
**Causa:** AuthCallback solo verifica ausencia de `code`, no parsea `?error=` del OAuth standard
**Impacto:** UX menor. El usuario simplemente vuelve al login.

### 4. `setTimeout(0)` en onAuthStateChange
**Síntoma:** Workaround para un deadlock de Supabase JS al hacer queries dentro del callback
**Causa:** Limitación del SDK 2.x
**Impacto:** `userType` tarda un tick extra en resolverse. Controlado por los checks de `userType === null`.

---

## Edge cases documentados

| Caso | Comportamiento actual |
|---|---|
| Acceso a `/auth/callback` sin `?code=` | Redirect a `/login` |
| `exchangeCodeForSession` falla (código expirado) | Redirect a `/login?error=auth_failed` |
| Code usado dos veces (StrictMode / doble click) | `useRef` guard previene la segunda llamada |
| GitHub OAuth con email ya registrado en email/password | Depende de configuración Supabase ("Link accounts"). Por defecto: vincula. Si deshabilitado: error sin mensaje amigable → redirect a `/login` |
| User desactiva su cuenta en Supabase | Próximo getSession/refresh falla → session null → redirect a `/login` |
| profiles sin registro para el userId | `fetchUserType` retorna `2` (fallback en `useAuth.tsx:27`) |
| Token expirado al abrir la app | autoRefreshToken lo renueva transparentemente |
| Logout en otra pestaña | onAuthStateChange propaga el SIGNED_OUT → todas las pestañas redirigen |

---

## Troubleshooting

**"Provider not enabled" al hacer click en GitHub:**
→ GitHub provider no está habilitado en Supabase Dashboard → Authentication → Providers

**El botón de GitHub no hace nada después del click:**
→ Revisar consola del browser. Si hay error de Supabase, aparece un toast. Si no hay nada, puede ser un bloqueador de popups.

**Usuario llega a `/solicitudes` siendo admin:**
→ El perfil en la tabla `profiles` tiene `user_type: 2`. Actualizar manualmente.

**`/auth/callback` redirige a `/login` inmediatamente:**
→ El `?code=` en la URL está ausente o expiró (válido por 60 segundos). Intentar el flujo OAuth de nuevo.

**Usuario ve pantalla de "Confirmá tu cuenta" tras OAuth:**
→ No debería ocurrir (OAuth setea `email_confirmed_at`). Si ocurre, verificar en Supabase que la cuenta no fue creada con email/password previamente sin confirmar.

**`userType` queda en `null` indefinidamente:**
→ La query a `profiles` falló. Verificar RLS policies en la tabla `profiles`. La policy debe permitir `SELECT` donde `id = auth.uid()`.

---

## Cómo extender auth correctamente

### Agregar un nuevo OAuth provider (ej. Google ya existe en UI)

1. Habilitar el provider en Supabase Dashboard → Auth → Providers
2. Crear OAuth App en el dashboard del provider
3. Agregar botón en `Login.tsx` siguiendo el patrón de `handleOAuth("github")` — ya acepta cualquier string de provider que Supabase soporte
4. No hay cambios necesarios en `AuthCallback.tsx`, `useAuth.tsx` ni `ProtectedRoute.tsx`

### Agregar un nuevo rol (user_type)

1. Decidir el número (ej. `user_type: 3` para manager)
2. Crear nueva migración SQL si necesitas restricciones a nivel DB
3. Agregar nueva ruta en `App.tsx` con `<ProtectedRoute allowedTypes={[3]}>`
4. Actualizar la lógica de redirect en `Login.tsx` y `AuthCallback.tsx`
5. Actualizar `ProtectedRoute.tsx` si el rol necesita un fallback distinto a `/`

### Modificar qué rutas puede ver un rol existente

Solo cambiar el array `allowedTypes` en la ruta correspondiente en `App.tsx`. No modificar `ProtectedRoute`.

### Agregar información extra al perfil de usuario

Agregar columna en `profiles` via nueva migración SQL. En `useAuth.tsx`, ampliar `fetchUserType` para traer los campos adicionales y exponerlos en el `AuthContext`.

---

## Qué NO modificar

- **`onAuthStateChange` listener** — el `setTimeout(0)` no es un bug, es un workaround necesario. No quitarlo.
- **`exchanged.current` ref** en `AuthCallback` — protege contra doble ejecución.
- **El orden de checks** en `ProtectedRoute` — loading → session → email_confirmed → userType. Cambiar el orden puede crear estados donde el usuario accede antes de estar validado.
- **`persistSession: true` y `autoRefreshToken: true`** en `client.ts` — son requeridos para experiencia normal.
- **El fallback de `fetchUserType`** — retorna `2` si `profiles` no tiene registro. Cambiar este default puede crear usuarios con acceso incorrecto.
