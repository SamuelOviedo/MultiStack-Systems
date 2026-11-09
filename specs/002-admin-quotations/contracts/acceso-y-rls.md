# Contrato: acceso, RLS y pruebas pgTAP por rol

**Spec**: RF-001 a RF-004, RF-051, RF-106, RF-118, Historia 5, CE-003, CE-012 · **Constitución**: II y C3 · **Modelo**: `data-model.md` · **Decisión**: DA-06, opción A con salvaguardas obligatorias (aprobada el 2026-11-09)

Principio: **nadie gana acceso nuevo.** El módulo es solo del administrador (rol 0). Colaborador (1), cliente (2) y visitante (`anon`) no ven filas, no escriben y no ejecutan nada. Todo falla cerrado: un rol `NULL` (sin perfil) tampoco pasa, porque `get_user_type() = 0` es falso.

Segundo principio (DA-06): **el navegador solo escribe contenido de borradores.** El ciclo de vida, la auditoría, los orígenes de revisión y de duplicado y todo valor calculado los fija la base, tanto al insertar como al actualizar.

## 1. Reglas generales de privilegios

1. En cada tabla nueva: `ENABLE ROW LEVEL SECURITY`; `REVOKE ALL … FROM PUBLIC, anon, authenticated`; después **solo** los `GRANT` de este contrato.
2. Todas las políticas usan `public.get_user_type() = 0` (nunca `IN (0,1)`).
3. Ninguna tabla concede `DELETE` a `authenticated`, salvo las hijas de un borrador (líneas, tramos, hitos) y la composición del catálogo.
4. **Privilegios por columna en `INSERT` y en `UPDATE`.** No existe `GRANT INSERT` ni `GRANT UPDATE` de tabla completa: cada tabla concede solo las columnas de contenido de §1.1. Las demás columnas toman su valor por defecto seguro o las fija un trigger o una función del módulo. Intentar escribirlas falla con `42501`, aunque el rol sea administrador.
5. **Políticas.** `INSERT` en `cotizaciones`: `WITH CHECK (get_user_type() = 0 AND estado = 'borrador')`. `UPDATE` en `cotizaciones`: `estado = 'borrador'` en `USING` y en `WITH CHECK`. Las hijas verifican con `EXISTS`, en `INSERT`, `UPDATE` y `DELETE`, que el padre es un borrador.
6. **Triggers de alta** (`BEFORE INSERT`), para cualquier rol: imponen `estado = 'borrador'`, `row_version = 1` y la auditoría de la sesión (`creado_por = auth.uid()`, `creado_at = now()`), sin atender al valor recibido. Los triggers de R-05 (`BEFORE UPDATE`) repiten la regla de inmutabilidad y de transiciones.
7. **Funciones `SECURITY DEFINER`.** Todas llevan `SET search_path = public, pg_temp` (ruta fija, con `pg_temp` al final) y nombran sus objetos con esquema. Privilegios explícitos: `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated` en **todas** (los privilegios por defecto del esquema no bastan), y después `GRANT EXECUTE … TO authenticated` **solo** en las 14 RPC de `contracts/rpc-cotizaciones.md` §0. Las funciones de apoyo y de trigger no conceden `EXECUTE` a ningún rol de la API. Cada RPC comprueba `get_user_type() = 0` en su primera sentencia.
8. `cotizacion_secuencias` no concede nada a la API (solo funciones `SECURITY DEFINER`).
9. Ninguna vista ni función devuelve filas de cotizaciones a un rol distinto del administrador; si se crea una vista, es `security_invoker = true`.
10. El portal de clientes (`/client/:token`, `portal.ts` y sus RPC) **no** se modifica ni expone nada de este módulo (RF-002).

### 1.1 Columnas que el administrador puede escribir directamente

Lo que no aparece en las columnas «INSERT» y «UPDATE» no es escribible por el navegador.

