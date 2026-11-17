# Especificación de funcionalidad: Módulo de Cotizaciones del panel administrativo

**Identificador de la spec**: `002-admin-quotations` (nombra la carpeta en `specs/`; no es el nombre de una rama de git)

**Creada**: 2026-11-09

**Estado**: Lista para generar tareas — decisiones Q1, Q2, Q3, DP-04, DP-05, DP-06, DP-08 y DP-10, la aprobación final AF-1 a AF-5 y, al revisar el plan técnico, las decisiones DA-01, DA-07, DA-08, DA-12 y DA-14, aprobadas por el propietario el 2026-11-09. Lo que queda abierto es una puerta de aprobación de una fase concreta o está diferido más allá de la primera versión (ver «Pendientes y diferidos»). Nada se implementa hasta que el propietario lo autorice.

**Entrada**: «Definir el módulo de Cotizaciones de MultiStack Systems dentro del Centro de Operaciones administrativo. La primera versión debe permitir al administrador crear, editar, calcular, previsualizar y gestionar cotizaciones de clientes: paquetes de servicio, módulos opcionales, líneas definidas a mano cuando corresponda, cargos únicos, anticipos, saldos restantes y cuotas recurrentes mostradas por separado. Importes mostrados en HNL, sin asumir si los precios del catálogo se mantienen en HNL o se convierten desde USD.»

**Decisiones aprobadas después del encargo** (2026-11-09): Q1 = B, Q2 = A y Q3 = A, más DP-10, DP-06, DP-05, DP-08 y DP-04 en la sesión de aclaración, y la aprobación final AF-1 a AF-5. Sustituyen lo que la entrada dejaba abierto sobre clientes, catálogo, moneda, aceptación, proyectos, ubicación en el menú, ciclo de vida de la cotización, anticipos, hitos, cobros recurrentes, numeración, revisiones, duplicados e impuestos (la entrada decía «Centro de Operaciones»; DP-10 la sitúa en «Gestión comercial»). Al revisar el plan técnico el propietario aprobó además la cantidad por precio unitario (DA-08), el redondeo del anticipo (DA-01), los límites (DA-07), las condiciones de pago del cargo único (DA-12) y la presentación de la moneda (DA-14). El detalle está en «Decisiones del propietario».

## Clarificaciones

### Sesión 2026-11-09

- Q: ¿En qué grupo del menú del panel aparece «Cotizaciones» y qué rutas nuevas se autorizan? → A: Opción B. Entrada «Cotizaciones» en el grupo «Gestión comercial», solo administrador. Tres rutas nuevas autorizadas de forma expresa por el propietario, todas de acceso solo administrador: `/dashboard/cotizaciones` (listado y gestión), `/dashboard/cotizaciones/:id` (detalle, edición y vista previa) y `/dashboard/cotizaciones/catalogo` (catálogo de paquetes y módulos). Se conservan la protección de rutas con `allowedTypes={[0]}`, las restricciones de navegación por rol y el modelo de autorización actual; ningún acceso para colaboradores ni clientes. La ruta fija `/catalogo` debe resolverse correctamente junto a la dinámica `/:id`. (DP-10; RF-056 a RF-061)
- Q: ¿Qué estados tiene una cotización, cuándo vence y qué se puede hacer con una cotización vencida o con una aceptación registrada por error? → A: Opción A con correcciones del propietario. Estados: Borrador, Emitida, Aceptada y firmada, Rechazada y Cancelada. «Vencida» no es un estado: es una condición derivada de la fecha, y la cotización sigue «Emitida» con un indicador de vencida. Vigencia de 15 días calendario desde la emisión, en hora de Honduras, con una fecha exacta única y sin un día adicional. Una cotización vencida no se acepta ni se reactiva: se duplica en un borrador nuevo y se emite una cotización nueva, conservando el original y su historial (la política de precios del duplicado está en DP-08, RF-088 a RF-091). La aceptación solo vale sobre una cotización emitida, no vencida y con la evidencia de la propuesta firmada. Una aceptación por error se revierte con motivo obligatorio y registro de auditoría inmutable (quién, cuándo y por qué), conservando el registro y la evidencia originales; la cotización vuelve a «Emitida» (si ya venció, queda emitida, marcada como vencida y sin poder aceptarse de nuevo). Si ya hay un proyecto vinculado, la reversión no es automática: se señala para una revisión administrativa controlada aparte. «Cancelada» es terminal y exige un motivo. Rechazada y Cancelada no se reactivan en silencio. Archivar es un atributo de organización, no un estado. (DP-06; RF-023 a RF-027 y RF-062 a RF-072)
- Q: Confirmación de tres lecturas de DP-06 → A: (1) El día de emisión cuenta como día 1: una cotización emitida el 1 de noviembre es válida hasta el 15 de noviembre y vence a las 00:00 del 16 de noviembre, en la zona horaria `America/Tegucigalpa`. (2) Se puede cancelar desde Borrador o desde Emitida, solo con motivo obligatorio; una cotización Aceptada y firmada no se cancela directamente y requiere un procedimiento administrativo controlado aparte. (3) Se puede rechazar solo desde Emitida, con motivo registrado. Rechazada y Cancelada no se reactivan en silencio. (DP-06; RF-062, RF-069, RF-070, RF-072)
- Q: ¿Cómo se define el anticipo, qué relación tiene con los hitos y qué periodicidades de cobro recurrente existen? → A: Opción D personalizada (combina B y A, con periodicidades mensual y anual). Anticipo: monto fijo en HNL o porcentaje del total único, a elección del administrador, sin valor por defecto, entre cero y el total único (ambos incluidos), con cálculo y redondeo consistentes a dos decimales. El anticipo es el primer hito de pago; el anticipo más los demás hitos suman exactamente el total único y el anticipo nunca se cuenta dos veces; lo recurrente queda fuera de esas sumas. Servicios recurrentes: periodicidad mensual o anual por servicio; el mantenimiento mensual se factura por adelantado y las condiciones de pago anual se declaran de forma explícita en la cotización; el administrador define fecha de inicio, tarifas y condiciones de renovación; se pueden documentar tramos de tarifa mensual por rango de meses sin inventar importes; sin pagos, facturas, renovaciones ni pasarela automáticos; sin prorrateo automático (todo ajuste del primer período lo define el administrador). (DP-05; RF-009, RF-010, RF-014 y RF-016 a RF-020, RF-073 a RF-079)
- Q: ¿Cómo se numeran las cotizaciones, qué pasa cuando hay que cambiar una ya emitida y con qué precios arranca un duplicado? → A: Opción A con salvaguardas de coherencia. Número `COT-AAAA-NNNN`, con el año del calendario de `America/Tegucigalpa`, secuencia que se reinicia cada año y se asigna solo en la primera emisión; los borradores no reciben número definitivo y los números son únicos, permanentes y nunca se reutilizan. Revisiones con sufijo `-R1`, `-R2` bajo el número de la original; las versiones emitidas son inmutables (datos del cliente, precios, condiciones y fechas de emisión); la revisión parte de los precios originales y admite cambios explícitos del administrador; al emitirla recibe sus propios 15 días calendario y la versión anterior queda «sustituida», disponible para auditoría y sin poder aceptarse. No se revisan en silencio las cotizaciones vencidas, rechazadas, canceladas ni aceptadas y firmadas. Un duplicado es un borrador nuevo con referencia a su origen y número nuevo e independiente al emitirlo: los elementos del catálogo usan los precios vigentes en HNL, las líneas manuales conservan sus precios y deben revisarse de forma explícita antes de emitir, el original y sus precios históricos no cambian, y se muestra qué precios cambiaron y cuáles se conservaron. En duplicados y revisiones se revalidan anticipo, hitos, recurrentes y tramos; se conserva el modo del anticipo y se recalcula o se señala para confirmar si cambia el total único; nunca se emite con inconsistencias financieras sin resolver. (DP-08; RF-027, RF-028, RF-034 y RF-080 a RF-100)
- Q: ¿La cotización solo debe decir que los importes no incluyen impuestos, o también debe calcular y mostrar el impuesto? → A: Opción A con aclaraciones. Todos los importes están en HNL y excluyen impuestos. Toda cotización dirigida al cliente muestra de forma destacada el aviso exacto «Los importes no incluyen impuestos». El módulo no calcula montos de impuesto, no configura tasas, no infiere exenciones y no presenta un total con impuestos incluidos; el total de la cotización se rotula como sin impuestos para que el cliente no lo confunda con el monto final de una factura fiscal. Anticipo, hitos, saldo y recurrentes se calculan sobre los importes cotizados sin impuestos. La evaluación real de impuestos, la facturación fiscal y las obligaciones tributarias quedan fuera de esta primera versión, sin dar a entender que los impuestos estén exentos o que nunca apliquen. No se inventan porcentajes, exenciones, requisitos fiscales ni políticas comerciales. (DP-04; RF-021, RF-022 y RF-101 a RF-103)
- Q: Aprobación final, sección 1: ¿qué salvaguardas rigen el ciclo de vida (cancelación, reversión, borradores, versiones sustituidas y archivado)? → A: Una cotización con cualquier historial de aceptación no se cancela por el flujo ordinario de cancelación, ni siquiera tras revertir la aceptación; una aceptación errónea se corrige con la reversión auditada ya aprobada, y cualquier cancelación correctiva posterior exige un procedimiento separado, explícito y controlado por el administrador, con justificación obligatoria e historial de auditoría inmutable. Una cotización con proyecto vinculado no puede tener su aceptación revertida de forma automática. Los borradores se cancelan con motivo y no se eliminan de forma permanente desde la interfaz normal. Las versiones sustituidas no se aceptan, rechazan, cancelan ni revisan. Solo el administrador archiva y desarchiva, y archivar nunca cambia el estado comercial. (AF-1; RF-005, RF-068, RF-069, RF-071, RF-072, RF-086 y RF-104 a RF-106)
- Q: Aprobación final, sección 2: ¿cómo se aplican la vigencia y las revisiones? → A: Se conserva la vigencia de 15 fechas calendario en `America/Tegucigalpa`, contando el día de emisión como el día uno, sin afirmar que garantiza 15 períodos completos de 24 horas. Cada revisión emitida de forma explícita tiene su propia vigencia e historial inmutable; emitirla sustituye a la anterior y la vigencia nunca se extiende de forma automática. Las cotizaciones vencidas se duplican, no se revisan ni se reactivan. (AF-2; RF-062, RF-085 y RF-109)
- Q: Aprobación final, sección 3: ¿qué reglas financieras definitivas rigen la primera versión? → A: El administrador decide por cotización si hacen falta hitos de desarrollo adicionales; sin ellos, el saldo restante es una única obligación de pago bajo condiciones acordadas de forma explícita. Un anticipo positivo es el primer hito y no se cuenta dos veces; un anticipo en cero no crea un hito visible. Se conserva la conciliación exacta de todos los pagos únicos y su separación de los recurrentes. Fuera de la primera versión: cálculo de impuestos, facturación automática, procesamiento de pagos y descuentos automáticos. El aviso de impuestos aprobado va junto a los totales dirigidos al cliente. (AF-3; RF-018, RF-019, RF-021, RF-110, RF-111 y RF-113)
- Q: Aprobación final, sección 4: ¿se aprueban las salvaguardas de revisión y duplicado propuestas en DP-08 y cómo crece la secuencia? → A: Se aprueban las seis: una revisión en borrador no puede emitirse si su origen ya no es elegible; solo una revisión en borrador por familia de cotización; los elementos retirados del catálogo bloquean emitir un duplicado hasta resolverlos; los duplicados heredan una instantánea editable del prospecto; las revisiones emitidas en años posteriores conservan el identificador y el año de la original; solo se revisa la versión emitida más reciente, elegible y no sustituida. Los cuatro dígitos de `COT-AAAA-NNNN` son un mínimo: la numeración continúa de forma secuencial más allá de 9999 sin colisiones. (AF-4; RF-080, RF-083 y RF-096 a RF-099)
- Q: Aprobación final, sección 5: ¿qué decisiones restantes de la primera versión se cierran? → A: Mínimo del prospecto: nombre de persona o empresa más al menos un medio de contacto. Aceptación firmada: se guarda o se referencia de forma segura el documento firmado, con acceso solo del administrador y metadatos de aceptación auditables, sin firma electrónica. Proyectos: creación o vinculación explícita y controlada por el administrador, conservando la instantánea original de la cotización y transfiriendo solo la información necesaria de cliente, alcance y finanzas; sin creación automática de proyectos, ampliación de roles, envío de correos ni cobro de pagos. La composición de paquetes y módulos no puede cobrar un componente dos veces, y un cambio de precio del catálogo que afecte a un borrador exige una revisión explícita del administrador, sin repreciar en silencio. Los descuentos automáticos quedan diferidos. Los registros históricos se conservan de forma segura sin inventar un plazo de retención ni de eliminación; cualquier obligación legal de retención se somete a una aprobación aparte. (AF-5; RF-042, RF-051, RF-052, RF-055, RF-106 a RF-108, RF-112 a RF-114)

### Sesión 2026-11-09 — aprobación de la arquitectura del plan

- Q: ¿Cada línea es un importe o lleva cantidad y precio unitario? → A: Cantidad entera por precio unitario en HNL desde la primera versión. La cantidad es 1 por defecto y va de 1 a 9,999. Se aplica a las líneas de cargo único y a las de servicio recurrente; los tramos de tarifa expresan un precio por unidad y por período, y la cantidad de la línea es la misma en todos los tramos. El importe de la línea lo calcula el sistema. Las comparaciones con el catálogo y las de un duplicado se hacen por precio unitario. Un módulo incluido en un paquete no se cobra dos veces, y las unidades adicionales de ese módulo exigen una línea facturable explícita, nunca un cargo automático. El ajuste del primer período acordado a mano se aplica una vez a toda la línea, no una vez por unidad. Las cantidades fraccionarias y la facturación por horas con fracciones quedan diferidas. (DA-08; RF-008, RF-010, RF-076, RF-078, RF-089, RF-090, RF-107, RF-108 y RF-115 a RF-120)
- Q: ¿Qué límites tienen los importes y las cantidades? → A: Máximo de L 99,999,999.99 por línea, L 999,999,999.99 por total de la cotización, 100 líneas y 12 tramos de tarifa por servicio, y cantidad entera de 1 a 9,999. Se validan por separado la cantidad por el precio unitario, el importe de cada línea y el total de la cotización, y una operación que supera un límite se rechaza antes de emitir y antes de calcular un anticipo en porcentaje. (DA-07; RF-015, RF-121)
- Q: ¿Cómo se redondea el anticipo en porcentaje? → A: Redondeo decimal mitad hacia arriba a dos decimales de HNL, con aritmética exacta en centavos y una representación documentada del porcentaje, sin errores de coma flotante. (DA-01; RF-014, RF-122)
- Q: ¿Se exigen condiciones de pago cuando no hay anticipo ni hitos? → A: Sí. Los cargos únicos exigen condiciones de pago explícitas aunque no se haya configurado un anticipo ni hitos adicionales. (DA-12; RF-110)
- Q: ¿Cómo se muestran y se capturan los importes? → A: La aplicación no tenía una convención propia para lempiras, así que se usa `L 1,250.00` y una captura decimal sin ambigüedad como `1250.00`. La interpretación es determinista, exacta al centavo, probada e independiente de la configuración regional del navegador, y no cambia el formato de los demás módulos. (DA-14; RF-012, RF-123)
- Q: ¿Se puede revisar una cotización emitida que volvió de una aceptación revertida? → A: No se habilita en silencio. Mientras el propietario no lo apruebe de forma expresa, el módulo no ofrece esa revisión; la cotización se puede duplicar. (DA-10, pendiente; RF-083)

## Cómo leer esta spec

Cada requisito lleva una etiqueta de procedencia, para que el propietario sepa qué ya está decidido y qué se está proponiendo:

- **[Confirmado]**: sale del encargo del propietario, de una decisión que él aprobó después (se indica cuál: Q1, Q2, Q3, DP-04, DP-05, DP-06, DP-08, DP-10, la aprobación final AF-1 a AF-5 o las decisiones DA-01, DA-07, DA-08, DA-12 y DA-14 aprobadas al revisar el plan), de los Términos del Servicio vigentes (sección 4 de la página pública de términos), de `CLAUDE.md` o de la constitución del proyecto.
- **[Propuesto]**: comportamiento razonable que esta spec sugiere para que la funcionalidad sea completa y comprobable. **No está decidido**: el propietario lo aprueba, lo cambia o lo descarta al revisar.

Lo que el propietario ya aprobó y todo lo que aún no ha decidido están en la sección «Decisiones del propietario». Sobre lo pendiente, la spec no inventa precios, tasas de impuesto, porcentajes, permisos ni reglas de negocio.

**Identificadores**: `RF-###` es un requisito funcional y `CE-###` un criterio de éxito; equivalen a los `FR-###` y `SC-###` de las plantillas de Spec Kit. `DP-##` es una decisión del propietario. `AF-1` a `AF-5` son las cinco secciones de la aprobación final del propietario (1 ciclo de vida, 2 vigencia y revisiones, 3 reglas financieras, 4 salvaguardas de revisión y duplicado, 5 decisiones restantes de la primera versión). `DA-##` es una decisión de arquitectura o de cálculo tomada al revisar el plan técnico; esta spec solo recoge las que cambian una regla visible para el negocio, y las demás viven en `plan.md`.

