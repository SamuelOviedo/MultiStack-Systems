# Guía de validación (quickstart): Módulo de Cotizaciones

**Plan**: `specs/002-admin-quotations/plan.md` · **Contratos**: `specs/002-admin-quotations/contracts/` · **Modelo**: `specs/002-admin-quotations/data-model.md`

Esta guía dice **cómo comprobar** que cada fase funciona, no cómo implementarla. Todo se hace en local, con datos sintéticos. Los pasos de producción son del **Propietario** y no los ejecuta quien implementa.

## 0. Prerrequisitos

| Necesidad | Para qué |
| --- | --- |
| Node y dependencias ya instaladas (`npm ci` solo si falta `node_modules`) | gate del frontend |
| Docker y Supabase CLI | pgTAP y entorno local (`supabase test db`, `supabase start`) |
| Índice de CodeGraph (`codegraph init`, ignorado por git) | análisis de impacto |
| Usuarios de prueba **locales y sintéticos** (administrador, colaborador, cliente) | comprobar acceso por rol |

Reglas: ningún test usa credenciales, correos ni el proyecto de producción; Playwright solo contra entornos locales; no se commitean `.env*`, volcados ni datos de clientes.

## 1. Gate de cada fase (criterio común de cierre)

```text
npm run lint && npx tsc -p tsconfig.app.json --noEmit && npm test && npm run build
supabase test db          # cuando la fase cambia la base de datos
```

Además, en cada fase: `revisor` sin hallazgos críticos; `security` sin hallazgos críticos si la fase toca datos (todas); `qa` para accesibilidad de las pantallas nuevas (WCAG 2.2 AA, teclado). Se cierra con `/bitacora`.

Antes de tocar símbolos compartidos (`useAuth`, `ProtectedRoute`, `Project`, `adminNav`), `codegraph impact <Símbolo>`.

## 2. Escenarios por fase

Cada escenario enlaza con los criterios de éxito (CE) y los requisitos (RF) de la spec.

### F1 — Cimientos seguros y esqueleto del módulo

| # | Escenario | Resultado esperado | CE / RF |
| --- | --- | --- | --- |
| F1-1 | Iniciar sesión como **administrador** y abrir el menú | «Cotizaciones» aparece en «Gestión comercial»; al abrirla se ve la lista vacía con un estado vacío claro | RF-056 |
| F1-2 | Como administrador, abrir las tres URLs directamente | `/dashboard/cotizaciones` → lista; `/dashboard/cotizaciones/catalogo` → catálogo (no un detalle); `/dashboard/cotizaciones/<uuid inexistente>` y `/dashboard/cotizaciones/xyz` → «Cotización no encontrada» sin texto técnico; la entrada del menú queda marcada como página actual en las tres | RF-057, RF-059, RF-060, CE-014 |
| F1-3 | Repetir F1-2 como **colaborador**, **cliente** y **sin sesión** | Rechazo o redirección igual que el resto de `/dashboard`; el menú del colaborador no muestra la entrada | RF-002, RF-058, CE-003, CE-014 |
| F1-4 | `supabase test db` | Todas las pruebas de `cotizaciones_fundacion` en verde: `anon` sin privilegios; cliente y colaborador con 0 filas; el administrador no puede escribir `estado` ni al actualizar ni al insertar; un alta directa nace siempre en borrador, con versión 1 y la auditoría de la sesión; el trigger rechaza toda transición no permitida; los eventos son inmutables; un usuario sin perfil falla; las funciones tienen `search_path` fijo y no son ejecutables por `anon`. Ninguna prueba usa número, fechas de emisión, líneas ni aceptaciones | S1, S2, S3 (prospecto), S4 (eventos), S10, S14, S15, S17 |
| F1-5 | `npm test` | Pruebas de menú y rutas actualizadas (4 funcionales, 12 entradas, migas de las tres rutas) en verde | `contracts/rutas-y-navegacion.md` §3 |

### F2 — Catálogo de servicios