| Tabla | `INSERT` | `UPDATE` | Lo fija la base (sin privilegio de escritura) |
| --- | --- | --- | --- |
| `catalogo_items` (F2) | `tipo`, `nombre`, `descripcion`, `precio_hnl`, `cargo`, `periodicidad` | `nombre`, `descripcion`, `precio_hnl`, `cargo`, `periodicidad`, `retirado_at` (el trigger sustituye el valor por `now()` o por `NULL`) | `id`, `tipo` tras el alta, `creado_*`, `actualizado_*` |
| `catalogo_paquete_modulos` (F2) | `paquete_id`, `modulo_id` | — | — |
| `cotizaciones` (F1) | `prospecto_nombre`, `prospecto_contacto`, `prospecto_email`, `prospecto_telefono` | las mismas | `id`, `referencia_interna`, `estado`, `creado_*`, `actualizado_*`, `row_version` |
| `cotizaciones` (F3 añade) | `titulo`, `condiciones_generales`, `anticipo_modo`, `anticipo_porcentaje`, `anticipo_monto`, `condiciones_pago_unico` | las mismas | `total_unico`, `saldo_pago_unico`, `recurrente_mensual_inicial`, `recurrente_anual`; `anticipo_monto` cuando el modo es porcentaje (el trigger lo recalcula) |
| `cotizaciones` (F4 añade) | — | — | `numero`, `familia_id`, `revision`, `emitida_at`, `emitida_por`, `fecha_emision`, `valida_hasta`, `revision_de_id`, `duplicado_de_id`, `sustituida_*`, `cerrada_*`, `archivada_*`, `requiere_confirmar_anticipo` |
| `cotizacion_lineas` (F3) | `cotizacion_id`, `orden`, `origen`, `tipo_linea`, `catalogo_item_id`, `descripcion`, `cantidad`, `precio_unitario`, `es_cortesia`, `cargo`, `periodicidad`, `incluida`, `unidades_adicionales`, `fecha_inicio`, `condiciones_renovacion`, `condiciones_pago_anual`, `primer_periodo_importe`, `primer_periodo_descripcion` | las mismas salvo `cotizacion_id`, `origen`, `tipo_linea` y `catalogo_item_id`; además `revisada` (solo de `false` a `true`) | `id`, `importe`, `incluida_en_linea_id`, `precio_catalogo_ref`, `precio_unitario_origen` |
| `cotizacion_tramos` (F3) | `linea_id`, `mes_desde`, `mes_hasta`, `tarifa` | `mes_desde`, `mes_hasta`, `tarifa` | `id` |
| `cotizacion_hitos` (F3) | `cotizacion_id`, `orden`, `descripcion`, `importe` | `orden`, `descripcion`, `importe` | `id` |

Notas:

- **Línea de catálogo**: en el alta, un trigger toma del catálogo el precio unitario y la referencia (`precio_catalogo_ref`); el valor que envíe el navegador se ignora. Después el administrador puede cambiar el precio unitario de forma explícita (RF-084); la deriva frente al catálogo se resuelve con `cotizacion_resolver_precio`.
- **Orígenes**: `revision_de_id`, `duplicado_de_id`, `familia_id` y `precio_unitario_origen` solo los escriben `cotizacion_crear_revision` y `cotizacion_duplicar`. Un alta directa no puede fabricar una revisión ni un duplicado.
- **Versión del borrador**: todo cambio en una línea, un tramo o un hito incrementa `row_version` de la cotización (por el recálculo). La versión protege al borrador completo, y por eso `cotizacion_emitir` la exige. La capa de datos (`src/lib/cotizaciones.ts`) recarga la cotización —versión y totales calculados— tras cada cambio en sus hijas antes de permitir otra escritura, y serializa las mutaciones de un mismo borrador. Así el aviso de conflicto solo aparece cuando otra sesión cambió el borrador, nunca por los cambios de la propia sesión.

## 2. Matriz tabla × rol

`—` = sin privilegio (error `42501` al intentar); `0 filas` = el privilegio existe pero la política no devuelve nada.

| Tabla | `anon` | cliente (2) | colaborador (1) | admin (0) |
| --- | --- | --- | --- | --- |
| `catalogo_items` | — | `SELECT` 0 filas; escrituras → error | igual | `SELECT`; `INSERT` y `UPDATE` de las columnas de §1.1; sin `DELETE` |
| `catalogo_paquete_modulos` | — | 0 filas; escrituras → error | igual | `SELECT`, `INSERT`, `DELETE` (composición editable; no es registro histórico) |
| `cotizaciones` | — | 0 filas; escrituras → error | igual | `SELECT`; `INSERT` de las columnas de §1.1 (nace en borrador); `UPDATE` de esas columnas solo con `estado='borrador'`; sin `DELETE` |
| `cotizacion_lineas`, `cotizacion_tramos`, `cotizacion_hitos` | — | 0 filas; escrituras → error | igual | `SELECT`; `INSERT/UPDATE` de las columnas de §1.1 y `DELETE`, solo si la cotización es borrador |
| `cotizacion_familias` | — | 0 filas | 0 filas | `SELECT`; sin escritura (la crea `cotizacion_emitir`) |
| `cotizacion_eventos` | — | 0 filas | 0 filas | `SELECT`; sin escritura directa; sin `UPDATE/DELETE` para nadie |
| `cotizacion_aceptaciones`, `cotizacion_reversiones` | — | 0 filas | 0 filas | `SELECT`; sin escritura directa; inmutables |
| `cotizacion_proyecto_vinculos` (F5b) | — | 0 filas | 0 filas | `SELECT`; sin escritura directa |
| `cotizacion_secuencias` | — | — | — | — |

