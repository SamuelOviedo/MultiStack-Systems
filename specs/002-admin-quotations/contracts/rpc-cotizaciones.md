# Contrato: funciones RPC de cotizaciones

**Spec**: RF-004, RF-041, RF-062 a RF-072, RF-080 a RF-100, RF-104 a RF-112, RF-115 a RF-121 · **Ciclo de vida**: `contracts/ciclo-de-vida.md` · **Modelo**: `data-model.md`

Interfaz entre `src/lib/cotizaciones.ts` (la única capa del frontend que llama a Supabase para este módulo) y Postgres. **No es una API pública**: solo la invoca el administrador autenticado. No se crea ninguna Edge Function (R-18).

## 0. Lista canónica de funciones

Estos son los **únicos** nombres válidos. `research.md`, `data-model.md` y los demás contratos usan exactamente estos. Son 14 RPC.

| # | RPC | Fase en que se crea | Cambios posteriores |
| --- | --- | --- | --- |
| 1 | `cotizacion_validar` | F3 | F4 la amplía con los bloqueos de emisión |
| 2 | `cotizacion_resolver_precio` | F3 | — |
| 3 | `cotizacion_emitir` | F4 | — |
| 4 | `cotizacion_crear_revision` | F4 | **F5a** la sustituye para rechazar cotizaciones con historial de aceptación (DA-10 pendiente) |
| 5 | `cotizacion_duplicar` | F4 | — |
| 6 | `cotizacion_rechazar` | F4 | — |
| 7 | `cotizacion_cancelar` | F4 | **F5a** la sustituye para rechazar cotizaciones con historial de aceptación (RF-104) |
| 8 | `cotizacion_archivar` | F4 | — |
| 9 | `cotizacion_confirmar_anticipo` | F4 | — |
| 10 | `cotizacion_registrar_aceptacion` | F5a | — |
| 11 | `cotizacion_revertir_aceptacion` | F5a | **F5b** la sustituye para rechazar cotizaciones con proyecto vinculado (RF-068) |
| 12 | `cotizacion_cancelar_correctiva` | F5a | **F5b**, igual que la anterior |
| 13 | `cotizacion_vincular_proyecto` | F5b (bloqueada) | — |
| 14 | `cotizacion_crear_proyecto` | F5b (bloqueada) | — |

Funciones de apoyo (no son RPC y no conceden `EXECUTE` a la API): `cotizacion_fecha_honduras`, `cotizacion_valida_hasta`, `cotizacion_esta_vencida`, `cotizacion_formatear_numero`, `cotizacion_redondear_anticipo`, `cotizacion_recalcular` y las funciones de trigger.

**Por qué algunas se sustituyen en una fase posterior**: una función no puede consultar una tabla que su fase todavía no crea. El historial de aceptación (`cotizacion_aceptaciones`) nace en F5a y el vínculo con proyecto (`cotizacion_proyecto_vinculos`) en F5b. Antes de esas fases no puede existir ninguna aceptación ni ningún proyecto vinculado, así que no hay ventana en la que la regla falte. Cada sustitución va dentro de la migración de su fase, con `CREATE OR REPLACE` y su prueba (S11, S21 y S12 de `contracts/acceso-y-rls.md`): no añade migraciones a las seis previstas ni edita una migración existente.

## 1. Convenciones comunes a todas las RPC