**Notación de importes**: los importes se escriben como los muestra el módulo, `L 1,250.00` (coma de miles y punto decimal, RF-123). Los porcentajes usan también el punto decimal.

## Escenarios de usuario y pruebas *(obligatorio)*

El único actor de este módulo es el **administrador** (rol 0). Colaboradores, clientes y visitantes anónimos no son actores: no ven ni usan nada de Cotizaciones **[Confirmado]**.

### Historia 1 — Armar y calcular una cotización (Prioridad: P1)

El administrador crea una cotización para un cliente o para un prospecto, sin que haga falta un registro de cliente ni un proyecto previos. Elige un paquete de servicio del catálogo, añade módulos opcionales y, si hace falta, líneas definidas a mano. Cada línea lleva una cantidad entera y un precio unitario. Agrega cargos únicos y una cuota recurrente (por ejemplo, mantenimiento mensual). El sistema calcula el importe de cada línea y los totales y los muestra en HNL, con lo único y lo recurrente en bloques separados.

**Por qué esta prioridad**: sin una cotización que se pueda armar y calcular sin errores, el resto del módulo no tiene valor. Es el MVP: por sí sola ya sustituye el cálculo manual.

**Prueba independiente**: se crea una cotización de ejemplo con un paquete, un módulo opcional, una línea manual, un cargo único y una cuota recurrente, y se verifica que los totales mostrados coinciden con la suma de las líneas mostradas, que lo recurrente no se suma al total único y que todo está en HNL.

**Escenarios de aceptación**:

1. **Dado** una cotización en borrador con un paquete de L 1,000.00 y un módulo opcional de L 250.00, **Cuando** el administrador incluye el módulo, **Entonces** el subtotal único es L 1,250.00; si lo quita, vuelve a L 1,000.00. *(Importes ilustrativos de prueba; no son precios del catálogo.)*
2. **Dado** una cotización con una cuota recurrente mensual, **Cuando** se calculan los totales, **Entonces** la cuota aparece en su propio bloque «Recurrente», rotulada con su periodicidad, y nunca se suma al total único.
3. **Dado** una línea manual sin descripción o sin precio unitario, **Cuando** el administrador intenta guardarla, **Entonces** el sistema lo impide y explica en español qué falta.
4. **Dado** una cotización con cualquier combinación de líneas, **Cuando** se muestran los importes, **Entonces** cada total visible equivale exactamente a la suma de las líneas visibles (sin diferencias de redondeo a la vista) **[Propuesto]**.
5. **Dado** un precio unitario fuera de rango (negativo en una línea manual, no numérico, vacío o con más de dos decimales), **Cuando** se intenta guardar, **Entonces** se rechaza con un mensaje claro en español **[Confirmado — DA-07]**.
6. **Dado** un prospecto sin registro de cliente ni proyecto, **Cuando** el administrador crea la cotización y captura sus datos de contacto, **Entonces** la cotización se guarda y puede emitirse sin crear ningún registro de cliente ni proyecto **[Confirmado — Q1 = B]**.
7. **Dado** una cotización emitida, **Cuando** más adelante cambian los datos de ese cliente o la cotización se asocia a un registro formal de cliente, **Entonces** la cotización conserva los datos de cliente con que se emitió **[Confirmado — Q1 = B]**.
8. **Dado** un prospecto sin nombre de persona o empresa, o sin ningún medio de contacto, **Cuando** el administrador intenta emitir la cotización, **Entonces** el sistema lo impide y explica qué falta; con el nombre y al menos un medio de contacto puede emitirla **[Confirmado — AF-5]**.
9. **Dado** una cotización con un paquete y un módulo que ese paquete ya incluye, **Cuando** el administrador añade ese módulo, **Entonces** el módulo no suma un cargo adicional: se muestra como incluido en el paquete y el total no cuenta el mismo componente dos veces **[Confirmado — AF-5]**.
10. **Dado** una línea con un precio unitario de L 250.00, **Cuando** el administrador fija la cantidad en 3, **Entonces** el importe de la línea es L 750.00 y el total único lo refleja; una línea nueva nace con cantidad 1 **[Confirmado — DA-08]**. *(Importes ilustrativos.)*
11. **Dado** una cantidad igual a cero, negativa, con decimales o mayor que 9,999, **Cuando** el administrador intenta guardarla, **Entonces** el sistema la rechaza con un mensaje claro en español **[Confirmado — DA-07 y DA-08]**.
12. **Dado** un servicio recurrente mensual con cantidad 5 y una tarifa de L 100.00 por unidad, **Cuando** se calcula, **Entonces** el importe mensual de la línea es L 500.00; si el servicio tiene tramos, cada tramo expresa el precio por unidad y por período y la misma cantidad se aplica a todos **[Confirmado — DA-08]**. *(Importes ilustrativos.)*
13. **Dado** un paquete que ya incluye un módulo, **Cuando** el administrador necesita cobrar unidades adicionales de ese módulo, **Entonces** las añade en una línea facturable explícita, marcada como unidades adicionales; el sistema nunca genera ese cargo por su cuenta ni cobra el módulo incluido **[Confirmado — DA-08]**.
14. **Dado** una línea cuyo importe (cantidad por precio unitario) supera L 99,999,999.99, o una cotización cuyo total supera L 999,999,999.99, **Cuando** el administrador intenta guardar el cambio, **Entonces** el sistema lo rechaza con un mensaje claro y no calcula ningún anticipo en porcentaje sobre ese total **[Confirmado — DA-07]**.

---

### Historia 2 — Anticipo, saldo y plan de pagos por hitos (Prioridad: P1)

El administrador define el anticipo de la cotización (un monto fijo en HNL o un porcentaje del total único) y el sistema muestra el saldo restante. Un anticipo positivo es el primer hito de pago; el administrador decide, cotización por cotización, si hacen falta más hitos de desarrollo o si el resto se paga en un único pago.

**Por qué esta prioridad**: los Términos del Servicio establecen que el desarrollo se factura en hitos acordados; una cotización sin anticipo, saldo y hitos no sirve para cerrar un trato.

**Prueba independiente**: sobre una cotización con total único conocido, se registra un anticipo (monto y porcentaje) y se verifica el saldo; se definen hitos y se verifica que anticipo más hitos suman exactamente el total único, sin contar el anticipo dos veces.

**Escenarios de aceptación**:

1. **Dado** un total único de L 1,250.00, **Cuando** el administrador fija un anticipo de L 400.00, **Entonces** el saldo restante mostrado es L 850.00 **[Confirmado — DP-05]**. *(Importes ilustrativos.)*
2. **Dado** un total único de L 1,000.00, **Cuando** el administrador fija el anticipo como un porcentaje del total único, **Entonces** el sistema muestra el monto resultante en HNL con dos decimales (por ejemplo, 40 % da L 400.00) y usa ese monto en todos los cálculos **[Confirmado — DP-05]**. Si el cálculo no da centavos exactos, se redondea a dos decimales con la regla «mitad hacia arriba» (por ejemplo, 5 % de L 0.10 da L 0.01) **[Confirmado — DA-01]**. *(Valores de prueba ilustrativos; no son una política de anticipo.)*
3. **Dado** un anticipo menor que cero o mayor que el total único, **Cuando** se intenta guardar, **Entonces** se rechaza con un mensaje claro; el cero y el total único completo son valores válidos **[Confirmado — DP-05]**.
4. **Dado** una cotización con hitos adicionales y un anticipo positivo, **Cuando** el administrador define los hitos, **Entonces** el anticipo aparece como el primer hito y, con los demás hitos, suma exactamente el total único; si no cuadra, el sistema lo señala y no permite emitir la cotización hasta corregirlo **[Confirmado — DP-05]**.
5. **Dado** un plan con anticipo y otros hitos, **Cuando** se calcula el plan de pagos, **Entonces** el anticipo se cuenta una sola vez: no hay un hito de anticipo adicional dentro de los demás hitos **[Confirmado — DP-05]**.
6. **Dado** una cotización sin anticipo definido, **Cuando** se previsualiza, **Entonces** el documento no muestra anticipo ni saldo inventados: solo lo que el administrador definió; el sistema no propone ningún monto ni porcentaje por defecto **[Confirmado — DP-05]**.
7. **Dado** una cotización con cargos recurrentes, **Cuando** se calculan el anticipo, el saldo y los hitos, **Entonces** los cargos recurrentes no entran en ninguna de esas sumas **[Confirmado — DP-05]**.
8. **Dado** un servicio recurrente mensual, **Cuando** se muestra, **Entonces** el documento indica que se factura por adelantado **[Confirmado]**.
9. **Dado** un servicio recurrente anual, **Cuando** el administrador intenta emitir la cotización sin declarar sus condiciones de pago anual, **Entonces** el sistema lo impide y explica qué falta **[Confirmado — DP-05]**.
10. **Dado** un servicio recurrente, **Cuando** el administrador lo define, **Entonces** indica la periodicidad (mensual o anual), la fecha de inicio, las tarifas y las condiciones de renovación; el sistema no propone ningún valor **[Confirmado — DP-05]**.
11. **Dado** un servicio mensual con tramos de tarifa (por ejemplo, meses 1 a 3, 4 a 6 y 7 en adelante), **Cuando** el administrador los define, **Entonces** el documento muestra cada tramo con su rango de meses y su tarifa; los rangos no se superponen ni dejan meses sin cubrir, y el último puede quedar abierto «en adelante» **[Confirmado — DP-05]**. *(Rangos de ejemplo; los importes los escribe el administrador.)*
12. **Dado** un servicio recurrente que empieza a mitad de un período, **Cuando** se calcula el primer cobro, **Entonces** el sistema no prorratea nada: usa el importe del primer período que el administrador haya definido de forma explícita (con su descripción) o, si no lo definió, la tarifa completa **[Confirmado — DP-05]**. Ese ajuste se aplica una sola vez a toda la línea, no una vez por unidad **[Confirmado — DA-08]**.
13. **Dado** cualquier cotización con recurrentes, **Cuando** se completa o se acepta, **Entonces** el módulo no cobra, no factura, no renueva ni conecta con ninguna pasarela de pago **[Confirmado — DP-05]**.
14. **Dado** una cotización sin hitos adicionales y con saldo restante mayor que cero, **Cuando** el administrador la prepara para emitir, **Entonces** el saldo se presenta como una única obligación de pago con las condiciones acordadas que el administrador escribe de forma explícita; sin ellas no puede emitirse **[Confirmado — AF-3]**. Lo mismo vale cuando no se definió ningún anticipo: el cargo único completo exige sus condiciones de pago **[Confirmado — DA-12]**.
15. **Dado** un anticipo igual a cero, **Cuando** se muestra el plan de pagos, **Entonces** no aparece ningún hito de pago de anticipo y, si hay hitos adicionales, estos suman el total único **[Confirmado — AF-3]**.
16. **Dado** una cotización con anticipo, saldo único o hitos, **Cuando** se emite, **Entonces** todos los pagos únicos concilian exactamente con el total único y los recurrentes siguen fuera de esa cuenta **[Confirmado — AF-3]**.

---

### Historia 3 — Previsualizar la cotización como la vería el cliente (Prioridad: P2)

El administrador abre una vista previa del documento con el aspecto y el contenido que tendría para el cliente, antes de emitirla.

**Por qué esta prioridad**: permite revisar el documento antes de comprometerse con él; depende de la Historia 1.

**Prueba independiente**: con una cotización armada, se abre la vista previa y se comprueba que muestra todos los bloques, los importes en HNL y las condiciones obligatorias.

**Escenarios de aceptación**:

1. **Dado** una cotización armada, **Cuando** el administrador abre la vista previa, **Entonces** ve: datos del cliente o prospecto tal como los guarda la cotización, líneas (con su cantidad, su precio unitario y su importe), subtotales, total único, anticipo y saldo (si existen), cuota recurrente por separado, vigencia y condiciones.
2. **Dado** cualquier vista previa, **Cuando** se lee, **Entonces** muestra de forma destacada el aviso exacto «Los importes no incluyen impuestos» **[Confirmado — DP-04]** y que la cotización tiene validez de 15 días calendario desde su emisión **[Confirmado]**; si ya fue emitida, muestra la fecha exacta «Válida hasta» calculada según RF-062 **[Confirmado — DP-06]**.
3. **Dado** una cotización en borrador, **Cuando** se previsualiza, **Entonces** se distingue claramente como borrador y sin vigencia calculada todavía **[Propuesto]**.
4. **Dado** que la vista previa se abre, **Cuando** el administrador la cierra, **Entonces** no se envía nada a nadie: ningún correo ni notificación sale desde este módulo **[Confirmado]**.
5. **Dado** cualquier cotización (en borrador, emitida o de cualquier estado), **Cuando** se muestra al cliente o en la vista previa, **Entonces** el total único se rotula como sin impuestos, y no existe ningún total con impuestos incluidos **[Confirmado — DP-04]**.
6. **Dado** cualquier pantalla, vista previa o documento del módulo, **Cuando** se revisa, **Entonces** no hay campos, líneas, tasas ni montos de impuesto calculados por el módulo, ni exenciones inferidas, ni texto que dé a entender que los impuestos están exentos o que nunca aplican **[Confirmado — DP-04]**.
7. **Dado** una cotización con anticipo, hitos, saldo y cargos recurrentes, **Cuando** se calculan, **Entonces** todos se calculan sobre los importes cotizados sin impuestos **[Confirmado — DP-04]**.
8. **Dado** cualquier importe del módulo (lista, detalle, catálogo o vista previa), **Cuando** se muestra, **Entonces** aparece con el formato `L 1,250.00`: símbolo «L», coma de miles, punto decimal y siempre dos decimales **[Confirmado — DA-14]**.

---

### Historia 4 — Gestionar el ciclo de vida de las cotizaciones (Prioridad: P2)

El administrador lista, busca, filtra y abre cotizaciones; las emite, las duplica o las archiva; y registra su desenlace: Aceptada y firmada, Rechazada o Cancelada. Una cotización emitida cuya vigencia terminó sigue «Emitida» y muestra un indicador de vencida. El registro de la aceptación y su reversión se detallan en la Historia 7.

**Por qué esta prioridad**: sin gestión, las cotizaciones se pierden y no se sabe cuáles siguen vigentes; depende de las Historias 1 y 2.

**Prueba independiente**: se crean varias cotizaciones en distintos estados y se verifica que el listado las muestra, filtra y ordena correctamente, y que las transiciones respetan las reglas.

**Escenarios de aceptación**:

1. **Dado** varias cotizaciones, **Cuando** el administrador abre el listado, **Entonces** ve identificador, cliente, total único, cuota recurrente, estado y fecha de vigencia, y puede filtrar por estado y buscar por cliente o identificador **[Propuesto]**.
2. **Dado** una cotización «Emitida» cuya fecha «Válida hasta» ya pasó, **Cuando** el administrador la consulta, **Entonces** sigue en estado «Emitida», muestra el indicador de vencida, no se presenta como vigente y no puede aceptarse **[Confirmado — DP-06]**.
3. **Dado** una cotización con el indicador de vencida, **Cuando** el administrador quiere retomarla, **Entonces** la duplica en un borrador nuevo y emite una cotización nueva; la original se conserva con su historial. El módulo no ofrece reactivarla ni extender su vigencia **[Confirmado — DP-06]**. La política de precios del duplicado está en DP-08 (RF-088 a RF-091).
4. **Dado** una cotización emitida, **Cuando** el administrador intenta cambiar importes, **Entonces** el sistema no permite alterarla: el cambio se hace con una revisión (Historia 8) **[Confirmado — DP-08]**.
5. **Dado** una cotización que no está en estado «Aceptada y firmada», **Cuando** el administrador quiere iniciar un trabajo sobre ella, **Entonces** el módulo no ofrece ni sugiere iniciar el trabajo **[Confirmado]** (ningún servicio de desarrollo o consultoría se inicia sin propuesta formal aprobada y firmada por ambas partes).
6. **Dado** una cotización emitida el día 1 de un mes (fecha de Honduras) a cualquier hora, **Cuando** se muestra en el listado, el detalle o la vista previa, **Entonces** en los tres lugares dice «Válida hasta» el día 15 de ese mes, sigue vigente hasta las 23:59 de ese día 15 y desde las 00:00 del día 16 muestra el indicador de vencida **[Confirmado — DP-06]**. *(Fechas ilustrativas.)*
7. **Dado** una cotización en «Borrador», o «Emitida» sin historial de aceptación, **Cuando** el administrador la cancela por el flujo ordinario, **Entonces** el sistema exige un motivo, la pasa a «Cancelada», registra quién, cuándo y por qué, y la deja terminal: ni se reactiva ni vuelve a otro estado **[Confirmado — DP-06 y AF-1]**.
8. **Dado** una cotización «Aceptada y firmada», o una «Emitida» con cualquier historial de aceptación (aunque la aceptación se haya revertido), **Cuando** el administrador busca cancelarla, **Entonces** el flujo ordinario de cancelación no está disponible: solo cabe el procedimiento correctivo separado de RF-105 **[Confirmado — DP-06 y AF-1]**.
9. **Dado** una cotización «Emitida», **Cuando** el administrador la rechaza, **Entonces** el sistema exige registrar el motivo, la pasa a «Rechazada» y la deja terminal; el rechazo no se ofrece desde ningún otro estado **[Confirmado — DP-06]**.
10. **Dado** una cotización «Rechazada» o «Cancelada», **Cuando** el administrador quiere retomarla, **Entonces** el módulo no ofrece reactivarla; puede duplicarla en un borrador nuevo **[Confirmado — DP-06]**.
11. **Dado** cualquier cotización, **Cuando** el administrador la archiva o la desarchiva, **Entonces** el estado, los datos y el historial no cambian, y solo el administrador puede hacerlo **[Confirmado — DP-06 y AF-1]** (que el listado oculte por defecto las archivadas y se puedan mostrar al filtrar: **[Propuesto]**).
12. **Dado** un borrador que ya no se quiere, **Cuando** el administrador lo descarta, **Entonces** lo cancela con un motivo; la interfaz normal no ofrece eliminarlo de forma permanente **[Confirmado — AF-1]**.
13. **Dado** una versión «sustituida», **Cuando** el administrador abre sus acciones, **Entonces** el módulo no le ofrece aceptarla, rechazarla, cancelarla ni revisarla; sigue disponible para auditoría **[Confirmado — AF-1]**.
14. **Dado** una cotización con historial de aceptación que requiere una cancelación correctiva, **Cuando** el administrador ejecuta el procedimiento separado, **Entonces** debe iniciarlo de forma explícita y distinta de la cancelación ordinaria, escribir una justificación obligatoria y queda un registro de auditoría inmutable con quién, cuándo y por qué **[Confirmado — AF-1]**.