## 3. Pruebas pgTAP exigidas (mínimo)

Un archivo por fase en `supabase/tests/database/` (nombres propuestos: `cotizaciones_fundacion`, `catalogo_servicios`, `cotizaciones_borradores`, `cotizaciones_emision`, `cotizaciones_aceptacion`, `cotizaciones_proyecto`). Los fixtures usan correos `@test.local` y UUID fijos sintéticos, como los existentes.

**Regla de fases**: cada archivo prueba solo lo que su fase crea. Ninguna prueba de una fase da por hecho una tabla, una columna, una función o un tipo de evento de una fase posterior.

### 3.1 En todas las tablas con datos de usuario (parametrizable por tabla)

| # | Prueba | Rol |
| --- | --- | --- |
| A1 | `SELECT` → `42501` | `anon` |
| A2 | `INSERT` → `42501` | `anon` |
| A3 | `SELECT` devuelve 0 filas existiendo filas | cliente |
| A4 | `SELECT` devuelve 0 filas existiendo filas | colaborador |
| A5 | `INSERT/UPDATE/DELETE` → error (`42501` o 0 filas afectadas con verificación posterior) | cliente y colaborador |
| A6 | `SELECT` devuelve las filas | administrador |
| A7 | `DELETE` → error en tablas de registro | administrador |
| A8 | Ninguna columna de la tabla contiene `impuesto`, `isv`, `iva`, `tax` ni `descuento` en su nombre | catálogo de esquema |
| A9 | La tabla tiene RLS activo y no hay política con `USING (true)` | catálogo de esquema |

### 3.2 Específicas

| # | Prueba | Fase |
| --- | --- | --- |
| S1 | El administrador no puede hacer `UPDATE cotizaciones SET estado = 'emitida'` directo (sin privilegio de columna) | F1 |
| S2 | Como `postgres`, el trigger rechaza cada transición no incluida en RF-072 (matriz completa, incluidas las que salen de Rechazada y Cancelada). En F1 la fila de ejemplo solo tiene las columnas de F1; cuando F4 añade la restricción de forma, F4 **actualiza a propósito** los datos de ejemplo (número, familia, fechas) sin relajar ninguna aserción | F1 (se ajusta en F4) |
| S3 | Una fila que no es borrador rechaza cambios de prospecto (F1, con una fila llevada al estado como `postgres`); rechaza cambios de contenido y sus líneas, tramos e hitos rechazan insertar, editar y borrar (F3, igual); y lo mismo sobre una cotización emitida con `cotizacion_emitir` (F4) | F1 / F3 / F4 |
| S4 | `cotizacion_eventos` rechaza `UPDATE` y `DELETE` incluso al dueño (F1); `cotizacion_aceptaciones` y `cotizacion_reversiones`, igual (F5a) | F1 / F5a |
| S5 | `cotizacion_secuencias` no es legible ni escribible por ningún rol de la API | F4 |
| S6 | Un elemento retirado no se puede añadir a un borrador; las líneas existentes no cambian | F3 |
| S7 | `total_unico` y demás totales no se pueden escribir directamente (sin privilegio de columna) | F3 |
| S8 | Una línea manual con precio unitario cero sin `es_cortesia` se rechaza; con la marca se acepta | F3 |
| S9 | La BD rechaza precios negativos, con más de 2 decimales o sobre su límite y textos sobre su máximo | F2 (catálogo) / F3 (líneas) |
| S10 | El administrador no puede insertar un evento (falsificar auditoría) | F1 |
| S11 | Una cotización con historial de aceptación no puede cancelarse por `cotizacion_cancelar` (`COT:HISTORIAL_ACEPTACION`), ni siquiera tras revertir la aceptación | F5a |
| S12 | Con proyecto vinculado fallan `cotizacion_revertir_aceptacion` y `cotizacion_cancelar_correctiva` | F5b |
| S13 | Cada RPC de la fase: `anon` → `42501`; cliente y colaborador → `COT:SIN_PERMISO` | F3 en adelante (F1 y F2 no crean RPC) |
| S14 | Un usuario sin fila en `profiles` (rol `NULL`) falla en todas las tablas y RPC de la fase | cada fase |
| S15 | **Alta directa segura**: el administrador no puede insertar `estado`, `referencia_interna`, `row_version`, `creado_por` ni `creado_at` (`42501`); la fila que inserta nace en `borrador`, con versión 1 y con la auditoría de su sesión. Como `postgres`, un alta con `estado = 'emitida'` queda igualmente en `borrador` (trigger) | F1 |
| S16 | **Columnas calculadas y de ciclo de vida**: el administrador no puede insertar ni actualizar `importe` de línea, `incluida_en_linea_id`, `precio_catalogo_ref` ni `precio_unitario_origen` (F3), ni `numero`, `familia_id`, `revision`, `revision_de_id`, `duplicado_de_id`, `emitida_*`, `sustituida_*`, `cerrada_*`, `archivada_*` ni `requiere_confirmar_anticipo` (F4) | F3 / F4 |
| S17 | **Funciones**: toda función `SECURITY DEFINER` del módulo tiene `search_path` fijo; `PUBLIC` y `anon` no tienen `EXECUTE` en ninguna; `authenticated` solo lo tiene en las RPC de la lista canónica creadas hasta esa fase | cada fase |
| S18 | **Versión del borrador**: un cambio en una línea, un tramo o un hito incrementa `row_version` de la cotización; un `UPDATE` de la cotización con una versión anterior afecta 0 filas y no sobrescribe | F3 |
| S19 | **Límites** (`calculo-y-validacion.md` §2.2): cantidad 0 y 10 000 rechazadas; producto sobre el límite de línea rechazado; línea 101 y tramo 13 rechazados; un cambio que deja un total sobre su límite falla con `COT:TOPE_EXCEDIDO`, no queda guardado y no calcula anticipo en porcentaje | F3 |
| S20 | En el alta de una línea de catálogo, el precio unitario y la referencia salen del catálogo aunque se envíe otro valor | F3 |
| S21 | Una cotización con historial de aceptación no admite `cotizacion_crear_revision` (`COT:NO_REVISABLE`) mientras DA-10 no esté aprobada | F5a |

