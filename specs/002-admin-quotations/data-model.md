# Modelo de datos (propuesta): Módulo de Cotizaciones

**Spec**: `specs/002-admin-quotations/spec.md` · **Plan**: `specs/002-admin-quotations/plan.md` · **Investigación**: `specs/002-admin-quotations/research.md`

> **Esto es un diseño, no una migración.** No se crea ningún archivo de `supabase/migrations/`. Cada fase del plan lo convertirá en una migración nueva (solo hacia adelante) con su prueba pgTAP. Los nombres de tabla y columna son propuestos y se pueden cambiar al revisar el plan; las **reglas** que sostienen vienen de la spec y se citan.
>
> Los ejemplos usan datos sintéticos. No hay precios, tasas ni porcentajes reales del negocio.
>
> **Decisiones aprobadas el 2026-11-09 que este modelo ya aplica**: DA-05 (Postgres es la autoridad del cálculo), DA-06 (escritura mixta con salvaguardas), DA-07 (límites), DA-08 (cantidad por precio unitario), DA-12 y DA-01. Siguen abiertas las puertas de F5a (DA-02, DA-09, DA-10, DA-11) y F5b sigue bloqueada (DA-03, DA-04).

## 0. Convenciones

- Roles: `get_user_type()` → 0 administrador, 1 colaborador, 2 cliente, `NULL` sin sesión (`anon`). Toda política de este módulo es `get_user_type() = 0`.
- Importes: `numeric(14,2)`, nunca negativos. Hay dos niveles de límite (DA-07; R-03 de `research.md` y `contracts/calculo-y-validacion.md` §2.2):
  - **de línea** (precio unitario, importe de línea, tarifa de tramo, importe por período, ajuste del primer período): `<= 99999999.99`;
  - **de cotización** (cada total, anticipo, saldo, hito): `<= 999999999.99`.
- Cantidad: `integer`, de 1 a 9 999, por defecto 1 (DA-08). Porcentajes: `numeric(5,2)` entre 0 y 100.
- Textos: con `CHECK (char_length(col) <= N)`; los formularios usan el mismo `maxLength`.
- **Columnas que el navegador no escribe** (DA-06): estado y demás campos del ciclo de vida, metadatos de auditoría (`*_por`, `*_at`, `row_version`), orígenes de revisión y de duplicado, número y familia, importes de línea y totales calculados. No tienen privilegio de `INSERT` ni de `UPDATE` para `authenticated`; toman un valor por defecto seguro o los fija un trigger o una función del módulo. El detalle está en `contracts/acceso-y-rls.md` §1.
- Nada se borra: ninguna tabla concede `DELETE` a `authenticated`, salvo las filas hijas de un **borrador** mientras se edita (líneas, tramos, hitos).
- «Fase» indica en qué migración aparece cada tabla o columna (F1…F5; ver `plan.md`). Una columna posterior se añade con `ALTER TABLE` en la migración de su fase.
- Auditoría de fila: `creado_por/creado_at` (+ `actualizado_por/actualizado_at` en borradores). Los cambios de estado viven en `cotizacion_eventos`.

## 1. Mapa de relaciones

```text
catalogo_items ──< catalogo_paquete_modulos >── catalogo_items
      │ (referencia, nunca se borra)
      ▼
cotizacion_lineas >── cotizaciones ──> cotizacion_familias
      │                    │   ▲ duplicado_de_id / revision_de_id / sustituida_por_id (autorreferencias)
cotizacion_tramos          │
cotizacion_hitos           ├──< cotizacion_eventos        (auditoría, solo se añade)
                           ├──< cotizacion_aceptaciones ──< cotizacion_reversiones  (inmutables)
                           └──< cotizacion_proyecto_vinculos >── proyectos_clientes (F5b, bloqueada)
cotizacion_secuencias (anio, ultimo)   — solo desde funciones
```

## 2. Tablas