| # | Escenario | Resultado esperado | CE / RF |
| --- | --- | --- | --- |
| F2-1 | Abrir el catálogo por primera vez | Vacío: ningún paquete, módulo ni precio precargado | RF-047, CE-013 |
| F2-2 | Crear un paquete (nombre, descripción, precio unitario en HNL, único/recurrente) y un módulo; declarar que el paquete incluye el módulo | Quedan disponibles; el precio se muestra como `L 1,250.00` | RF-040, RF-049, RF-123 |
| F2-3 | Intentar guardar con precio vacío, negativo, `abc`, con 3 decimales, mayor que `99999999.99` o escrito como `1250,50` | Se rechaza con un mensaje en español que indica el formato esperado; la BD también lo rechaza | RF-015, RF-121, RF-123, Historia 6 esc. 4 |
| F2-4 | Retirar un elemento | Deja de poder elegirse; la fila no se borra | RF-050 |
| F2-5 | Como colaborador y cliente, consultar y escribir el catálogo por la API | 0 filas y errores de permiso | CE-003 |
| F2-6 | Revisar la página pública | Los precios «desde» en dólares no cambian | RF-048 |
| F2-7 | `npm test` (vectores M-01 a M-06) y revisar el detalle de un proyecto | La captura y el formato dan lo mismo con otra configuración regional; los importes del detalle de proyecto se ven como antes | RF-123, CE-040 |

### F3 — Creación de cotizaciones y cálculos

| # | Escenario | Resultado esperado | CE / RF |
| --- | --- | --- | --- |
| F3-1 | Crear un borrador para un prospecto (sin cliente ni proyecto), añadir un paquete (1,000.00), un módulo (250.00), una línea manual, un cargo único y una cuota mensual, todos con cantidad 1 | Totales correctos; lo recurrente en su propio bloque, mensual y anual por separado | CE-001, CE-002, RF-010, RF-011 |
| F3-2 | Cambiar el interruptor del módulo | `1,250.00` ↔ `1,000.00` | Historia 1 esc. 1 |
| F3-3 | Añadir un módulo que el paquete ya incluye | Se muestra «incluido en el paquete» y no suma | RF-107, CE-032 |
| F3-4 | Anticipo en monto (400.00 sobre 1,250.00) y en porcentaje (40 % sobre 1,000.00); probar `-0.01`, `1,250.01`, `0` y el total completo | Saldo `850.00`; `400.00`; fuera de rango se rechaza; `0` y total válidos | CE-018, vectores V-03 a V-11 |
| F3-5 | Definir hitos que no cuadran con el total | La interfaz lo señala; «Emitir» no existe aún en F3, pero `cotizacion_validar` ya devuelve `HITOS_NO_CONCILIAN` | RF-019 |
| F3-6 | Servicio mensual con tramos 1–3, 4–6, 7–∞; luego un hueco, un solape y dos abiertos | El primero es válido y se muestra como tabla sin total de vigencia; los demás dan `TRAMOS_INVALIDOS` | RF-076, V-17, V-18 |
| F3-7 | Servicio anual sin condiciones de pago anual | `RECURRENTE_ANUAL_SIN_CONDICIONES` | RF-074, CE-020 |
| F3-8 | Cambiar el precio de un elemento del catálogo usado en un borrador y reabrir el borrador | Se señala la diferencia y no se puede dar por listo hasta elegir «actualizar» o «conservar» | RF-108, CE-032 |
| F3-9 | Abrir la vista previa | Muestra «Borrador», datos del prospecto, bloques único/recurrente, plan de pagos, el aviso **«Los importes no incluyen impuestos»** junto a los totales y el total rotulado sin impuestos; sin «Válida hasta»; no envía nada | RF-021, RF-030 a RF-032, CE-026 |
| F3-10 | Buscar en todo el módulo cualquier campo, columna o texto de impuesto/descuento | No existe ninguno | RF-022, CE-027 |
| F3-11 | Editar el mismo borrador desde dos sesiones | La segunda guardada recibe el aviso de conflicto y no sobrescribe | R-17 |
| F3-12 | `npm test` (vectores V-01 a V-36) y `supabase test db` (mismos vectores) | Mismos resultados en TypeScript y SQL | R-19, CE-002 |
| F3-13 | Poner cantidad 3 a un módulo de `250.00`; probar cantidad `0`, `1.5` y `10000`; servicio mensual con cantidad 5 y tramos; ajuste del primer período de `40.00` | Importe `750.00` y total actualizado; las tres cantidades se rechazan; cada tramo muestra precio por unidad e importe por período; el ajuste sigue en `40.00` | RF-115 a RF-117, CE-036, CE-037, V-22 a V-27 |
| F3-14 | Paquete que incluye un módulo: añadir el módulo con cantidad 3; después añadir una línea marcada como unidades adicionales | El módulo figura como incluido y no suma; solo la línea explícita se cobra | RF-119, CE-037, V-28 |
| F3-15 | Superar un límite: importe de línea, total de la cotización, línea 101 y tramo 13 | Cada intento se rechaza con un mensaje claro, no queda guardado y no se calcula anticipo en porcentaje | RF-121, CE-038, V-31 a V-35 |
| F3-16 | Total único sin anticipo definido ni hitos, sin condiciones de pago | `cotizacion_validar` devuelve `PAGO_UNICO_SIN_CONDICIONES` | RF-110, CE-031, V-36 |
| F3-17 | Editar dos líneas seguidas y luego el título; intentar escribir por la API un importe de línea o un total | No aparece el aviso de conflicto; la pantalla muestra los totales de la base tras cada guardado; la escritura directa falla con error de permiso | DA-05, DA-06, S16, S18 |