---

### Historia 5 — Mantener el módulo solo para administradores (Prioridad: P1)

Ningún otro rol gana acceso. Un colaborador, un cliente o un visitante anónimo no puede ver, listar ni abrir cotizaciones, ni encontrar rastro del módulo en su interfaz.

**Por qué esta prioridad**: es una restricción de seguridad no negociable del proyecto; condiciona a todas las demás historias.

**Prueba independiente**: se intenta acceder al módulo y a sus datos con cada rol distinto del administrador y sin sesión; todos los intentos fallan.

**Escenarios de aceptación**:

1. **Dado** un colaborador con sesión, **Cuando** intenta abrir el módulo o sus datos por cualquier vía, **Entonces** se le niega el acceso y no ve entrada alguna del módulo en el menú **[Confirmado]**.
2. **Dado** un cliente con sesión o con enlace de portal, **Cuando** intenta alcanzar una cotización (propia o ajena), **Entonces** se le niega el acceso: el portal de clientes **no** expone cotizaciones en esta versión **[Confirmado]**.
3. **Dado** un visitante sin sesión, **Cuando** intenta alcanzar el módulo, **Entonces** se le niega el acceso y es redirigido al flujo de autenticación existente.
4. **Dado** un administrador, **Cuando** se produce un fallo (red, datos, permisos), **Entonces** ve un mensaje claro en español, sin el texto técnico crudo del error **[Confirmado]** (regla del panel).
5. **Dado** un colaborador, un cliente o un visitante sin sesión, **Cuando** intenta abrir directamente `/dashboard/cotizaciones`, `/dashboard/cotizaciones/:id` o `/dashboard/cotizaciones/catalogo`, **Entonces** se le niega el acceso en las tres rutas, igual que en el resto de `/dashboard` **[Confirmado — DP-10]**.
6. **Dado** un administrador, **Cuando** abre `/dashboard/cotizaciones/catalogo`, **Entonces** ve el catálogo y nunca el detalle de una cotización con identificador «catalogo»; **Cuando** abre `/dashboard/cotizaciones/:id` con el identificador de una cotización existente, **Entonces** ve su detalle **[Confirmado — DP-10]**.
7. **Dado** un administrador, **Cuando** abre `/dashboard/cotizaciones/:id` con un identificador que no existe, **Entonces** ve un mensaje claro en español de que la cotización no se encontró, sin texto técnico **[Propuesto]**.
8. **Dado** un administrador en cualquiera de las tres rutas, **Cuando** mira el menú, **Entonces** la entrada «Cotizaciones» del grupo «Gestión comercial» aparece marcada como la página actual **[Propuesto]**.

---

### Historia 6 — Mantener el catálogo de paquetes y módulos (Prioridad: P1)

El administrador mantiene el catálogo con el que se arman las cotizaciones: los paquetes de servicio y los módulos opcionales, cada uno con su precio en HNL.

**Por qué esta prioridad**: es la decisión Q2 = A del propietario. Sin catálogo, la Historia 1 solo podría usar líneas definidas a mano.

**Prueba independiente**: se crean un paquete y un módulo con precio en HNL, se usan en una cotización y se emite; después se cambia el precio del paquete y se verifica que la cotización emitida conserva su importe y que una cotización nueva usa el precio nuevo.

**Escenarios de aceptación**:

1. **Dado** un catálogo vacío, **Cuando** el administrador crea un paquete con su nombre, su descripción y su precio en HNL, **Entonces** el paquete queda disponible para elegirlo en cotizaciones nuevas **[Confirmado — Q2 = A]**.
2. **Dado** una cotización emitida que usa un paquete, **Cuando** el administrador cambia después el precio de ese paquete, **Entonces** la cotización emitida conserva el precio con que se emitió **[Confirmado — Q2 = A]**.
3. **Dado** el catálogo sin uso previo, **Cuando** el administrador lo abre por primera vez, **Entonces** no encuentra paquetes, módulos ni precios precargados: todo precio lo introduce él **[Confirmado — Q2 = A]**.
4. **Dado** un precio vacío, negativo, no numérico, con más de dos decimales o mayor que el máximo por línea, **Cuando** se intenta guardar el elemento, **Entonces** se rechaza con un mensaje claro en español **[Confirmado — DA-07]**.
5. **Dado** un paquete o módulo que ya no se ofrece, **Cuando** el administrador lo retira del catálogo, **Entonces** deja de poder elegirse en cotizaciones nuevas y las cotizaciones que ya lo usaron no cambian **[Propuesto]**.
6. **Dado** cualquier cambio en el catálogo, **Cuando** se consulta el sitio público, **Entonces** el contenido público que expresa el precio «desde» en dólares sigue igual **[Confirmado — Q2 = A]**.
7. **Dado** un importe en otra moneda, **Cuando** el administrador quiere usarlo, **Entonces** el módulo no ofrece conversión ni tipo de cambio: el precio se introduce en HNL **[Confirmado — Q2 = A]**.
8. **Dado** un borrador con una línea de catálogo cuyo precio cambió después en el catálogo, **Cuando** el administrador lo abre, **Entonces** el sistema señala la diferencia (precio unitario en el borrador y precio unitario actual) y exige una decisión explícita del administrador (actualizar o conservar) antes de emitir; el borrador nunca cambia de precio en silencio **[Confirmado — AF-5]** (la comparación por precio unitario: **[Confirmado — DA-08]**).
9. **Dado** un paquete del catálogo que declara los módulos que incluye, **Cuando** el administrador lo guarda, **Entonces** esa composición se usa para no cobrar dos veces un componente (RF-107) **[Propuesto]** (cómo se declara la composición lo define el plan).
10. **Dado** un elemento del catálogo usado en una cotización, **Cuando** el administrador lo añade, **Entonces** el precio del catálogo es el precio unitario de la línea y la cantidad se define en la cotización, no en el catálogo **[Confirmado — DA-08]**.

El catálogo forma parte del módulo: le aplican las mismas reglas de acceso de la Historia 5.

---

### Historia 7 — Registrar la aceptación y vincular un proyecto (Prioridad: P2)

El administrador registra a mano que el cliente aceptó la cotización y deja la referencia a la propuesta firmada. Si más adelante quiere relacionar esa cotización con un proyecto, lo hace con una acción aparte.

**Por qué esta prioridad**: es la decisión Q3 = A del propietario y aplica la regla de los Términos del Servicio (ningún trabajo sin propuesta formal aprobada y firmada). Depende de la Historia 4.

**Prueba independiente**: sobre una cotización emitida y vigente se registra la aceptación con su referencia; se verifica el estado, los datos registrados, que no se creó ni se enlazó ningún proyecto y que la evidencia solo la alcanza el administrador. Después se ejecuta la acción de vincular y se verifica el vínculo.

**Escenarios de aceptación**:

1. **Dado** una cotización emitida y vigente, **Cuando** el administrador registra la aceptación e indica la referencia a la propuesta firmada, **Entonces** la cotización pasa a «Aceptada y firmada» y quedan registrados los datos de la aceptación **[Confirmado — Q3 = A]**.
2. **Dado** que falta la referencia a la propuesta firmada, **Cuando** el administrador intenta registrar la aceptación, **Entonces** el sistema lo impide y explica en español qué falta **[Confirmado — Q3 = A]**.
3. **Dado** una aceptación recién registrada, **Cuando** se consultan los proyectos, **Entonces** ese registro no creó ni enlazó ningún proyecto **[Confirmado — Q3 = A]**.
4. **Dado** una cotización «Aceptada y firmada», **Cuando** el administrador decide relacionarla con un proyecto, **Entonces** lo hace con una acción aparte y explícita (enlazar un proyecto existente o crear uno) y el vínculo queda visible en la cotización **[Confirmado — Q3 = A]**. Solo pasan al proyecto la información necesaria de cliente, alcance y finanzas, y la cotización conserva su instantánea original **[Confirmado — AF-5]** (los campos exactos los define el plan con la revisión del propietario).
5. **Dado** una cotización que no está «Aceptada y firmada», **Cuando** el administrador la abre, **Entonces** el módulo no ofrece enlazar ni crear un proyecto a partir de ella **[Confirmado]** (el encargo vincula solo cotizaciones aceptadas).
6. **Dado** la evidencia de la aprobación y de la firma, **Cuando** un colaborador, un cliente o un visitante intenta alcanzarla por cualquier vía, incluido un enlace directo, **Entonces** se le niega el acceso **[Confirmado — Q3 = A]**.
7. **Dado** el registro de una aceptación, **Cuando** se completa, **Entonces** el módulo no recoge ninguna firma electrónica ni envía nada al cliente **[Confirmado — Q3 = A]**.
8. **Dado** una cotización en «Borrador», «Rechazada» o «Cancelada», una «Emitida» con el indicador de vencida, o una sin la referencia a la propuesta firmada, **Cuando** se intenta registrar su aceptación, **Entonces** el sistema no lo permite **[Confirmado — DP-06]**.
9. **Dado** una cotización «Aceptada y firmada» sin proyecto vinculado, **Cuando** el administrador revierte la aceptación indicando un motivo, **Entonces** la cotización vuelve a «Emitida», queda un registro inmutable de quién, cuándo y por qué, y el registro de aceptación original y su evidencia se conservan sin cambios **[Confirmado — DP-06]**.
10. **Dado** que el administrador intenta revertir sin indicar motivo, **Cuando** confirma, **Entonces** el sistema lo impide y explica en español qué falta **[Confirmado — DP-06]**.
11. **Dado** una aceptación revertida cuya fecha «Válida hasta» ya pasó, **Cuando** el administrador abre la cotización, **Entonces** sigue «Emitida», muestra el indicador de vencida y no puede aceptarse de nuevo **[Confirmado — DP-06]**.
12. **Dado** una cotización «Aceptada y firmada» con un proyecto ya vinculado, **Cuando** el administrador quiere revertir la aceptación, **Entonces** el módulo no la revierte de forma automática: lo señala como un caso para una revisión administrativa controlada aparte **[Confirmado — DP-06]**. En la primera versión el módulo no ofrece ninguna acción para ese caso; se atiende fuera del flujo ordinario, mediante la revisión administrativa controlada **[Confirmado — AF-1]**.
13. **Dado** el registro de una aceptación, **Cuando** el administrador adjunta el documento firmado o indica una referencia segura a él, **Entonces** la evidencia queda guardada o referenciada con acceso solo del administrador, junto con los metadatos auditables de la aceptación **[Confirmado — AF-5]**.
14. **Dado** una cotización «Aceptada y firmada», **Cuando** el administrador crea un proyecto o lo vincula, **Entonces** la acción es explícita, la cotización conserva su instantánea original y al proyecto solo pasa la información necesaria de cliente, alcance y finanzas **[Confirmado — AF-5]**.
15. **Dado** cualquier acción de este flujo, **Cuando** termina, **Entonces** no se crea ningún proyecto de forma automática, no se amplía el acceso de ningún rol, no se envía ningún correo y no se cobra ningún pago **[Confirmado — AF-5]**.

---

### Historia 8 — Numerar, revisar y duplicar cotizaciones (Prioridad: P2)

El administrador emite cotizaciones con un número permanente, corrige una cotización emitida mediante una revisión que deja intacta la versión anterior, y retoma una cotización vencida, rechazada, cancelada o aceptada mediante un duplicado que parte de los precios vigentes.

**Por qué esta prioridad**: es la decisión DP-08 del propietario. Sin números permanentes y versiones inmutables no se puede auditar qué se ofreció, y sin salvaguardas financieras un duplicado o una revisión podrían emitirse con importes que no cuadran. Depende de las Historias 2 y 4.

**Prueba independiente**: se emite una cotización y se verifica su número; se crea y se emite una revisión y se verifica el sufijo, la nueva vigencia y que la anterior queda sustituida e intacta; se duplica una cotización con cambios de catálogo y se verifica la comparación de precios y que no se puede emitir con inconsistencias.

**Escenarios de aceptación**:

1. **Dado** un borrador, **Cuando** el administrador lo emite por primera vez, **Entonces** recibe el número `COT-AAAA-NNNN` con el año del calendario de `America/Tegucigalpa` y la secuencia de ese año; mientras sea borrador no tiene número definitivo **[Confirmado — DP-08]**.
2. **Dado** cualquier número ya asignado, **Cuando** la cotización se cancela, se sustituye o se archiva, o cuando se emiten otras, **Entonces** ese número no se reutiliza ni se reasigna a nada **[Confirmado — DP-08]**.
3. **Dado** que cambia el año en `America/Tegucigalpa`, **Cuando** se emite la primera cotización del año nuevo, **Entonces** la secuencia reinicia en 0001 con el año nuevo **[Confirmado — DP-08]**.
4. **Dado** una cotización «Emitida» y no vencida, que sea la versión emitida más reciente y no esté sustituida, **Cuando** el administrador crea una revisión, **Entonces** se abre un borrador que parte de los precios, líneas y condiciones originales y permite cambios explícitos; la original sigue intacta **[Confirmado — DP-08]**.
5. **Dado** una revisión en borrador, **Cuando** el administrador la emite, **Entonces** recibe el número de la original con el siguiente sufijo (`-R1`, luego `-R2`), una fecha de emisión propia y sus propios 15 días calendario de vigencia (RF-062), y la versión anterior queda marcada «sustituida» **[Confirmado — DP-08]**.
6. **Dado** una versión «sustituida», **Cuando** el administrador intenta aceptarla, **Entonces** el sistema lo impide; la versión sigue disponible para auditoría, sin cambios **[Confirmado — DP-08]**.
7. **Dado** una cotización vencida, rechazada, cancelada, «Aceptada y firmada» o «sustituida», **Cuando** el administrador quiere revisarla, **Entonces** el módulo no ofrece la revisión; puede duplicarla **[Confirmado — DP-08 y AF-1]**.
8. **Dado** una versión ya emitida (la original o una revisión), **Cuando** se abre, **Entonces** sus datos de cliente, precios, condiciones y fechas de emisión son los de la emisión y no pueden editarse **[Confirmado — DP-08]**.
9. **Dado** cualquier cotización, **Cuando** el administrador la duplica, **Entonces** se crea un borrador nuevo con una referencia a su origen; recibe un número nuevo e independiente solo al emitirlo; el origen y sus precios históricos no cambian **[Confirmado — DP-08]**.
10. **Dado** un duplicado con elementos del catálogo y líneas manuales, **Cuando** el administrador lo abre, **Entonces** los elementos del catálogo muestran los precios vigentes del catálogo en HNL y las líneas manuales conservan los precios del origen; una comparación muestra qué precios cambiaron y cuáles se conservaron **[Confirmado — DP-08]**. La comparación es por precio unitario y cada línea conserva la cantidad del origen **[Confirmado — DA-08]**.
11. **Dado** un duplicado con líneas manuales, **Cuando** el administrador intenta emitirlo sin haber revisado de forma explícita cada línea manual, **Entonces** el sistema lo impide y señala cuáles faltan **[Confirmado — DP-08]**.
12. **Dado** un duplicado o una revisión cuyo total único cambió respecto del origen, **Cuando** se abre, **Entonces** el anticipo mantiene su modo (monto fijo o porcentaje): en porcentaje se recalcula y en monto fijo se conserva, y en ambos casos se señala para que el administrador lo confirme **[Confirmado — DP-08]**.
13. **Dado** un duplicado o una revisión en la que el anticipo más los hitos no cuadran con el total único, o con tramos de tarifa mal formados, o con una condición recurrente anual sin condiciones de pago, **Cuando** el administrador intenta emitirlo, **Entonces** el sistema lo impide y explica qué falta; nunca se emite de forma automática **[Confirmado — DP-08]**.
14. **Dado** una revisión en borrador cuya cotización de origen se aceptó, se rechazó, se canceló, venció o fue sustituida, **Cuando** el administrador intenta emitirla, **Entonces** el sistema lo impide y le indica que debe duplicar la cotización **[Confirmado — AF-4]**.
15. **Dado** que en un año se emitieron más de 9 999 cotizaciones, **Cuando** se emite la siguiente, **Entonces** recibe el número siguiente de la secuencia (por ejemplo, `COT-2026-10000`) sin colisiones ni reutilización; los cuatro dígitos son un mínimo **[Confirmado — AF-4]**. *(Ejemplo ilustrativo.)*
16. **Dado** una revisión emitida, **Cuando** se consulta su vigencia y la de la versión anterior, **Entonces** la revisión tiene sus 15 fechas calendario propias, la anterior queda sustituida con su vigencia y su historial intactos, y ninguna vigencia se extiende de forma automática **[Confirmado — AF-2]**.
17. **Dado** una revisión ya en borrador de una cotización, **Cuando** el administrador intenta crear otra revisión de la misma cotización, **Entonces** el sistema no lo permite **[Confirmado — AF-4]**.
18. **Dado** un duplicado, **Cuando** el administrador abre los datos del cliente, **Entonces** ve una instantánea editable heredada del origen que puede actualizar antes de emitir sin afectar al origen **[Confirmado — AF-4]**.
19. **Dado** una cotización «Emitida» que volvió de una aceptación revertida, **Cuando** el administrador abre sus acciones, **Entonces** el módulo no ofrece revisarla mientras el propietario no apruebe ese caso de forma expresa; puede duplicarla **[Confirmado — instrucción del propietario de 2026-11-09]** (si llega a permitirse: pendiente, DA-10).