### 3.3 Qué prueba cada fase

| Fase | Tablas (A1–A9) | Específicas |
| --- | --- | --- |
| F1 | `cotizaciones`, `cotizacion_eventos` | S1, S2, S3 (prospecto), S4 (eventos), S10, S14, S15, S17 |
| F2 | `catalogo_items`, `catalogo_paquete_modulos` | S9 (catálogo), S14, S17; el retiro no borra la fila y la marca de tiempo la pone la base |
| F3 | `cotizacion_lineas`, `cotizacion_tramos`, `cotizacion_hitos` | S3 (contenido e hijas), S6, S7, S8, S9 (líneas), S13, S14, S16, S17, S18, S19, S20; vectores V-01 a V-36 |
| F4 | `cotizacion_familias`, `cotizacion_secuencias` | S2 (datos de ejemplo actualizados), S3 (emitida), S5, S13, S14, S16, S17; vectores D-01 a D-08 y N-01 a N-05 |
| F5a | `cotizacion_aceptaciones`, `cotizacion_reversiones` | S4 (aceptaciones y reversiones), S11, S13, S14, S17, S21 |
| F5b | `cotizacion_proyecto_vinculos` | S12, S13, S14, S17 |

## 4. Pruebas de interfaz y de ruta

Complementan las de base de datos (ver `contracts/rutas-y-navegacion.md`): `ProtectedRoute` con `allowedTypes={[0]}` en las tres rutas; colaborador, cliente y sin sesión rechazados o redirigidos igual que en el resto de `/dashboard`; el menú no muestra la entrada al colaborador; el portal no incluye cotizaciones. Desde F3, una prueba de pantalla edita dos líneas seguidas y después el encabezado del borrador y comprueba que no aparece el aviso de conflicto de versión.

## 5. Revisión de `security`

Por tocar auth y datos (constitución II, `CLAUDE.md`), `security` revisa **cada migración y cada RPC antes del cierre de su fase**, con foco en: `search_path` y objetos cualificados en funciones `SECURITY DEFINER`, privilegios de ejecución explícitos, privilegios por columna en `INSERT` y en `UPDATE`, valores impuestos en el alta, bloqueo de filas, atomicidad de los eventos, ausencia de datos personales en mensajes de error, y que `get_user_type()` sea la única fuente del rol.