| Tema | Regla |
| --- | --- |
| Definición | `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp` (ruta fija, `pg_temp` al final); objetos siempre cualificados con su esquema |
| Permisos | `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated` y después `GRANT EXECUTE … TO authenticated`, solo en las 14 RPC. Las funciones de apoyo y de trigger no conceden `EXECUTE` a la API |
| Rol | Primera sentencia: `IF public.get_user_type() IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'COT:SIN_PERMISO'`. Colaborador y cliente llegan hasta aquí y fallan; `anon` falla antes, con `42501` |
| Volatilidad | Las RPC que escriben son `VOLATILE` (el valor por defecto). `cotizacion_validar` es la única `STABLE`: solo lee, no escribe y no registra eventos |
| Bloqueo | **Solo las RPC que escriben**: `SELECT … FROM cotizaciones WHERE id = p_id FOR UPDATE` antes de comprobar nada; las que tocan una familia bloquean también la fila de la familia. `cotizacion_validar` **no bloquea filas**: Postgres no admite `FOR UPDATE` en una función no volátil. Cuando hace falta validar con la fila bloqueada lo hace `cotizacion_emitir`, que bloquea, recalcula y después, en otra sentencia de la misma transacción, llama a la validación |
| Errores | `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COT:<CODIGO>'`. El mensaje contiene **solo** el código, sin texto añadido: nunca datos del cliente ni importes (RF-004). Las pruebas comprueban el SQLSTATE y el mensaje exactos |
| Traducción | `src/lib/cotizaciones.ts` mapea cada `COT:<CODIGO>` a un texto en español (RF-036). Un código desconocido o cualquier otro error se traduce a «No se pudo completar la operación. Inténtalo de nuevo.» y el detalle técnico no llega a la interfaz |
| Auditoría | Cada RPC de transición inserta su fila en `cotizacion_eventos` **en la misma transacción**; si algo falla, no queda evento ni cambio |
| Registro | Ninguna RPC usa `RAISE NOTICE/LOG` con datos del prospecto ni del contenido |
| Concurrencia | Las que modifican contenido o estado reciben `p_row_version` o bloquean la fila; `COT:CONFLICTO_VERSION` si no coincide. La que cambia el precio de una línea (`cotizacion_resolver_precio`) recibe la versión de esa línea |
| Importes | Ninguna RPC recibe importes de línea ni totales del navegador: los recalcula la base (DA-05). Los importes que una RPC admite como dato (por ejemplo un precio unitario) se validan contra los límites de `calculo-y-validacion.md` §2.2 |
| Retorno | Un objeto JSON con los campos mínimos que la interfaz necesita (identificadores, número, fechas, versión); nunca la cotización completa. Tras una RPC la capa de datos recarga la cotización para mostrar los valores de la base |

Códigos comunes: `COT:SIN_PERMISO`, `COT:NO_ENCONTRADA`, `COT:ESTADO_INVALIDO`, `COT:CONFLICTO_VERSION`, `COT:MOTIVO_REQUERIDO`, `COT:SUSTITUIDA`, `COT:TOPE_EXCEDIDO`, `COT:INMUTABLE`.

Los triggers de protección usan los mismos códigos: `COT:ESTADO_INVALIDO` para una transición fuera de `contracts/ciclo-de-vida.md` §1 y `COT:INMUTABLE` para un cambio de algo congelado (`contracts/ciclo-de-vida.md` §5). Hay dos códigos que solo lanzan los triggers y que el uso normal nunca produce: `COT:ORIGEN_INVALIDO` (copia de línea cuyo origen no corresponde al borrador, F4) y `COT:DETALLE_INVALIDO` (evento cuyo `detalle` o cuyo `motivo` no cumple el esquema estricto de `data-model.md` §2.9). La interfaz los traduce con el mensaje genérico.

## 2. Lectura y validación (F3)

| RPC | Entradas | Salida | Notas |
| --- | --- | --- | --- |
| `cotizacion_validar(p_id uuid)` | id | arreglo JSON de bloqueos (`calculo-y-validacion.md` §5) | `STABLE`, solo lectura: no escribe, no registra eventos y no bloquea filas. La interfaz la usa para el panel «qué falta» y, desde F4, antes de habilitar «Emitir» |

El listado, el detalle y el catálogo se leen con `select` normal bajo RLS (no necesitan RPC). El listado pagina en servidor (`range`).

## 3. Borrador (F3)