### 2.1 `catalogo_items` — F2 *(RF-040, RF-047, RF-049, RF-050; Q2 = A)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `tipo` | text | `CHECK IN ('paquete','modulo')` |
| `nombre` | text NOT NULL | ≤ 200, no vacío tras `btrim` |
| `descripcion` | text | ≤ 4 000 |
| `precio_hnl` | numeric(14,2) NOT NULL | **precio unitario**, ≥ 0 y `<= 99999999.99` (límite de línea); **lo escribe el administrador, sin valor por defecto** (RF-047). La cantidad no vive en el catálogo |
| `cargo` | text NOT NULL | `IN ('unico','recurrente')` (RF-049) |
| `periodicidad` | text | `IN ('mensual','anual')`; obligatoria si `cargo='recurrente'`, nula si `'unico'` (`CHECK`) |
| `retirado_at` | timestamptz | `NULL` = disponible; no `NULL` = retirado, no seleccionable (RF-050). Nunca se borra la fila. El administrador solo indica retirar o restaurar: un trigger sustituye el valor recibido por `now()` (la marca de tiempo no la controla el navegador) |
| `creado_por`, `creado_at`, `actualizado_por`, `actualizado_at` | | RF-029. Los fija un trigger a partir de la sesión; no son escribibles |

- Índice único `lower(nombre)` entre elementos **no retirados** del mismo `tipo` (evita duplicados al elegir).
- No hay semilla: la migración **no inserta filas** (RF-047, CE-013).
- Cambiar `precio_hnl` actualiza la fila; las cotizaciones guardan su propia copia del precio unitario (RF-046), así que el cambio no las toca.

### 2.2 `catalogo_paquete_modulos` — F2 *(RF-107; mecanismo propuesto)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `paquete_id` | uuid FK → `catalogo_items(id)` | el elemento debe ser `tipo='paquete'` (trigger) |
| `modulo_id` | uuid FK → `catalogo_items(id)` | el elemento debe ser `tipo='modulo'` (trigger) |
| PK | `(paquete_id, modulo_id)` | |

Declara «este paquete ya incluye este módulo». Sin dependencias ni incompatibilidades (diferido).

### 2.3 `cotizacion_secuencias` — F4 *(RF-080, RF-081)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `anio` | integer PK | año del calendario de `America/Tegucigalpa` |
| `ultimo` | bigint NOT NULL | último número asignado ese año |

RLS activo, `REVOKE ALL … FROM PUBLIC, anon, authenticated`: solo la usan las funciones `SECURITY DEFINER` (mismo patrón que `contact_rate_events`).

### 2.4 `cotizacion_familias` — F4 *(RF-080, RF-082, RF-087)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | |
| `anio` | integer NOT NULL | |
| `secuencia` | bigint NOT NULL | `UNIQUE (anio, secuencia)` |
| `numero_base` | text NOT NULL UNIQUE | `COT-AAAA-NNNN` (≥ 4 dígitos; ver fórmula en `contracts/calculo-y-validacion.md`) |
| `creado_por`, `creado_at` | | |

Se crea en la **primera emisión** de una cotización original. Las revisiones en borrador la referencian desde que se crean.

### 2.5 `cotizaciones` — F1 (núcleo) y ampliada en F3, F4 y F5 *(RF-005, RF-023, RF-025, RF-027, RF-028, RF-043)*

**F1 — núcleo y prospecto**

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | |
| `referencia_interna` | text UNIQUE NOT NULL | `BOR-` + identidad numérica; estable; **no** es el número de cotización (RF-028) |
| `estado` | text NOT NULL DEFAULT `'borrador'` | `CHECK IN ('borrador','emitida','aceptada_firmada','rechazada','cancelada')` (RF-025). «vencida», «archivada» y «sustituida» **no** son valores |
| `prospecto_nombre` | text | persona o empresa, ≤ 200 |
| `prospecto_contacto` | text | persona de contacto, ≤ 200 |
| `prospecto_email` | text | ≤ 254 |
| `prospecto_telefono` | text | ≤ 40 |
| `creado_por`, `creado_at`, `actualizado_por`, `actualizado_at` | | RF-029. Los fija un trigger a partir de la sesión (`auth.uid()`, `now()`); no son escribibles |
| `row_version` | integer NOT NULL DEFAULT 1 | trigger la incrementa en cada cambio de la fila **y de sus líneas, tramos e hitos** (R-17): representa la versión de todo el borrador |