---

### Casos límite

- **Cotización sin líneas**: no se puede emitir; el borrador sí puede existir vacío **[Propuesto]**.
- **Solo recurrente, sin cargo único**: válida; el total único, el anticipo y el saldo son cero y se presentan como tales **[Propuesto]**; el anticipo solo puede ser cero porque se calcula sobre el total único (RF-019).
- **Anticipo en cero**: no genera un hito de pago visible; los hitos restantes, si los hay, suman el total único **[Confirmado — AF-3]**.
- **Sin hitos adicionales**: el saldo restante es una única obligación de pago, con condiciones acordadas escritas de forma explícita por el administrador **[Confirmado — AF-3]**.
- **Sin anticipo definido y sin hitos**: si hay total único, la cotización exige igualmente las condiciones de pago del cargo único y no se emite sin ellas **[Confirmado — DA-12]**.
- **Total con impuestos o línea de impuesto**: el módulo no ofrece un total con impuestos incluidos ni un tipo de línea de impuesto; si el administrador escribe un impuesto en una línea manual, el módulo no lo reconoce como tal y lo trata como un importe cualquiera, por lo que no debe usarse así **[Propuesto]**.
- **Cliente que pide el monto con impuestos**: el módulo no lo calcula ni lo muestra; el documento solo declara que los importes no incluyen impuestos **[Confirmado — DP-04]**.
- **Anticipo igual a cero o igual al total único**: ambos son válidos. Con anticipo igual al total único, el saldo es cero y no quedan otros hitos **[Confirmado — DP-05]**.
- **Anticipo en porcentaje y cambio del total único** antes de emitir: el monto en HNL se recalcula con el total vigente del borrador; al emitir, el monto queda fijo **[Propuesto]**.
- **Redondeo del anticipo en porcentaje**: el monto en HNL se redondea a dos decimales con la misma regla única de todo el módulo; ese monto redondeado es el que entra en la suma de los hitos, de modo que no hay diferencias de centavos **[Confirmado — DP-05]**. La regla es «mitad hacia arriba»: medio centavo exacto sube al centavo siguiente (RF-122) **[Confirmado — DA-01]**.
- **Tramos de tarifa con huecos, superposiciones o que no empiezan en el mes 1**: se rechazan con un mensaje claro **[Confirmado — DP-05]** (los límites exactos de los tramos los define el administrador).
- **Servicio recurrente anual sin condiciones de pago anual declaradas**: no se puede emitir (RF-074) **[Confirmado — DP-05]**.
- **Primer período parcial**: sin prorrateo automático; el ajuste, si existe, lo define el administrador (RF-078) **[Confirmado — DP-05]**.
- **Cambio de precio en el catálogo** después de emitir una cotización: la cotización emitida conserva los importes con que se emitió; solo las cotizaciones nuevas usan los precios nuevos **[Confirmado — Q2 = A]**.
- **Otra moneda**: no hay conversión ni tipo de cambio en esta versión; el catálogo y todos los cálculos están en HNL **[Confirmado — Q2 = A]**.
- **Borrador abierto cuando cambia un precio del catálogo**: el borrador no cambia de precio en silencio; el sistema señala la diferencia y el administrador decide de forma explícita antes de emitir **[Confirmado — AF-5]**.
- **Borrador cancelado antes de emitirse**: nunca recibió número, así que no consume ninguno ni deja hueco en la secuencia **[Confirmado — DP-08]**.
- **Emisión simultánea de dos cotizaciones**: nunca reciben el mismo número ni quedan números repetidos **[Confirmado — DP-08]**.
- **Cambio de año y revisión**: una revisión emitida en un año nuevo conserva el año y el número de la original, con su sufijo; el reinicio anual solo afecta a las cotizaciones nuevas **[Confirmado — AF-4]**.
- **Revisión de una revisión**: la siguiente revisión recibe el siguiente sufijo (`-R2`, `-R3`…); solo se revisa la versión emitida más reciente, elegible y no sustituida, y una versión «sustituida» no se revisa **[Confirmado — DP-08 y AF-4]**.
- **Dos revisiones en borrador de la misma cotización**: no se permite más de una por familia de cotización a la vez **[Confirmado — AF-4]**.
- **Origen que cambia mientras la revisión está en borrador**: si el origen se acepta, se rechaza, se cancela, vence o es sustituido, la revisión pendiente no puede emitirse (Historia 8, escenario 14) **[Confirmado — AF-4]**; el administrador la cancela con motivo o la conserva como borrador hasta duplicar.
- **Elemento del catálogo retirado al duplicar**: el duplicado lo señala y no se puede emitir hasta que el administrador lo quite o lo sustituya por otro elemento del catálogo o por una línea manual **[Confirmado — AF-4]** (las alternativas de resolución: **[Propuesto]**).
- **Datos del cliente en un duplicado**: parte de la instantánea del origen y el administrador puede actualizarla antes de emitir; el origen conserva la suya **[Confirmado — AF-4]**.
- **Tramos de tarifa, hitos y recurrentes copiados**: en duplicados y revisiones se revalidan como en una cotización nueva y nunca se arrastra una inconsistencia **[Confirmado — DP-08]**.
- **Anticipo en porcentaje tras un cambio de total único**: se recalcula en HNL con dos decimales y se señala para confirmar; el anticipo y los hitos nunca superan ni dejan de cuadrar con el total único **[Confirmado — DP-08]**.
- **Cargos recurrentes en un duplicado o revisión**: no entran en el total único ni cambian el anticipo ni los hitos **[Confirmado — DP-08]**.
- **Prospecto que después se registra como cliente formal**: la cotización conserva su instantánea de datos; asociarla al registro formal no reescribe cotizaciones ya emitidas **[Confirmado — Q1 = B]**.
- **Aceptación registrada por error**: se corrige con una reversión de motivo obligatorio y registro inmutable; con proyecto vinculado no se revierte de forma automática (RF-066 a RF-068) **[Confirmado — DP-06]**.
- **Emisión cerca de medianoche**: la fecha de emisión es la del calendario de Honduras en el momento de emitir, aunque en otras zonas horarias ya sea otro día; de ella salen la fecha «Válida hasta» y el vencimiento **[Confirmado — DP-06]**.
- **Intento de reactivar** una cotización vencida, rechazada o cancelada, o de extender su vigencia: el módulo no lo ofrece; solo se duplica **[Confirmado — DP-06]**.
- **Módulo opcional que depende de un paquete** (o es incompatible con otro): la primera versión no define dependencias ni incompatibilidades entre módulos; el administrador puede combinarlos libremente, pero un componente incluido en un paquete elegido no se cobra dos veces (RF-107) **[Propuesto]** (dependencias: diferidas).
- **Línea manual con precio unitario cero**: se permite solo si el administrador la marca como cortesía o sin cargo; sin esa marca, se rechaza **[Propuesto]**.
- **Cantidad fuera de rango**: cero, negativa, con decimales o mayor que 9,999 se rechaza con un mensaje claro; la cantidad por defecto es 1 **[Confirmado — DA-07 y DA-08]**.
- **Cantidad en un módulo ya incluido en el paquete**: el módulo incluido no se cobra, sea cual sea su cantidad; las unidades adicionales van en una línea facturable explícita que añade el administrador (RF-119) **[Confirmado — DA-08]**.
- **Cantidad y ajuste del primer período**: el ajuste se aplica una vez a toda la línea y no se multiplica por la cantidad (RF-117) **[Confirmado — DA-08]**.
- **Cantidades fraccionarias u horas con fracciones**: no se admiten en la primera versión (RF-120) **[Confirmado — DA-08]**.
- **Importe escrito con coma decimal o con un formato ambiguo** (por ejemplo `1250,50` o `1.250,50`): se rechaza con un mensaje que indica el formato esperado (`1250.50`); el módulo no adivina (RF-123) **[Confirmado — DA-14]**.
- **Revisión tras una aceptación revertida**: no se ofrece mientras el propietario no la apruebe; la cotización se puede duplicar (DA-10, pendiente) **[Confirmado — instrucción del propietario de 2026-11-09]**.
- **Ruta fija y ruta dinámica**: `/dashboard/cotizaciones/catalogo` siempre abre el catálogo, y la palabra «catalogo» nunca es un identificador de cotización válido **[Confirmado — DP-10]**.
- **Identificador inexistente** en `/dashboard/cotizaciones/:id`: mensaje claro de «no encontrada», sin revelar si existe para otro rol **[Propuesto]**.
- **Edición simultánea** de la misma cotización por dos sesiones del administrador: la segunda guardada no puede sobrescribir en silencio a la primera **[Propuesto]**.
- **Vencimiento en el límite**: el día de emisión cuenta como el día 1; el último día de vigencia es el día 15 y desde las 00:00 del día 16 (hora de Honduras) la cotización muestra el indicador de vencida. Nunca se concede un día adicional (RF-062) **[Confirmado — DP-06]**.
- **Vigencia y horas**: la vigencia son 15 fechas calendario, no 15 períodos completos de 24 horas; una cotización emitida por la tarde dura menos de 15 días completos de 24 horas, y el documento no afirma lo contrario **[Confirmado — AF-2]**.
- **Cancelación tras una aceptación revertida**: la cotización vuelve a «Emitida» pero conserva su historial de aceptación, así que la cancelación ordinaria no está disponible y solo cabe el procedimiento correctivo separado **[Confirmado — AF-1]**.
- **Revisión emitida**: no extiende ni modifica la vigencia de la versión anterior, que queda sustituida con su vigencia original **[Confirmado — AF-2]**.
- **Secuencia anual por encima de 9 999**: continúa (`COT-2026-10000`…) sin colisiones **[Confirmado — AF-4]**.
- **Eliminar un borrador**: la interfaz normal no ofrece borrado permanente; el borrador se cancela con motivo y se conserva **[Confirmado — AF-1]**.
- **Componente incluido en un paquete y añadido como módulo**: no se cobra dos veces; se muestra como incluido **[Confirmado — AF-5]** (mecanismo: **[Propuesto]**).
- **Cotización que cruza el cierre de sesión**: un borrador abierto no pierde datos ya guardados; lo no guardado se advierte antes de salir **[Propuesto]**.
- **Importes muy grandes o con muchos decimales**: se limitan a dos decimales y a los máximos de RF-121 (L 99,999,999.99 por línea y L 999,999,999.99 por total), con mensaje claro. Lo que supera un máximo se rechaza antes de emitir y antes de calcular un anticipo en porcentaje **[Confirmado — DA-07]**.
- **Texto largo o con caracteres especiales** en descripciones: se aceptan hasta un máximo razonable y se muestran sin corromper la vista previa.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Acceso y seguridad**

- **RF-001**: El módulo MUST ser accesible solo para el administrador (rol 0), dentro del panel administrativo, en el grupo «Gestión comercial» del menú. **[Confirmado — DP-10]** (el encargo decía «Centro de Operaciones»; DP-10 lo cambió)
- **RF-002**: El sistema MUST negar a colaboradores, clientes y visitantes anónimos cualquier acceso al módulo, a sus pantallas y a sus datos, incluida cualquier vía indirecta (portal de clientes, vistas de proyecto, listados compartidos). **[Confirmado]**
- **RF-003**: Esta funcionalidad MUST NOT ampliar el acceso de ningún rol existente. **[Confirmado]**
- **RF-004**: El sistema MUST NOT registrar en logs datos personales del cliente (correo, teléfono) ni el contenido de las cotizaciones. **[Confirmado]** (regla de seguridad del proyecto)

**Cotización y líneas**

- **RF-005**: El administrador MUST poder crear y editar una cotización mientras esté en borrador, y cancelar un borrador con un motivo. La interfaz normal MUST NOT ofrecer eliminar un borrador de forma permanente. **[Confirmado — AF-1]** Archivar es un atributo aparte (RF-071).
- **RF-006**: Una cotización MUST poder contener paquetes de servicio, módulos opcionales y líneas definidas a mano. **[Confirmado]**
- **RF-007**: Los módulos opcionales MUST poder incluirse o excluirse por cotización, y la cotización MUST mostrar claramente cuáles están incluidos. **[Confirmado]** (existencia de módulos opcionales) / **[Propuesto]** (detalle de presentación)
- **RF-008**: Las líneas definidas a mano MUST requerir descripción, cantidad y precio unitario (RF-115), MUST distinguirse visualmente de las líneas del catálogo en la vista previa y MUST permitirse únicamente donde el catálogo no cubra lo cotizado. **[Confirmado]** (que existan «donde corresponda») / **[Confirmado — DA-08]** (cantidad y precio unitario) / **[Propuesto]** (distinción visual y criterio)
- **RF-009**: Cada línea MUST clasificarse como cargo **único** o como cargo **recurrente**; una línea recurrente MUST ser **mensual** o **anual**, a elección del administrador por servicio. **[Confirmado — DP-05]**

**Cálculo**

- **RF-010**: El sistema MUST calcular el importe de cada línea (cantidad por precio unitario, RF-115), los subtotales, el total único, el anticipo, el saldo restante y los importes recurrentes a partir de las líneas, sin intervención manual. Los importes recurrentes se muestran por periodicidad (mensual y anual por separado), nunca se suman entre sí ni al total único, y en un servicio con tramos se muestra la tabla de tramos sin calcular un total de toda la vigencia. **[Confirmado]** (separación) / **[Confirmado — DP-05]** (periodicidades y tramos)
- **RF-011**: Los cargos recurrentes MUST mostrarse por separado del total único y MUST NOT sumarse a él. **[Confirmado]**
- **RF-012**: Todo importe mostrado MUST estar en HNL. **[Confirmado]** (su presentación: RF-123)
- **RF-013**: Todos los precios del catálogo y todos los cálculos de la cotización MUST estar en HNL; el sistema MUST NOT convertir importes desde otra moneda ni aplicar un tipo de cambio en esta versión. **[Confirmado — Q2 = A]**
- **RF-014**: Los totales visibles MUST coincidir con la suma de las líneas visibles, con una regla de redondeo única y documentada a dos decimales de HNL en todo el módulo, y el cálculo MUST dar siempre el mismo resultado para los mismos datos. **[Confirmado — DP-05]** (dos decimales y consistencia) / **[Confirmado — DA-01]** (la regla de redondeo, RF-122)
- **RF-015**: El sistema MUST rechazar precios e importes negativos, no numéricos o fuera de rango en las líneas, y cantidades fuera de rango (los descuentos no forman parte de la primera versión salvo decisión del propietario). **[Confirmado — DA-07]** (los límites: RF-121)

**Anticipos, saldo y plan de pagos**

