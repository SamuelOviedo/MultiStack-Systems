# Lista de calidad de la especificación: Módulo de Cotizaciones del panel administrativo

**Propósito**: validar que la especificación está completa y es de calidad antes de generar las tareas
**Creada**: 2026-11-09
**Funcionalidad**: [spec.md](../spec.md)
**Resultado de la validación**: 9 iteraciones. Tras aplicar las decisiones Q1 = B, Q2 = A, Q3 = A, DP-04, DP-05, DP-06, DP-08 y DP-10, la aprobación final AF-1 a AF-5 y las decisiones DA-01, DA-07, DA-08, DA-12 y DA-14 aprobadas al revisar el plan (2026-11-09), cumplen 31 de 31 elementos (16 del checklist base y 15 de cumplimiento del encargo, la constitución y la verificación final). No queda ningún bloqueo para generar las tareas de F1 a F5a (ver Notas).

## Calidad del contenido

- [x] Sin detalles de implementación (lenguajes, frameworks, APIs). La spec nombra roles, el panel, las rutas y la protección de rutas que el propietario autorizó de forma expresa (DP-10) y las reglas del proyecto, pero no tablas, políticas ni librerías. Las decisiones puramente técnicas (DA-05, DA-06, DA-13) viven en `plan.md`.
- [x] Centrada en el valor para el usuario y las necesidades del negocio.
- [x] Escrita para personas no técnicas (el propietario).
- [x] Todas las secciones obligatorias completadas (escenarios, requisitos, criterios de éxito, supuestos), más «Alcance» y «Decisiones del propietario».

## Completitud de los requisitos

- [x] No quedan marcadores [NEEDS CLARIFICATION]. Los 3 se sustituyeron por las decisiones aprobadas: Q1 = B (RF-039), Q2 = A (RF-040) y Q3 = A (RF-041).
- [x] Los requisitos son comprobables y no ambiguos. Cada uno lleva etiqueta [Confirmado] o [Propuesto] y los escenarios de aceptación los ejercitan.
- [x] Los criterios de éxito son medibles (CE-001 a CE-040).
- [x] Los criterios de éxito son agnósticos de la tecnología.
- [x] Todos los escenarios de aceptación están definidos (8 historias, con Dado/Cuando/Entonces).
- [x] Los casos límite están identificados (52).
- [x] El alcance está claramente delimitado: «Dentro del alcance», «Fuera del alcance (Confirmado)», «Límites de esta etapa de especificación (Confirmado)» y «Diferido más allá de la primera versión».
- [x] Dependencias y supuestos identificados (el módulo Clientes no es prerrequisito, la zona de proyectos, el almacenamiento de archivos que hoy no existe, importes ilustrativos, límites técnicos, formato de moneda propio del módulo, zona horaria).

## Preparación de la funcionalidad

- [x] Todos los requisitos funcionales tienen criterios de aceptación claros, directos (historias) o indirectos (criterios de éxito).
- [x] Los escenarios de usuario cubren los flujos principales: armar y calcular (con cantidad por precio unitario), anticipo y saldo, vista previa, gestión del ciclo de vida, acceso solo de administrador, catálogo, aceptación con vínculo a proyecto, y numeración, revisiones y duplicados.
- [x] La funcionalidad cumple los resultados medibles definidos en los criterios de éxito.
- [x] No se filtran detalles de implementación en la spec.

## Cumplimiento del encargo y de la constitución