- El prospecto es una **instantánea en la propia fila** (RF-043): no hay `FK` a clientes, no hay módulo de clientes (RF-045). Mínimo para emitir: `prospecto_nombre` y al menos uno de `prospecto_email`/`prospecto_telefono` (RF-042); se exige al **emitir** (RPC), no al guardar el borrador.
- No se loguean ni se copian a `cotizacion_eventos` (RF-004).
- **Alta directa** (DA-06): el administrador solo puede insertar las columnas `prospecto_*` (y, desde F3, las de contenido). Toda cotización nace con `estado = 'borrador'`, `row_version = 1` y la auditoría de la sesión, que un trigger `BEFORE INSERT` impone aunque el valor recibido sea otro. Un alta directa no puede traer estado, número, familia, origen de revisión o de duplicado, totales ni marcas de cierre o archivo: no existe el privilegio de columna y la política exige `estado = 'borrador'`.
- En F1 la tabla solo tiene estas columnas. Las pruebas de F1 no usan número, fechas de emisión, líneas ni aceptaciones, que llegan en F3, F4 y F5a.

**F3 — contenido, anticipo y totales**

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `titulo` | text | ≤ 200 |
| `condiciones_generales` | text | ≤ 4 000 |
| `anticipo_modo` | text | `NULL`, `'monto'` o `'porcentaje'`; sin valor por defecto (RF-017) |
| `anticipo_porcentaje` | numeric(5,2) | solo si `modo='porcentaje'`; 0–100 |
| `anticipo_monto` | numeric(14,2) | si `modo='monto'`, lo escribe el administrador; si `'porcentaje'`, lo calcula el sistema con redondeo mitad hacia arriba (R-02, DA-01) y el valor recibido se ignora. Límite de cotización. `CHECK` coherencia con el modo |
| `condiciones_pago_unico` | text | ≤ 4 000; obligatorio al emitir si no hay hitos y el saldo > 0, **haya o no anticipo definido** (RF-110, DA-12) |
| `total_unico` | numeric(14,2) | **calculado** por el trigger de recálculo; el administrador no puede escribirlo (sin `GRANT` de columna). `<= 999999999.99` |
| `saldo_pago_unico` | numeric(14,2) | calculado: `total_unico − anticipo` |
| `recurrente_mensual_inicial` | numeric(14,2) | calculado: suma de `cantidad × tarifa` del primer período de los servicios mensuales (solo para listado). `<= 999999999.99` |
| `recurrente_anual` | numeric(14,2) | calculado: suma de `cantidad × precio_unitario` de los servicios anuales. `<= 999999999.99` |

- `CHECK (anticipo_monto IS NULL OR anticipo_monto <= total_unico)` se comprueba en el trigger de recálculo y de nuevo en `cotizacion_emitir`.
- Los totales calculados son **copias derivadas**; la fuente son las líneas. Se recalculan en cada cambio del borrador; al emitir se recalculan y quedan congelados (la fila ya no admite cambios). El navegador nunca los envía (DA-05).
- **Límite del total** (DA-07): si un cambio dejara un total por encima de su límite, el recálculo lo rechaza con `COT:TOPE_EXCEDIDO` y el cambio no se guarda; así nunca se calcula un anticipo en porcentaje sobre un total fuera de límite.

**F4 — emisión, numeración, vigencia, versiones, cierre y archivo**

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `numero` | text UNIQUE | `NULL` mientras sea borrador; `COT-AAAA-NNNN` o `…-Rn`. `CHECK (estado <> 'borrador' OR numero IS NULL)` |
| `familia_id` | uuid FK → `cotizacion_familias` | `NULL` en borradores originales y duplicados; asignada al emitir o al crear una revisión |
| `revision` | integer | `0` original; `n ≥ 1` revisión; asignada al emitir |
| `emitida_at` | timestamptz | instante de emisión |
| `emitida_por` | uuid FK → `auth.users` | |
| `fecha_emision` | date | día de calendario de Honduras en `emitida_at` (RF-062) |
| `valida_hasta` | date | `fecha_emision + 14` (`CHECK` exacto, RF-062) |
| `revision_de_id` | uuid FK → `cotizaciones` | versión de la que parte una revisión |
| `duplicado_de_id` | uuid FK → `cotizaciones` | origen de un duplicado (RF-088) |
| `sustituida_at`, `sustituida_por_id` | timestamptz, uuid FK | atributo, no estado (RF-086). Se escribe al emitir la revisión que la sustituye |
| `cerrada_at`, `cerrada_por`, `cerrada_motivo` | | para `rechazada`/`cancelada` (RF-069, RF-070); motivo 10–1 000 caracteres |
| `archivada_at`, `archivada_por` | | atributo de organización (RF-071) |
| `requiere_confirmar_anticipo` | boolean NOT NULL DEFAULT false | `true` cuando un duplicado o una revisión recalculó o conservó el anticipo con un total único distinto del origen; `cotizacion_emitir` lo rechaza hasta que el administrador lo confirme con `cotizacion_confirmar_anticipo` (RF-093) |