- **RF-016**: El administrador MUST poder definir, por cotización, el anticipo como un monto fijo en HNL o como un porcentaje del total único; el sistema MUST mostrar el monto resultante en HNL y el saldo restante (total único menos anticipo). **[Confirmado — DP-05]**
- **RF-017**: El sistema MUST NOT aplicar un monto ni un porcentaje de anticipo por defecto ni sugerir uno; el anticipo MUST ser definido por el administrador. **[Confirmado — DP-05]**
- **RF-018**: El administrador MUST decidir, cotización por cotización, si hacen falta hitos de desarrollo adicionales; cuando los define, MUST expresarlos como hitos acordados y un anticipo positivo MUST ser el primer hito de pago. **[Confirmado — DP-05 y AF-3]**
- **RF-019**: El sistema MUST validar que el anticipo esté entre cero y el total único, ambos incluidos, y que, cuando la cotización define hitos, el anticipo más todos los demás hitos de desarrollo sumen exactamente el total único. El anticipo MUST NOT contarse dos veces, y los cargos recurrentes MUST quedar fuera del total único y del cálculo de hitos. Una cotización que no cumpla MUST NOT poder emitirse. **[Confirmado — DP-05]** Cuando la cotización no define hitos adicionales, el saldo restante (total único menos anticipo) MUST ser una única obligación de pago con condiciones acordadas que el administrador escribe de forma explícita (RF-110). **[Confirmado — AF-3]**
- **RF-020**: La cuota de mantenimiento mensual MUST presentarse indicando que se factura por adelantado. **[Confirmado]**

**Servicios recurrentes** *(decisión DP-05, aprobada el 2026-11-09)*

- **RF-073**: Cada servicio recurrente MUST tener una periodicidad mensual o anual, elegida por el administrador por servicio; el sistema MUST NOT ofrecer otras periodicidades. **[Confirmado — DP-05]**
- **RF-074**: Los servicios recurrentes anuales MUST declarar de forma explícita en la cotización sus condiciones de pago anual, y la cotización MUST NOT poder emitirse sin ellas. **[Confirmado — DP-05]**
- **RF-075**: El administrador MUST definir, por servicio recurrente, la fecha de inicio, las tarifas aplicables y las condiciones de renovación; el sistema MUST NOT proponer valores por defecto para ellas. **[Confirmado — DP-05]**
- **RF-076**: El sistema MUST permitir documentar, para un servicio mensual, tramos de tarifa por rango de meses (por ejemplo, meses 1 a 3, 4 a 6 y 7 en adelante), con importes que escribe el administrador. Los tramos MUST empezar en el mes 1, no superponerse ni dejar meses sin cubrir, y el último puede quedar abierto «en adelante». **[Confirmado — DP-05]** (la validación de los tramos: **[Propuesto]**) Cada tramo expresa un precio por unidad y por período, y la cantidad de la línea es la misma en todos los tramos (RF-116). **[Confirmado — DA-08]**
- **RF-077**: El módulo MUST NOT generar cobros, facturas ni renovaciones automáticas ni conectarse con una pasarela de pago; las condiciones recurrentes solo se documentan en la cotización. **[Confirmado — DP-05]**
- **RF-078**: El sistema MUST NOT prorratear de forma automática. Todo ajuste del primer período MUST ser definido de forma explícita por el administrador, con su importe y su descripción. **[Confirmado — DP-05]** (que el importe sea mayor o igual a cero: **[Propuesto]**, porque los descuentos están diferidos (DP-11)) El ajuste se aplica una sola vez a toda la línea y no se multiplica por la cantidad (RF-117). **[Confirmado — DA-08]**
- **RF-079**: La vista previa y el documento MUST mostrar, por servicio recurrente, su periodicidad, fecha de inicio, tarifas o tabla de tramos, condiciones de renovación y, si es anual, sus condiciones de pago. **[Propuesto]**

**Impuestos**

- **RF-021**: Todos los importes de la cotización MUST estar en HNL y excluir impuestos. Toda cotización dirigida al cliente (la vista previa y cualquier documento que se entregue) MUST mostrar de forma destacada el aviso exacto «Los importes no incluyen impuestos». **[Confirmado — DP-04]** (que los precios publicados excluyen impuestos: **[Confirmado]**). El aviso MUST mostrarse junto a los totales dirigidos al cliente, no escondido al pie. **[Confirmado — AF-3]**
- **RF-022**: El módulo MUST NOT calcular montos de impuesto, configurar tasas, inferir exenciones ni presentar un total con impuestos incluidos, y MUST NOT tener campos, líneas ni tipos de línea de impuesto. **[Confirmado — DP-04]**
- **RF-101**: El total único de la cotización MUST rotularse de forma clara como sin impuestos, para que el cliente no lo confunda con el monto final de una factura fiscal. **[Confirmado — DP-04]** (el texto exacto del rótulo, por ejemplo «Total único (sin impuestos)»: **[Propuesto]**)
- **RF-102**: El anticipo, los hitos, el saldo restante y los cargos recurrentes MUST calcularse de forma consistente sobre los importes cotizados sin impuestos. **[Confirmado — DP-04]**
- **RF-103**: La evaluación real de impuestos, la facturación fiscal y las obligaciones tributarias aplicables MUST quedar fuera de esta versión, y el módulo MUST NOT dar a entender que los impuestos estén exentos o que nunca apliquen. El módulo MUST NOT inventar porcentajes, exenciones legales, requisitos fiscales ni políticas comerciales adicionales. **[Confirmado — DP-04]**

**Vigencia y estados**

- **RF-023**: Toda cotización emitida MUST tener una fecha de emisión y una fecha «Válida hasta» que corresponde a 15 días calendario desde su emisión, calculada según RF-062. **[Confirmado]**
- **RF-024**: Una cotización emitida cuya vigencia terminó sin aceptarse MUST mostrar el indicador de vencida (RF-063) y MUST NOT presentarse como vigente. **[Confirmado]**
- **RF-025**: El sistema MUST manejar un conjunto cerrado de estados: **Borrador, Emitida, Aceptada y firmada, Rechazada y Cancelada**. «Vencida» no es un estado (RF-063) y archivar no es un estado (RF-071). **[Confirmado — DP-06]**
- **RF-026**: El módulo MUST NOT ofrecer ni sugerir el inicio de trabajo sobre una cotización que no esté «Aceptada y firmada». **[Confirmado]**
- **RF-027**: Una versión emitida de una cotización MUST ser inmutable: sus datos de cliente (instantánea), precios, condiciones y fechas de emisión MUST NOT cambiar. Todo cambio posterior se hace con una revisión (RF-082 a RF-087). **[Confirmado — DP-08]**

**Identificación y trazabilidad**

- **RF-028**: Toda cotización MUST tener un número único y permanente que se asigna al emitirla por primera vez y que nunca se reutiliza (RF-080, RF-081). Un borrador MUST NOT tener número definitivo y se identifica con una referencia interna estable que no es el número de cotización. **[Confirmado — DP-08]**
- **RF-029**: El sistema MUST registrar quién creó o modificó una cotización y cuándo. **[Propuesto]** Los cambios de estado, la aceptación, la reversión y la cancelación se registran además con su motivo cuando corresponda (RF-066, RF-069), **[Confirmado — DP-06]**.

**Vista previa**

- **RF-030**: El administrador MUST poder previsualizar la cotización con el contenido y el aspecto que tendría para el cliente. **[Confirmado]**
- **RF-031**: La vista previa MUST mostrar los datos del cliente o prospecto que guarda la cotización, las líneas, los bloques único y recurrente por separado, el anticipo y el saldo (si existen), el plan de hitos, los servicios recurrentes con sus condiciones (RF-079), la vigencia y la nota de impuestos. **[Propuesto]** (detalle) sobre el encargo **[Confirmado]**
- **RF-032**: La vista previa y el módulo MUST NOT enviar correos ni notificaciones. **[Confirmado]**

**Gestión**

- **RF-033**: El administrador MUST poder listar, buscar, filtrar por estado y abrir cotizaciones. **[Propuesto]**
- **RF-034**: El administrador MUST poder duplicar una cotización en un borrador nuevo, que se emite como una cotización nueva. La original MUST conservarse sin cambios, con su registro e historial. **[Confirmado — DP-06 y DP-08]** (la política de precios del duplicado: RF-088 a RF-091)
- **RF-035**: Los datos personales de clientes MUST tratarse con el mismo cuidado que el resto del panel; la spec, el plan y los ejemplos no incluyen datos reales. **[Confirmado]**

**Interfaz**

- **RF-036**: Toda la interfaz y los mensajes del módulo MUST estar en español, y los errores MUST ser claros y sin texto técnico crudo. **[Confirmado]**
- **RF-037**: El módulo MUST seguir el sistema de diseño del panel administrativo (primitivas y tokens del dashboard) y los colores de estado del proyecto (no hex directos). **[Confirmado]**
- **RF-038**: El módulo MUST ser utilizable con teclado y cumplir los criterios de accesibilidad del panel (WCAG 2.2 AA). **[Propuesto]**

**Clientes y prospectos** *(decisión Q1 = B, aprobada el 2026-11-09)*

- **RF-039**: El administrador MUST poder crear y emitir una cotización para un prospecto sin que exista antes un registro de cliente ni un proyecto. **[Confirmado — Q1 = B]**
- **RF-042**: La cotización MUST capturar los datos de contacto del prospecto. Para emitirla MUST exigir como mínimo el nombre de una persona o empresa y al menos un medio de contacto; los demás datos son opcionales. **[Confirmado — Q1 = B y AF-5]**
- **RF-043**: Cada cotización MUST conservar una instantánea estable de los datos del cliente o prospecto con que se emitió; los cambios posteriores en esos datos MUST NOT alterar las cotizaciones ya emitidas. **[Confirmado — Q1 = B]**
- **RF-044**: Una cotización MUST poder asociarse más adelante a un registro formal de cliente, cuando exista, sin perder ni reescribir sus datos históricos. **[Confirmado — Q1 = B]**
- **RF-045**: El módulo «Clientes» MUST NOT ser un prerrequisito de esta funcionalidad, y esta spec MUST NOT introducir un módulo de gestión de clientes. **[Confirmado — Q1 = B]**

**Catálogo y moneda** *(decisión Q2 = A, aprobada el 2026-11-09)*

- **RF-040**: El administrador MUST poder gestionar el catálogo de paquetes de servicio y módulos opcionales y fijar sus precios en HNL. **[Confirmado — Q2 = A]**
- **RF-046**: Una cotización emitida MUST conservar los precios aplicados al emitirla aunque los precios del catálogo cambien después. **[Confirmado — Q2 = A]**
- **RF-047**: El sistema MUST NOT traer precios precargados, inventados ni fijos en la aplicación: todo precio del catálogo lo introduce el administrador. **[Confirmado — Q2 = A]**
- **RF-048**: Esta funcionalidad MUST NOT cambiar el contenido público que expresa el precio «desde» en dólares. **[Confirmado — Q2 = A]**
- **RF-049**: Cada elemento del catálogo MUST indicar si su precio es un cargo único o recurrente, para clasificar la línea que genera (RF-009). **[Propuesto]**
- **RF-050**: El administrador MUST poder retirar un elemento del catálogo sin que cambien las cotizaciones que ya lo usaron. **[Propuesto]**

**Aceptación, evidencia y proyecto** *(decisión Q3 = A, aprobada el 2026-11-09)*

- **RF-041**: El administrador MUST registrar manualmente la aceptación de una cotización junto con la referencia a la propuesta firmada; solo así la cotización pasa a «Aceptada y firmada», y únicamente en las condiciones de RF-065. **[Confirmado — Q3 = A]**
- **RF-051**: El sistema MUST guardar el documento firmado, o una referencia segura a él, con acceso privado y controlado por autorización. En esta versión solo lo alcanza el administrador, y MUST NOT quedar expuesto por enlaces públicos ni por el portal de clientes. **[Confirmado — Q3 = A y AF-5]** (guardar el archivo o solo referenciarlo: decisión del plan, ver «Dependencias»)
- **RF-052**: El sistema MUST registrar los datos de la aceptación como metadatos auditables. Conjunto mínimo propuesto: fecha de aceptación, quién la registró y cuándo, quién aceptó por parte del cliente y la referencia a la propuesta firmada. **[Confirmado — Q3 = A y AF-5]** (que se registren como metadatos auditables) / **[Propuesto]** (el conjunto exacto; lo concreta el plan)
- **RF-053**: El módulo MUST NOT recoger firmas electrónicas. **[Confirmado — Q3 = A]**
- **RF-054**: Registrar la aceptación MUST NOT crear ni enlazar un proyecto de forma automática. **[Confirmado — Q3 = A]**
- **RF-055**: Crear o enlazar un proyecto a partir de una cotización «Aceptada y firmada» MUST ser una acción aparte, explícita y autorizada del administrador. **[Confirmado — Q3 = A]** Al crear o vincular el proyecto, el sistema MUST conservar la instantánea original de la cotización y transferir solo la información necesaria de cliente, alcance y finanzas. **[Confirmado — AF-5]** (los campos exactos: plan, con revisión del propietario)

**Estados, vigencia y correcciones** *(decisión DP-06, aprobada el 2026-11-09)*

- **RF-062**: La fecha de emisión MUST ser la del calendario de Honduras (zona horaria `America/Tegucigalpa`) en el momento de emitir. El día de emisión cuenta como el día 1: la fecha «Válida hasta» es la fecha de emisión más 14 días calendario, y la cotización vence a las 00:00 (hora de Honduras) del día siguiente. La vigencia se cuenta en 15 fechas calendario y MUST NOT describirse como 15 períodos completos de 24 horas. Esa misma fecha MUST mostrarse igual en el listado, el detalle y la vista previa, y el sistema MUST NOT conceder ningún día adicional. **[Confirmado — DP-06 y AF-2]** (15 días calendario, zona horaria `America/Tegucigalpa`, una fecha única, sin día adicional; el día de emisión cuenta como día 1). Ejemplo: emitida el 1 de noviembre, «Válida hasta» el 15 de noviembre y vencida desde las 00:00 del 16 de noviembre.
- **RF-063**: «Vencida» MUST ser una condición derivada de la fecha y MUST NOT ser un estado del ciclo de vida: nadie la asigna a mano ni se guarda como estado. Una cotización emitida con la vigencia terminada sigue «Emitida» y muestra un indicador de vencida en el listado, el detalle y la vista previa; el listado MUST poder filtrarla. **[Confirmado — DP-06]**
- **RF-064**: Una cotización con el indicador de vencida MUST NOT poder aceptarse, reactivarse en silencio ni extenderse en su vigencia. Para retomarla, el administrador MUST duplicarla en un borrador nuevo y emitir una cotización nueva; la original y su historial se conservan (RF-034). **[Confirmado — DP-06]**
- **RF-065**: El sistema MUST permitir registrar la aceptación solo si la cotización está «Emitida», no tiene el indicador de vencida y se indica la referencia a la propuesta firmada (RF-041). **[Confirmado — DP-06]**
- **RF-066**: El administrador MUST poder revertir una aceptación registrada por error, con un motivo obligatorio. El sistema MUST dejar un registro de auditoría inmutable con quién, cuándo y por qué, y MUST conservar el registro de aceptación original y su evidencia sin borrarlos ni sobrescribirlos. **[Confirmado — DP-06]**
- **RF-067**: La reversión MUST devolver la cotización a «Emitida». Si su vigencia ya terminó, queda «Emitida» con el indicador de vencida y no puede aceptarse de nuevo. **[Confirmado — DP-06]**
- **RF-068**: El sistema MUST NOT revertir de forma automática una aceptación cuando ya hay un proyecto vinculado; MUST señalar el caso para una revisión administrativa controlada aparte. En la primera versión el módulo no ofrece ninguna acción para ese caso. **[Confirmado — DP-06 y AF-1]**
- **RF-069**: «Cancelada» MUST ser un estado terminal que exige un motivo; el sistema MUST registrar quién, cuándo y por qué. El flujo ordinario de cancelación solo se ofrece desde «Borrador» o desde «Emitida» sin historial de aceptación (RF-104). Una cotización «Aceptada y firmada» MUST NOT cancelarse directamente. **[Confirmado — DP-06 y AF-1]**
- **RF-070**: «Rechazada» MUST ser un estado terminal al que solo se llega desde «Emitida», con un motivo registrado (quién, cuándo y por qué). Una cotización Rechazada o Cancelada MUST NOT reactivarse en silencio; solo puede duplicarse (RF-034). **[Confirmado — DP-06]**
- **RF-071**: Archivar MUST ser un atributo de organización de la cotización, no un estado: no cambia su estado comercial, sus datos ni su historial. Solo el administrador MUST poder archivar y desarchivar. **[Confirmado — DP-06 y AF-1]** (que el listado oculte por defecto las archivadas: **[Propuesto]**)
- **RF-072**: Las únicas transiciones válidas MUST ser: Borrador → Emitida; Borrador → Cancelada; Emitida → Aceptada y firmada; Emitida → Rechazada; Emitida → Cancelada (solo sin historial de aceptación); y Aceptada y firmada → Emitida, solo mediante la reversión de RF-066. La cancelación de una cotización «Aceptada y firmada» o «Emitida» con historial de aceptación solo se hace con el procedimiento correctivo de RF-105. Rechazada y Cancelada no tienen salida. **[Confirmado — DP-06 y AF-1]**

**Numeración, revisiones y duplicados** *(decisión DP-08, aprobada el 2026-11-09)*