- [x] Redactada íntegramente en español. Se conservan como convención las palabras normativas MUST y MUST NOT y los identificadores.
- [x] Distingue lo confirmado de lo propuesto en cada requisito e indica qué decisión (Q1, Q2, Q3, DP-04, DP-05, DP-06, DP-08, DP-10, AF-1 a AF-5 o DA-01, DA-07, DA-08, DA-12, DA-14) confirma cada uno.
- [x] No inventa precios, tasas de impuesto, porcentajes, permisos ni reglas de negocio: los importes de los ejemplos están declarados como ilustrativos, el catálogo no trae precios precargados, no hay tasas ni plazos de retención, y los límites de RF-121 son topes técnicos aprobados por el propietario, no una política comercial.
- [x] Panel solo para administrador: ningún acceso nuevo para colaboradores ni clientes (RF-001 a RF-003, RF-051, RF-058, Historia 5).
- [x] Reglas de los Términos del Servicio incorporadas: validez de 15 días calendario, propuesta aprobada y firmada antes de empezar, mantenimiento mensual por adelantado, desarrollo en hitos acordados, precios sin impuestos.
- [x] Decisiones registradas. Aprobadas: DP-01 a DP-10 (con Q1, Q2 y Q3), AF-1 a AF-5 y DA-01, DA-07, DA-08, DA-12 y DA-14. Lo que queda es una puerta de aprobación de una fase (DA-02, DA-09, DA-10, DA-11; DA-03 y DA-04), un detalle para el plan (DP-07 y DP-09, resto) o está diferido o requiere aprobación aparte (DP-02 resto, DP-11 y DP-12), todo en «Pendientes y diferidos».
- [x] Aprobación final aplicada a los requisitos (RF-005, RF-018, RF-019, RF-021, RF-042, RF-051, RF-052, RF-055, RF-062, RF-068, RF-069, RF-071, RF-072, RF-080, RF-083, RF-085, RF-086, RF-096 a RF-099 y RF-104 a RF-114), las historias (1, 2, 4, 6, 7 y 8), los casos límite, las entidades, el alcance, las tablas de decisiones y los criterios de éxito (CE-028 a CE-035).
- [x] Decisiones aprobadas al revisar el plan aplicadas: cantidad por precio unitario (RF-008, RF-010, RF-076, RF-078, RF-089, RF-107, RF-108 y RF-115 a RF-120), límites (RF-015, RF-121), redondeo (RF-014, RF-122), condiciones de pago del cargo único (RF-110) y presentación de la moneda (RF-012, RF-123); en las historias 1, 2, 3, 6 y 8, los casos límite, las entidades, el alcance, las tablas de decisiones y los criterios de éxito (CE-031 y CE-036 a CE-040).
- [x] Sin contradicciones con lo aprobado: no hay doble camino de cancelación (un historial de aceptación solo se cancela con el procedimiento correctivo separado, que no se sustituye por el rechazo), la revisión tras una aceptación revertida no se habilita sin aprobación (DA-10), los borradores no se eliminan sino que se cancelan, la revisión no extiende la vigencia, el anticipo sin hitos tiene un saldo único con condiciones explícitas haya o no anticipo, «vencida», «sustituida» y «archivada» no son estados, un módulo incluido no se cobra dos veces sea cual sea su cantidad, y no hay cálculo de impuestos ni descuentos automáticos.
- [x] Identificadores `RF-` y `CE-` conservados (RF-001 a RF-123 sin huecos, CE-001 a CE-040); la spec anota su equivalencia con `FR-` y `SC-` de las plantillas de Spec Kit.
- [x] Marcadores [NEEDS CLARIFICATION]: 0 (el máximo era 3).
- [x] Sin datos personales, secretos, rutas absolutas ni contenido de documentación privada.
- [x] Fuera del alcance respetado: sin pasarelas de pago, pagos en línea, envío de correos, conversión de moneda, firma electrónica, creación automática de proyectos, módulo de clientes, impuestos calculados, descuentos automáticos, cantidades fraccionarias ni cambios de formato en otros módulos. En esta etapa tampoco hay código, cambios de base de datos, ramas de git, commits ni despliegue.
- [x] La constitución y `CLAUDE.md` siguen siendo la autoridad: ninguna regla de la spec amplía accesos, añade rutas más allá de las tres autorizadas, ni introduce servicios, paquetes ni infraestructura.
- [x] Coherencia entre artefactos comprobada (spec, plan, investigación, modelo de datos, contratos y guía de validación): toda referencia a `RF-` y `CE-` existe; los vectores V-01 a V-36, M-01 a M-06, D-01 a D-08 y N-01 a N-05 y las pruebas S1 a S21 están definidos donde se citan; los nombres de función son los 14 de la lista canónica; la aritmética de los vectores se recalculó; y ninguna fase prueba lo que crea una fase posterior.

## Notas

- El propietario aprobó las decisiones el 2026-11-09 en la sesión de aclaración, en la aprobación final y al revisar la arquitectura del plan. No queda ningún bloqueo para generar las tareas de F1 a F5a.
- **Puertas de aprobación de F5a** (no impiden generar las tareas; se resuelven antes de implementar esa fase): DA-02 (evidencia por referencia o por archivo), DA-09 (asociación con un registro formal de cliente), DA-10 (revisión tras una aceptación revertida; por defecto no se ofrece) y DA-11 (procedimiento concreto de la cancelación correctiva, que se conserva como requisito).
- **F5b sigue bloqueada** por DA-03 (relación entre cotizaciones y proyectos) y DA-04 (qué pasa al proyecto).
- Para la implementación (no son bloqueos): ejecutar `codegraph impact` y leer la sección Riesgos de `docs/context/PROJECT_CONTEXT.md` antes de tocar el menú del panel, `ProtectedRoute` o la zona de proyectos; actualizar las pruebas del menú que hoy fijan el número de pantallas y entradas.
- Diferido o con aprobación aparte: descuentos (automáticos y manuales), entrega del documento al cliente y PDF, dependencias entre módulos, cantidades fraccionarias y el plazo de retención de los registros.
- Siguiente paso: que el propietario invoque `/speckit-tasks` cuando lo decida.