- `UNIQUE (familia_id, revision)` y el índice único parcial `(familia_id) WHERE estado = 'borrador'` (una revisión en borrador por familia, RF-097).
- `CHECK` de forma: si `estado <> 'borrador'` entonces `numero`, `familia_id`, `revision`, `emitida_at`, `fecha_emision` y `valida_hasta` no son nulos. Esta restricción **nace en F4**: las pruebas de F1 que mueven una fila de ejemplo por los estados para ejercitar el trigger se actualizan a propósito en F4 para darle número y fechas, sin relajar ninguna aserción.
- Ninguna de estas columnas es escribible por el navegador (DA-06): las fijan `cotizacion_emitir`, `cotizacion_crear_revision`, `cotizacion_duplicar`, `cotizacion_rechazar`, `cotizacion_cancelar` y `cotizacion_archivar`.
- **No hay columna `vencida`.**

**F5a — aceptación y cliente formal**

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `cliente_perfil_id` | uuid FK → `profiles(id)` ON DELETE SET NULL | asociación posterior a un registro formal (RF-044); solo punto de referencia, **no** reescribe la instantánea. **Puerta de F5a (DA-09)**: la columna y la acción de asociar no se implementan hasta que el propietario la apruebe |

### 2.6 `cotizacion_lineas` — F3 *(RF-006 a RF-009, RF-015, RF-049, RF-073 a RF-079, RF-089, RF-090, RF-107, RF-108, RF-115 a RF-121)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | |
| `cotizacion_id` | uuid FK ON DELETE RESTRICT | |
| `orden` | integer NOT NULL | posición |
| `origen` | text NOT NULL | `IN ('catalogo','manual')` |
| `tipo_linea` | text NOT NULL | `IN ('paquete','modulo','manual')` |
| `catalogo_item_id` | uuid FK → `catalogo_items`, ON DELETE RESTRICT | obligatorio si `origen='catalogo'`, nulo si `'manual'` (`CHECK`) |
| `descripcion` | text NOT NULL | ≤ 500, no vacía (Historia 1, esc. 3) |
| `cantidad` | integer NOT NULL DEFAULT 1 | `CHECK (cantidad BETWEEN 1 AND 9999)` (RF-115, DA-07). Se aplica a cargos únicos y recurrentes |
| `precio_unitario` | numeric(14,2) | ≥ 0 y `<= 99999999.99`; nulo solo en un servicio **mensual con tramos** (el precio por unidad vive en los tramos) |
| `importe` | numeric(14,2) | **calculado por la base**: `cantidad × precio_unitario`, exacto (RF-115, RF-118). Sin privilegio de escritura. `CHECK (importe <= 99999999.99)`: el producto se valida aparte del precio. Nulo en un servicio con tramos |
| `es_cortesia` | boolean NOT NULL DEFAULT false | un precio unitario `0` en línea manual solo con `es_cortesia = true` (spec, caso límite) |
| `cargo` | text NOT NULL | `IN ('unico','recurrente')` |
| `periodicidad` | text | `IN ('mensual','anual')` si `cargo='recurrente'`; nulo si `'unico'` (`CHECK`) |
| `incluida` | boolean NOT NULL DEFAULT true | RF-007: módulo opcional incluido o excluido |
| `incluida_en_linea_id` | uuid FK → `cotizacion_lineas(id)` | módulo ya contenido en un paquete de la misma cotización: **no suma**, sea cual sea su cantidad (RF-107, RF-119). **Lo asigna la base** al recalcular, a partir de la composición del catálogo; sin privilegio de escritura |
| `unidades_adicionales` | boolean NOT NULL DEFAULT false | línea facturable **explícita** de unidades adicionales de un módulo que un paquete presente ya incluye (RF-119). La marca el administrador; con ella la línea cuenta y no se trata como incluida. El sistema nunca la crea |
| `precio_catalogo_ref` | numeric(14,2) | **precio unitario** del catálogo cuando se añadió/confirmó; base de la deriva (RF-108). Sin privilegio de escritura: lo fijan el alta de la línea (trigger) y `cotizacion_resolver_precio` |
| `precio_unitario_origen` | numeric(14,2) | **precio unitario** en la cotización de origen (duplicados), para la comparación por unidad (RF-090, RF-118). Sin privilegio de escritura |
| `revisada` | boolean NOT NULL DEFAULT true | en duplicados las líneas **manuales** nacen en `false`; `cotizacion_emitir` las exige en `true` (RF-090). El administrador solo puede pasarla a `true` |
| `fecha_inicio` | date | servicio recurrente (RF-075) |
| `condiciones_renovacion` | text | ≤ 2 000 (RF-075) |
| `condiciones_pago_anual` | text | ≤ 2 000; obligatoria si `periodicidad='anual'` (RF-074) |
| `primer_periodo_importe` | numeric(14,2) | ≥ 0 y `<= 99999999.99`; explícito (RF-078). Se aplica **una vez a toda la línea**: no se multiplica por la cantidad (RF-117) |
| `primer_periodo_descripcion` | text | obligatoria si hay `primer_periodo_importe` |