- **RF-080**: El número de cotización MUST tener el formato `COT-AAAA-NNNN`, donde AAAA es el año del calendario de `America/Tegucigalpa` en que se emite por primera vez y NNNN es la secuencia de ese año, que se reinicia cada año. NNNN MUST tener un mínimo de cuatro dígitos y la secuencia MUST continuar más allá de 9999 sin colisiones. **[Confirmado — DP-08 y AF-4]**
- **RF-081**: El número MUST asignarse solo en la primera emisión, MUST ser único y permanente y MUST NOT reutilizarse nunca, ni siquiera si la cotización se cancela, se sustituye o se archiva. Dos emisiones simultáneas MUST NOT recibir el mismo número. **[Confirmado — DP-08]**
- **RF-082**: Las revisiones MUST usar el número de la original con el sufijo `-R1`, `-R2`, etc., que se asigna al emitir cada revisión. **[Confirmado — DP-08]**
- **RF-083**: El módulo MUST permitir crear una revisión solo de una cotización «Emitida» que no esté vencida que sea la versión emitida más reciente y no esté sustituida. MUST NOT ofrecer revisar cotizaciones vencidas, rechazadas, canceladas, «Aceptada y firmada» ni sustituidas; para retomarlas, se duplican. **[Confirmado — DP-08 y AF-4]** Una cotización «Emitida» con historial de aceptación (volvió de una aceptación revertida) MUST NOT ofrecer la revisión mientras el propietario no la apruebe de forma expresa. **[Confirmado — instrucción del propietario de 2026-11-09]** (si llega a permitirse: pendiente, DA-10)
- **RF-084**: Una revisión MUST empezar como un borrador con los precios, líneas y condiciones de la versión original y MUST permitir que el administrador los cambie de forma explícita. La versión original MUST seguir intacta hasta que se emita la revisión. **[Confirmado — DP-08]**
- **RF-085**: Al emitirse una revisión, MUST recibir su propia fecha de emisión y sus propios 15 días calendario de vigencia, calculados según RF-062, y la versión anterior MUST quedar marcada «sustituida». Cada revisión emitida MUST conservar su historial de forma inmutable. **[Confirmado — DP-08 y AF-2]**
- **RF-086**: «Sustituida» MUST ser un atributo de la versión, no un estado del ciclo de vida. Una versión sustituida MUST permanecer disponible para auditoría sin cambios y MUST NOT poder aceptarse, rechazarse, cancelarse ni revisarse. **[Confirmado — DP-08 y AF-1]**
- **RF-087**: Todas las versiones de una cotización (original y revisiones) MUST quedar enlazadas y conservarse; el historial MUST ser visible solo para el administrador. **[Confirmado — DP-08]** (la visibilidad solo para el administrador sigue de RF-001 y RF-002)
- **RF-088**: Un duplicado MUST ser un borrador nuevo con una referencia a su origen, y MUST recibir un número nuevo e independiente solo al emitirse. **[Confirmado — DP-08]**
- **RF-089**: En un duplicado, los elementos vinculados al catálogo MUST usar los precios vigentes del catálogo en HNL, y las líneas manuales MUST conservar los precios del origen. **[Confirmado — DP-08]** Los precios son unitarios y cada línea conserva la cantidad del origen (RF-118). **[Confirmado — DA-08]**
- **RF-090**: El sistema MUST mostrar al administrador qué precios cambiaron y cuáles se conservaron en un duplicado, y MUST exigir una revisión explícita de cada línea manual antes de poder emitirlo. **[Confirmado — DP-08]**
- **RF-091**: El duplicado MUST NOT modificar la cotización original ni sus precios históricos. **[Confirmado — DP-08]**
- **RF-092**: Al duplicar o revisar, el sistema MUST revalidar el anticipo, los hitos de desarrollo, los cargos recurrentes y los tramos de tarifa mensual con las mismas reglas de una cotización nueva (RF-019, RF-074 y RF-076). **[Confirmado — DP-08]**
- **RF-093**: Un duplicado o una revisión MUST conservar el modo del anticipo (monto fijo o porcentaje). Si cambia el total único, el sistema MUST recalcular el monto en porcentaje o conservar el monto fijo, y en ambos casos MUST señalarlo para que el administrador lo confirme. **[Confirmado — DP-08]**
- **RF-094**: El anticipo y los hitos MUST NOT superar el total único ni dejar de cuadrar con él; los cargos recurrentes MUST NOT incluirse en el total único. **[Confirmado — DP-08]**
- **RF-095**: El sistema MUST NOT emitir una cotización de forma automática ni permitir emitir una con inconsistencias financieras sin resolver. **[Confirmado — DP-08]**
- **RF-096**: Una revisión en borrador MUST NOT poder emitirse si su cotización de origen ya no es elegible según RF-083; en ese caso el administrador la duplica. **[Confirmado — AF-4]**
- **RF-097**: El sistema MUST NOT permitir más de una revisión en borrador por familia de cotización a la vez. **[Confirmado — AF-4]**
- **RF-098**: Un elemento del catálogo retirado MUST señalarse al duplicar y MUST impedir emitir hasta que el administrador lo quite o lo sustituya. **[Confirmado — AF-4]**
- **RF-099**: Un duplicado MUST heredar una instantánea editable de los datos del cliente o prospecto del origen, y el administrador MUST poder actualizarla antes de emitir sin afectar al origen. **[Confirmado — AF-4]**
- **RF-100**: El módulo MUST NOT revisar, reactivar ni modificar en silencio cotizaciones vencidas, rechazadas, canceladas ni «Aceptada y firmada», y MUST conservar todas las reglas del ciclo de vida de DP-06. **[Confirmado — DP-08]**

**Aprobación final (AF-1 a AF-5)** *(aprobada el 2026-11-09)*

- **RF-104**: Una cotización con cualquier historial de aceptación (hoy «Aceptada y firmada» o «Emitida» tras una reversión) MUST NOT poder cancelarse por el flujo ordinario de cancelación. **[Confirmado — AF-1]**
- **RF-105**: Una cancelación correctiva posterior a una aceptación MUST hacerse con un procedimiento separado, explícito y controlado por el administrador, distinto de la cancelación ordinaria, con una justificación obligatoria y un registro de auditoría inmutable (quién, cuándo y por qué). **[Confirmado — AF-1]** (que el procedimiento no esté disponible para una cotización con proyecto vinculado, igual que la reversión: **[Propuesto]**)
- **RF-106**: El módulo MUST conservar de forma segura las cotizaciones, sus versiones, su historial y sus evidencias, y MUST NOT ofrecer su eliminación permanente en la interfaz normal ni definir plazos de retención o de eliminación. Cualquier obligación legal de retención MUST someterse a una aprobación aparte. **[Confirmado — AF-5]**
- **RF-107**: La composición de paquetes y módulos MUST NOT cobrar un mismo componente dos veces: si un módulo ya forma parte de un paquete elegido, no suma un cargo adicional y se muestra como incluido. **[Confirmado — AF-5]** (cómo se declara qué módulos incluye cada paquete: **[Propuesto]**, lo define el plan) Las unidades adicionales de un módulo incluido se rigen por RF-119. **[Confirmado — DA-08]**
- **RF-108**: Si un cambio de precio del catálogo afecta a un borrador, el sistema MUST señalar la diferencia y exigir una revisión explícita del administrador (actualizar o conservar) antes de emitir, y MUST NOT repreciar en silencio. **[Confirmado — AF-5]** La diferencia se evalúa por precio unitario (RF-118). **[Confirmado — DA-08]**
- **RF-109**: La vigencia de una cotización MUST NOT extenderse nunca de forma automática; emitir una revisión crea una vigencia propia para la revisión y no modifica la de la versión anterior. **[Confirmado — AF-2]**
- **RF-110**: Cuando una cotización no define hitos adicionales y tiene saldo restante mayor que cero, el sistema MUST exigir que el administrador escriba de forma explícita las condiciones acordadas del pago único y MUST NOT permitir emitirla sin ellas. **[Confirmado — AF-3]** La regla MUST aplicarse también cuando no se configuró ningún anticipo: en ese caso el saldo es todo el total único y el cargo único exige sus condiciones de pago. **[Confirmado — DA-12]**
- **RF-111**: Un anticipo igual a cero MUST NOT crear un hito de pago visible. **[Confirmado — AF-3]**
- **RF-112**: Crear o vincular un proyecto MUST ser una acción explícita y controlada por el administrador; el sistema MUST NOT crear proyectos automáticamente, ampliar roles, enviar correos ni cobrar pagos. **[Confirmado — AF-5]**
- **RF-113**: El módulo MUST NOT aplicar descuentos automáticos en la primera versión, y los descuentos automáticos, el cálculo de impuestos, la facturación automática y el procesamiento de pagos quedan fuera de ella. **[Confirmado — AF-3 y AF-5]**
- **RF-114**: La evidencia de la aceptación MUST poder guardarse como archivo o como referencia segura; el plan MUST elegir la opción, y guardar archivos MUST tratarse como una decisión de arquitectura (hoy el proyecto no almacena archivos). **[Confirmado — AF-5]** (la elección entre archivo y referencia: decisión del plan)

**Cantidad, límites, redondeo y presentación** *(decisiones DA-01, DA-07, DA-08 y DA-14, aprobadas el 2026-11-09 al revisar el plan)*

- **RF-115**: Cada línea MUST tener una cantidad entera y un precio unitario en HNL. La cantidad MUST ser 1 por defecto y estar entre 1 y 9,999; el sistema MUST rechazar una cantidad igual a cero, negativa o con decimales. El importe de la línea MUST ser la cantidad por el precio unitario, exacto y sin redondeo. **[Confirmado — DA-08]**
- **RF-116**: La cantidad MUST aplicarse tanto a las líneas de cargo único como a las de servicio recurrente. En un servicio recurrente, la tarifa y la de cada tramo (RF-076) MUST expresarse como un precio por unidad y por período, y la cantidad de la línea MUST ser la misma en todos los tramos. **[Confirmado — DA-08]**
- **RF-117**: Un ajuste del primer período acordado a mano (RF-078) MUST aplicarse una sola vez a toda la línea y MUST NOT multiplicarse por la cantidad. **[Confirmado — DA-08]**
- **RF-118**: El sistema MUST calcular el importe de cada línea y los totales a partir de la cantidad y el precio unitario, y el administrador MUST NOT poder fijar un importe de línea ni un total que no salga de ese cálculo. La comparación con el catálogo (RF-108) y la de un duplicado (RF-089, RF-090) MUST hacerse por precio unitario, y un duplicado o una revisión MUST conservar la cantidad de cada línea del origen. **[Confirmado — DA-08]**
- **RF-119**: Un módulo ya incluido en un paquete elegido MUST NOT cobrarse, sea cual sea su cantidad (RF-107). Las unidades adicionales de ese módulo MUST cotizarse en una línea facturable explícita que el administrador añade y marca como tal; el sistema MUST NOT generar ese cargo de forma automática. **[Confirmado — DA-08]** (la forma de marcar la línea: **[Propuesto]**, la define el plan)
- **RF-120**: Las cantidades fraccionarias y la facturación por horas con fracciones MUST quedar fuera de la primera versión. **[Confirmado — DA-08]**
- **RF-121**: El sistema MUST aplicar estos límites: precio unitario e importe de cada línea (cantidad por precio unitario) de hasta L 99,999,999.99; total de la cotización de hasta L 999,999,999.99; un máximo de 100 líneas por cotización y de 12 tramos de tarifa por servicio; y cantidad entera de 1 a 9,999. El sistema MUST validar por separado la cantidad por el precio unitario, el importe de cada línea y el total de la cotización, MUST rechazar con un mensaje claro la operación que supere un límite y MUST NOT emitir una cotización ni calcular un anticipo en porcentaje sobre un total fuera de límite. **[Confirmado — DA-07]** (son límites técnicos, no una política comercial)
- **RF-122**: El anticipo en porcentaje MUST redondearse a dos decimales de HNL con redondeo decimal «mitad hacia arriba» (medio centavo exacto sube al centavo siguiente), aplicado una sola vez sobre el total único. El porcentaje admite hasta dos decimales. El cálculo MUST ser exacto, sin errores de coma flotante, y el saldo MUST ser el total único menos el anticipo redondeado, de modo que ambos sumen el total único. Es la única operación de redondeo del módulo. **[Confirmado — DA-01]**
- **RF-123**: Los importes MUST mostrarse en todo el módulo con el formato `L 1,250.00`: símbolo «L», coma de miles, punto decimal y siempre dos decimales. La captura de importes MUST aceptar el punto como separador decimal (por ejemplo `1250.00`), MUST interpretarse igual en cualquier navegador y configuración regional, MUST ser exacta al centavo y MUST rechazar con un mensaje claro una entrada ambigua en lugar de adivinar su valor. Este formato MUST NOT cambiar la presentación de importes de otros módulos. **[Confirmado — DA-14]**

**Navegación y rutas** *(decisión DP-10, aprobada el 2026-11-09)*

- **RF-056**: El menú del administrador MUST incluir una entrada «Cotizaciones» en el grupo «Gestión comercial», visible solo para el rol 0. **[Confirmado — DP-10]**
- **RF-057**: El módulo MUST usar únicamente estas tres rutas nuevas, autorizadas de forma expresa por el propietario: `/dashboard/cotizaciones` (listado y gestión), `/dashboard/cotizaciones/:id` (detalle, edición y vista previa) y `/dashboard/cotizaciones/catalogo` (catálogo de paquetes y módulos). **[Confirmado — DP-10]**
- **RF-058**: Cada una de las tres rutas MUST conservar la protección de rutas existente (`ProtectedRoute` con `allowedTypes={[0]}`), las restricciones de navegación por rol y el modelo de autorización actual. Ningún colaborador ni cliente gana acceso. **[Confirmado — DP-10]**
- **RF-059**: La ruta fija `/dashboard/cotizaciones/catalogo` MUST resolverse siempre al catálogo y no interpretarse como el identificador de una cotización; ningún identificador de cotización MUST poder coincidir con «catalogo». **[Confirmado — DP-10]**
- **RF-060**: La entrada del menú MUST marcarse como página actual en las tres rutas. **[Propuesto]**
- **RF-061**: Cualquier ruta adicional distinta de las tres autorizadas MUST NOT crearse sin una nueva consulta al propietario. **[Confirmado — DP-10]**

### Entidades clave

*(Descritas por lo que representan, sin estructura técnica.)*

- **Cotización**: propuesta económica dirigida a un cliente. Atributos: identificador, estado, fecha de emisión, fecha de vigencia, datos del cliente o prospecto (instantánea, RF-043), líneas, totales, anticipo, plan de hitos, condiciones, historial de revisiones, registro de aceptación, vínculo con un proyecto (si se hizo) y quién la creó o modificó.
- **Línea de cotización**: renglón de una cotización. Puede ser un paquete, un módulo opcional o una línea definida a mano; tiene descripción, cantidad (entero de 1 a 9,999), precio unitario en HNL, importe (cantidad por precio unitario, calculado por el sistema), clasificación única o recurrente, periodicidad mensual o anual (si es recurrente) y si está incluida. Una línea de unidades adicionales de un módulo incluido en un paquete se marca como tal (RF-119).
- **Catálogo**: lista de paquetes de servicio y módulos opcionales que mantiene el administrador, con sus precios unitarios en HNL (RF-040). No trae precios precargados (RF-047). La cantidad no se define en el catálogo, sino en cada cotización.
- **Paquete de servicio**: conjunto de entregables con un precio en HNL que fija el administrador en el catálogo.
- **Módulo opcional**: complemento que se agrega a un paquete o a una cotización, también con precio en HNL fijado por el administrador en el catálogo.
- **Anticipo y saldo**: anticipo (monto fijo en HNL o porcentaje del total único, que el administrador define) y lo que resta del total único; el anticipo es el primer hito de pago.
- **Hito de pago**: tramo del pago único de una cotización, acordado con el cliente; el administrador decide por cotización si hay hitos adicionales. Un anticipo positivo es el primero; con los demás suman el total único. Sin hitos adicionales, el saldo es un único pago con condiciones acordadas (RF-110).
- **Cuota recurrente**: cargo periódico mensual o anual (como el mantenimiento mensual, que se factura por adelantado), con fecha de inicio, tarifas y condiciones de renovación que define el administrador, y mostrado aparte del total único.
- **Tramo de tarifa**: rango de meses de un servicio mensual con su propia tarifa por unidad y por período (por ejemplo, meses 1 a 3); los importes los escribe el administrador y la cantidad de la línea se aplica a todos los tramos (RF-116).
- **Número de cotización**: identificador `COT-AAAA-NNNN` asignado en la primera emisión, único y permanente (RF-080, RF-081).
- **Versión**: la cotización original o una de sus revisiones; las versiones emitidas son inmutables y la anterior a una revisión emitida queda «sustituida» (RF-027, RF-086).
- **Revisión**: versión posterior de una cotización emitida, con el número de la original más el sufijo `-R1`, `-R2`…; se emite con sus propios 15 días de vigencia (RF-082 a RF-085).
- **Duplicado**: borrador nuevo creado a partir de otra cotización, con referencia a su origen y número propio al emitirse (RF-088 a RF-091).
- **Cliente o prospecto**: persona o empresa destinataria (mínimo para emitir: nombre y un medio de contacto). Sus datos de contacto se capturan con la cotización y se conservan en ella como instantánea; más adelante puede asociarse a un registro formal de cliente sin perder el historial (RF-039, RF-042 a RF-045). *(Sin datos personales en este repositorio.)*
- **Registro de aceptación**: constancia de que el cliente aceptó la cotización, con sus metadatos auditables, el documento firmado o su referencia segura, y acceso privado solo para el administrador (RF-041, RF-051, RF-052).
- **Cancelación correctiva**: procedimiento separado y controlado para cancelar una cotización con historial de aceptación, con justificación obligatoria y auditoría inmutable (RF-105). Si se revierte, se añade el registro inmutable de la reversión (quién, cuándo y por qué) y el original se conserva (RF-066).
- **Vínculo con proyecto**: relación entre una cotización «Aceptada y firmada» y un proyecto, que solo nace de una acción explícita del administrador (RF-054, RF-055).