| RPC | Entradas | Efecto | Errores específicos |
| --- | --- | --- | --- |
| `cotizacion_resolver_precio(p_linea_id uuid, p_accion text, p_linea_version int)` | `'actualizar'` o `'conservar'`; versión leída de la línea | Comprueba que la línea sigue en la versión que el administrador vio. Resuelve la deriva de una línea de catálogo comparando **precios unitarios**: «actualizar» fija `precio_unitario = precio vigente` (el importe de la línea se recalcula con su cantidad); ambos fijan `precio_catalogo_ref = precio vigente`. Evento `precio_resuelto` (línea y acción, sin importes) | `COT:ACCION_INVALIDA`, `COT:LINEA_NO_CATALOGO`, `COT:ELEMENTO_RETIRADO`, `COT:TOPE_EXCEDIDO`, `COT:CONFLICTO_VERSION` |

La creación y edición de un borrador, sus líneas, tramos e hitos son `insert/update/delete` de tabla bajo RLS y privilegios por columna en `INSERT` y en `UPDATE` (R-04, `contracts/acceso-y-rls.md` §1.1). Un trigger recalcula los importes de línea y los totales (`cotizacion_recalcular`) e incrementa la versión del borrador; la capa de datos recarga la cotización tras cada cambio. El recálculo no se dispara por sus propias escrituras y el incremento de la versión no es fijo (`data-model.md` §3.1). Cada línea, tramo e hito lleva además su propia `row_version`: los `update` y los `delete` van condicionados a la versión leída, y 0 filas afectadas es un conflicto de edición que la capa de datos devuelve con el mismo aviso que `COT:CONFLICTO_VERSION`, sin reintentar ni sobrescribir.

## 4. Emisión, versiones y cierre (F4)

| RPC | Entradas | Efecto | Errores específicos |
| --- | --- | --- | --- |
| `cotizacion_emitir(p_id uuid, p_row_version int)` → `{id, numero, fecha_emision, valida_hasta}` | borrador y versión leída | Valida (`COT:NO_EMITIBLE` si hay bloqueos). **Original**: crea la familia y asigna `COT-AAAA-NNNN` (R-06). **Revisión**: comprueba que el origen sigue elegible (RF-096), asigna `-R{n}`, marca el origen `sustituida_*`. En ambos casos fija `fecha_emision`, `valida_hasta` (R-07) y `emitida_*`; recalcula importes de línea y totales, comprueba los límites y los congela. Evento `emitida` (y `sustituida`) | `COT:NO_EMITIBLE`, `COT:ORIGEN_NO_ELEGIBLE`, `COT:CONFLICTO_VERSION`, `COT:TOPE_EXCEDIDO` |
| `cotizacion_crear_revision(p_origen uuid)` → `{id}` | id de la versión emitida | Crea un borrador copiando líneas, tramos, hitos, anticipo y prospecto. Cada línea **conserva la cantidad, el precio unitario y la referencia de catálogo del original**, sin consultar el precio vigente (RF-084); si el catálogo cambió o el elemento fue retirado, la revisión se crea igual y la validación lo señala (`PRECIO_DERIVADO`, `ELEMENTO_RETIRADO`). Termina con `requiere_confirmar_anticipo = false`; si después cambia el total, la marca la pone el recálculo (`data-model.md` §3.1). Evento `revision_creada` | `COT:NO_REVISABLE` (no emitida / vencida / sustituida / no es la más reciente; **desde F5a**, también con historial de aceptación), `COT:REVISION_EN_CURSO` (RF-097) |
| `cotizacion_duplicar(p_origen uuid)` → `{id}` | cualquier cotización | Borrador nuevo con `duplicado_de_id`; copia el prospecto (RF-099) y la cantidad de cada línea; reprecia las líneas de catálogo al **precio unitario** vigente guardando `precio_unitario_origen`; una línea cuyo elemento fue retirado **conserva el precio del origen** (no se reprecia ni se descarta) y queda señalada con `ELEMENTO_RETIRADO` (RF-098); las manuales conservan su precio unitario y nacen con `revisada = false`; al terminar la copia fija `requiere_confirmar_anticipo` a `true` si hay anticipo definido y el total quedó distinto del origen, y los cambios posteriores del total los marca el recálculo (RF-093). El origen no se modifica (RF-091). Evento `duplicada` | `COT:TOPE_EXCEDIDO` (ver nota) |
| `cotizacion_rechazar(p_id uuid, p_motivo text)` | motivo 10–1 000 | Emitida → Rechazada (terminal). Evento `rechazada` | `COT:MOTIVO_REQUERIDO`, `COT:SUSTITUIDA` |
| `cotizacion_cancelar(p_id uuid, p_motivo text)` | motivo 10–1 000 | Borrador/Emitida → Cancelada. Un borrador cancelado queda sin número ni fechas de emisión y no consume secuencia. Evento `cancelada` | `COT:MOTIVO_REQUERIDO`, `COT:SUSTITUIDA`; **desde F5a**, `COT:HISTORIAL_ACEPTACION` (RF-104) |
| `cotizacion_archivar(p_id uuid, p_archivar boolean)` | | Fija o limpia `archivada_*`. Evento `archivada`/`desarchivada` | — |
| `cotizacion_confirmar_anticipo(p_id uuid)` | id | Limpia `requiere_confirmar_anticipo` (RF-093) | `COT:NADA_QUE_CONFIRMAR` |