- **Cantidad por precio unitario** (DA-08, aprobada): el importe de la línea es un producto exacto de un entero por un importe con dos decimales, así que no añade ningún redondeo. Cantidades fraccionarias: fuera de la primera versión (RF-120); la columna es `integer` y no las admite.
- **Máximo de 100 líneas por cotización** (DA-07): un trigger rechaza la línea 101.
- **Sin columnas de impuesto ni de descuento** (RF-022, RF-113). Una prueba pgTAP verifica que ninguna tabla del módulo tiene columnas cuyo nombre contenga `impuesto`, `isv`, `tax`, `iva` o `descuento`.
- Las columnas obligatorias *para emitir* (p. ej. `fecha_inicio`) pueden ser nulas en un borrador; la lista de lo que falta la devuelve `cotizacion_validar` (ver `contracts/rpc-cotizaciones.md`).

### 2.7 `cotizacion_tramos` — F3 *(RF-076)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | |
| `linea_id` | uuid FK → `cotizacion_lineas` | solo líneas `recurrente` + `mensual` (trigger) |
| `mes_desde` | integer NOT NULL | ≥ 1 |
| `mes_hasta` | integer | `NULL` = «en adelante»; si no, `≥ mes_desde` |
| `tarifa` | numeric(14,2) NOT NULL | **precio por unidad y por período**, ≥ 0 y `<= 99999999.99`; la escribe el administrador (RF-116) |
| `UNIQUE (linea_id, mes_desde)` | | |

La contigüidad (empiezan en 1, sin huecos ni solapes, solo el último abierto) la valida `cotizacion_validar` y el trigger de recálculo; un tramo mal formado **impide emitir**, no guardar.

El importe de cada período es `cantidad × tarifa`, con la cantidad de la línea, igual en todos los tramos (RF-116); no se guarda y debe quedar dentro del límite de línea (un trigger rechaza el cambio que lo supere). Máximo de 12 tramos por servicio (DA-07): un trigger rechaza el tramo 13.

### 2.8 `cotizacion_hitos` — F3 *(RF-018, RF-019, RF-111)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | |
| `cotizacion_id` | uuid FK | |
| `orden` | integer NOT NULL | |
| `descripcion` | text NOT NULL | ≤ 500 |
| `importe` | numeric(14,2) NOT NULL | **> 0** y `<= 999999999.99` (límite de cotización: un hito puede cubrir casi todo el total) |

**Contiene solo los hitos de desarrollo adicionales.** El anticipo positivo es el primer hito *derivado* y no tiene fila aquí (así no puede contarse dos veces). Si existen filas: `anticipo (o 0) + Σ importe = total_unico` exacto.