## Alcance

### Dentro del alcance de la primera versión

Crear, editar, calcular, previsualizar y gestionar cotizaciones por parte del administrador; paquetes, módulos opcionales, líneas manuales, cargos únicos, anticipos, saldos, hitos y cuotas recurrentes mensuales o anuales (separadas, con tramos de tarifa mensual); cantidad entera por precio unitario en cada línea (DA-08); importes en HNL con el formato `L 1,250.00` (DA-14); vigencia de 15 días calendario; reglas de los Términos del Servicio descritas arriba. Por las decisiones aprobadas: cotizaciones para prospectos sin registro de cliente ni proyecto previos (Q1 = B); catálogo de paquetes y módulos administrado por el administrador con precios en HNL (Q2 = A); registro manual de la aceptación con el documento firmado o su referencia segura, y vínculo con un proyecto solo por acción explícita (Q3 = A, AF-5); numeración permanente, revisiones inmutables y duplicados con comparación de precios (DP-08, AF-4); salvaguardas del ciclo de vida, la vigencia y las finanzas (AF-1 a AF-3).

### Fuera del alcance *(Confirmado)*

- Integraciones con pasarelas de pago y procesamiento de pagos en línea.
- Envío real de correos o cualquier notificación.
- Conversión de moneda y tipo de cambio (Q2 = A).
- Cambios en el contenido público que expresa precios en dólares (Q2 = A).
- Recogida de firmas electrónicas (Q3 = A).
- Creación o enlace automático de proyectos al aceptar una cotización (Q3 = A).
- Un módulo de gestión de clientes (Q1 = B).
- Rutas nuevas distintas de las tres autorizadas, y cualquier acceso para colaboradores o clientes (DP-10).
- Reactivar o extender la vigencia de una cotización vencida, rechazada o cancelada; «vencida» como estado propio; archivar como estado (DP-06).
- Reversión automática de una aceptación con proyecto vinculado, y cancelación directa de una cotización Aceptada y firmada (DP-06).
- Cobros, facturas, renovaciones y pagos automáticos, pasarela de pago y prorrateo automático (DP-05).
- Periodicidades distintas de la mensual y la anual (DP-05).
- Cálculo de impuestos, configuración de tasas, inferencia de exenciones, total con impuestos incluidos, facturación fiscal y obligaciones tributarias (DP-04).
- Formatos de numeración distintos de `COT-AAAA-NNNN`, y reutilizar o reasignar números (DP-08).
- Eliminar de forma permanente cotizaciones, versiones o evidencias, y definir plazos de retención (AF-1, AF-5).
- Descuentos automáticos, facturación automática y procesamiento de pagos (AF-3).
- Revisar en silencio una cotización vencida, rechazada, cancelada o «Aceptada y firmada»; editar una versión ya emitida (DP-08).
- Cantidades fraccionarias y facturación por horas con fracciones (DA-08).
- Cambiar el formato de importes de otros módulos de la aplicación (DA-14).

### Límites de esta etapa de especificación *(Confirmado)*

Son límites de esta etapa, no de la funcionalidad: cuando se implemente, entrará por `/tarea` y necesitará código y datos.

- Implementación de código de aplicación.
- Cambios en la base de datos.
- Creación de ramas de git.
- Despliegue.

### Diferido más allá de la primera versión

Mejoras que el propietario no pidió para la primera versión. No son bloqueos del plan.

- Descuentos automáticos **[Confirmado — AF-3 y AF-5]**; descuentos manuales: la primera versión rechaza importes negativos (RF-015), así que no los admite **[Propuesto]** (DP-11).
- Cálculo de impuestos, facturación automática, procesamiento de pagos y pasarela **[Confirmado — DP-04, AF-3]**.
- Firma electrónica **[Confirmado — Q3 = A]** y envío de correos **[Confirmado]**.
- Generación y descarga de archivos (PDF u otros) y entrega del documento al cliente: la spec solo exige la vista previa **[Propuesto]** (DP-07, resto).
- Reglas de dependencia o incompatibilidad entre módulos **[Propuesto]** (DP-02, resto).
- Cantidades fraccionarias y facturación por horas con fracciones **[Confirmado — DA-08]**.
- Acciones del módulo para cotizaciones con proyecto vinculado (reversión o cancelación correctiva): se atienden fuera del flujo ordinario **[Confirmado — AF-1]**.
- Acceso del colaborador o del cliente a cotizaciones, incluida su visualización en el portal **[Confirmado]**.
- Reportes financieros y conciliación de cobros (módulo «Cobros y comprobantes», que sigue «próximamente»).
- Un módulo de gestión de clientes **[Confirmado — Q1 = B]**.

## Decisiones del propietario

### Aprobadas *(2026-11-09)*

Las tres preguntas que estaban marcadas en los requisitos quedaron resueltas, y la sesión de aclaración y la aprobación final cerraron el resto. Los identificadores `DP-##` se conservan para no romper referencias.

| ID | Decisión aprobada | Requisitos |
| --- | --- | --- |
| DP-01 | **Q1 = B — Cliente o prospecto**: el administrador puede cotizar a un prospecto sin registro de cliente ni proyecto previos. La cotización captura los datos de contacto necesarios, conserva una instantánea estable de ellos y puede asociarse después a un registro formal de cliente sin perder el historial. El módulo «Clientes» no es prerrequisito y esta spec no crea un módulo de clientes. | RF-039, RF-042 a RF-045 |
| DP-02 | **Q2 = A — Catálogo**: el administrador gestiona los paquetes de servicio, los módulos opcionales y sus precios. No hay precios inventados ni fijos en la aplicación. | RF-040, RF-047 |
| DP-03 | **Q2 = A — Moneda**: todos los precios del catálogo y todos los cálculos están en HNL. No hay conversión ni tipo de cambio. Las cotizaciones emitidas conservan los precios aplicados. El contenido público en dólares no cambia. Las reglas de impuestos están en DP-04 (los importes excluyen impuestos). | RF-012, RF-013, RF-046, RF-048 |
| DP-04 | **Opción A con aclaraciones — Impuestos** *(aprobada en la sesión de aclaración de 2026-11-09)*: todos los importes están en HNL y excluyen impuestos. Toda cotización dirigida al cliente muestra de forma destacada el aviso exacto «Los importes no incluyen impuestos». El módulo no calcula montos de impuesto, no configura tasas, no infiere exenciones y no presenta un total con impuestos incluidos; el total se rotula como sin impuestos para no confundirlo con el monto final de una factura fiscal. Anticipo, hitos, saldo y recurrentes se calculan sobre los importes sin impuestos. La evaluación real de impuestos, la facturación fiscal y las obligaciones tributarias quedan fuera de esta versión, sin dar a entender que los impuestos estén exentos o nunca apliquen. Sin tasas, exenciones, requisitos fiscales ni políticas comerciales inventados. | RF-021, RF-022, RF-101 a RF-103 |
| DP-05 | **Opción D personalizada (B + A) — Anticipos, hitos y servicios recurrentes** *(aprobada en la sesión de aclaración de 2026-11-09)*: el anticipo es un monto fijo en HNL o un porcentaje del total único, a elección del administrador, sin valor por defecto, entre cero y el total único (ambos incluidos), con cálculos y redondeo consistentes a dos decimales de HNL. El anticipo es el primer hito de pago; anticipo más los demás hitos suman exactamente el total único, sin contar el anticipo dos veces; lo recurrente queda fuera de esas sumas. Servicios recurrentes con periodicidad mensual o anual por servicio; el mantenimiento mensual se factura por adelantado; las condiciones de pago anual se declaran explícitamente en la cotización; el administrador define fecha de inicio, tarifas y condiciones de renovación; se documentan tramos de tarifa mensual por rango de meses sin inventar importes. Sin pagos, facturas, renovaciones ni pasarela automáticos y sin prorrateo automático: todo ajuste del primer período lo define el administrador. | RF-009, RF-010, RF-014, RF-016 a RF-020, RF-073 a RF-079 |
| DP-06 | **Opción A con correcciones — Estados, vigencia y correcciones** *(aprobada en la sesión de aclaración de 2026-11-09)*: estados Borrador, Emitida, Aceptada y firmada, Rechazada y Cancelada. «Vencida» es una condición derivada, no un estado: la cotización sigue «Emitida» con un indicador de vencida. Vigencia de 15 días calendario desde la emisión en hora de Honduras, con una fecha exacta única y sin día adicional (RF-062). Una cotización vencida no se acepta ni se reactiva: se duplica en un borrador nuevo y se emite una nueva, conservando original e historial; la política de precios del duplicado está en DP-08 (RF-088 a RF-091). La aceptación solo vale sobre una cotización emitida, no vencida y con la evidencia de la propuesta firmada. Una aceptación por error se revierte con motivo obligatorio y auditoría inmutable (quién, cuándo y por qué), conservando el registro y la evidencia originales; vuelve a «Emitida» (si ya venció, queda emitida, marcada como vencida y sin poder aceptarse). Con un proyecto vinculado la reversión no es automática: se señala para una revisión administrativa controlada aparte. «Cancelada» es terminal y exige motivo. Rechazada y Cancelada no se reactivan en silencio. Archivar es un atributo de organización, no un estado. *Confirmaciones posteriores*: el día de emisión cuenta como día 1 (emitida el 1 de noviembre, válida hasta el 15 y vencida desde las 00:00 del 16, zona horaria `America/Tegucigalpa`); se cancela solo desde Borrador o Emitida, con motivo obligatorio, y una cotización Aceptada y firmada requiere un procedimiento administrativo controlado aparte; se rechaza solo desde Emitida, con motivo registrado. | RF-023 a RF-026, RF-034 y RF-062 a RF-072 |
| DP-07 | **Q3 = A — Aceptación y firma**: el administrador registra a mano la aceptación y la referencia a la propuesta firmada. Se conserva la evidencia con acceso privado y controlado por autorización, y se registran los datos de la aceptación. No hay firma electrónica. | RF-041, RF-051 a RF-053 |
| DP-08 | **Opción A con salvaguardas — Numeración, revisiones y duplicados** *(aprobada en la sesión de aclaración de 2026-11-09)*: número `COT-AAAA-NNNN`, con el año del calendario de `America/Tegucigalpa`, secuencia reiniciada cada año y asignada solo en la primera emisión; los borradores no tienen número definitivo; los números son únicos, permanentes y nunca se reutilizan. Revisiones con sufijo `-R1`, `-R2` bajo el número de la original; versiones emitidas inmutables (datos del cliente, precios, condiciones y fechas de emisión); la revisión parte de los precios originales y admite cambios explícitos; al emitirla recibe sus propios 15 días de vigencia y la versión anterior queda «sustituida», disponible para auditoría y sin poder aceptarse. No se revisan en silencio las cotizaciones vencidas, rechazadas, canceladas ni aceptadas y firmadas. Duplicado: borrador nuevo con referencia al origen y número independiente al emitirlo; el catálogo usa precios vigentes, las líneas manuales conservan precios y se revisan explícitamente, el original no cambia y se muestra qué precios cambiaron y cuáles se conservaron. Revalidación financiera completa en duplicados y revisiones: anticipo (modo conservado, recalculado o señalado), hitos, recurrentes y tramos; nunca se emite con inconsistencias sin resolver. | RF-027, RF-028, RF-034 y RF-080 a RF-100 |
| DP-09 | **Q3 = A — Aceptación y proyecto**: aceptar una cotización nunca crea ni enlaza un proyecto. Crear o enlazar uno exige una acción aparte, explícita y autorizada. | RF-054, RF-055 |
| DP-10 | **Opción B — Ubicación y rutas** *(aprobada en la sesión de aclaración de 2026-11-09)*: entrada «Cotizaciones» en el grupo «Gestión comercial», solo administrador. Tres rutas nuevas autorizadas de forma expresa: `/dashboard/cotizaciones`, `/dashboard/cotizaciones/:id` y `/dashboard/cotizaciones/catalogo`. Se conservan `ProtectedRoute` con `allowedTypes={[0]}`, las restricciones de navegación por rol y el modelo de autorización actual, sin acceso para colaboradores ni clientes. La ruta fija `/catalogo` se resuelve correctamente junto a `/:id`. | RF-001, RF-056 a RF-061 |

#### Aprobación final *(2026-11-09)*

| ID | Decisión aprobada | Cierra | Requisitos |
| --- | --- | --- | --- |
| AF-1 | **Salvaguardas del ciclo de vida**: una cotización con cualquier historial de aceptación no se cancela por el flujo ordinario, ni siquiera tras la reversión; la aceptación errónea se corrige con la reversión auditada; cualquier cancelación correctiva posterior exige un procedimiento separado, explícito y controlado por el administrador, con justificación obligatoria y auditoría inmutable. Con proyecto vinculado no hay reversión automática. Los borradores se cancelan con motivo y no se eliminan de forma permanente. Las versiones sustituidas no se aceptan, rechazan, cancelan ni revisan. Solo el administrador archiva y desarchiva, y archivar no cambia el estado comercial. | DP-06 (resto) | RF-005, RF-068, RF-069, RF-071, RF-072, RF-086, RF-104, RF-105 |
| AF-2 | **Vigencia y revisiones**: 15 fechas calendario en `America/Tegucigalpa`, con el día de emisión como día uno, sin garantizar 15 períodos completos de 24 horas. Cada revisión emitida tiene su vigencia e historial inmutable; emitirla sustituye a la anterior y la vigencia nunca se extiende de forma automática. Las vencidas se duplican. | DP-06, DP-08 | RF-062, RF-085, RF-109 |
| AF-3 | **Reglas financieras**: el administrador decide por cotización si hay hitos adicionales; sin ellos, el saldo es un único pago con condiciones acordadas de forma explícita. Un anticipo positivo es el primer hito y no se cuenta dos veces; un anticipo en cero no crea un hito visible. Conciliación exacta de los pagos únicos y separación de los recurrentes. Fuera de la primera versión: impuestos calculados, facturación automática, procesamiento de pagos y descuentos automáticos. Aviso de impuestos junto a los totales. | DP-05 (resto), DP-11 (en parte) | RF-018, RF-019, RF-021, RF-110, RF-111, RF-113 |
| AF-4 | **Salvaguardas de revisión y duplicado**: se aprueban las seis. Una revisión en borrador no se emite si su origen ya no es elegible; una revisión en borrador por familia; los elementos retirados del catálogo bloquean emitir un duplicado; los duplicados heredan una instantánea editable del prospecto; las revisiones de años posteriores conservan el identificador y el año de la original; solo se revisa la versión emitida más reciente, elegible y no sustituida. El ancho de `NNNN` es un mínimo de cuatro dígitos y la secuencia sigue más allá de 9999 sin colisiones. | DP-08 (propuestas), DP-06 (resto, secuencia) | RF-080, RF-083, RF-096 a RF-099 |
| AF-5 | **Decisiones restantes de la primera versión**: mínimo del prospecto (nombre de persona o empresa y al menos un medio de contacto); documento firmado guardado o referenciado de forma segura, con acceso solo del administrador y metadatos auditables, sin firma electrónica; proyecto creado o vinculado de forma explícita, conservando la instantánea de la cotización y transfiriendo solo cliente, alcance y finanzas necesarios, sin creación automática, ampliación de roles, correos ni cobros; la composición de paquetes y módulos no cobra dos veces; un cambio de precio del catálogo que afecte a un borrador exige revisión explícita, nunca repreciado en silencio; descuentos automáticos diferidos; registros históricos conservados de forma segura, sin inventar plazo de retención ni de eliminación, y con cualquier obligación legal de retención sometida a aprobación aparte. | DP-01 (resto), DP-02 (resto, en parte), DP-07 (resto, en parte), DP-09 (resto, en parte), DP-12 (en parte) | RF-042, RF-051, RF-052, RF-055, RF-106 a RF-108, RF-112 a RF-114 |

#### Decisiones aprobadas al revisar el plan técnico *(2026-11-09)*

Solo figuran aquí las que cambian una regla visible para el negocio. Las decisiones puramente técnicas aprobadas el mismo día (DA-05, DA-06 y DA-13) están en `plan.md`.