Nota sobre `cotizacion_duplicar` y los límites: si un precio unitario vigente del catálogo, con la cantidad copiada, dejara una línea o el total fuera de límite, la función **no** crea un borrador con importes inválidos: falla con `COT:TOPE_EXCEDIDO` y no deja nada. El administrador corrige el catálogo o crea la cotización a mano.

**Copias de líneas: una vía estrecha, sin exenciones.** El alta directa de una línea de catálogo sigue la validación del catálogo (precio vigente, elemento no retirado). Una revisión y un duplicado necesitan otra regla, y la obtienen sin saltarse el trigger: `cotizacion_crear_revision` y `cotizacion_duplicar` insertan cada línea con `linea_origen_id`, una columna que el navegador no puede escribir, y el trigger de alta aplica a esa fila la regla de copia que le corresponde, comprobada contra la línea de origen y contra el origen declarado en el borrador (`contracts/acceso-y-rls.md` §1.1). No existe ninguna variable de sesión, parámetro del cliente ni exención por rol que desactive la validación, y ningún trigger se deshabilita.

En F4 no existe todavía ninguna aceptación. Por eso `cotizacion_cancelar` y `cotizacion_crear_revision` **no** consultan el historial de aceptación en F4, y las pruebas de F4 no lo ejercitan: esa regla y sus pruebas son de F5a.

## 5. Aceptación (F5a)

F5a tiene **puertas de aprobación del propietario** antes de implementarse: DA-02 (forma de la evidencia), DA-09 (asociación con un registro formal de cliente), DA-10 (revisión tras una aceptación revertida) y DA-11 (procedimiento concreto de la cancelación correctiva). Mientras no se aprueben, este contrato describe la opción recomendada, no una decisión.

| RPC | Entradas | Efecto | Errores específicos |
| --- | --- | --- | --- |
| `cotizacion_registrar_aceptacion(p_id uuid, p_fecha date, p_aceptada_por text, p_referencia text, p_enlace text)` | | Inserta `cotizacion_aceptaciones`, pasa a Aceptada y firmada. **No** crea ni enlaza proyecto (RF-054). Evento `aceptada` | `COT:REFERENCIA_REQUERIDA`, `COT:VENCIDA`, `COT:SUSTITUIDA`, `COT:ESTADO_INVALIDO`, `COT:ENLACE_INVALIDO` (no https o rechazado por `safeUrl`) |
| `cotizacion_revertir_aceptacion(p_id uuid, p_motivo text)` | motivo 10–1 000 | Inserta `cotizacion_reversiones`, vuelve a Emitida; la aceptación y su evidencia no se tocan. Si ya venció, queda «Emitida · Vencida». Evento `aceptacion_revertida` | `COT:MOTIVO_REQUERIDO`; **desde F5b**, `COT:PROYECTO_VINCULADO` (RF-068) |
| `cotizacion_cancelar_correctiva(p_id uuid, p_justificacion text, p_confirmacion text)` | justificación 10–1 000; confirmación = número de la cotización escrito por el administrador | Cancela una cotización con historial de aceptación (RF-105). Es un procedimiento separado de `cotizacion_cancelar` y **no** se sustituye por `cotizacion_rechazar`. Evento `cancelacion_correctiva` | `COT:MOTIVO_REQUERIDO`, `COT:CONFIRMACION_INCORRECTA`, `COT:SIN_HISTORIAL_ACEPTACION`; **desde F5b**, `COT:PROYECTO_VINCULADO` |

