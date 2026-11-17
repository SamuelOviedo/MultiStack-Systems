# Contrato: rutas, menú y migas

**Spec**: RF-001, RF-056 a RF-061, Historia 5, CE-014 · **Autorización**: DP-10 autoriza exactamente tres rutas nuevas; cualquier otra requiere una consulta nueva (RF-061). **DA-13, opción A, aprobada el 2026-11-09**: `NavItem` se extiende con metadatos opcionales de subpágina y el menú conserva **una sola** entrada «Cotizaciones» en «Gestión comercial».

## 1. Rutas (únicas)

| Ruta | Página (propuesta) | Contenido | Guardia |
| --- | --- | --- | --- |
| `/dashboard/cotizaciones` | `src/pages/dashboard/CotizacionesList.tsx` | listado, búsqueda, filtros (estado, vencidas, archivadas), alta | `ProtectedRoute allowedTypes={[0]}` → `AdminShell` |
| `/dashboard/cotizaciones/catalogo` | `src/pages/dashboard/CotizacionesCatalogo.tsx` | catálogo de paquetes y módulos | igual |
| `/dashboard/cotizaciones/:id` | `src/pages/dashboard/CotizacionDetalle.tsx` | detalle, edición, vista previa (pestaña), historial, acciones | igual |

Cada página es `lazy` en `src/App.tsx`, igual que las del panel. Vista previa, historial y acciones **no** son rutas: son pestañas o paneles dentro de `:id` (la pestaña puede reflejarse en el parámetro `?vista=previa`, que no crea ruta).

### 1.1 `catalogo` frente a `:id` (RF-059)

- React Router ordena por especificidad, de modo que el segmento fijo gana al dinámico sin depender del orden de las filas; aun así se declara `catalogo` **antes** de `:id` por legibilidad.
- `CotizacionDetalle` valida que `:id` sea un UUID; si no lo es (incluida la palabra «catalogo» por cualquier error de ruta), muestra «Cotización no encontrada», sin consultar la base de datos. Un UUID que no existe produce el mismo mensaje, sin distinguir «no existe» de «no es tuya» (RF-036, caso límite).
- Como el identificador es un UUID generado, ninguna cotización puede coincidir con «catalogo».

## 2. Menú

Una entrada nueva en el grupo `gestion-comercial` de `buildAdminNavGroups()` (`src/components/admin/adminNav.ts`):

```text
id: "cotizaciones"          label: "Cotizaciones"        icon: (Lucide, p. ej. FileText)
status: "funcional"         href: "/dashboard/cotizaciones"
roles: SOLO_ADMIN           match: { exact: ["/dashboard/cotizaciones", "/dashboard/cotizaciones/catalogo"],
                                     prefix: ["/dashboard/cotizaciones/"] }
subpages: [{ path: "/dashboard/cotizaciones/catalogo", label: "Catálogo" }]      ← extensión de NavItem (DA-13)
```

Posición propuesta: tras «Proyectos» y antes de «Clientes» (la lista de «próximamente» conserva su orden).

- **Visible solo para el rol 0**: `roles: [0]`; es presentación, la autorización real es `ProtectedRoute` + RLS (comentario existente del archivo).
- `aria-current="page"` en las tres rutas (RF-060) por la regla `match`.
- **Extensión de `NavItem` (DA-13, aprobada)**: `subpages?: readonly { path: string; label: string }[]` (opcional). Sin ella `breadcrumbsFor('/dashboard/cotizaciones/catalogo')` daría «Gestión comercial / Cotizaciones / Detalle». Con ella: `Gestión comercial / Cotizaciones / Catálogo`. Para las entradas que no la declaran, el comportamiento es idéntico al actual. El catálogo **no** es una entrada propia del menú: el número de entradas pasa de 11 a 12, no a 13.
- Migas del detalle: `Gestión comercial / Cotizaciones (enlace) / Detalle`.

### 2.1 Precarga (opcional)

Añadir `/dashboard/cotizaciones` a `FIRST_PAGE` (`preloadPanel.ts`) y a `SHELL_PATHS` (`App.tsx`) para la visita directa. Mejora de carga, no requisito.

## 3. Pruebas existentes que cambian a propósito (F1)

