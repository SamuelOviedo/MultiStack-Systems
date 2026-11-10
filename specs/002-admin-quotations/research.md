# Investigación (Fase 0): Módulo de Cotizaciones

**Spec**: `specs/002-admin-quotations/spec.md` · **Plan**: `specs/002-admin-quotations/plan.md` · **Fecha**: 2026-11-09

Este documento resume lo que se inspeccionó en el código y las decisiones técnicas que de ello salen. Cada decisión lleva su estado:

- **Propuesta técnica**: diseño recomendado que cabe en el stack y las reglas actuales; el propietario puede cambiarlo al revisar el plan.
- **Aprobada (DA-##)**: decisión que el propietario aprobó el 2026-11-09 al revisar el plan: DA-01, DA-05, DA-06, DA-07, DA-08, DA-12, DA-13 y DA-14.
- **Requiere aprobación (DA-##)**: decisión de arquitectura o de negocio que el plan **no** da por resuelta: DA-02, DA-09, DA-10 y DA-11 (puertas de F5a) y DA-03 y DA-04 (bloquean F5b). Están en `plan.md`, sección «Decisiones del propietario».

Los nombres de función son los de la lista canónica de `contracts/rpc-cotizaciones.md` §0. Los importes se escriben como los muestra el módulo (`1,250.00`).

Nada aquí contradice la spec: donde la spec ya decidió algo, se cita su identificador (`RF-###`, `DP-##`, `AF-#`).

---

## 1. Lo que se inspeccionó (hallazgos)

| Área | Hallazgo | Consecuencia para el plan |
| --- | --- | --- |
| Rutas | `src/App.tsx` declara cada ruta del panel como `ProtectedRoute allowedTypes={[0]}` → `AdminShell` → página `lazy`. `ProtectedRoute` exige `allowedTypes` (no hay valor por defecto). | Las tres rutas de DP-10 siguen exactamente ese patrón. React Router v6 ordena por especificidad, pero se añade una prueba que fija que `/catalogo` gana a `/:id`. |
| Precarga | `SHELL_PATHS` (App) y `FIRST_PAGE` (`src/components/admin/preloadPanel.ts`) solo cubren las 3 pantallas actuales. | Opcional: añadir `/dashboard/cotizaciones`. No es requisito; solo mejora la primera carga. |
| Menú | `src/components/admin/adminNav.ts` define `buildAdminNavGroups()`. «Gestión comercial» tiene Proyectos (funcional), Clientes y Servicios y renovaciones (próximamente). `breadcrumbsFor()` marca como «Detalle» cualquier ruta que coincida por prefijo y no sea el `href` exacto. | `/dashboard/cotizaciones/catalogo` saldría como «Cotizaciones / Detalle» (incorrecto). Hace falta una extensión mínima y retrocompatible de `NavItem` (ver R-16, DA-13). |
| Pruebas del menú | `src/test/admin-nav.test.ts` fija: 6 grupos, «solo 3 funcionales» (`Proyectos`, `Resumen`, `Tickets`), «11 entradas», `Gestión comercial = [Proyectos]` disponible y `[Clientes, Servicios y renovaciones]` próximamente, migas. `src/test/admin-shell.test.tsx` repite listas de grupos/entradas. `src/test/admin-routes.test.tsx` caracteriza las 3 pantallas con el `App` real. `dashboard-admin-only.test.tsx`, `ProtectedRoute.test.tsx`, `dashboard-parity.test.tsx` y `e2e/dashboard-admin-only.spec.ts` cubren el acceso. | Estas pruebas se **actualizan a propósito** en la fase que añade la entrada (F1), no se debilitan: 4 funcionales, 12 entradas, nueva lista de «Gestión comercial». |
| Datos y roles | `public.get_user_type()` (SECURITY DEFINER, STABLE) devuelve el rol de `auth.uid()`; para `anon` es `NULL`. Las políticas del proyecto usan `get_user_type() = 0` o `IN (0,1)`. | Toda política nueva usa `get_user_type() = 0`: `anon` y cualquier valor distinto fallan cerrado. |
| Patrón de RPC | `convert_ticket_to_project` (`20260605000005_…`): `SECURITY DEFINER SET search_path = public`, comprueba `get_user_type() IS DISTINCT FROM 0`, `REVOKE … FROM PUBLIC, anon`, `GRANT … TO authenticated`. | Las RPC de cotizaciones copian ese patrón (con `search_path` más estricto y sin referencias sin cualificar). |
| Patrón «solo servidor» | `contact_rate_events`: RLS activo, `REVOKE ALL … FROM PUBLIC, anon, authenticated`. | Se reutiliza para `cotizacion_secuencias` (no accesible desde la API). |
| Pruebas de BD | `supabase/tests/database/*.test.sql` con pgTAP: fixtures en `auth.users`, `SET LOCAL role`, `request.jwt.claims`. `db-tests.yml` corre `supabase test db`. | Los archivos pgTAP nuevos se recogen solos; **no se toca CI**. |
| Zona de proyectos | `proyectos_clientes` la leen el colaborador líder y el cliente destinatario (`client_id`) según sus políticas. `Project` (`src/types/projects.ts`) alcanza **45 símbolos** según `codegraph impact`; `createProject`/`updateProject`/`convertTicketToProject` alcanzan 5 símbolos cada uno; `ProjectDetail.tsx` está catalogada como riesgo Alto en `docs/context/PROJECT_CONTEXT.md` (Riesgos). | **Nada de lo que se copie a `proyectos_clientes` es privado del administrador.** El vínculo no debe tocar `Project`, `ProjectDetail` ni el esquema de `proyectos_clientes` (R-14). |
| Impacto en navegación | `NavItem` alcanza `adminNav.ts` y `AdminNavList.tsx`; `breadcrumbsFor` alcanza `AdminShell.tsx`; `ADMIN_NAV_GROUPS` alcanza `admin-nav.test.ts`. `ProtectedRoute` alcanza `App.tsx` y 5 archivos de prueba. | El cambio de navegación es pequeño y acotado; el de rutas solo añade filas a `App.tsx`. |
| Archivos | No hay uso de Supabase Storage (la búsqueda de `storage` solo halla `localStorage` en `useAuth.tsx` y `authRedirect.ts`). | Guardar el documento firmado como archivo sería **infraestructura nueva** (constitución, I): queda como DA-02. |
| Fechas | `src/lib/calendarDate.ts` ya fija `COMMERCIAL_TIME_ZONE = "America/Tegucigalpa"` y ofrece `commercialToday`, `calendarDayOf`, `addCalendarDays`, `calendarDaysBetween`, con pruebas. | La vigencia en cliente reutiliza esas funciones; no se escribe otra aritmética de fechas. |
| Dependencias | Ya están `zod`, `react-hook-form`, `date-fns`, `@tanstack/react-query`. No hay librería decimal. `useQuery`/`useMutation` solo se usa hoy en `useDashboardData.ts`. | No se instala nada. El dinero se maneja con enteros (R-01). TanStack Query se usa como pide `.claude/rules/dashboard.md`. |
| Formato de moneda | No existe una convención reutilizable para lempiras: `formatMoney` (`src/components/dashboard/project-detail/format.ts`) solo une el importe con el código de moneda registrado, sin separadores ni decimales fijos; el resto de `es-HN` en el código son fechas y un contador (`KpiTile`). | DA-14 se resuelve con el formato `L 1,250.00` en un formateador propio del módulo. `formatMoney` y los demás módulos no se tocan. |
| Tipos generados | `src/integrations/supabase/types.ts` se regenera; `src/lib/projects.ts` usa `supabase as any`. | Los módulos nuevos se tipan con tipos propios en `src/types/cotizaciones.ts`, y el archivo generado se regenera contra Supabase **local** (R-21), nunca a mano. |
| CI | `ci.yml` corre lint, `tsc`, `npm test`, `build`; `db-tests.yml` corre `supabase test db`. | El gate de `CLAUDE.md` es el criterio de cierre de cada fase. |

### codegraph

`codegraph init` construyó un índice local (`.codegraph/`, ignorado por git) y se ejecutó `codegraph impact` sobre: `ProtectedRoute` (11 símbolos), `Project` (45), `createProject` (5), `updateProject` (5), `convertTicketToProject` (5), `ADMIN_NAV_GROUPS` (4), `buildAdminNavGroups` (2), `NavItem`, `breadcrumbsFor`, `AdminNavList` y `preloadPanelForPath` (4). La conclusión es la de la tabla anterior. **Antes de implementar F5b se repite** sobre el estado de `main` de ese momento (ver plan, F5b).

---

## 2. Decisiones técnicas

### R-01 · Dinero: exacto, sin coma flotante, sin dependencias nuevas
- **Decisión** *(aprobada: DA-05, DA-14)*: en Postgres, `numeric(14,2)` para todo importe; en TypeScript, **enteros de centavos** (`number` seguro) con límites que garantizan que ningún producto intermedio supere 2^53 − 1 (ver R-03). El texto que escribe el administrador y los valores que llegan de la base se convierten a centavos por análisis de cadena (nunca `parseFloat` ni multiplicar por 100 en coma flotante). La autoridad del cálculo está en Postgres; el cliente lo replica solo para la vista previa inmediata y sustituye sus valores por los de la base después de guardar (DA-05).
- **Presentación y captura** *(DA-14, aprobada)*: formato `L 1,250.00` con un formateador propio determinista, no con `Intl`, cuya salida depende del motor. Captura con punto decimal (`1250.00`); la coma solo se admite como separador de miles bien formado y cualquier entrada ambigua se rechaza. La regla completa y sus vectores (M-01 a M-06) están en `contracts/calculo-y-validacion.md` §1. No hay cambio global: solo `src/lib/cotizacionDinero.ts`.
- **Justificación**: RF-014 exige resultados idénticos para los mismos datos y totales que coincidan con la suma de las líneas. Con enteros, sumar y multiplicar por una cantidad entera es exacto. `numeric` de Postgres es exacto y su `ROUND` es determinista.
- **Alternativas**: `decimal.js`/`big.js` (dependencia nueva sin necesidad, ya que solo hay sumas y un porcentaje); `BigInt` (válido, pero con los topes de R-03 no hace falta); `number` con `toFixed` (rechazado: error de coma flotante).

### R-02 · Regla de redondeo (APROBADA — DA-01)
> **Aprobada por el propietario el 2026-11-09**: redondeo decimal mitad hacia arriba a dos decimales de HNL para el anticipo en porcentaje, con aritmética exacta en centavos y una representación documentada del porcentaje (RF-122).

- **Dónde hay redondeo**: los precios unitarios se escriben con **máximo dos decimales** (se rechaza más precisión, no se redondea en silencio). El importe de línea es una cantidad entera por un precio en centavos, exacto, y las sumas son exactas. **El único importe que se calcula con división es el anticipo en porcentaje.** Por eso hay **una sola** operación de redondeo en todo el módulo.
- **Fórmula**: `anticipo = redondeo_mitad_hacia_arriba(total_único × porcentaje / 100, 2 decimales)`. En enteros: `anticipo_centavos = floor((total_centavos × puntos_base + 5000) / 10000)`, con el porcentaje guardado como **puntos base** (entero 0–10000, es decir, hasta dos decimales de porcentaje: 33.33 %).
- **Dónde se aplica**: en el borrador, cada vez que cambia el total único o el porcentaje; al emitir, el monto resultante **queda fijo** (edge case «anticipo en porcentaje y cambio del total»). `saldo = total_único − anticipo` es exacto, así que anticipo + saldo suma siempre el total único sin diferencia de centavos (CE-018).
- **Justificación**: «mitad hacia arriba» es la convención que espera un usuario no técnico (0,5 centavos → 1 centavo); en Postgres coincide con `ROUND(numeric, 2)` (mitad lejos de cero, y todos los importes son ≥ 0), por lo que SQL y TypeScript dan lo mismo; no depende de la configuración del motor.
- **Alternativas**: redondeo bancario (mitad al par: menos intuitivo y poco habitual en documentos comerciales); truncar (nunca cobra de más pero sesga siempre a la baja); redondear siempre hacia arriba (sesga al alza). En empates de medio centavo la diferencia es de un centavo y no afecta a la conciliación, porque el saldo es el resto.
- **Vectores de prueba** (sintéticos): V-05 a V-11 de `contracts/calculo-y-validacion.md`. Se usan los **mismos** en Vitest y en pgTAP.
- **Representación del porcentaje**: `numeric(5,2)` en la base y puntos base (entero 0–10000) en TypeScript; la conversión es por análisis de texto.

### R-03 · Límites numéricos y de texto *(APROBADOS — DA-07)*
- **Cantidad**: entero de 1 a 9 999, por defecto 1.
- **Nivel de línea** (precio unitario, importe de línea `cantidad × precio unitario`, tarifa de tramo, importe de cada período y ajuste del primer período): `0 ≤ x ≤ L 99,999,999.99`. El precio unitario y el producto se validan por separado: un precio dentro de su límite puede dar un importe de línea fuera del suyo.
- Máximo **100 líneas** por cotización y **12 tramos** por servicio.
- **Nivel de cotización** (total único, cada total recurrente, anticipo, saldo e hitos): `≤ L 999,999,999.99`.
- **El límite del total no se deduce del de línea** *(corrección)*: 100 líneas en su máximo sumarían L 9,999,999,999.00, diez veces el límite del total. Una versión anterior de este documento afirmaba lo contrario. Por eso el total se comprueba de forma explícita, en la base (el recálculo rechaza el cambio con `COT:TOPE_EXCEDIDO`) y en TypeScript, **antes** de calcular el anticipo en porcentaje.
- **Seguridad de enteros**: el mayor producto de línea antes de comprobar su límite es 9 999 × 9 999 999 999 = 99 989 999 990 001 centavos; la mayor suma es 100 × 9 999 999 999 = 999 999 999 900; el mayor producto del porcentaje es 99 999 999 999 × 10 000 + 5 000 = 999 999 999 995 000. Todos son menores que 2^53 − 1, siempre que los pasos se ejecuten en el orden de `contracts/calculo-y-validacion.md` §2.2 y cada paso que falle detenga los siguientes. Toda operación intermedia de TypeScript verifica `Number.isSafeInteger`.
- Porcentaje de anticipo: 0 a 100 con hasta dos decimales.
- Textos: nombre/empresa ≤ 200; descripción de línea ≤ 500; condiciones y notas ≤ 4 000; motivos y justificaciones: de 10 a 1 000 caracteres; referencia a la propuesta firmada ≤ 500. Los formularios llevan `maxLength` igual (regla del panel) y la BD lleva `CHECK`.
- Estos valores son **límites técnicos**, no reglas comerciales (RF-121).

### R-04 · Quién escribe qué (privilegio mínimo)
- **Decisión** *(aprobada: DA-06, opción A con salvaguardas obligatorias; `security` la revisa en cada fase)*:
  - Borradores y sus hijos (líneas, tramos, hitos): el administrador los edita por **tabla** (PostgREST) bajo RLS que exige `get_user_type() = 0` y `estado = 'borrador'`, con `GRANT` **por columna tanto en `INSERT` como en `UPDATE`**.
  - **Alta directa cerrada** *(corrección)*: una versión anterior solo limitaba `UPDATE`, de modo que un alta directa podía traer estado, familia, origen de revisión o totales. Ahora ningún alta ni cambio directo puede escribir campos del ciclo de vida, metadatos de auditoría, orígenes de revisión o de duplicado, ni valores calculados; un trigger de alta impone `estado = 'borrador'`, la versión inicial y la auditoría de la sesión. La lista de columnas escribibles está en `contracts/acceso-y-rls.md` §1.1.
  - **Toda transición** (emitir, revisar, duplicar, rechazar, cancelar, aceptar, revertir, archivar, vincular) se hace con **RPC `SECURITY DEFINER`** atómicas que validan el rol, bloquean la fila (`FOR UPDATE`), comprueban la regla y escriben el evento de auditoría en la misma transacción.
  - **Funciones `SECURITY DEFINER`**: `search_path` fijo (`public, pg_temp`), objetos cualificados y privilegios de ejecución explícitos: `REVOKE ALL … FROM PUBLIC, anon, authenticated` en todas y `GRANT EXECUTE … TO authenticated` solo en las 14 RPC.
  - Nadie (ni `authenticated`) tiene `DELETE` sobre cotizaciones, eventos, aceptaciones ni vínculos (RF-106).
- **Justificación**: la máquina de estados (RF-072) no puede depender de que el navegador se porte bien. Con `GRANT` por columna, un `UPDATE` o un `INSERT` directo de `estado` falla con `42501` aunque el rol sea admin.
- **Alternativas**: todo por RPC (más código y menos reutilización del cliente ya existente); todo por tabla con solo RLS (permitiría saltarse la máquina de estados).

### R-05 · Inmutabilidad y máquina de estados en la base de datos
- **Decisión** *(propuesta técnica)*: un trigger `BEFORE UPDATE` en `cotizaciones` (a) rechaza cualquier transición fuera de RF-072 y (b) rechaza cambios en las columnas de contenido cuando `OLD.estado <> 'borrador'`; solo permite las columnas de estado/cierre/archivo/sustitución. Triggers en `cotizacion_lineas/_tramos/_hitos` rechazan `INSERT/UPDATE/DELETE` si la cotización padre no es borrador. `cotizacion_eventos`, `cotizacion_aceptaciones`, `cotizacion_reversiones` rechazan `UPDATE/DELETE` para todos (incluido el dueño de la tabla). Un trigger `BEFORE INSERT` en `cotizaciones` impone el estado inicial, la versión y la auditoría (R-04).
- **Por fases**: F1 crea el trigger de estados y el de inmutabilidad sobre las columnas que F1 tiene; F3 y F4 añaden columnas y la restricción de forma de las filas emitidas. Las pruebas de F1 no usan nada de F3, F4 ni F5a; cuando F4 añade la restricción de forma, actualiza a propósito los datos de ejemplo de la prueba de transiciones de F1.
- **Justificación**: defensa en profundidad (RF-027, RF-066, CE-017, CE-023). Las pruebas pgTAP intentan saltar cada regla incluso como `postgres`.
- **Alternativa**: solo validar en las RPC (más simple, pero un error futuro en una RPC rompería la inmutabilidad sin que nada lo detecte).

### R-06 · Numeración `COT-AAAA-NNNN`
- **Decisión** *(propuesta técnica)*: tabla `cotizacion_secuencias(anio, ultimo)` solo accesible desde funciones. La emisión hace `INSERT … ON CONFLICT (anio) DO UPDATE SET ultimo = ultimo + 1 RETURNING ultimo` **dentro de la transacción de emisión**: la fila de ese año serializa las emisiones simultáneas (RF-081) y, si la transacción falla, el incremento se revierte, así que no quedan huecos por errores. El año sale de `(now() AT TIME ZONE 'America/Tegucigalpa')`.
- **Formato**: `'COT-' || anio || '-' || (CASE WHEN n < 10000 THEN lpad(n::text, 4, '0') ELSE n::text END)`. Es deliberado: `lpad` **trunca** si el texto es más largo que el ancho, lo que rompería la numeración desde 10 000 (RF-080, CE-034).
- **Unicidad**: `UNIQUE (anio, secuencia)` en la familia y `UNIQUE (numero)` en la cotización: aunque algo fallara, la BD rechaza un duplicado.
- **Alternativas**: `SEQUENCE` de Postgres (no se reinicia por año y consume valores al revertir → huecos); `max()+1` (condición de carrera).

### R-07 · Vigencia y «vencida» derivada
- **Decisión** *(propuesta técnica)*: se guardan `fecha_emision` (date, calendario de Honduras en el instante de emitir) y `valida_hasta = fecha_emision + 14`. «Vencida» **no se guarda**: es `fecha_hoy_en_Honduras > valida_hasta`, evaluada con funciones SQL puras que reciben el instante como parámetro (`cotizacion_esta_vencida(valida_hasta, ahora)`), de modo que las pruebas usan instantes fijos sin falsear el reloj. Las RPC pasan `now()`; el cliente usa `commercialToday()`.
- **Justificación**: RF-062/063, CE-004, CE-015. Una sola fuente de la regla en SQL (decisiones) y la misma fórmula en TS (presentación), con los mismos vectores.
- **Alternativa**: columna `vencida` o tarea programada (`pg_cron`): introduce un estado que la spec prohíbe y una pieza de infraestructura nueva.

### R-08 · Familias, revisiones y «sustituida»
- **Decisión** *(propuesta técnica)*: `cotizacion_familias` guarda el número base (`COT-AAAA-NNNN`) y se crea **en la primera emisión**. Cada versión (original = revisión 0, `-R1`, `-R2`…) es una fila de `cotizaciones` con `familia_id`, `revision` y `numero` completo únicos. «Sustituida» es el atributo `sustituida_at/por`, no un estado. Un índice único parcial `(familia_id) WHERE estado = 'borrador'` garantiza **una sola revisión en borrador por familia** (RF-097); los duplicados no tienen familia hasta emitirse, así que no chocan.
- **Elegibilidad** (RF-083, RF-096): se comprueba en `cotizacion_crear_revision` **y otra vez en `cotizacion_emitir`**, con la fila de origen bloqueada.
- **Pendiente (DA-10, puerta de F5a)**: una «Emitida» que **volvió** de una aceptación revertida cumple la letra de RF-083, pero el propietario indicó que esa revisión **no se habilite en silencio**. Regla por defecto: una cotización con historial de aceptación no admite `cotizacion_crear_revision` (`COT:NO_REVISABLE`); se puede duplicar. La comprobación entra en F5a, que es cuando existe el historial; si el propietario aprueba DA-10 en sentido afirmativo antes de F5a, la comprobación se retira.

### R-09 · Duplicados, deriva del catálogo y comparación
- **Decisión** *(propuesta técnica; la comparación por precio unitario es DA-08, aprobada)*: `cotizacion_duplicar` crea un borrador con `duplicado_de_id`, copia la instantánea del prospecto (RF-099) y las líneas con su cantidad. Las líneas del catálogo se **reprecian** con el precio unitario vigente y guardan `precio_unitario_origen` (precio unitario del origen) para mostrar la comparación por unidad; las manuales conservan su precio unitario y nacen con `revisada = false`. `cotizacion_emitir` exige todas las manuales revisadas (RF-090) y ningún elemento retirado (RF-098).
- **Deriva en borradores** (RF-108): cada línea de catálogo guarda `precio_catalogo_ref` (el precio unitario del catálogo cuando se añadió o se confirmó). Si el catálogo cambia, `precio_catalogo_ref ≠ precio vigente` y el borrador **no puede emitirse** hasta que el administrador elija «actualizar» o «conservar» (RPC `cotizacion_resolver_precio`); nunca se reprecia en silencio.

### R-10 · Composición de paquetes (RF-107)
- **Decisión** *(propuesta; la spec delega el mecanismo al plan)*: tabla `catalogo_paquete_modulos(paquete_id, modulo_id)`. Cuando un módulo ya incluido por un paquete presente en la cotización se añade como módulo, la línea se guarda con `incluida_en_linea_id = <línea del paquete>`, **no suma al total** y se muestra «incluido en el paquete». La marca la asigna la base al recalcular, no el navegador. La validación de emisión rechaza una cotización donde un módulo con cargo coincida con la composición de un paquete presente.
- **Unidades adicionales** *(DA-08, aprobada; el mecanismo es propuesta técnica)*: un módulo incluido no se cobra sea cual sea su cantidad. Si el administrador quiere cobrar unidades adicionales, añade una línea aparte y la marca con `unidades_adicionales = true`; esa línea cuenta con su cantidad y su precio unitario. El sistema nunca crea ni cobra esa línea por su cuenta (RF-119).
- **Fuera de alcance**: dependencias e incompatibilidades entre módulos (DP-02 resto, diferido).

### R-11 · Anticipo, hitos, pago único y recurrentes
- **Anticipo** (DP-05): `anticipo_modo ∈ {NULL, 'monto', 'porcentaje'}`; sin valor por defecto (RF-017). Entre 0 y el total único, ambos incluidos.
- **Hito 1 = anticipo (no se duplica)**: el anticipo **no es una fila de `cotizacion_hitos`**; es el primer hito *derivado* cuando `anticipo > 0`. `cotizacion_hitos` guarda solo los **demás** hitos (RF-018, RF-111). Así el anticipo no puede contarse dos veces por construcción.
- **Conciliación** (RF-019): si hay hitos, `anticipo + Σ hitos = total_único` exacto; si no, el saldo es **un pago único** y `condiciones_pago_unico` es obligatorio cuando `saldo > 0` (RF-110).
- **Anticipo no definido** *(DA-12, aprobada)*: se trata como 0 para validar (no se muestra anticipo ni saldo, escenario 6 de la Historia 2); si hay total único y no hay hitos, se exige igualmente `condiciones_pago_unico`: un cargo único nunca se emite sin condiciones de pago explícitas (RF-110).
- **Recurrentes**: `periodicidad ∈ {mensual, anual}` por línea (RF-073); `fecha_inicio`, tarifas y `condiciones_renovacion` obligatorias para emitir (RF-075); anual exige `condiciones_pago_anual` (RF-074); `cotizacion_tramos` (mes_desde, mes_hasta, tarifa) para servicios mensuales, validados: empiezan en 1, sin huecos ni solapes, último abierto (RF-076); `primer_periodo_importe/descripcion` explícitos y ≥ 0 (RF-078); **sin prorrateo** en ninguna función.
- **Cantidad en recurrentes** *(DA-08, aprobada)*: la tarifa de la línea y la de cada tramo son precios **por unidad y por período**; el importe de cada período es `cantidad × tarifa`, con la misma cantidad en todos los tramos (RF-116). El ajuste del primer período es un importe que se aplica **una vez a toda la línea** y no se multiplica por la cantidad (RF-117).
- **Presentación**: los recurrentes se agrupan por periodicidad y no se suman entre sí ni al total único; con tramos se muestra la tabla, sin total de toda la vigencia (RF-010).

### R-12 · Auditoría append-only
- **Decisión** *(propuesta técnica)*: `cotizacion_eventos` (bigint identity) con `tipo`, `actor`, `ocurrido_at`, `motivo` y `detalle jsonb`. Se escribe **solo desde las RPC**; nadie la edita ni borra. El `detalle` lleva solo identificadores y códigos de estado o de acción, con un esquema estricto por tipo de evento (`data-model.md` §2.9): **nunca** correo, teléfono ni nombre del prospecto (RF-004, RF-035), y tampoco importes, números ni fechas que ya están en la fila protegida a la que el evento apunta. «Quién creó o modificó y cuándo» (RF-029) vive además en `creado_por/at` y `actualizado_por/at` de los borradores, que fija un trigger y el navegador no puede escribir. El conjunto de tipos de evento crece con cada fase (F1 solo `creada`): ninguna fase declara ni prueba tipos de una fase posterior.

### R-13 · Evidencia de la propuesta firmada: referencia segura, sin Storage (DA-02, puerta de F5a)
- **Decisión recomendada** *(no aprobada todavía; el propietario la decide antes de F5a)*: en v1 se guarda una **referencia** (identificador o nombre del documento en la custodia del administrador, texto ≤ 500) y, opcionalmente, un **enlace https** validado con `src/lib/safeUrl.ts` (misma guardia que ya usa el enlace de requisitos del proyecto). Se guarda en `cotizacion_aceptaciones`, tabla solo legible por el administrador (RLS + `get_user_type() = 0`); no se publica por el portal ni por enlaces propios.
- **Límite honesto**: el control de acceso al documento *detrás* del enlace pertenece al sistema donde el administrador lo guarde; esta plataforma solo protege la **referencia** y los metadatos. Se documenta en la interfaz.
- **Alternativa (no se adopta sin aprobación)**: bucket privado de Supabase Storage con URL firmadas de corta vida. Es **infraestructura nueva** (constitución I): exige `/l99`, política de Storage, pruebas pgTAP del bucket, decisión de retención y tamaño, y pasos del Propietario. Se deja diseñada como evolución posible, no como parte del plan.

### R-14 · Vínculo con proyecto (DA-03, DA-04) — fase final y bloqueada
- **Decisión recomendada**: tabla propia `cotizacion_proyecto_vinculos(cotizacion_id, proyecto_id, …)`. **No** se añade columna a `proyectos_clientes`, **no** se modifica `Project`/`src/types/projects.ts` ni `ProjectDetail.tsx`. El vínculo es visible desde la cotización (RF-055) y se consulta por join solo desde cotizaciones.
- **Cardinalidad**: la tabla admite cualquier cardinalidad; cuál se impone es **una restricción de unicidad** que se elige al aprobar DA-03. Opciones: (A) una cotización → como máximo un proyecto, un proyecto → varias cotizaciones (la propuesta de la spec, DP-09 resto); (B) uno a uno; (C) muchos a muchos. **No se asume ninguna sin aprobación**; F5b no empieza hasta que el propietario elija.
- **Qué pasa al proyecto**: *crear* un proyecto copia solo `nombre_proyecto`, `descripcion` (resumen del alcance, sin importes) y los datos de contacto del prospecto (`client_name/email/phone`, campos que `proyectos_clientes` ya tiene). **Las finanzas no se copian**: `proyectos_clientes` es legible por el colaborador líder y por el cliente del proyecto, de modo que copiar importes los expondría y ampliaría el acceso de dos roles (viola RF-003 y RF-002). Las finanzas quedan en la cotización y se ven por referencia, solo para el administrador. Si el propietario quiere finanzas dentro del proyecto, es una decisión de seguridad aparte.
- **Crear vs enlazar**: dos RPC separadas y explícitas (`cotizacion_vincular_proyecto`, `cotizacion_crear_proyecto`), ambas solo admin y solo sobre «Aceptada y firmada». La segunda sigue el patrón de `convert_ticket_to_project` (misma transacción, sin tocar su definición).
- **Acciones sobre cotizaciones con proyecto vinculado**: reversión y cancelación correctiva **no disponibles** en v1 (RF-068, instrucción del propietario); `cotizacion_revertir_aceptacion` y `cotizacion_cancelar_correctiva` lanzan `COT:PROYECTO_VINCULADO`. Esa comprobación la añade la migración de F5b, que es la que crea la tabla del vínculo.

### R-15 · Cancelación correctiva (RF-105; procedimiento concreto: DA-11, puerta de F5a)
- **Requisito aprobado que se conserva**: la cancelación correctiva de RF-105 forma parte de la primera versión y **no se sustituye por el rechazo ordinario**.
- **Diseño recomendado**: la cancelación **ordinaria** (`cotizacion_cancelar`) solo opera desde Borrador o Emitida **sin historial de aceptación** (RF-069, RF-104). Para una cotización con historial de aceptación y **sin proyecto vinculado**, existe una RPC distinta, `cotizacion_cancelar_correctiva`, que exige justificación (10–1 000 caracteres) y una confirmación explícita aparte, y deja un evento inmutable. **Con proyecto vinculado, `cotizacion_cancelar_correctiva` no está disponible** hasta que el propietario apruebe un procedimiento administrativo separado.
- **Fase**: F5a, tras registrar y revertir aceptaciones. La regla «sin historial de aceptación» de `cotizacion_cancelar` también entra en F5a, porque el historial no existe antes; el propietario confirma el procedimiento concreto (justificación y confirmación escrita del número) antes de implementarlo.

### R-16 · Rutas, menú y migas
- **Decisión**: tres filas nuevas en `App.tsx`, cada una `ProtectedRoute allowedTypes={[0]}` → `AdminShell` → página lazy: `/dashboard/cotizaciones`, `/dashboard/cotizaciones/catalogo`, `/dashboard/cotizaciones/:id`. Entrada «Cotizaciones» (`funcional`, `roles: [0]`) dentro de «Gestión comercial», con `match.exact` para la lista y el catálogo y `match.prefix` para `/dashboard/cotizaciones/`.
- **Resolución `catalogo` vs `:id`**: la página de detalle valida que `:id` sea un UUID; cualquier otro valor muestra «Cotización no encontrada». Como la clave primaria es un UUID, ninguna cotización puede llamarse «catalogo» (RF-059). Una prueba renderiza el `App` real en las tres rutas.
- **Migas** *(DA-13, opción A, aprobada)*: extensión mínima y retrocompatible de `NavItem`: `subpages?: readonly { path: string; label: string }[]`. `breadcrumbsFor` usa la etiqueta de la subpágina si la ruta coincide (`Gestión comercial / Cotizaciones / Catálogo`) y «Detalle» solo para el resto. Las entradas existentes no cambian de comportamiento (se fija con la prueba actual).
- **Precarga**: opcional, añadir la lista a `FIRST_PAGE`/`SHELL_PATHS`.

### R-17 · Edición simultánea (spec: edge case)
- `row_version integer` en `cotizaciones`, incrementado por trigger en cada `UPDATE`. El cliente envía la versión que leyó (`.eq('row_version', n)`); si no coincide devuelve 0 filas y la interfaz muestra «Otra sesión modificó esta cotización; recarga para ver los cambios» sin sobrescribir.
- **La versión es de todo el borrador** *(salvaguarda de DA-06)*: cada cambio en una línea, un tramo o un hito recalcula los totales en la fila de la cotización y, por tanto, incrementa su `row_version`. Eso es deliberado: `cotizacion_emitir(p_row_version)` solo emite el contenido que el administrador vio. Para que la propia sesión no reciba un falso conflicto, `src/lib/cotizaciones.ts` recarga la cotización (versión y totales de la base) tras cada cambio en sus hijas, antes de permitir otra escritura, y serializa las mutaciones de un mismo borrador. El aviso solo aparece cuando el cambio vino de otra sesión.
- **Versión por fila en líneas, tramos e hitos** *(aprobada el 2026-11-09, DT-03 de `plan.md`)*: la versión de la cotización no puede viajar en una escritura de tabla de una hija, así que por sí sola dejaba una ventana en la que dos administradores podían pisarse un precio o una cantidad sin aviso. Cada línea, tramo e hito lleva su propia `row_version`, que el navegador no escribe; todo `UPDATE` y todo `DELETE` va condicionado a la versión leída y 0 filas afectadas es un conflicto de edición que no sobrescribe. La versión de la cotización sigue protegiendo la emisión. Detalle en `data-model.md` §3.1.

### R-18 · Edge Functions: ninguna
- No se crea ninguna Edge Function: no hay correo, ni firma, ni webhook, ni secreto (RF-032, Q3). Toda la lógica va en Postgres (RPC) y en `src/lib/*`. Eso deja intacto C3 para funciones y evita pasos del Propietario de despliegue de funciones.

### R-19 · Paridad SQL ↔ TypeScript (DA-05, opción A, aprobada)
- Un solo conjunto de **vectores** (`contracts/calculo-y-validacion.md`, V-01 a V-36) alimenta un test de Vitest sobre `src/lib/cotizacionCalculo.ts` y los `SELECT is(...)` de pgTAP sobre las funciones SQL equivalentes. Si una diverge, falla CI.
- **Postgres es la autoridad** de los importes de línea, los totales, el anticipo y la validación financiera. TypeScript calcula solo la vista previa inmediata, con las mismas reglas verificadas. El navegador nunca envía un importe de línea ni un total (no tiene privilegio de columna), ninguna RPC los acepta como entrada, y tras cada guardado la pantalla sustituye su vista previa por los valores que devuelve la base.

### R-20 · Tipado
- `src/types/cotizaciones.ts` es **nuevo**; `src/types/projects.ts` no cambia. Los estados se declaran como unión de literales con un `Record<Estado, {label; tone}>` que usa los colores de estado del sistema (`var(--success)`, `var(--warning)`), nunca hex.

### R-21 · Tipos generados de Supabase
- Tras cada migración, el implementador regenera `src/integrations/supabase/types.ts` contra la base **local** (Docker); nunca se edita a mano ni se genera contra producción.

### R-22 · Archivado
- `archivada_at/por` (atributo de organización). La lista oculta archivadas por defecto y las muestra con un filtro. La RPC `cotizacion_archivar` registra un evento; **no** cambia estado, contenido ni historial (RF-071). Se permite archivar en cualquier estado.

### R-23 · Vista previa
- Un componente de documento reutilizable (`CotizacionDocumento`) dibuja el contenido que vería el cliente; vive en la página de detalle como pestaña (parámetro `?vista=previa`, que **no** es una ruta nueva). Sin PDF, sin descarga, sin envío (RF-032; PDF diferido, DP-07 resto).

### R-24 · Cantidad por precio unitario (DA-08, aprobada)
- **Decisión**: cada línea lleva `cantidad` (entero, 1 por defecto, de 1 a 9 999) y `precio_unitario` en HNL. El importe de la línea es `cantidad × precio_unitario` y lo calcula la base; el administrador no lo escribe (RF-115, RF-118).
- **Por qué es seguro**: una cantidad entera por un precio con dos decimales es un producto exacto, tanto en `numeric` como en enteros de centavos. No aparece ningún redondeo nuevo: el único redondeo del módulo sigue siendo el anticipo en porcentaje (R-02). Los límites de R-03 acotan el producto antes de cualquier suma.
- **Alcance**: cargos únicos y servicios recurrentes (RF-116); tramos como precios por unidad y por período con la misma cantidad; ajuste del primer período una vez por línea (RF-117); comparación con el catálogo y en duplicados por precio unitario, conservando la cantidad (RF-118); módulos incluidos sin cargo y unidades adicionales en línea explícita (R-10, RF-119).
- **Fuera de la primera versión**: cantidades fraccionarias y facturación por horas con fracciones (RF-120). Añadirían un segundo punto de redondeo y exigirían otra decisión del propietario.
- **Dónde entra**: solo en F3 (`cotizacion_lineas` y el cálculo). F1 y F2 no cambian: el precio del catálogo ya es un precio unitario.
- **Alternativa descartada**: mantener una línea igual a un importe (la propuesta original). El propietario la descartó: obligaría a expresar las unidades en la descripción y a calcular el producto a mano.

---

## 3. Alternativas generales descartadas

- **Un módulo `Clientes`** para guardar prospectos (Q1 = B lo prohíbe).
- **Guardar el contenido emitido como un único `jsonb` inmutable**: más simple para inmutabilidad, pero pierde las restricciones relacionales (tramos contiguos, importes ≥ 0, FKs al catálogo), complica la comparación de precios y dificulta las pruebas pgTAP. Se prefieren filas inmutables protegidas por triggers.
- **Descuentos, impuestos, pasarelas, PDF, correo**: fuera de alcance (spec). Una prueba de esquema verifica que no existen columnas de impuesto ni de descuento.
