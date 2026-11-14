# Contrato: ciclo de vida de la cotización

**Spec**: RF-025, RF-062 a RF-072, RF-083 a RF-086, RF-096 a RF-100, RF-104 a RF-106, AF-1 a AF-4 · **Modelo**: `specs/002-admin-quotations/data-model.md`

Los nombres de función son los de la lista canónica de `contracts/rpc-cotizaciones.md` §0.

Una cotización tiene **un estado** (conjunto cerrado) y tres **atributos** que no son estados:

| Atributo | Cómo se obtiene | Guardado |
| --- | --- | --- |
| Vencida | `estado = 'emitida'` y hoy (Honduras) > `valida_hasta` | **No** (derivado) |
| Sustituida | `sustituida_at IS NOT NULL` | Sí (atributo de la versión) |
| Archivada | `archivada_at IS NOT NULL` | Sí (atributo de organización) |

Y dos hechos que condicionan acciones: **historial de aceptación** (existe alguna fila en `cotizacion_aceptaciones`, aunque se haya revertido) y **proyecto vinculado** (existe fila en `cotizacion_proyecto_vinculos`).

**Cuándo existe cada hecho.** El historial de aceptación solo puede existir desde F5a, y el proyecto vinculado, desde F5b. Las reglas que dependen de ellos se implementan y se prueban en esa fase, cuando su tabla existe; antes no hay nada que comprobar (`contracts/rpc-cotizaciones.md` §0).

## 1. Transiciones válidas (únicas)

| De → A | Acción (RPC) | Condiciones | Motivo | Evento | Fase |
| --- | --- | --- | --- | --- | --- |
| Borrador → Emitida | `cotizacion_emitir` | `cotizacion_validar` sin bloqueos; versión de `row_version` coincide; importes y totales dentro de sus límites; si es revisión, el origen sigue elegible (RF-096) | — | `emitida` (+ `sustituida` del origen si es revisión) | F4 |
| Borrador → Cancelada | `cotizacion_cancelar` | — (la fila queda sin número ni fechas de emisión) | **obligatorio** | `cancelada` | F4 |
| Emitida → Rechazada | `cotizacion_rechazar` | no sustituida | **obligatorio** | `rechazada` | F4 |
| Emitida → Cancelada | `cotizacion_cancelar` | no sustituida; **sin** historial de aceptación (RF-104; la comprobación del historial entra en F5a) | **obligatorio** | `cancelada` | F4 (regla del historial: F5a) |
| Emitida → Aceptada y firmada | `cotizacion_registrar_aceptacion` | **no vencida**, no sustituida, referencia a la propuesta firmada presente (RF-065) | — | `aceptada` | F5a |
| Aceptada y firmada → Emitida | `cotizacion_revertir_aceptacion` | **sin proyecto vinculado** (RF-068; la comprobación del vínculo entra en F5b) | **obligatorio** | `aceptacion_revertida` | F5a (regla del vínculo: F5b) |

Todo lo demás está **prohibido** y lo rechaza el trigger de `cotizaciones` aunque la llamada venga de un rol con privilegios: Rechazada y Cancelada no tienen salida; ninguna transición sale de un estado terminal; no se vuelve a Borrador.

## 2. Acciones que no cambian el estado

| Acción | Condiciones | Efecto |
| --- | --- | --- |
| `cotizacion_crear_revision` | Emitida, **no vencida**, **no sustituida**, es la versión emitida más reciente de su familia, no hay otra revisión en borrador de la familia (RF-083, RF-097) y, desde F5a, **sin historial de aceptación** (DA-10 pendiente) | Crea un borrador `revision_de_id = origen`. El origen no cambia |
| `cotizacion_duplicar` | Cualquier estado | Crea un borrador con `duplicado_de_id`; sin número ni familia; conserva las cantidades, reprecia el catálogo por precio unitario y marca para revisar las manuales (RF-088 a RF-091, RF-118) |
| `cotizacion_archivar` (archivar o desarchivar) | Cualquier estado | Cambia `archivada_at`; **no** toca estado, datos ni historial (RF-071) |
| `cotizacion_resolver_precio` | Borrador, línea de catálogo con deriva | «actualizar» (precio unitario = precio vigente) o «conservar» (se confirma el precio unitario actual); registra evento (RF-108) |
| `cotizacion_confirmar_anticipo` | Borrador con `requiere_confirmar_anticipo` | Limpia la marca (RF-093) |
| `cotizacion_cancelar_correctiva` | Historial de aceptación, **sin proyecto vinculado**; justificación 10–1 000; confirmación escribiendo el número de la cotización | Estado → Cancelada, evento `cancelacion_correctiva` (RF-105). Es un requisito aprobado: no se sustituye por el rechazo ordinario. El procedimiento concreto es una puerta de F5a (DA-11) |