### F4 — Emisión, numeración, vigencia y revisiones

| # | Escenario | Resultado esperado | CE / RF |
| --- | --- | --- | --- |
| F4-1 | Emitir un borrador completo | Recibe `COT-AAAA-NNNN` con el año de Honduras; fecha de emisión y «Válida hasta» (+14 días) iguales en lista, detalle y vista previa; ya no es editable | RF-023, RF-062, RF-080, CE-004 |
| F4-2 | Intentar emitir con bloqueos (sin líneas, sin contacto, hitos que no cuadran…) | No se emite; la interfaz lista qué falta en español | RF-095, CE-025 |
| F4-3 | Vectores de fecha D-01 a D-08 con instantes fijos | `valida_hasta`, vencida/no vencida y año de numeración como en el contrato | CE-015, CE-022 |
| F4-4 | Emitir con el contador del año en 9 999 | Siguiente número `COT-AAAA-10000` | CE-034 |
| F4-5 | Crear una revisión, cambiar un precio unitario o una cantidad y emitirla | `…-R1` con 15 días propios; la original queda «sustituida», intacta y sin poder aceptarse | CE-023, CE-035 |
| F4-6 | Crear una segunda revisión en borrador de la misma cotización | No se permite | CE-029 |
| F4-7 | Duplicar una cotización vencida con cambios de catálogo | Borrador con la comparación por precio unitario y las cantidades del origen; manuales sin revisar bloquean la emisión; elemento retirado bloquea; el origen no cambia | CE-024, V-29 |
| F4-8 | Rechazar y cancelar con y sin motivo; reintentar una transición no permitida | Sin motivo se rechaza; Rechazada y Cancelada no tienen salida | CE-017 |
| F4-9 | Archivar y desarchivar | El estado, los datos y el historial no cambian; la lista oculta archivadas por defecto | RF-071 |
| F4-10 | Ver el historial de una cotización | Eventos con quién, cuándo y por qué; no se pueden editar ni borrar | RF-029, S4 |
| F4-11 | Intentar borrar un borrador desde la interfaz | No hay acción de borrado; se cancela con motivo | CE-030 |
| F4-12 | `supabase test db` tras añadir la restricción de forma de las filas emitidas | La prueba de transiciones de F1 sigue en verde con sus datos de ejemplo actualizados (número, familia y fechas) y sin aserciones relajadas | S2 |

En F4 no se prueba ninguna regla que dependa del historial de aceptación: no existe hasta F5a.

### F5a — Aceptación, reversión y evidencia