### 2.9 `cotizacion_eventos` — F1 (tabla) / F3–F5 (tipos de evento) *(RF-029, RF-066, RF-069, RF-070, RF-105)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | bigint identity PK | |
| `cotizacion_id` | uuid FK ON DELETE RESTRICT | |
| `tipo` | text NOT NULL | conjunto cerrado que **crece con cada fase** (la migración de cada fase amplía el `CHECK`): F1 `'creada'`; F3 `'precio_resuelto'`; F4 `'emitida','revision_creada','duplicada','sustituida','rechazada','cancelada','archivada','desarchivada'`; F5a `'aceptada','aceptacion_revertida','cancelacion_correctiva'`; F5b `'proyecto_vinculado','proyecto_creado'`. Ninguna fase declara ni prueba tipos de una fase posterior |
| `actor` | uuid NOT NULL | quién |
| `ocurrido_at` | timestamptz NOT NULL DEFAULT now() | cuándo |
| `motivo` | text | por qué; obligatorio en `rechazada`, `cancelada`, `cancelacion_correctiva`, `aceptacion_revertida` (10–1 000) |
| `detalle` | jsonb NOT NULL DEFAULT '{}' | identificadores, estados anterior/nuevo, importes de control. **Sin correo, teléfono ni nombre del prospecto** |

Solo se **inserta** desde las funciones del módulo (RPC y triggers `SECURITY DEFINER`); `authenticated` no tiene `INSERT`. Un trigger rechaza `UPDATE` y `DELETE` para cualquier rol (inmutable, RF-066). En F1 el único evento es `creada`, que escribe un trigger al insertar la cotización.

### 2.10 `cotizacion_aceptaciones` — F5a *(RF-041, RF-051, RF-052, RF-053)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | |
| `cotizacion_id` | uuid FK ON DELETE RESTRICT | |
| `fecha_aceptacion` | date NOT NULL | |
| `aceptada_por_cliente` | text NOT NULL | ≤ 200; quién aceptó por el cliente |
| `referencia_propuesta_firmada` | text NOT NULL | ≤ 500; **referencia**, no archivo. **Puerta de F5a (DA-02)**: la opción «referencia segura» es la recomendada y no está aprobada todavía |
| `enlace_propuesta_firmada` | text | https validado; opcional (misma puerta) |
| `registrada_por`, `registrada_at` | | RF-052 |

Inmutable (trigger). **Sin campos de firma electrónica** (RF-053). Legible solo por el administrador (RF-051). Pueden existir varias filas por cotización (aceptar → revertir → aceptar de nuevo si no venció); la **vigente** es la que no tiene fila en `cotizacion_reversiones`.

**Historial de aceptación** = existe alguna fila de esta tabla para la cotización, aunque esté revertida. Como la tabla nace en F5a, **toda regla que dependa del historial se implementa y se prueba en F5a**: la migración de F5a sustituye `cotizacion_cancelar` (RF-104) y `cotizacion_crear_revision` (RF-083, DA-10) para añadir la comprobación. Antes de F5a no puede existir ninguna aceptación, así que no hay ventana en la que la regla falte.

### 2.11 `cotizacion_reversiones` — F5a *(RF-066, RF-067)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | |
| `aceptacion_id` | uuid UNIQUE FK → `cotizacion_aceptaciones` | una reversión por aceptación |
| `revertida_por`, `revertida_at` | | quién y cuándo |
| `motivo` | text NOT NULL | 10–1 000 |

Inmutable. La aceptación original y su evidencia **no se tocan**.

### 2.12 `cotizacion_proyecto_vinculos` — F5b *(RF-054, RF-055, RF-112; BLOQUEADA hasta DA-03 y DA-04)*

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | uuid PK | |
| `cotizacion_id` | uuid FK → `cotizaciones` ON DELETE RESTRICT | solo cotizaciones `aceptada_firmada` (`cotizacion_vincular_proyecto` o `cotizacion_crear_proyecto`, más trigger) |
| `proyecto_id` | uuid FK → `proyectos_clientes` | `ON DELETE RESTRICT` **propuesto**: impide borrar un proyecto vinculado. Cambia el comportamiento de borrado de proyectos → parte de DA-03 |
| `origen` | text NOT NULL | `IN ('creado','enlazado')` |
| `vinculado_por`, `vinculado_at` | | |
| Unicidad | **a decidir (DA-03)** | (A) `UNIQUE (cotizacion_id)`; (B) además `UNIQUE (proyecto_id)`; (C) solo `UNIQUE (cotizacion_id, proyecto_id)` |

No se modifica `proyectos_clientes`. Ver R-14 de `research.md`.

