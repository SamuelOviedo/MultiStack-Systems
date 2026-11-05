# Sistema de diseño de correos — MultiStack Systems

| Dato | Valor |
|---|---|
| Estado | Implementado |
| Base común | `supabase/functions/_shared/email/layout.ts` |

## 1. Por qué

Los correos usaban una estética oscura de "terminal" (fondo negro, verde neón, monoespaciada), y cada función tenía su propio HTML. Ahora todos los correos comparten **una sola línea visual**: fondo gris muy claro, tarjeta blanca, paleta de grises, botón gris oscuro, misma cabecera y mismo pie.

## 2. Arquitectura

```
_shared/email/layout.ts      ← tokens de marca + renderEmail(content) + bloques
_shared/html.ts              ← escapeHtml (ya existía)
send-auth-email/templates.ts      passwordRecoveryHtml · confirmSignupHtml · emailChangeHtml · inviteHtml
send-welcome-email/templates.ts   welcomeHtml · WELCOME_SUBJECT
send-notification/templates.ts    teamReplyHtml · teamReplySubject
send-contact-email/templates.ts   contactHtml · contactSubject
```

Las plantillas **solo componen bloques**; nunca concatenan HTML. La lógica de cada función (firma, autorización, validación, idempotencia) no cambia y vive en `handler.ts` / `index.ts`.

### Tokens (`BRAND`, `COLORS`)

| Token | Valor | Uso |
|---|---|---|
| `page` | `#f4f4f5` | Fondo general |
| `card` | `#ffffff` | Tarjeta principal |
| `border` | `#e4e4e7` | Bordes finos |
| `subtle` | `#fafafa` | Avisos, tablas de detalle, mensajes |
| `title` | `#18181b` | Títulos y texto destacado |
| `text` | `#3f3f46` | Texto principal |
| `muted` | `#71717a` | Texto secundario y etiquetas dentro de la tarjeta (4.83:1) |
| `footer` | `#52525b` | Texto del pie sobre el fondo de página (AA) |
| `button` | `#18181b` (texto `#ffffff`) | Botón principal |
| Tipografía | Fuentes del sistema (`-apple-system, Segoe UI, Roboto, Arial…`) | Sin fuentes web |
| Logo | `https://www.multistacksystems.com/logo-black.png` (24×28) | Marca oscura sobre blanco |
| Soporte | `soporte@multistacksystems.com` | Pie y Reply-To. Es el buzón con MX; `mail.` no tiene MX |

### Bloques disponibles

| Bloque | Para qué |
|---|---|
| `paragraph` | Texto; admite partes en negrita (`{ strong }`) y variante `muted` |
| `button` | Botón principal ("bulletproof", basado en tabla) |
| `fallbackLink` | "Si el botón no funciona…" + URL completa en monoespaciada |
| `details` | Tabla etiqueta/valor (asunto del ticket, datos de contacto) |
| `message` | Cita de un mensaje con borde izquierdo (`pre-wrap`) |
| `list` | Viñetas |
| `notice` | Caja gris de aviso ("¿No fuiste tú?") |

**Estructura común:** preheader oculto → cabecera (logo + "MultiStack Systems") → tarjeta (etiqueta superior, título, bloques) → pie (motivo del correo, ayuda con enlace a soporte, marca, lema y web).

### Compatibilidad con clientes de correo

- Maquetación con tablas (`role="presentation"`) y **estilos en línea**.
- Sin CSS ni JS externos.
- Ancho máximo de 560 px, fluido en pantallas pequeñas.
- `<style>` mínimo solo para ajustes móviles (relleno y tamaño del título); si un cliente lo ignora, el correo sigue funcionando.
- `color-scheme: light`, para que no se invierta de forma rara en modo oscuro.
- **Outlook de escritorio** (motor de Word):
  - tabla fantasma `<!--[if mso]>` de 560 px, porque ignora `max-width`;
  - `mso-padding-alt` en el botón, porque ignora el padding de `<a>`;
  - saltos de línea como `<br />`, porque ignora `pre-wrap`.
- **Contraste WCAG AA (≥ 4.5:1)** en todas las combinaciones de texto, comprobado por pruebas automáticas. El gris `faint` queda solo para elementos decorativos (viñetas).

### Seguridad

- Cada bloque escapa su contenido.
- `safeUrl()` solo permite `http(s)`, `mailto` y `tel`; cualquier otra URL se convierte en `#`.
- No se tocó la verificación de firmas (S3), la autorización (S2) ni el acceso a datos.

## 3. Correos rediseñados

| Correo | Asunto | Botón |
|---|---|---|
| Recuperación de contraseña | Recuperar contraseña — MultiStack Systems | Restablecer contraseña |
| Confirmación de cuenta | Confirma tu cuenta — MultiStack Systems | Confirmar mi cuenta |
| Nuevo correo (cambio) | Confirma tu nuevo correo — MultiStack Systems | Confirmar nuevo correo |
| Invitación | Te invitaron a MultiStack Systems | Aceptar invitación |
| Bienvenida | Te damos la bienvenida a MultiStack Systems | Ir a la plataforma |
| Respuesta a ticket | Respuesta a tu ticket: {título} — MultiStack Systems | Ver mis solicitudes (o texto, en tickets de proyecto) |
| Contacto (interno) | Nuevo mensaje de {nombre} — MultiStack Systems | Responder a {nombre} (si dejó correo) |

**Tono unificado:** español neutro con "tú" (sin voseo), profesional y directo; títulos neutros en cuanto al género ("Te damos la bienvenida", "Te invitaron").

### Plantillas de contingencia para el Dashboard

`supabase/email-templates/confirm-signup.html` y `reset-password.html` se generan desde el mismo sistema, con las variables `{{ .ConfirmationURL }}` y `{{ .Email }}`. Solo se usan si se desactiva el Send Email Hook.

## 4. Cómo revisar

| Forma | Comando / ruta |
|---|---|
| Instantáneas HTML versionadas (abrir en el navegador) | `supabase/functions/_shared/email/__snapshots__/*.html` (9 correos) |
| Galería escritorio (640 px) + móvil (375 px) | `npm run email:preview` → `email-previews/index.html` (no versionado) |
| Regenerar instantáneas tras un cambio de diseño intencional | `npx vitest run supabase/functions/_shared/email -u` |
| Pruebas | `npx vitest run supabase/functions` |

`_shared/email/templates.test.ts` (42 pruebas) comprueba en los 9 correos:
- que comparten el layout (fondo, tarjeta, borde, ancho, logo, marca, pie);
- que no queda nada del diseño anterior (colores neón, logo blanco, monoespaciada en el cuerpo);
- que son seguros para clientes de correo (sin `<script>` ni CSS externo, tablas, solo esquemas de URL permitidos);
- el escape de todos los valores dinámicos;
- los requisitos específicos del correo de recuperación.