## 3. Matriz de acciones por situación (lo que la interfaz ofrece)

«—» = no se ofrece **y** la base de datos lo rechaza.

| Situación | Editar | Emitir | Revisar | Duplicar | Rechazar | Cancelar | Aceptar | Revertir | Cancelación correctiva | Archivar | Vincular proyecto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Borrador | ✔ | ✔ | — | ✔ | — | ✔ | — | — | — | ✔ | — |
| Emitida, vigente | — | — | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | — |
| Emitida, **vencida** | — | — | — | ✔ | ✔ | ✔ | — | — | — | ✔ | — |
| Emitida, **sustituida** | — | — | — | ✔ | — | — | — | — | — | ✔ | — |
| Emitida tras reversión (con historial) | — | — | — (DA-10 pendiente) | ✔ | ✔ | — (RF-104) | ✔ si vigente | — | ✔ (sin proyecto) | ✔ | — |
| Aceptada y firmada | — | — | — | ✔ | — | — (RF-069) | — | ✔ si **no** hay proyecto | ✔ si **no** hay proyecto | ✔ | ✔ (F5b) |
| Aceptada y firmada con proyecto vinculado | — | — | — | ✔ | — | — | — | — (RF-068, no en v1) | — (no en v1) | ✔ | — |
| Rechazada / Cancelada | — | — | — | ✔ | — | — | — | — | — | ✔ | — |

Notas:
- **Cotizaciones con historial de aceptación** (regla única, conciliada con `contracts/rpc-cotizaciones.md` §5): no se cancelan por el flujo ordinario (RF-104); no se revisan mientras DA-10 siga pendiente —la revisión tras una aceptación revertida **no se habilita sin la aprobación expresa del propietario**— y se pueden duplicar; se pueden rechazar y, si siguen vigentes, aceptar de nuevo; y su cancelación solo cabe por el procedimiento correctivo separado (RF-105), que no equivale al rechazo.
- «Rechazar» y «Cancelar» desde una Emitida **vencida** siguen permitidos: la vigencia terminada no impide cerrar el expediente (RF-070 solo exige estar «Emitida»). *Lectura literal de la spec; el propietario puede cambiarla.*
- Una cotización **sustituida** solo se consulta, se duplica o se archiva (RF-086).
- Ninguna acción «reactiva» ni «extiende la vigencia» (RF-064, RF-109).
- Ninguna acción inicia trabajo sobre una cotización que no sea Aceptada y firmada (RF-026): el módulo no tiene esa acción en ningún estado.

## 4. Indicadores que muestran la lista, el detalle y la vista previa (misma regla, mismo texto)

| Situación | Estado mostrado | Indicadores |
| --- | --- | --- |
| Emitida vigente | Emitida | «Válida hasta DD/MM/AAAA» |
| Emitida vencida | Emitida | «Vencida» (con la misma fecha) |
| Versión sustituida | Emitida | «Sustituida por …-R1» |
| Archivada | su estado | «Archivada» |

La fecha «Válida hasta» sale de **una sola función** (`cotizacion_valida_hasta`); lista, detalle y vista previa no la recalculan por separado (CE-004).

## 5. Inmutabilidad: qué puede cambiar después de salir de borrador

*(RF-027, RF-043, RF-046, RF-085, RF-086; R-05 de `research.md`)*

El trigger `BEFORE UPDATE` de `cotizaciones` trabaja con **lista blanca y falla cerrado**: si el estado anterior no es `borrador`, toda columna queda congelada salvo las de la tabla siguiente, y una columna nueva que nadie clasifique queda congelada. Vale para cualquier rol, también para las funciones `SECURITY DEFINER` y para `postgres`. Un cambio de algo congelado se rechaza con `COT:INMUTABLE`; una transición fuera de §1, con `COT:ESTADO_INVALIDO`.