La migración de F5a también **sustituye** dos funciones de F4:

- `cotizacion_cancelar`: añade `COT:HISTORIAL_ACEPTACION` cuando existe cualquier fila de `cotizacion_aceptaciones` para la cotización, esté o no revertida (RF-104, S11).
- `cotizacion_crear_revision`: añade `COT:NO_REVISABLE` cuando existe historial de aceptación (S21). Es el comportamiento por defecto mientras DA-10 siga pendiente: **la revisión tras una aceptación revertida no se habilita sin la aprobación expresa del propietario**. Si el propietario aprueba DA-10 en sentido afirmativo, esta comprobación se retira antes de implementar F5a.

Y reemite la función del trigger de `cotizaciones` (`contracts/ciclo-de-vida.md` §5): para que `cotizacion_cancelar_correctiva` pueda cancelar una «Aceptada y firmada», el trigger admite `aceptada_firmada → cancelada` solo en la sentencia que fija `cerrada_*` y solo si la cotización tiene historial de aceptación. Es mecánica del trigger; el procedimiento concreto sigue siendo la puerta DA-11.

## 6. Proyecto (F5b — BLOQUEADA hasta DA-03 y DA-04)

| RPC | Entradas | Efecto | Errores específicos |
| --- | --- | --- | --- |
| `cotizacion_vincular_proyecto(p_id uuid, p_proyecto_id uuid)` | | Inserta el vínculo `origen='enlazado'`. No modifica el proyecto. Evento `proyecto_vinculado` | `COT:NO_ACEPTADA`, `COT:PROYECTO_NO_ENCONTRADO`, `COT:VINCULO_DUPLICADO` y el error que corresponda a la cardinalidad aprobada |
| `cotizacion_crear_proyecto(p_id uuid, p_nombre text)` → `{proyecto_id}` | nombre del proyecto | En **una** transacción: crea el proyecto con `nombre_proyecto`, un resumen de alcance como `descripcion` y los datos de contacto de la instantánea; inserta el vínculo `origen='creado'`. Sin importes en el proyecto (DA-04). Evento `proyecto_creado` | los de arriba |

Ninguna de las dos envía correo, crea tokens de portal, cambia roles ni cobra. La migración de F5b sustituye `cotizacion_revertir_aceptacion` y `cotizacion_cancelar_correctiva` para añadir `COT:PROYECTO_VINCULADO` (S12).

## 7. Pruebas obligatorias por RPC (pgTAP)

Para **cada** RPC, en el archivo de la fase que la crea: (1) `anon` → `42501`; (2) cliente → `COT:SIN_PERMISO`; (3) colaborador → `COT:SIN_PERMISO`; (4) administrador, camino feliz con efecto y evento verificados; (5) cada error específico de la tabla que exista en esa fase, comprobado con el SQLSTATE `P0001` y el mensaje exacto `COT:<CODIGO>`; (6) que el evento exista y sea inmutable; (7) que una llamada fallida no deje cambios (atomicidad); (8) que la función tenga `search_path` fijo y que `PUBLIC` y `anon` no tengan `EXECUTE` (S17). Los errores marcados «desde F5a» o «desde F5b» se prueban en esa fase, no antes. Casos adicionales de F4: emisión con el contador del año en 9 999 (→ `COT-AAAA-10000`), cambio de año con fechas fijas, dos revisiones en borrador de la misma familia, origen que deja de ser elegible entre crear y emitir.