| ID | Decisión aprobada | Requisitos |
| --- | --- | --- |
| DA-01 | **Redondeo**: el anticipo en porcentaje se redondea a dos decimales de HNL con redondeo decimal mitad hacia arriba, con aritmética exacta en centavos y una representación documentada del porcentaje. | RF-014, RF-122 |
| DA-07 | **Límites**: L 99,999,999.99 por línea, L 999,999,999.99 por total de la cotización, 100 líneas, 12 tramos de tarifa y cantidad entera de 1 a 9,999. La cantidad por el precio unitario, el importe de cada línea y el total se validan por separado, y lo que supera un límite se rechaza antes de emitir y antes de calcular un anticipo en porcentaje. | RF-015, RF-121 |
| DA-08 | **Cantidad por precio unitario**: cantidad entera (1 por defecto, de 1 a 9,999) por precio unitario en HNL, en líneas de cargo único y recurrentes. Los tramos son precios por unidad y por período con la misma cantidad. El importe de la línea lo calcula el sistema. Las comparaciones con el catálogo y en duplicados son por precio unitario. Un módulo incluido no se cobra dos veces y las unidades adicionales exigen una línea facturable explícita. El ajuste del primer período se aplica una vez a toda la línea. Las cantidades fraccionarias quedan diferidas. | RF-008, RF-010, RF-076, RF-078, RF-089, RF-107, RF-108, RF-115 a RF-120 |
| DA-12 | **Condiciones de pago**: los cargos únicos exigen condiciones de pago explícitas aunque no se haya configurado un anticipo ni hitos adicionales. | RF-110 |
| DA-14 | **Presentación de la moneda**: formato `L 1,250.00` y captura decimal sin ambigüedad (`1250.00`), determinista, exacta al centavo e independiente del navegador; sin cambiar el formato de otros módulos. | RF-012, RF-123 |

### Pendientes y diferidos

Ningún punto de esta tabla impide generar las tareas de la primera versión. Cada uno es una puerta de aprobación de una fase concreta, un detalle que el plan concreta con aprobación del propietario o una mejora diferida. Las propuestas no son decisiones.

| ID | Tema | Tipo | Qué hace la primera versión mientras tanto |
| --- | --- | --- | --- |
| DP-02 (resto) | Dependencias o incompatibilidades entre módulos y módulos en varios paquetes. | Diferido | Sin reglas de dependencia. La composición solo evita el doble cobro (RF-107). **[Propuesto]** |
| DP-07 (resto) | Formato de entrega del documento al cliente (PDF, enlace, entrega manual) y conjunto exacto de metadatos de la aceptación. | Detalle para el plan y diferido | La entrega es externa al módulo y los metadatos son el conjunto mínimo de RF-052. **[Propuesto]** |
| DP-09 (resto) | Campos exactos que pasan al proyecto, relación entre cotizaciones y proyectos (cuántas por cada uno) y revisión administrativa controlada con proyecto vinculado. | Detalle para el plan, con aprobación del propietario porque toca una zona delicada | Vinculación explícita; el módulo no revierte ni cancela cotizaciones con proyecto vinculado. Una cotización se vincula como máximo a un proyecto. **[Propuesto]** |
| DP-11 | Descuentos manuales (los automáticos ya están diferidos). | Diferido | Sin descuentos: no se admiten importes negativos (RF-015). **[Propuesto]** |
| DP-12 | Plazo de conservación y eliminación, y posible obligación legal de retención. | Aprobación aparte | Todo se conserva; no se define ningún plazo. **[Confirmado — AF-5]** |
| DA-10 | Si una cotización «Emitida» que volvió de una aceptación revertida puede revisarse. | Puerta de aprobación antes de implementar la aceptación | No se ofrece la revisión; la cotización se puede duplicar (RF-083). **[Confirmado — instrucción del propietario de 2026-11-09]** |
| DA-02, DA-09, DA-11 | Forma de la evidencia de aceptación (referencia o archivo), asociación con un registro formal de cliente y procedimiento concreto de la cancelación correctiva. | Puertas de aprobación antes de implementar la aceptación (`plan.md`) | La cancelación correctiva de RF-105 se conserva como requisito y no se sustituye por el rechazo ordinario. |
| DA-03, DA-04 | Relación entre cotizaciones y proyectos y qué información pasa al proyecto. | Bloquean la fase de proyectos (`plan.md`) | No se crea ni se enlaza ningún proyecto desde el módulo. |

## Supuestos y dependencias

- **Supuesto**: el rol administrador (0) ya existe, y el panel administrativo y su menú existen como base sobre la que se añade el módulo **[Confirmado]**. El grupo «Gestión comercial» ya tiene «Proyectos» (funcional) y «Clientes» y «Servicios y renovaciones» («próximamente»); «Cotizaciones» se añade ahí (DP-10). Las pruebas del menú que fijan hoy el número de pantallas y entradas tendrán que actualizarse en el plan.
- **Supuesto**: los importes que aparecen en ejemplos y escenarios son ilustrativos para describir pruebas y **no** son precios, tasas ni porcentajes del negocio.
- **Supuesto**: los límites de RF-121 son topes técnicos para proteger el cálculo, no una política comercial de precios ni de volumen **[Confirmado — DA-07]**.
- **Supuesto**: la aplicación no tenía una convención propia para mostrar lempiras; el formato de RF-123 se aplica solo a este módulo **[Confirmado — DA-14]**.
- **Supuesto**: la zona horaria de referencia para fechas y vencimientos es la de Honduras **[Confirmado — DP-06]**.
- **Supuesto**: las cotizaciones no se envían desde este módulo; la entrega al cliente se hace fuera de él y su formato lo decide DP-07.
- **Supuesto**: el administrador custodia la propuesta firmada; el módulo registra la aceptación y su referencia, y no recoge la firma **[Confirmado — Q3 = A]**.
- **Dependencia resuelta**: el módulo «Clientes» figura como «próximamente» y **no** es prerrequisito (Q1 = B). La cotización guarda los datos del prospecto y podrá asociarse a un registro formal de cliente cuando exista.
- **Dependencia resuelta**: la moneda (HNL, sin conversión; Q2 = A) y los impuestos (importes sin impuestos y aviso obligatorio; DP-04) están decididos; los totales del documento son siempre sin impuestos.
- **Dependencia**: vincular una cotización con un proyecto toca la zona de proyectos, que es delicada; el plan debe tratarla como tal, ejecutar `codegraph impact` y leer la sección Riesgos de `docs/context/PROJECT_CONTEXT.md` antes de proponer los campos que se transfieren (AF-5).
- **Dependencia**: guardar el documento firmado como archivo exigiría un almacenamiento de archivos que el proyecto no usa hoy; el plan debe tratarlo como una decisión de arquitectura aprobada por el propietario (constitución, principio I) o empezar solo con la referencia segura (RF-114).
- **Restricciones del proyecto aplicables** *(constitución y `CLAUDE.md`)*:
  - Panel solo para el administrador; ninguna ampliación de acceso sin aprobación del propietario y revisión de `security`.
  - Repositorio público: sin datos personales, secretos ni documentación privada en `specs/` ni en `.specify/`.
  - Producción la opera solo el propietario; cualquier paso de producción es un paso del **Propietario**.
  - La implementación entra por `/tarea`, no por Spec Kit.
  - Crear rutas nuevas, tocar CI o `.claude/settings.json` y cambiar el copy de productos requieren consulta previa. Las tres rutas de DP-10 ya están autorizadas por el propietario; cualquier otra requiere una consulta nueva. La aprobación final (AF-1 a AF-5) no autoriza rutas, roles, infraestructura ni integraciones nuevas.
  - Reglas de los Términos del Servicio que esta spec respeta: validez de 15 días calendario desde la emisión, ningún servicio de desarrollo o consultoría sin propuesta formal aprobada y firmada por ambas partes, mantenimiento mensual facturado por adelantado y proyectos de desarrollo facturados en hitos acordados.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **CE-001**: Un administrador arma una cotización completa (un paquete, un módulo opcional, una línea manual, un anticipo y una cuota recurrente) y la previsualiza en menos de 10 minutos, sin ayuda ni cálculos externos.
- **CE-002**: En el 100 % de las cotizaciones de prueba, cada total visible coincide con la suma exacta de sus líneas visibles, y lo recurrente nunca se suma al total único.
- **CE-003**: El 100 % de los intentos de acceso al módulo y a sus datos por colaboradores, clientes y visitantes anónimos son rechazados, incluidas las vías indirectas.
- **CE-004**: El 100 % de las cotizaciones emitidas muestran fecha de emisión y una fecha «Válida hasta» de 15 días calendario según RF-062, idéntica en el listado, el detalle y la vista previa; ninguna con el indicador de vencida aparece como vigente ni puede aceptarse.
- **CE-005**: Ninguna cotización que no esté «Aceptada y firmada» permite iniciar trabajo desde el módulo.
- **CE-006**: Los importes mostrados están siempre en HNL y todo documento declara que no incluye impuestos; no aparece ninguna tasa, porcentaje ni precio que el propietario no haya definido.
- **CE-007**: Toda cotización emitida conserva sus importes aunque los precios del catálogo cambien después; las cotizaciones nuevas usan los precios vigentes.
- **CE-008**: Al revisar la spec, el propietario puede resolver cada decisión que sigue pendiente en «Decisiones del propietario» sin pedir información adicional sobre el contexto del proyecto.
- **CE-009**: Ningún correo ni notificación sale desde el módulo en ninguna prueba.
- **CE-010**: El 100 % de las cotizaciones de prueba para prospectos se crean y se emiten sin que exista un registro de cliente ni un proyecto, y conservan sin cambios los datos de cliente con que se emitieron.
- **CE-011**: El 100 % de las aceptaciones de prueba dejan registrada la referencia a la propuesta firmada y los datos de la aceptación, y ninguna crea ni enlaza un proyecto por sí sola.
- **CE-012**: El 100 % de los intentos de alcanzar la evidencia de aprobación por un rol distinto del administrador, o sin sesión, son rechazados.
- **CE-013**: El catálogo no contiene ningún precio que no haya introducido el administrador, y el contenido público de precios en dólares no cambia.
- **CE-014**: En el 100 % de las pruebas, las tres rutas autorizadas resuelven a la pantalla correcta para el administrador (en particular `/dashboard/cotizaciones/catalogo` abre el catálogo) y son rechazadas para colaboradores, clientes y visitantes sin sesión; no existe ninguna otra ruta del módulo.
- **CE-015**: En pruebas con fechas fijas, una cotización emitida el día 1 se muestra vigente hasta las 23:59 del día 15 y con el indicador de vencida desde las 00:00 del día 16, en hora de Honduras, incluso si se emitió cerca de la medianoche; en ningún caso se concede un día adicional.
- **CE-016**: El 100 % de las reversiones de aceptación de prueba exigen un motivo, dejan un registro inmutable de quién, cuándo y por qué, y conservan el registro de aceptación original y su evidencia; el 0 % se ejecuta de forma automática cuando hay un proyecto vinculado.
- **CE-017**: Ninguna prueba logra una transición fuera de las definidas en RF-072, reactivar una cotización vencida, rechazada o cancelada, ni cancelar sin motivo; «vencida» y «archivada» nunca aparecen como estados del ciclo de vida.
- **CE-018**: El 100 % de los anticipos de prueba entre cero y el total único (ambos incluidos) se aceptan y el 100 % de los que quedan fuera se rechazan; en cada cotización emitida con hitos, el anticipo positivo más los demás hitos suman exactamente el total único, con el anticipo contado una sola vez y sin diferencias de centavos por redondeo.
- **CE-019**: Ninguna cotización de prueba incluye un anticipo, un porcentaje, una tarifa, un tramo o un ajuste de primer período que el administrador no haya escrito; ningún cálculo prorratea de forma automática.
- **CE-020**: En el 100 % de las cotizaciones de prueba con servicios recurrentes, los importes mensuales y anuales se muestran por separado, no se suman entre sí ni al total único, y no entran en el anticipo, el saldo ni los hitos; las cotizaciones con un servicio anual sin condiciones de pago anual o con tramos mal formados no pueden emitirse.
- **CE-021**: El módulo no genera ningún cobro, factura, renovación ni conexión con una pasarela de pago en ninguna prueba.
- **CE-022**: El 100 % de las cotizaciones emitidas de prueba reciben un número `COT-AAAA-NNNN` único, con el año de `America/Tegucigalpa` y la secuencia anual correcta; ningún número se repite, se reutiliza o se asigna a un borrador, ni siquiera con emisiones simultáneas o tras un cambio de año.
- **CE-023**: El 100 % de las versiones emitidas de prueba permanecen idénticas (cliente, precios, condiciones y fechas) tras emitir una revisión; la revisión emitida lleva el sufijo correcto y sus propios 15 días de vigencia, y la versión anterior queda «sustituida» y no puede aceptarse.
- **CE-024**: En el 100 % de los duplicados de prueba, los elementos del catálogo muestran los precios vigentes, las líneas manuales conservan los suyos, la comparación indica cuáles cambiaron y cuáles se conservaron, y ninguno se emite sin la revisión explícita de cada línea manual; el origen no cambia.
- **CE-025**: Ninguna cotización de prueba creada como duplicado o revisión se emite con un anticipo que exceda el total único, con hitos que no cuadren con él, con recurrentes dentro del total único, con tramos mal formados o sin la confirmación del anticipo recalculado; la emisión nunca es automática.
- **CE-026**: El 100 % de las cotizaciones de prueba dirigidas al cliente muestran de forma destacada el aviso exacto «Los importes no incluyen impuestos» y rotulan el total único como sin impuestos.
- **CE-027**: Ninguna pantalla, vista previa o documento de prueba contiene un monto de impuesto, una tasa, una exención, un total con impuestos incluidos ni un texto que dé a entender que los impuestos están exentos o nunca aplican; el anticipo, los hitos, el saldo y los recurrentes de prueba coinciden con los cálculos sobre los importes sin impuestos.
- **CE-028**: El 100 % de los intentos de cancelar por el flujo ordinario una cotización con historial de aceptación (aceptada, o emitida tras una reversión) son rechazados; la cancelación correctiva solo se completa con justificación y deja un registro inmutable de quién, cuándo y por qué; ninguna cotización con proyecto vinculado se revierte de forma automática.
- **CE-029**: Ninguna versión «sustituida» puede aceptarse, rechazarse, cancelarse ni revisarse; hay como máximo una revisión en borrador por familia de cotización y ninguna se emite si su origen dejó de ser elegible.
- **CE-030**: La interfaz normal no ofrece eliminar de forma permanente ninguna cotización, versión ni evidencia; los borradores descartados quedan cancelados con su motivo.
- **CE-031**: El 100 % de las cotizaciones de prueba sin hitos adicionales y con saldo mayor que cero exigen las condiciones del pago único antes de emitirse, haya o no un anticipo configurado, y un anticipo en cero nunca crea un hito visible.
- **CE-032**: Ningún borrador de prueba cambia de precio por un cambio en el catálogo sin una decisión explícita del administrador, y ningún componente incluido en un paquete elegido se cobra dos veces.
- **CE-033**: El 100 % de las cotizaciones de prueba para prospectos exigen nombre y al menos un medio de contacto para emitirse; la evidencia de aceptación solo la alcanza el administrador y el proyecto, si se vincula, solo recibe información necesaria de cliente, alcance y finanzas, conservando la instantánea de la cotización.
- **CE-034**: En pruebas con más de 9 999 emisiones simuladas en un año, los números continúan de forma secuencial sin colisiones ni reutilización.
- **CE-035**: Los documentos de prueba no describen la vigencia como 15 períodos completos de 24 horas, y cada revisión emitida tiene su propia vigencia sin extender la de su predecesora.
- **CE-036**: En el 100 % de las cotizaciones de prueba, el importe de cada línea es exactamente su cantidad por su precio unitario y los totales coinciden con la suma de esos importes; toda cantidad fuera de 1 a 9,999 o con decimales es rechazada.
- **CE-037**: En las pruebas con servicios recurrentes y cantidad, cada tramo muestra su precio por unidad y su importe por período con la misma cantidad; el ajuste del primer período aparece una sola vez por línea; ningún módulo incluido en un paquete se cobra, y sus unidades adicionales solo se cobran en una línea explícita añadida por el administrador.
- **CE-038**: El 100 % de las operaciones de prueba que superan un límite (cantidad, importe de línea, total de la cotización, número de líneas o de tramos) son rechazadas con un mensaje claro, y ningún anticipo en porcentaje se calcula sobre un total fuera de límite.
- **CE-039**: En las pruebas del anticipo en porcentaje, incluidos los empates de medio centavo, el resultado es idéntico en todas las ejecuciones y entornos, sigue la regla mitad hacia arriba, y el anticipo más el saldo suman exactamente el total único.
- **CE-040**: Todos los importes del módulo se muestran con el formato `L 1,250.00`, y una misma entrada de importe produce el mismo valor al centavo en cualquier navegador y configuración regional; las entradas ambiguas son rechazadas y los importes de los demás módulos no cambian de presentación.