**«Proyecto vinculado»** = existe una fila de esta tabla. Como nace en F5b, la comprobación `COT:PROYECTO_VINCULADO` de `cotizacion_revertir_aceptacion` y `cotizacion_cancelar_correctiva` la añade la migración de F5b (y la prueba S12 es de F5b). En F5a esas funciones no consultan esta tabla porque todavía no existe y ningún proyecto puede estar vinculado.

## 3. Funciones de apoyo (SQL)

| Función | Para qué | Fase |
| --- | --- | --- |
| `cotizacion_fecha_honduras(ts timestamptz) → date` | día de calendario de Honduras de un instante | F4 |
| `cotizacion_valida_hasta(fecha_emision date) → date` | `+14` días | F4 |
| `cotizacion_esta_vencida(valida_hasta date, ahora timestamptz) → boolean` | derivada, pura | F4 |
| `cotizacion_formatear_numero(anio int, n bigint) → text` | `COT-AAAA-NNNN` sin truncar sobre 9 999 | F4 |
| `cotizacion_redondear_anticipo(total numeric, porcentaje numeric) → numeric` | R-02, mitad hacia arriba (DA-01) | F3 |
| `cotizacion_recalcular(id uuid)` | importes de línea, inclusión de módulos, totales derivados y límite del total; la llama un trigger tras cambios en líneas, tramos, hitos o anticipo del borrador | F3 |
| `cotizacion_validar(id uuid) → jsonb` | lista de bloqueos para emitir (es una de las 14 RPC) | F3 (se amplía en F4) |

Todas con `SET search_path = public, pg_temp`, nombres de objeto cualificados y `STABLE`/`IMMUTABLE` donde corresponda.

**Nombres canónicos**: toda función del módulo se llama `cotizacion_<acción>`. La lista única de las 14 RPC, con su fase, está en `contracts/rpc-cotizaciones.md` §0; `research.md`, este modelo y los demás contratos usan esos nombres. Las funciones de apoyo de esta tabla (salvo `cotizacion_validar`) y las de trigger **no son RPC**: no conceden `EXECUTE` a `anon` ni a `authenticated`.

## 4. Seguridad de acceso por tabla (resumen)

El detalle completo, con las pruebas pgTAP exigidas, está en `contracts/acceso-y-rls.md`.

| Tabla | `anon` | cliente (2) | colaborador (1) | admin (0) |
| --- | --- | --- | --- | --- |
| `catalogo_items`, `catalogo_paquete_modulos` | sin privilegios | 0 filas / sin escritura | 0 filas / sin escritura | lee; inserta y actualiza solo columnas de contenido |
| `cotizaciones` | sin privilegios | 0 filas | 0 filas | lee todo; inserta y actualiza **solo columnas de contenido** y **solo en borrador**; el resto, por RPC |
| `cotizacion_lineas`, `_tramos`, `_hitos` | sin privilegios | 0 filas | 0 filas | lee; inserta, actualiza y borra solo si la cotización es borrador, y nunca las columnas calculadas |
| `cotizacion_eventos`, `_aceptaciones`, `_reversiones`, `_proyecto_vinculos`, `_familias` | sin privilegios | 0 filas | 0 filas | solo lee; escribe solo vía RPC |
| `cotizacion_secuencias` | sin privilegios | sin privilegios | sin privilegios | sin privilegios (solo funciones) |

## 5. Integridad, rendimiento y conservación

- **Índices**: `cotizaciones(estado, creado_at DESC)`, `cotizaciones(familia_id)`, `cotizaciones(valida_hasta) WHERE estado='emitida'` (filtro de vencidas), `cotizacion_lineas(cotizacion_id, orden)`, `cotizacion_eventos(cotizacion_id, ocurrido_at)`. Búsqueda del listado por número y nombre con `ILIKE` paginado en servidor (`range`); el volumen esperado no requiere trigramas.
- **Conservación** (RF-106, DP-12): no hay plazos, no hay `DELETE`, no hay purga. Cualquier plazo legal se somete aparte.
- **Datos personales**: viven solo en `cotizaciones.prospecto_*` y en `cotizacion_aceptaciones.aceptada_por_cliente`, protegidos por RLS de administrador. No hay copias en eventos, registros de aplicación ni mensajes de error.
- **Regeneración de tipos**: tras cada migración, `src/integrations/supabase/types.ts` se regenera contra Supabase local (R-21).