| # | Escenario | Resultado esperado | CE / RF |
| --- | --- | --- | --- |
| F5a-0 | Antes de empezar | El propietario aprobó DA-02, DA-09, DA-10 y DA-11; lo que no esté aprobado no se implementa | `plan.md`, F5a |
| F5a-1 | Registrar la aceptación de una Emitida vigente con referencia a la propuesta firmada | Pasa a «Aceptada y firmada»; se guardan los metadatos; **no** se crea ni enlaza proyecto; no sale ningún correo | CE-011, CE-009, RF-054 |
| F5a-2 | Intentar aceptar sin referencia, vencida, rechazada, cancelada, borrador o sustituida | No se permite, con mensaje claro | RF-065 |
| F5a-3 | Revertir la aceptación sin motivo y con motivo | Sin motivo se rechaza; con motivo vuelve a «Emitida», queda registro inmutable y la aceptación original sigue | CE-016 |
| F5a-4 | Revertir una aceptación cuya vigencia ya terminó | Queda «Emitida · Vencida» y no se puede aceptar de nuevo | RF-067 |
| F5a-5 | Cancelar por el flujo ordinario una cotización con historial de aceptación, también tras revertirla | No se ofrece y la BD lo rechaza (`COT:HISTORIAL_ACEPTACION`); solo existe la cancelación correctiva con justificación y confirmación, que no se sustituye por el rechazo | CE-028, RF-104, RF-105, S11 |
| F5a-6 | Leer la evidencia como colaborador, cliente y anónimo (API y enlace directo) | Denegado | CE-012 |
| F5a-7 | Pegar un enlace `http://` o con esquema no permitido | Rechazado; solo `https` validado | R-13 |
| F5a-8 | Intentar revisar una Emitida que volvió de una aceptación revertida | No se ofrece y la BD lo rechaza (`COT:NO_REVISABLE`); se puede duplicar. Solo cambia si el propietario aprueba DA-10 | RF-083, S21 |

### F5b — Proyecto (solo tras la aprobación de DA-03 y DA-04)

| # | Escenario | Resultado esperado | CE / RF |
| --- | --- | --- | --- |
| F5b-0 | Antes de empezar | `codegraph impact` sobre `Project`, `createProject`, `convertTicketToProject`, `ProtectedRoute` repetido sobre `main`; relectura de «Riesgos» de `docs/context/PROJECT_CONTEXT.md`; `ProjectDetail.tsx`, `src/types/projects.ts` y `useAuth.tsx` **no** aparecen en el diff | CLAUDE.md |
| F5b-1 | Enlazar un proyecto existente / crear uno desde una cotización «Aceptada y firmada» | Acción explícita; el vínculo se ve en la cotización; el proyecto solo recibe nombre, resumen de alcance y contacto; **sin importes**; la instantánea de la cotización no cambia | CE-033, RF-055 |
| F5b-2 | Intentar vincular una cotización que no está «Aceptada y firmada» | No se ofrece y la BD lo rechaza | Historia 7 esc. 5 |
| F5b-3 | Con proyecto vinculado, intentar revertir y cancelar correctivamente | No disponibles (`COT:PROYECTO_VINCULADO`) | CE-028, RF-068 |
| F5b-4 | Comprobar que el colaborador líder y el cliente del proyecto no ven la cotización ni sus importes | 0 filas | RF-002, RF-003 |
| F5b-5 | Cardinalidad aprobada | El intento de superar la cardinalidad es rechazado | DA-03 |

## 3. Pasos del Propietario (producción)

No los ejecuta quien implementa. Para cada fase con base de datos:

1. Revisar la migración y su prueba pgTAP en el PR.
2. Aplicar la migración **antes** de publicar el frontend de esa fase (el merge a `main` no despliega migraciones; si el frontend llegara antes, las pantallas del administrador fallarían al consultar tablas inexistentes).
3. Confirmar con una verificación de solo lectura que RLS está activo en las tablas nuevas.
4. Publicar el frontend (Vercel) y comprobar con una cuenta de administrador.
5. Sin Edge Functions nuevas: no hay despliegue de funciones ni secretos asociados a este módulo.

Mientras DA-02 esté en la opción «referencia», **no** hay configuración de Storage.
