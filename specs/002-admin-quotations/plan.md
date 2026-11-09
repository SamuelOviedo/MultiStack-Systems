# Plan de implementación: Módulo de Cotizaciones del panel administrativo

**Identificador de la spec**: `002-admin-quotations` (nombra la carpeta en `specs/`; no es una rama de git) | **Fecha**: 2026-11-09 | **Spec**: `specs/002-admin-quotations/spec.md`

**Estado**: ARQUITECTURA APROBADA PARA GENERAR TAREAS DE F1 A F5a. El propietario aprobó el 2026-11-09 las decisiones DA-01, DA-05, DA-06, DA-07, DA-08, DA-12, DA-13 y DA-14. Quedan puertas de aprobación dentro de F5a (DA-02, DA-09, DA-10, DA-11) y F5b sigue bloqueada (DA-03, DA-04). No se ha escrito código, ni migraciones, ni se ha instalado nada.

**Artefactos de este plan**: `research.md` (hallazgos y decisiones R-01…R-24) · `data-model.md` · `contracts/` (`calculo-y-validacion.md`, `ciclo-de-vida.md`, `rpc-cotizaciones.md`, `acceso-y-rls.md`, `rutas-y-navegacion.md`) · `quickstart.md`. `tasks.md` **no** existe todavía (lo genera `/speckit-tasks` cuando el propietario apruebe este plan).

## Resumen

Se añade al panel administrativo un módulo de cotizaciones **solo para el administrador** (rol 0): catálogo de paquetes y módulos en HNL, borradores con líneas de cantidad entera por precio unitario, anticipo, hitos y servicios recurrentes, cálculo exacto, vista previa, emisión con número permanente y vigencia de 15 fechas calendario, revisiones inmutables, duplicados, aceptación manual con evidencia por referencia, y, al final, el vínculo explícito con un proyecto.

**Enfoque técnico** (todo sobre el stack actual, sin infraestructura nueva):

- **Frontend**: tres páginas `lazy` bajo `ProtectedRoute allowedTypes={[0]}` y `AdminShell`; datos en `src/lib/*` con TanStack Query; cálculo en funciones puras con **enteros de centavos**; componentes con las primitivas shadcn del panel.
- **Base de datos**: 12 tablas nuevas con RLS de administrador y privilegios mínimos, **por columna en `INSERT` y en `UPDATE`**; la máquina de estados y la inmutabilidad viven en **triggers**; todas las transiciones son **RPC `SECURITY DEFINER`** atómicas, con `search_path` fijo y privilegios de ejecución explícitos, que escriben su evento de auditoría (DA-06).
- **Autoridad del cálculo** (DA-05): Postgres calcula los importes de línea, los totales, el anticipo y la validación financiera; el navegador nunca los envía. El cliente replica la misma aritmética solo para la vista previa inmediata, con **los mismos vectores de prueba** en Vitest y pgTAP, y recarga los valores de la base después de guardar.
- **Dinero**: cantidad entera (1 a 9 999) por precio unitario; límites por nivel comprobados por separado (DA-07); un único redondeo, mitad hacia arriba, en el anticipo por porcentaje (DA-01); presentación `L 1,250.00` y captura determinista propias del módulo (DA-14).
- **Sin Edge Functions, sin Storage, sin dependencias nuevas, sin cambios en CI ni en `.claude/settings.json`.**
- **Proyectos**: tabla de vínculo propia; no se toca `proyectos_clientes`, `Project`, `ProjectDetail` ni `useAuth`. Es la **última** fase y está bloqueada hasta que el propietario decida la cardinalidad y qué pasa al proyecto.

## Cómo leer este plan (qué es qué)