| Columna | Cambio permitido con estado anterior distinto de `borrador` | Única vía | Desde |
| --- | --- | --- | --- |
| `estado` | solo las transiciones de §1 | la RPC de cada transición | F1 (matriz); F4 y F5a (RPC) |
| `row_version`, `actualizado_por`, `actualizado_at` | las fija el propio trigger en cada `UPDATE` | el trigger | F1 |
| `sustituida_at`, `sustituida_por_id` | una sola vez, juntas, de nulo a valor, con estado `emitida` y sin cambio de estado | `cotizacion_emitir`, al emitir la revisión que la sustituye | F4 |
| `cerrada_at`, `cerrada_por`, `cerrada_motivo` | una sola vez, juntas, de nulo a valor, en la misma sentencia que pasa a `rechazada` o `cancelada` | `cotizacion_rechazar`, `cotizacion_cancelar` y, desde F5a, `cotizacion_cancelar_correctiva` | F4 |
| `archivada_at`, `archivada_por` | se fijan o se limpian juntas, en cualquier estado | `cotizacion_archivar` | F4 |
| `cliente_perfil_id` | solo si el propietario aprueba DA-09, y según la decisión que registre | la acción de asociar | F5a (puerta) |

**Congelado siempre fuera de borrador**: la instantánea del cliente (`prospecto_*`), el título y las condiciones, el anticipo, los totales, el número, la familia, la revisión, las fechas de emisión y de vigencia, quién emitió y `requiere_confirmar_anticipo`. **No cambian en ningún estado**: `id`, `referencia_interna`, `creado_por`, `creado_at` y, una vez asignados, `revision_de_id` y `duplicado_de_id`.

**Datos de emisión** (F4): `numero`, `revision`, `emitida_at`, `emitida_por`, `fecha_emision` y `valida_hasta` solo pasan de nulo a valor en la sentencia que lleva la fila de `borrador` a `emitida`, y lo hacen todos juntos. Un borrador que se cancela los deja nulos y, como `cancelada` no tiene salida, ya no puede recibirlos; una fila emitida, aceptada o rechazada no puede carecer de ellos, y ninguna sentencia los devuelve a nulo. La restricción de forma de `data-model.md` §2.5 y este trigger se refuerzan: la primera impide una fila emitida a medias y el segundo, que se cambie después.

**Líneas, tramos e hitos** (F3): con la cotización fuera de borrador rechazan `INSERT`, `UPDATE` y `DELETE`. Su trigger bloquea la fila de la cotización antes de comprobarlo, de modo que un cambio de contenido y una emisión simultáneos se ordenan uno detrás del otro y el que llega tarde falla.

**Por fases.** F1 crea la función con la lista blanca mínima (las dos primeras filas). Cada fase que añade columnas a `cotizaciones` clasifica cada una en su migración; si amplía la lista blanca, reemite la función con `CREATE OR REPLACE FUNCTION` (nunca edita una migración anterior) y lo prueba (S22 de `contracts/acceso-y-rls.md`). F3 no amplía la lista: sus columnas son contenido. F4 añade las filas de sustitución, cierre y archivo.

**Las operaciones aprobadas siguen siendo posibles sin debilitar la regla.** Emitir, sustituir, rechazar, cancelar, archivar, aceptar y revertir solo tocan columnas de la lista blanca, y solo pueden hacerlo sus RPC, porque esas columnas no tienen privilegio de escritura para el navegador. Ninguna vía usa una variable de sesión, un parámetro del cliente, una exención por rol ni un trigger desactivado.

**Cancelación correctiva desde «Aceptada y firmada»** (RF-072, RF-105). La matriz de F1 no incluye `aceptada_firmada → cancelada`. La migración de F5a reemite la función para admitirla **solo** en la sentencia que fija `cerrada_*` y **solo** si la cotización tiene historial de aceptación; Rechazada y Cancelada siguen sin salida. Es mecánica del trigger: el procedimiento concreto sigue siendo la puerta DA-11.