Se actualizan por **una razón explícita** (la entrada nueva), nunca se debilitan:

| Archivo | Cambio |
| --- | --- |
| `src/test/admin-nav.test.ts` | «solo las 3 pantallas…» pasa a 4 funcionales (`Cotizaciones, Proyectos, Resumen, Tickets`) y a sus 4 `href`; «11 entradas» pasa a 12; «disponibles» de Gestión comercial = `[Proyectos, Cotizaciones]` (o el orden que se decida); «ids únicos», «solo administrador» y «no se pierde ni se repite» siguen igual; **nuevas**: migas de `/dashboard/cotizaciones`, de `…/catalogo` y de `…/:id`; `aria-current` en las tres; un colaborador (1), cliente (2) y `null` siguen sin ver nada |
| `src/test/admin-shell.test.tsx` | listas de entradas por grupo (líneas ~169, 185, 238) incluyen «Cotizaciones» |
| `src/test/admin-routes.test.tsx` | el `App` real conserva los `allowedTypes` de las 4 pantallas; **nuevas**: cada una de las 3 rutas nuevas con administrador (render correcto), colaborador, cliente y sin sesión (rechazo/redirección como `/dashboard`), y `/dashboard/cotizaciones/catalogo` abre el catálogo y no el detalle |
| `src/test/dashboard-admin-only.test.tsx`, `src/test/ProtectedRoute.test.tsx`, `src/test/dashboard-parity.test.tsx`, `e2e/dashboard-admin-only.spec.ts` | se revisan por si fijan la lista de rutas del panel; se añaden las tres rutas nuevas si corresponde |
| `src/test/dashboard-home.test.tsx` | los accesos rápidos del Resumen salen del menú: pasan a Proyectos, Cotizaciones y Tickets (solo cambia la lista esperada) |
| `src/test/dashboard-home-static.test.ts`, `src/test/project-detail-static.test.ts`, `src/test/role-routing.test.tsx`, `src/test/tickets-static.test.ts` | por las tres rutas nuevas, solo las listas y conteos de rutas que fijan sobre `App`, que ahora nombran exactamente las tres; ninguna aserción de comportamiento cambia |
| `src/test/dashboard-admin-only.test.tsx` | resultado de la revisión de la fila de arriba: por las tres rutas nuevas, su matriz de rol pasa de 4 a 7 rutas del panel (solo la lista de rutas). En la misma revisión, `dashboard-parity.test.tsx` añade las tres rutas a sus listas de rutas con armazón y protegidas, y `ProtectedRoute.test.tsx` y `e2e/dashboard-admin-only.spec.ts` no cambian por las rutas nuevas (rutas de juguete y una muestra de dos pantallas). Por otra razón explícita, ajena a las rutas nuevas, las 4 pruebas de `/dashboard/tickets` de `e2e/dashboard-admin-only.spec.ts`, que ya fallaban por buscar un encabezado obsoleto, se corrigieron en `21eeba6`: 3 líneas en ese archivo y 1 en `e2e/support/supabase-simulado.ts`, que alinean el título esperado con el `<h1>` «Tickets» de `PageHeader`, sin omitir pruebas ni cambiar otra aserción |

Pruebas nuevas, que no modifican ninguna existente: `src/test/cotizaciones-rutas.test.tsx` (las tres rutas con el `App`, el `ProtectedRoute` y el `AuthProvider` reales: acceso directo por rol, identificadores no válidos, cierre y cambio de sesión, respuestas tardías), `src/test/cotizaciones-precarga.test.ts` (precarga de la visita directa) y `e2e/cotizaciones-acceso.spec.ts` (Playwright local con Supabase simulado; sus ayudantes están en `e2e/support/supabase-simulado.ts`, extraídos de `e2e/dashboard-admin-only.spec.ts` sin cambiar sus pruebas).

Las pruebas de «Servicios y renovaciones» (etiqueta larga en migas) y de «Clientes» (próximamente) **no cambian**.

## 4. Fuera de este contrato

Ninguna ruta del portal (`/client/:token`, `/solicitudes`), de colaborador ni pública cambia. No hay rutas para PDF, descarga ni envío.