| Etiqueta | Significa |
| --- | --- |
| **[Aprobado]** | Viene de la spec o de una decisión del propietario (`RF-###`, `DP-##`, `AF-#`, o una `DA-##` de la tabla «Aprobadas»). No se reabre. |
| **[Propuesta técnica]** | Diseño razonable que cabe en el stack y las reglas; el propietario puede cambiarlo al revisar, pero no es una decisión de negocio. |
| **[Decisión pendiente DA-##]** | Decisión de arquitectura o de negocio que **el plan no resuelve**. Tiene recomendación y alternativas; nada que dependa de ella se implementa antes de su aprobación. Hoy solo quedan las puertas de F5a y las de F5b. |
| **[Diferido]** | Fuera de la primera versión (sección «Diferido»). |

## Contexto técnico

**Lenguaje/Versión**: TypeScript 5.9 (React 18, Vite 5); SQL (Postgres de Supabase)

**Dependencias principales**: las existentes — `@supabase/supabase-js`, `@tanstack/react-query`, `react-hook-form`, `zod`, `date-fns`, shadcn/ui + Tailwind. **No se añade ninguna dependencia** (el dinero va con enteros; ver R-01).

**Almacenamiento**: Postgres con RLS (12 tablas nuevas, `data-model.md`). Sin Supabase Storage (DA-02).

**Pruebas**: Vitest + Testing Library (`src/**/*.test.{ts,tsx}`), pgTAP (`supabase/tests/database/`), Playwright solo local para el acceso por rol. Gate: `npm run lint && npx tsc -p tsconfig.app.json --noEmit && npm test && npm run build`, más `supabase test db`.

**Plataforma**: SPA en Vercel; Supabase gestionado. Producción solo la opera el propietario.

**Tipo de proyecto**: aplicación web (SPA + backend gestionado), un único repositorio.

**Objetivos de rendimiento**: listado paginado en servidor; la página de detalle y el catálogo cargan `lazy` y **no entran en el chunk de entrada** (restricción de bundle de la landing: el módulo vive bajo `/dashboard`, ya separado). Recalcular totales con 100 líneas es instantáneo (aritmética de enteros).

**Restricciones**: repositorio público (sin datos reales); zona horaria `America/Tegucigalpa` para toda regla de fechas; límites de DA-07 (cantidad 1 a 9 999; L 99,999,999.99 por línea; L 999,999,999.99 por total; 100 líneas; 12 tramos), comprobados por separado y antes de calcular un anticipo en porcentaje; todo texto de interfaz en español, sin errores técnicos crudos.

**Escala/Alcance**: un único actor (administrador); del orden de cientos de cotizaciones al año. 3 pantallas, ~15 componentes, 12 tablas, 14 RPC.

**Sin `NEEDS CLARIFICATION`**: los puntos que la spec delegó al plan están resueltos como propuesta técnica o listados como decisión pendiente.

## Constitution Check — antes del diseño

Fuente: `.specify/memory/constitution.md` v1.0.0 y `CLAUDE.md` (que prevalece).

| Control | Resultado | Fundamento |
| --- | --- | --- |
| **C1 Stack** | **Cumple** | Solo Vite/React/TS, Supabase (Postgres/RLS/RPC), shadcn, TanStack Query. No se reemplaza ni añade infraestructura. Guardar archivos (Storage) **no** se adopta: está como DA-02 y requeriría `/l99` y aprobación. |
| **C2 Acceso** | **Cumple** | Tres rutas con `ProtectedRoute allowedTypes={[0]}` (autorizadas por DP-10); ningún rol gana acceso; el portal no se toca. |
| **C3 Datos** | **Cumple, con revisión de `security`** | Cada tabla nueva: RLS, `REVOKE ALL` + `GRANT` mínimos y pgTAP para `anon`, cliente, colaborador y admin (`contracts/acceso-y-rls.md`). Sin Edge Functions, así que la regla de fallo cerrado de funciones no aplica; las RPC fallan cerradas (`get_user_type() = 0`). |
| **C4 Pruebas** | **Cumple** | Cada fase cierra con el gate completo, pruebas de lógica nueva (vectores compartidos), pgTAP y revisión de `revisor`/`qa`/`security`. |
| **C5 Migraciones y producción** | **Cumple** | Solo migraciones nuevas hacia adelante (una por fase, seis en total como línea base; nunca se edita una existente: cuando una fase cambia una función de otra anterior, lo hace con `CREATE OR REPLACE` en su propia migración). Aplicarlas es paso del **Propietario** (`quickstart.md` §3). |
| **C6 Repo público** | **Cumple** | Solo datos sintéticos; sin ids de proyecto Supabase, secretos, rutas absolutas ni documentación privada. Ejemplos de importe marcados como ilustrativos. |
| **C7 Flujo** | **Cumple** | Sin ramas ni commits automáticos; la implementación entra por `/tarea`; las consultas previas están listadas abajo. |

**Consultas previas de la constitución** («Decisiones que se consultan antes de planificar»):

| Punto | Estado |
| --- | --- |
| Crear rutas nuevas | **Autorizado**: exactamente tres (DP-10). Cualquier otra requiere consulta (RF-061). |
| Cambiar el sistema de tokens o el copy de productos | **No aplica**: se usan los tokens existentes (`var(--success)`, `var(--warning)`). El contenido público en dólares no cambia (RF-048). |
| Borrar dependencias, modificar CI o `.claude/settings.json` | **No aplica**: `db-tests.yml` ya recoge los pgTAP nuevos. |
| Pasos de producción | **Propietario**: aplicar migraciones y publicar el frontend. |
| Símbolos compartidos y zonas delicadas | `codegraph impact` ejecutado (resultados en `research.md` §1). Se tocan `App.tsx`, `adminNav.ts` y sus pruebas; **no** se tocan `useAuth`, `client.ts`, `src/types/projects.ts`, `ProjectDetail.tsx`, `portal.ts` ni migraciones existentes. F5b repite el análisis. |

**Resultado del gate: PASA.** No hay violaciones que justificar (la tabla «Seguimiento de complejidad» queda sin filas sustantivas).

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/002-admin-quotations/
├── spec.md
├── plan.md                         # este archivo
├── research.md                     # Fase 0
├── data-model.md                   # Fase 1
├── quickstart.md                   # Fase 1
├── contracts/                      # Fase 1
│   ├── calculo-y-validacion.md
│   ├── ciclo-de-vida.md
│   ├── rpc-cotizaciones.md
│   ├── acceso-y-rls.md
│   └── rutas-y-navegacion.md
├── checklists/requirements.md
└── tasks.md                        # lo crea /speckit-tasks (NO existe aún)
```

### Código fuente (propuesta; nada de esto existe todavía)

```text
src/
├── App.tsx                                     (editar: 3 rutas lazy)                        F1
├── components/admin/adminNav.ts                (editar: entrada + NavItem.subpages)           F1
├── components/admin/preloadPanel.ts            (editar, opcional)                             F1
├── types/cotizaciones.ts                       (nuevo; NO se toca types/projects.ts)          F1…
├── lib/
│   ├── cotizaciones.ts                         (consultas, mutaciones, traducción de errores) F1…
│   ├── catalogoServicios.ts                    (catálogo)                                     F2
│   ├── cotizacionDinero.ts                     (captura y formato de HNL, enteros)            F2
│   ├── cotizacionCalculo.ts                    (cantidad × precio, totales, anticipo, hitos)  F3
│   ├── cotizacionVigencia.ts                   (vigencia/vencida; usa calendarDate.ts)        F4
│   └── cotizacionEstados.ts                    (acciones permitidas por situación; puro)      F4
├── pages/dashboard/
│   ├── CotizacionesList.tsx                    F1
│   ├── CotizacionesCatalogo.tsx                F2
│   └── CotizacionDetalle.tsx                   F1 (esqueleto) → F3…F5
├── components/dashboard/cotizaciones/          (formulario, editor de líneas, anticipo e hitos,
│                                                recurrentes y tramos, CotizacionDocumento [vista previa],
│                                                historial, acciones, diálogos con motivo)      F2…F5
└── test/ · lib/*.test.ts                       (menú, rutas, cálculo, vigencia, pantallas)

supabase/
├── migrations/   6 archivos nuevos (uno por fase; F5 se divide en 5a y 5b)
└── tests/database/   6 archivos pgTAP nuevos
e2e/              1 spec local nuevo (acceso por rol de las tres rutas)
```

**Decisión de estructura**: se sigue el esquema plano de `src/lib/*` y `src/pages/dashboard/*` ya existente; los componentes del módulo van en una carpeta propia bajo `components/dashboard/` como `tickets/` y `project-detail/`. No se crean directorios de primer nivel.

## Trazabilidad: requisitos aprobados → fase

| Grupo de requisitos [Aprobado] | Fase |
| --- | --- |
| Acceso y rutas: RF-001 a RF-004, RF-056 a RF-061; listado inicial RF-033 | **F1** |
| Auditoría de fila RF-029; no registrar datos personales RF-004/RF-035 | F1 (y todas) |
| Catálogo: RF-040, RF-046 a RF-050, RF-107 (composición); presentación y captura de importes RF-123; límite del precio del catálogo (RF-121, en parte) | **F2** |
| Líneas, clasificación y cálculo: RF-005 a RF-015, RF-101 a RF-103 | **F3** |
| Cantidad por precio unitario, límites y redondeo: RF-115 a RF-122 | **F3** |
| Anticipo, hitos, pago único, recurrentes: RF-016 a RF-020, RF-073 a RF-079, RF-110, RF-111 | **F3** |
| Prospecto y vista previa: RF-039, RF-042 a RF-045 (captura), RF-030 a RF-032, RF-021, RF-022 | **F3** |
| Deriva de precio del catálogo: RF-108 | F3 |
| Emisión, número, vigencia, estados, inmutabilidad: RF-023 a RF-028, RF-043, RF-062 a RF-064, RF-069 a RF-072, RF-094, RF-095, RF-106, RF-109, RF-113 | **F4** |
| Revisiones y duplicados: RF-034, RF-080 a RF-100 (la parte de RF-083 sobre historial de aceptación: F5a) | **F4** |
| Aceptación, reversión, evidencia, cancelación correctiva: RF-041, RF-051 a RF-054, RF-065 a RF-068, RF-104, RF-105, RF-114; asociación a cliente formal RF-044 (acción) | **F5a** |
| Proyecto: RF-055, RF-112 (y verificación de RF-054) | **F5b** |
| Interfaz en español, tokens y accesibilidad: RF-036 a RF-038 | todas |

## Fases de entrega

Cinco fases verticales, **cada una un PR** (un cambio, un propósito; ninguna toca 5 o más archivos no relacionados), con su migración, sus pruebas y su criterio de aceptación. Cada fase deja el sistema desplegable y con valor propio, salvo F1, que entrega el esqueleto seguro. F5 se divide en F5a (aceptación) y F5b (proyecto, bloqueada).

```text
F1 ──► F2 ──► F3 ──► F4 ──► F5a ──► F5b (bloqueada por DA-03 / DA-04)
cimientos  catálogo  borrador+cálculo  emisión+revisiones  aceptación  proyecto
```

### F1 — Cimientos seguros y esqueleto del módulo

- **Entrega independiente**: el módulo existe, está cerrado a todo rol salvo el administrador y su base de datos tiene la máquina de estados y la auditoría. *Valor comercial: ninguno todavía; valor de seguridad: la base sobre la que se apoya todo lo demás.*
- **Base de datos** (`…_cotizaciones_fundacion.sql`): `cotizaciones` (núcleo + prospecto, sin contenido financiero), `cotizacion_eventos` (con el único tipo `creada`); trigger de máquina de estados (RF-072) y de inmutabilidad; trigger de alta que impone estado inicial, versión y auditoría; trigger de `row_version` y de auditoría de fila; RLS y `GRANT` **por columna en `INSERT` y en `UPDATE`** (`contracts/acceso-y-rls.md` §1.1). F1 no crea ninguna RPC.
- **Frontend**: rutas, entrada de menú y `NavItem.subpages` (DA-13); `CotizacionesList` (lectura real, estado vacío); `CotizacionDetalle` con validación de UUID y «no encontrada»; `CotizacionesCatalogo` con estado vacío honesto («el catálogo se habilita en la siguiente fase»); `types/cotizaciones.ts`; `cotizaciones.ts` mínimo con la traducción de errores.
- **Pruebas**: pgTAP `cotizaciones_fundacion` (A1–A9 en las dos tablas; S1, S2, S3 solo sobre el prospecto, S4 solo sobre eventos, S10, S14, S15, S17); Vitest de menú, migas y rutas (actualización deliberada de `admin-nav`, `admin-shell`, `admin-routes`); e2e local de acceso por rol; test de traducción de errores.
- **Lo que F1 no da por hecho**: ni número, ni fechas de emisión, ni líneas, ni cálculo, ni aceptaciones, ni RPC. Las filas de ejemplo de S2 y S3 se llevan de un estado a otro como `postgres` solo para ejercitar los triggers; cuando F4 añade la restricción de forma de las filas emitidas, F4 actualiza esos datos de ejemplo a propósito, sin relajar ninguna aserción.
- **Criterios de aceptación**: `quickstart.md` F1-1 a F1-5; CE-003, CE-014.
- **Depende de**: nada pendiente (DA-06 y DA-13 aprobadas; DA-05 no condiciona ningún archivo de F1).
- **Propietario**: aplicar la migración antes de publicar.

### F2 — Catálogo de servicios

- **Entrega independiente**: el administrador mantiene paquetes y módulos con precio en HNL (y su composición). *Valor: catálogo gestionable aunque aún no se cotice.*
- **Base de datos** (`…_catalogo_servicios.sql`): `catalogo_items` (el precio es un **precio unitario** dentro del límite de línea), `catalogo_paquete_modulos`; sin filas semilla; índice único de nombre; privilegios por columna y marcas de tiempo puestas por la base; pgTAP `catalogo_servicios` (A1–A9, S9 del catálogo, S14, S17; el retiro no borra la fila). F2 no crea ninguna RPC.
- **Frontend**: `catalogoServicios.ts`, `CotizacionesCatalogo` completo (alta, edición, retirar, composición), `cotizacionDinero.ts` (captura determinista y formato `L 1,250.00`, **introducido aquí** porque el catálogo ya necesita precios; vectores M-01 a M-06), pruebas de formulario (`maxLength`, rechazo de precios inválidos o ambiguos).
- **Criterios de aceptación**: `quickstart.md` F2-1 a F2-7; CE-013, CE-040.
- **Depende de**: F1 (DA-07 y DA-14 aprobadas).

### F3 — Creación de cotizaciones y cálculos

- **Entrega independiente**: el administrador arma borradores completos, ve los totales exactos y los previsualiza; sustituye el cálculo manual. *Sin número, sin vigencia, sin emisión todavía.*
- **Base de datos** (`…_cotizaciones_borradores.sql`): columnas de contenido y anticipo en `cotizaciones`; `cotizacion_lineas` (con `cantidad`, `precio_unitario`, `importe` calculado y `unidades_adicionales`), `cotizacion_tramos` (tarifa por unidad y por período), `cotizacion_hitos`; funciones `cotizacion_redondear_anticipo`, `cotizacion_recalcular`, `cotizacion_validar` y `cotizacion_resolver_precio`; triggers de recálculo (importes de línea, inclusión de módulos, totales y versión del borrador) y de límites (cantidad, producto, línea 101, tramo 13, total); `GRANT` por columna en `INSERT` y en `UPDATE` (importes de línea, totales y referencias de precio no escribibles); tipo de evento `precio_resuelto`; pgTAP `cotizaciones_borradores` con los **vectores V-01 a V-36** y S3, S6 a S9, S13, S14, S16 a S20.
- **Frontend**: `cotizacionCalculo.ts` (mismos vectores, con el orden de comprobación de límites y `Number.isSafeInteger`), formulario del borrador (react-hook-form + zod), editor de líneas (catálogo y manuales, cantidad y precio unitario, cortesía, unidades adicionales), anticipo e hitos, recurrentes con tramos, panel «qué falta» (de `cotizacion_validar`), `CotizacionDocumento` (vista previa con cantidad, precio unitario e importe por línea, el aviso de impuestos **junto a los totales** y el total rotulado sin impuestos), aviso de conflicto de versión.
- **Valores de la base tras guardar** (DA-05, DA-06): cada cambio en una línea, un tramo o un hito recarga la cotización —versión y totales calculados— antes de permitir otra escritura, y las mutaciones de un mismo borrador se serializan. La vista previa de TypeScript se sustituye por los valores de la base, y el aviso de conflicto solo aparece por cambios de otra sesión.
- **Criterios de aceptación**: `quickstart.md` F3-1 a F3-17; CE-001, CE-002, CE-006, CE-018 a CE-020, CE-026, CE-027, CE-031, CE-032, CE-036 a CE-039.
- **Depende de**: F2 (DA-01, DA-07, DA-08 y DA-12 aprobadas).

### F4 — Emisión, numeración, vigencia y revisiones

- **Entrega independiente**: el administrador emite cotizaciones con número permanente y vigencia, las revisa, las duplica, las rechaza, las cancela y las archiva. *Valor: ciclo comercial completo hasta la respuesta del cliente (sin registrar aún la aceptación).*
- **Base de datos** (`…_cotizaciones_emision.sql`): `cotizacion_familias`, `cotizacion_secuencias`; columnas de emisión, versión, cierre y archivo, y la restricción de forma de las filas emitidas; funciones de fecha y de número; RPC `cotizacion_emitir`, `cotizacion_crear_revision`, `cotizacion_duplicar`, `cotizacion_rechazar`, `cotizacion_cancelar`, `cotizacion_archivar` y `cotizacion_confirmar_anticipo`; tipos de evento de la fase; índices únicos parciales; pgTAP `cotizaciones_emision` (vectores D-01 a D-08 y N-01 a N-05, S3, S5, S13, S14, S16, S17, contador en 9 999, cambio de año, una revisión en borrador por familia, origen no elegible) y la actualización deliberada de los datos de ejemplo de S2 en el archivo de F1.
- **Frontend**: `cotizacionVigencia.ts` y `cotizacionEstados.ts` (mismas reglas, mismos vectores), listado completo (filtros por estado, vencidas y archivadas, búsqueda, paginación), acciones con diálogo de motivo (10–1 000 caracteres), comparación de precios del duplicado, historial de eventos, indicadores «Vencida/Sustituida/Archivada» iguales en lista, detalle y vista previa.
- **Criterios de aceptación**: `quickstart.md` F4-1 a F4-12; CE-004, CE-005, CE-007, CE-010, CE-015, CE-017, CE-022 a CE-025, CE-029, CE-030, CE-034, CE-035. (CE-008 es un criterio sobre la propia spec y no pertenece a ninguna fase.)
- **Depende de**: F3. Ninguna decisión pendiente: DA-12 está aprobada y DA-10 es una puerta de F5a.
- **Nota sobre el historial de aceptación** *(corrección)*: en F4 no existe `cotizacion_aceptaciones` ni puede existir ninguna aceptación. Por eso `cotizacion_cancelar` y `cotizacion_crear_revision` **no** consultan el historial en F4 y las pruebas de F4 no lo ejercitan. La regla de RF-104, la de RF-083 sobre el historial y sus pruebas (S11, S21) entran en F5a, cuya migración sustituye ambas funciones. Una versión anterior de este plan situaba esa comprobación en F4 con datos de ejemplo que no podían existir.

### F5a — Aceptación, reversión y evidencia por referencia

- **Entrega independiente**: registrar la aceptación con su referencia a la propuesta firmada, revertirla por error y, en el caso excepcional, cancelar con el procedimiento correctivo separado (solo sin proyecto vinculado). *No crea ni enlaza proyectos.*
- **Puertas de aprobación del propietario antes de implementar F5a** (las tareas de F5a las llevan como primer paso, y nada que dependa de una puerta se implementa sin su aprobación):
  - **DA-02**: forma de la evidencia (referencia segura, recomendada, o archivo en Storage).
  - **DA-09**: asociación con un registro formal de cliente (`cliente_perfil_id`).
  - **DA-10**: si una «Emitida» que volvió de una aceptación revertida puede revisarse. **Por defecto no**: no se habilita en silencio.
  - **DA-11**: procedimiento concreto de la cancelación correctiva. El requisito RF-105 se conserva y no se sustituye por el rechazo ordinario; la puerta confirma la justificación y la confirmación escrita del número.
- **Base de datos** (`…_cotizaciones_aceptacion.sql`): `cotizacion_aceptaciones`, `cotizacion_reversiones`; `cliente_perfil_id` (si DA-09 se aprueba); RPC `cotizacion_registrar_aceptacion`, `cotizacion_revertir_aceptacion` y `cotizacion_cancelar_correctiva`; **sustitución** de `cotizacion_cancelar` (RF-104: sin historial de aceptación) y de `cotizacion_crear_revision` (sin historial de aceptación mientras DA-10 siga pendiente); tipos de evento de la fase; pgTAP `cotizaciones_aceptacion` (S4 sobre aceptaciones y reversiones, S11, S13, S14, S17, S21; evidencia ilegible para colaborador, cliente y `anon`).
- **Frontend**: diálogo de aceptación (referencia obligatoria, enlace `https` opcional validado con `safeUrl.ts`), reversión con motivo, cancelación correctiva con justificación y confirmación escrita del número, nota visible de que el control de acceso al documento detrás del enlace pertenece al sistema donde se guardó.
- **Criterios de aceptación**: `quickstart.md` F5a-0 a F5a-8; CE-009, CE-011, CE-012, CE-016, CE-021, CE-028.
- **Depende de**: F4 y las cuatro puertas anteriores.

### F5b — Asociación con proyectos (FINAL, BLOQUEADA)

- **No empieza** hasta que el propietario apruebe **DA-03 (cardinalidad)** y **DA-04 (qué pasa al proyecto)**.
- **Primer paso obligatorio** (CLAUDE.md): repetir `codegraph impact` sobre `Project`, `createProject`, `updateProject`, `convertTicketToProject`, `ProtectedRoute` y releer «Riesgos» de `docs/context/PROJECT_CONTEXT.md` contra el estado de `main` de ese momento; documentar el resultado.
- **Entrega independiente**: enlazar un proyecto existente o crear uno desde una cotización «Aceptada y firmada», con el vínculo visible en la cotización. *Sin cambios visibles en la pantalla del proyecto.*
- **Base de datos** (`…_cotizaciones_proyecto.sql`): `cotizacion_proyecto_vinculos` con la unicidad aprobada; RPC `cotizacion_vincular_proyecto` y `cotizacion_crear_proyecto` (patrón de `convert_ticket_to_project`, sin modificarlo); sustitución de `cotizacion_revertir_aceptacion` y `cotizacion_cancelar_correctiva` para añadir `COT:PROYECTO_VINCULADO`; pgTAP `cotizaciones_proyecto` (S12, cardinalidad, el colaborador líder y el cliente del proyecto no ven cotizaciones ni importes).
- **Frontend**: panel «Proyecto» en el detalle de la cotización; sin cambios en `ProjectDetail.tsx`, `Project` ni `ProjectsList`.
- **Criterios de aceptación**: `quickstart.md` F5b-0 a F5b-5; CE-033.
- **Fuera de F5b (RF-068, instrucción del propietario)**: revertir la aceptación o cancelar correctivamente una cotización **con proyecto vinculado** queda **no disponible** en la primera versión, a la espera de un procedimiento administrativo aparte que el propietario apruebe por separado.

## Estrategia de pruebas y regresión

| Capa | Qué se prueba | Dónde |
| --- | --- | --- |
| Aritmética y fechas | Vectores V-01…V-36, D-01…D-08, N-01…N-05, **idénticos** en TS y SQL | `src/lib/*.test.ts` y pgTAP |
| Captura y presentación de importes | Vectores M-01…M-06, también con la configuración regional cambiada | `src/lib/cotizacionDinero.test.ts` |
| Seguridad de datos | A1–A9 por tabla, S1–S21, cada una en la fase que crea lo que prueba | pgTAP (rol por rol) |
| Menú y rutas | 4 funcionales, 12 entradas, migas, `aria-current`, `catalogo` vs `:id`, `allowedTypes` | `admin-nav`, `admin-shell`, `admin-routes`, `dashboard-admin-only`, `ProtectedRoute`; e2e local |
| Pantallas | comportamiento visible: errores en español, `maxLength`, estados vacíos, conflicto de versión, acciones ofrecidas según `ciclo-de-vida.md` §3 | Testing Library |
| Regresión | las 3 pantallas actuales (`Dashboard`, `ProjectsList`, `ProjectDetail`, `TicketsGlobal`) y el portal no cambian | suites de caracterización existentes sin modificar |
| Ausencia de lo prohibido | ninguna columna ni texto de impuesto/descuento; ningún correo; ningún PDF; ninguna ruta extra | A8, búsqueda en pruebas de pantalla, prueba de rutas |
| Accesibilidad | teclado, foco en diálogos, etiquetas, contraste de estados | `qa` + pruebas de Testing Library |

Cada bug corregido durante la implementación lleva un test que falla sin el arreglo.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Divergencia entre el cálculo de TypeScript y el de SQL | Vectores compartidos; la BD es la autoridad al emitir (R-19) |
| Un `UPDATE` directo salta la máquina de estados | `GRANT` por columna + triggers (R-04, R-05) + pgTAP como `postgres` |
| Un `INSERT` directo fabrica estado, origen de revisión, auditoría o totales | `GRANT INSERT` por columna, política que exige borrador y trigger de alta (R-04); pruebas S15 y S16 |
| Falso conflicto de versión tras editar líneas | La versión es de todo el borrador; la capa de datos recarga la cotización tras cada cambio en sus hijas y serializa las mutaciones (R-17); pruebas S18 y de pantalla |
| Desbordamiento o conversión insegura de números | Límites por nivel comprobados en orden y antes del porcentaje, enteros de centavos, `Number.isSafeInteger`, conversión por análisis de texto (R-03); vectores V-31 a V-35 y M-04 |
| Función `SECURITY DEFINER` ejecutable por quien no debe o con `search_path` alterable | `REVOKE ALL … FROM PUBLIC, anon, authenticated`, `GRANT` solo a las 14 RPC, `search_path` fijo; prueba S17 en cada fase |
| Numeración con huecos o duplicados bajo concurrencia | Fila de secuencia por año con `ON CONFLICT DO UPDATE` en la transacción de emisión + `UNIQUE`; el formato no usa `lpad` sobre 9 999 (R-06) |
| Vigencia mal contada por zona horaria | Funciones puras con instantes explícitos y vectores fijos; reutiliza `calendarDate.ts` en cliente (R-07) |
| Filtración de datos personales a registros o errores | Mensajes `COT:<CODIGO>` sin datos; eventos sin PII; pruebas de mensajes (RF-004) |
| Exposición de importes al colaborador o al cliente por el vínculo | Finanzas **por referencia, no por copia**; `proyectos_clientes` intacta (DA-04) |
| Romper pruebas del menú sin querer | Cambios deliberados y listados (`rutas-y-navegacion.md` §3); las demás entradas conservan su comportamiento |
| Migración aplicada después del frontend | Orden del Propietario documentado (`quickstart.md` §3) |
| Tipos generados desactualizados | Regeneración local tras cada migración (R-21); `tsc` en el gate |

## Diferido (fuera de la primera versión)

Descuentos (automáticos y manuales), cálculo de impuestos, facturación, pagos y pasarelas, PDF y descarga, entrega al cliente y correo, firma electrónica, portal o colaborador con acceso a cotizaciones, módulo de clientes, dependencias entre módulos, periodicidades distintas de mensual/anual, cantidades fraccionarias y facturación por horas con fracciones, conversión de moneda, reportes de cobros, plazos de retención y borrado, y el procedimiento administrativo para cotizaciones con proyecto vinculado. (Spec, «Diferido» y «Fuera del alcance».)

## Decisiones del propietario

Ninguna se ha resuelto en silencio. Las aprobadas ya están aplicadas en los artefactos; cada pendiente dice qué bloquea y qué hace el módulo mientras tanto.

### Aprobadas (2026-11-09)

| ID | Decisión aprobada | Dónde se aplica | Fase |
| --- | --- | --- | --- |
| **DA-01** | **Redondeo**: decimal mitad hacia arriba a dos decimales de HNL en el anticipo por porcentaje; aritmética exacta en centavos; porcentaje representado en puntos base; sin coma flotante | R-02, `calculo-y-validacion.md` §2.1, RF-122 | F3 |
| **DA-05** | **Opción A**: Postgres es la autoridad de los totales, del anticipo y de la validación financiera. TypeScript calcula solo la vista previa inmediata, con las mismas reglas verificadas y los mismos vectores. Nunca se confía en un total calculado por el navegador al guardar o al emitir, y los valores de la base se recargan después de guardar | R-01, R-19, `calculo-y-validacion.md` | F3–F4 |
| **DA-06** | **Opción A con salvaguardas obligatorias**: edición directa de borradores solo con RLS de administrador y privilegios por columna; columnas permitidas y valores por defecto seguros **también en `INSERT`**; ningún campo del ciclo de vida, metadato de auditoría, origen de revisión ni total calculado bajo control del cliente; transiciones por RPC atómicas, con rol validado y auditadas; recarga de la versión de la cotización tras cambiar sus líneas; funciones `SECURITY DEFINER` con privilegios de ejecución explícitos y `search_path` seguro | R-04, R-05, R-17, `acceso-y-rls.md`, `rpc-cotizaciones.md` §1 | todas |
| **DA-07** | **Límites**: L 99,999,999.99 por línea, L 999,999,999.99 por total, 100 líneas, 12 tramos y cantidad entera positiva de hasta 9 999. Se validan por separado la cantidad por el precio unitario, el importe de cada línea y el total; lo que supera un límite se rechaza antes de emitir y antes de calcular un anticipo en porcentaje; sin desbordamientos ni conversiones inseguras de números | R-03, `calculo-y-validacion.md` §2.2, RF-121 | F2–F3 |
| **DA-08** | **Cantidad entera por precio unitario en HNL** desde la primera versión (detalle abajo) | R-24, `data-model.md` §2.6 y §2.7, RF-115 a RF-120 | F3 |
| **DA-12** | **Condiciones de pago**: los cargos únicos exigen condiciones de pago explícitas aunque no haya anticipo ni hitos adicionales | R-11, `calculo-y-validacion.md` §2.3, RF-110 | F3 |
| **DA-13** | **Opción A**: `NavItem` se extiende con metadatos opcionales de subpágina para las migas del catálogo; una sola entrada «Cotizaciones» en «Gestión comercial» | R-16, `rutas-y-navegacion.md` | F1 |
| **DA-14** | **Presentación de la moneda**: se comprobó que la aplicación no tiene una convención reutilizable para lempiras, así que se usa `L 1,250.00` y una captura decimal sin ambigüedad (`1250.00`), determinista, exacta al centavo, probada e independiente de la configuración regional del navegador. Sin cambio global de formato en otros módulos | R-01, `calculo-y-validacion.md` §1, RF-123 | F2 |

**DA-08 en detalle** (todo aplicado en la spec, el cálculo, el modelo, los contratos y los vectores V-22 a V-36):

- La cantidad es 1 por defecto y va de 1 a 9 999.
- Se aplica a las líneas de cargo único y a las de servicio recurrente.
- Los tramos de tarifa son precios por unidad y por período; la cantidad de la línea es la misma en todos los tramos.
- El importe de la línea lo calcula la base, que es la autoridad.
- Las comparaciones con el catálogo y las de los duplicados son por precio unitario.
- Un módulo incluido en un paquete no se cobra dos veces.
- Las unidades adicionales de un módulo exigen una línea facturable explícita, nunca un cargo duplicado automático.
- Un ajuste del primer período acordado a mano se aplica una vez a toda la línea, no una vez por unidad.
- Las cantidades fraccionarias y la facturación por horas con fracciones quedan diferidas.

### Pendientes

| ID | Decisión | Tipo | Recomendación del plan | Alternativas | Bloquea | Qué hace el módulo mientras tanto |
| --- | --- | --- | --- | --- | --- | --- |
| **DA-02** | **Evidencia de la propuesta firmada** | Arquitectura (infraestructura) | **Referencia segura**: texto + enlace `https` opcional, solo legible por el administrador (R-13) | Bucket privado de Supabase Storage con URL firmadas (infraestructura nueva: `/l99`, política y pruebas de Storage, retención) | Puerta de **F5a** | Nada: la aceptación no existe hasta F5a |
| **DA-09** | **Asociación a un registro formal de cliente** (RF-044) | Arquitectura | Columna `cliente_perfil_id` hacia `profiles` (el único «registro de cliente» que existe hoy); la acción de asociar es opcional y no reescribe la instantánea | Posponer la columna hasta que exista el módulo Clientes | Puerta de **F5a** | La cotización guarda solo la instantánea del prospecto |
| **DA-10** | ¿Se puede **revisar** una cotización «Emitida» que volvió de una aceptación revertida? | Negocio | Ninguna que la habilite: el propietario indicó que no se active en silencio | Permitirla (lectura literal de RF-083) | Puerta de **F5a** | **No se ofrece**: `cotizacion_crear_revision` rechaza cotizaciones con historial de aceptación; se pueden duplicar |
| **DA-11** | **Procedimiento concreto de la cancelación correctiva** (RF-105) | Negocio | Justificación obligatoria y confirmación escrita del número; solo para cotizaciones con historial de aceptación y **sin** proyecto vinculado | Otro procedimiento igual de explícito y auditado | Puerta de **F5a** | El requisito aprobado se conserva en el alcance de F5a y **no se sustituye por el rechazo ordinario** |
| **DA-03** | **Cardinalidad cotización ↔ proyecto** y qué pasa si se borra un proyecto vinculado | Negocio / zona delicada | Diseñar la tabla de vínculo sin presuponer; elegir una unicidad al aprobar. La spec propone «una cotización → como máximo un proyecto»; **no se asume** | (A) 1 cotización : ≤1 proyecto, 1 proyecto : N cotizaciones; (B) uno a uno; (C) muchos a muchos. Borrado: `RESTRICT` (propuesto) vs permitir y conservar el vínculo huérfano | **F5b** (bloqueada) | No se crea ni se enlaza ningún proyecto |
| **DA-04** | **Qué pasa al proyecto** | Seguridad / negocio | Crear copia nombre, resumen de alcance y contacto; **finanzas por referencia, sin copia**, porque `proyectos_clientes` la leen el colaborador líder y el cliente (R-14) | Copiar finanzas al proyecto (ampliaría el acceso: requiere decisión de seguridad aparte) | **F5b** (bloqueada) | Igual que DA-03 |

Detalles menores que el plan resolvió como propuesta técnica y que el propietario puede cambiar sin impacto estructural: recorte de textos, orden de la entrada en el menú, parámetro `?vista=previa`, índices y límites de paginación, la forma de marcar una línea de unidades adicionales (`unidades_adicionales`) y que la captura admita la coma como separador de miles bien formado.

### Línea base y simplificaciones

La línea base de planificación son **12 tablas, 14 RPC y 6 migraciones por fases**. No se aplicó ninguna simplificación: no se fusionan entidades ni se eliminan RPC para reducir el número de objetos, la cancelación correctiva no se sustituye por el rechazo ordinario, y ninguna opción de simplificación comentada durante la revisión está aprobada. No se añade ningún servicio, paquete, dependencia de infraestructura ni acceso de rol.

## Constitution Check — después del diseño

| Control | Resultado | Cambio respecto de la comprobación inicial |
| --- | --- | --- |
| C1 | Cumple | El diseño final no añade servicios: el vínculo, la auditoría y la numeración caben en Postgres; la evidencia por archivo quedó fuera (DA-02). |
| C2 | Cumple | Las 12 tablas y 14 RPC limitan por `get_user_type() = 0`; F5b se diseñó para **no** hacer visibles importes al colaborador ni al cliente. |
| C3 | Cumple | Pruebas A1–A9 y S1–S21 cubren los cuatro roles en cada tabla y RPC, las altas directas, los privilegios por columna y los privilegios de ejecución de las funciones; no hay Edge Functions. |
| C4 | Cumple | Vectores compartidos (V, D, N y M) y gate por fase; cada fase prueba solo lo que ella crea. |
| C5 | Cumple | Seis migraciones nuevas, ninguna edita una existente; todo paso remoto es del Propietario. |
| C6 | Cumple | Los artefactos usan rutas relativas y datos sintéticos; no incluyen el identificador del proyecto Supabase. |
| C7 | Cumple | Decisiones aprobadas aplicadas y decisiones abiertas listadas como puertas de F5a o bloqueos de F5b; sin tareas ni código; implementación por `/tarea`. |

Revalidado el 2026-11-09 tras aplicar las decisiones aprobadas: la cantidad por precio unitario, los límites, el redondeo y el formato de moneda no añaden servicios, dependencias, rutas ni accesos (C1, C2), y las salvaguardas de DA-06 refuerzan C3.

## Seguimiento de complejidad

| Elemento | Por qué hace falta | Alternativa más simple descartada porque |
| --- | --- | --- |
| 12 tablas nuevas | Cada una modela un hecho que la spec exige separar: catálogo, versión, línea, tramo, hito, familia, secuencia, evento, aceptación, reversión, vínculo, composición | Un `jsonb` único perdería las restricciones de integridad (tramos contiguos, importes ≥ 0, FKs) y las pruebas pgTAP por regla (`research.md` §3, «Alternativas generales») |
| Triggers de inmutabilidad y de estados | Las reglas RF-027/066/072 no pueden depender del cliente | Validar solo en RPC no detectaría un error futuro de una función |
| Dos fases de aceptación/proyecto | La spec y el propietario piden dejar el proyecto para el final y bloqueado | Una sola fase mezclaría una zona delicada con el flujo de aceptación |

No hay violaciones de la constitución que justificar.

## Preparación para `/speckit-tasks`

**Estado: listo para generar las tareas de F1 a F5a.** No queda ninguna decisión que impida escribirlas.

| Fase | Decisiones que necesita | Estado |
| --- | --- | --- |
| F1 | DA-06, DA-13 | Aprobadas |
| F2 | DA-07, DA-14 | Aprobadas |
| F3 | DA-01, DA-05, DA-07, DA-08, DA-12 | Aprobadas |
| F4 | ninguna propia | — |
| F5a | DA-02, DA-09, DA-10, DA-11 | **Puertas de aprobación**: las tareas de F5a se generan con la opción recomendada y llevan como primer paso obtener la aprobación del propietario. Pueden esperar hasta que F4 esté cerrada |
| F5b | DA-03, DA-04 | **Bloqueada**: `/speckit-tasks` la deja como un bloque marcado «bloqueado», sin tareas ejecutables |

Indicaciones para `/speckit-tasks`:

1. Generar F1 a F5a, una fase por PR y por migración (seis migraciones como línea base, contando la de F5b).
2. Respetar la regla de fases de `contracts/acceso-y-rls.md` §3: ninguna tarea de una fase prueba ni usa lo que crea una fase posterior. En particular, las reglas del historial de aceptación y sus pruebas (S11, S21) son de F5a, y las del proyecto vinculado (S12), de F5b.
3. Incluir en F4 la tarea de actualizar a propósito los datos de ejemplo de la prueba de transiciones de F1.
4. Tratar DA-10 como «no habilitada» y conservar la cancelación correctiva (RF-105) dentro de F5a.
5. No generar tareas para simplificaciones no aprobadas ni para nada de la sección «Diferido».

`/speckit-tasks` produce `tasks.md` (insumo del plan de `/tarea`, no orden de ejecución). `/speckit-analyze` revisará la consistencia spec–plan–tareas después.
