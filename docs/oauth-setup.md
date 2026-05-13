# OAuth Setup — MultiStack Systems

> Guía de configuración de OAuth (GitHub y Google) para este proyecto.
> La configuración es externa al código — Supabase Dashboard y los dashboards de cada provider.

---

## Estado actual

| Provider | UI implementada | Código implementado | Dashboard configurado |
|---|---|---|---|
| GitHub | ✅ | ✅ | ⚠️ Pendiente |
| Google | ✅ | ✅ | ⚠️ Pendiente |

El código está completo. Solo falta la configuración en Supabase Dashboard y en los providers.

---

## Configuración GitHub OAuth

### Paso 1 — Crear OAuth App en GitHub

Ir a: [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**

| Campo | Valor |
|---|---|
| Application name | `MultiStack Systems` |
| Homepage URL | `https://[tu-dominio].com` |
| Authorization callback URL | `https://ckyqrdemgssbrqfnkxsr.supabase.co/auth/v1/callback` |

La **Authorization callback URL** es siempre la de Supabase, no la de tu dominio. Supabase recibe el código de GitHub y lo intercambia por una sesión antes de redirigir a tu app.

Después de crear la app:
- Copiar **Client ID** (visible en la página)
- Generar **Client Secret** (hacer click en "Generate a new client secret") y copiarlo inmediatamente — solo se muestra una vez

### Paso 2 — Habilitar GitHub en Supabase

Ir a: Supabase Dashboard → **Authentication** → **Providers** → **GitHub**

| Campo | Valor |
|---|---|
| Enable Sign in with GitHub | ON |
| Client ID | [el de GitHub] |
| Client Secret | [el de GitHub] |

Guardar. Los cambios aplican inmediatamente.

### Paso 3 — Verificar Redirect URLs en Supabase

Ir a: Supabase Dashboard → **Authentication** → **URL Configuration**

Verificar que **Site URL** sea el dominio de producción:
```
https://[tu-dominio].com
```

En **Redirect URLs** agregar (si no están):
```
https://[tu-dominio].com/auth/callback
http://localhost:8080/auth/callback
```

La segunda es necesaria para pruebas locales.

---

## Configuración Google OAuth

### Paso 1 — Crear proyecto en Google Cloud Console

Ir a: [console.cloud.google.com](https://console.cloud.google.com)

1. Crear proyecto o seleccionar uno existente
2. Ir a **APIs & Services** → **Credentials**
3. Click **Create Credentials** → **OAuth client ID**
4. Application type: **Web application**

| Campo | Valor |
|---|---|
| Name | `MultiStack Systems` |
| Authorized JavaScript origins | `https://[tu-dominio].com` |
| Authorized redirect URIs | `https://ckyqrdemgssbrqfnkxsr.supabase.co/auth/v1/callback` |

Copiar **Client ID** y **Client Secret**.

### Paso 2 — Habilitar Google en Supabase

Ir a: Supabase Dashboard → **Authentication** → **Providers** → **Google**

| Campo | Valor |
|---|---|
| Enable Sign in with Google | ON |
| Client ID | [el de Google Cloud] |
| Client Secret | [el de Google Cloud] |

---

## Variables de entorno

El código OAuth no requiere variables de entorno adicionales. Las credenciales de los providers viven en Supabase (no en el frontend).

Las variables existentes en `.env` son suficientes:

```bash
# .env (ya configurado)
VITE_SUPABASE_URL="https://ckyqrdemgssbrqfnkxsr.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
VITE_SITE_URL="https://[tu-dominio].com"
```

`VITE_SITE_URL` afecta el redirect de confirmación de email (flujo email/password), no OAuth directamente. Pero debe estar correctamente configurado para que los emails de bienvenida/confirmación tengan links válidos.

---

## URLs requeridas

### URL de callback de Supabase (va en la configuración del provider, nunca en el código)

```
https://ckyqrdemgssbrqfnkxsr.supabase.co/auth/v1/callback
```

### URL de redirect de la app (adónde Supabase redirige después del exchange)

Configurada en el código (`Login.tsx:60`):
```
${window.location.origin}/auth/callback
```

En producción resuelve a:
```
https://[tu-dominio].com/auth/callback
```

En local resuelve a:
```
http://localhost:8080/auth/callback
```

### Flujo de URLs en OAuth

```
Browser → [Provider: github.com/login/oauth/authorize]
        → [Supabase: ckyqrdemgssbrqfnkxsr.supabase.co/auth/v1/callback]
        → [Tu app: /auth/callback?code=XXXX]
```

---

## Cómo probar localmente

### Requisito: las redirect URLs de los providers deben incluir localhost

En GitHub OAuth App → **Authorization callback URL** debe incluir la URL de Supabase (ya la tiene). Supabase se encarga del redirect a localhost.

En Supabase Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs**:
```
http://localhost:8080/auth/callback
```

Si esta URL no está en la lista, Supabase bloqueará el redirect con error `"redirect_uri mismatch"`.

### Pasos para probar en local

```bash
# 1. Tener el .env configurado con las variables de Supabase
cp .env.example .env
# Editar .env con los valores reales

# 2. Levantar el servidor
npm run dev

# 3. Abrir http://localhost:8080/login
# 4. Click en botón GitHub o Google
# 5. Autorizar en el provider
# 6. Debe redirigir a http://localhost:8080/auth/callback
# 7. Luego a /dashboard o /solicitudes según user_type
```

### Verificar en consola del browser

Si el OAuth falla:
1. Abrir DevTools → Network
2. Buscar la request a `supabase.co/auth/v1/authorize`
3. Verificar que retorne 302 hacia el provider
4. Si retorna error JSON: el provider no está habilitado en Supabase

---

## Cómo probar en producción

1. Hacer deploy a Vercel
2. Verificar que `VITE_SITE_URL` en Vercel tenga el dominio correcto
3. Verificar que el dominio de producción esté en Redirect URLs de Supabase
4. Probar flujo completo:
   - Nuevo usuario → debe terminar en `/solicitudes`
   - Usuario existente con user_type 0/1 → debe terminar en `/dashboard`
5. Verificar en Supabase Dashboard → Authentication → Users que el usuario se creó correctamente

---

## Problemas comunes

### "OAuth provider not enabled"

**Error:** Toast "Error de autenticación: OAuth provider not enabled"
**Causa:** El provider no está activado en Supabase Dashboard → Providers
**Solución:** Activarlo y guardar credenciales

### "redirect_uri_mismatch"

**Error:** El provider muestra error de URI mismatch
**Causa:** La Redirect URL configurada en el provider (GitHub/Google) no coincide con la de Supabase
**Solución:** Verificar que sea exactamente `https://ckyqrdemgssbrqfnkxsr.supabase.co/auth/v1/callback`

### "redirect_uri not in allowed list" (error de Supabase)

**Error:** Supabase bloquea el redirect final a la app
**Causa:** El origen de la app no está en Redirect URLs de Supabase
**Solución:** Agregar `https://[dominio]/auth/callback` y/o `http://localhost:8080/auth/callback` en Supabase → URL Configuration

### Usuario queda en `/solicitudes` siendo admin

**Causa:** Nuevo usuario OAuth, `profiles.user_type = 2` por defecto
**Solución:** Ir a Supabase Dashboard → Table Editor → profiles → cambiar `user_type` a `0` o `1` para ese usuario

### Pantalla de spinner infinita en `/auth/callback`

**Causa:** `exchangeCodeForSession` está fallando silenciosamente, o `fetchUserType` no resuelve
**Debug:** Verificar consola del browser. Posibles causas:
- El `?code=` expiró (válido ~60 segundos) — intentar flujo de nuevo
- RLS policy en `profiles` no permite SELECT al usuario recién creado
- La tabla `profiles` no tiene registro para ese `userId` (el trigger falló)

### Code expirado al volver del provider

**Error:** `AuthCallbackRouteError` o redirect a `/login?error=auth_failed`
**Causa:** El usuario tardó más de 60 segundos en autorizar, o recargó la página en el callback
**Solución:** Iniciar el flujo OAuth de nuevo desde `/login`

### Error al vincular cuentas (mismo email en dos providers)

**Causa:** Si un usuario tiene cuenta email/password con el mismo email que su GitHub
**Comportamiento actual:** Depende de la configuración de Supabase ("Link accounts with existing email")
- Si está activado (default): vincula automáticamente, el usuario puede usar ambos métodos
- Si está desactivado: error sin mensaje específico → redirect a `/login`

Para verificar/cambiar: Supabase Dashboard → Authentication → Providers → scroll abajo → "Allow users to link multiple OAuth accounts" 

---

## Información del proyecto Supabase

```
Project ref:  ckyqrdemgssbrqfnkxsr
Supabase URL: https://ckyqrdemgssbrqfnkxsr.supabase.co
Auth callback: https://ckyqrdemgssbrqfnkxsr.supabase.co/auth/v1/callback
```
