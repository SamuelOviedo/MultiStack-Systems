# Contrato: cálculo financiero, fechas, numeración y validación de emisión

**Spec**: `specs/002-admin-quotations/spec.md` · **Modelo**: `specs/002-admin-quotations/data-model.md`

Este contrato fija **qué** calcula el módulo y con qué resultado exacto. Lo implementan dos veces, con los mismos vectores:

- SQL (**autoridad**, DA-05): funciones de la sección 3 de `data-model.md`. Postgres es la única fuente de los importes de línea, los totales, el anticipo y la validación financiera que se guardan o se emiten.
- TypeScript (vista previa inmediata y avisos): `src/lib/cotizacionDinero.ts`, `src/lib/cotizacionCalculo.ts` y `src/lib/cotizacionVigencia.ts` (nombres propuestos). El navegador nunca envía un importe de línea ni un total: los calcula la base, y tras cada guardado la pantalla sustituye su vista previa por los valores que devuelve la base.

> **Decisiones aprobadas por el propietario el 2026-11-09**: DA-01 (redondeo), DA-05 (autoridad del cálculo), DA-07 (límites), DA-08 (cantidad por precio unitario), DA-12 (condiciones de pago) y DA-14 (presentación de la moneda). Los vectores de este contrato ya no son propuestas.

**Notación**: los importes se escriben como los muestra el módulo (`1,250.00`, coma de miles y punto decimal). Los enteros que no son dinero conservan el espacio de miles (`9 999`).

## 1. Representación del dinero

| Capa | Representación | Prohibido |
| --- | --- | --- |
| Postgres | `numeric(14,2)` para importes; `integer` para la cantidad; `numeric(5,2)` para el porcentaje | `float`, `real`, `money` |
| TypeScript | entero de **centavos** (`number` que cumple `Number.isSafeInteger`); cantidad entera; porcentaje en **puntos base** (entero 0 … 10000) | `parseFloat`, `toFixed` para calcular, multiplicar o dividir por `100` en coma flotante |
| Entrada del usuario | cadena → centavos por análisis de texto (§1.1) | adivinar una entrada ambigua; redondear en silencio un tercer decimal |
| Valores que llegan de la base | se convierten a centavos con el mismo analizador de texto, a partir de su representación decimal | `Math.round(valor * 100)` u otra conversión en coma flotante |
| Valores que se envían a la base | cadena decimal con punto (`"1250.50"`), cantidad entera | enviar importes de línea o totales (no hay privilegio de escritura sobre ellos) |
| Presentación | `formatearHNL(centavos)` → `L 1,250.00` (§1.2) | `Intl.NumberFormat` (su salida depende del motor y de la configuración regional) |

### 1.1 Captura de importes y porcentajes (DA-14)

La captura es determinista y no depende del navegador ni de su configuración regional.

- **Separador decimal**: solo el punto. Cero, uno o dos decimales.
- **Coma**: solo se admite como separador de miles bien formado (grupos de tres dígitos: `1,250.50`). Una coma en cualquier otra posición es ambigua y se rechaza.
- **Se admite**: `1250`, `1250.5`, `1250.50`, `1,250.50`, y los mismos con espacios al principio o al final.
- **Se rechaza** (con un mensaje que indica el formato esperado, `1250.50`): `1250,50`, `1.250,50`, `1 250.50`, `12,50`, `1,25`, más de dos decimales, signo negativo, notación científica, símbolos o letras (incluido `L`) y vacío.
- **Porcentaje**: mismas reglas, de `0` a `100` con hasta dos decimales (`33.33`); se convierte a puntos base (`3333`).

### 1.2 Presentación de importes (DA-14)

`formatearHNL(centavos)` devuelve el símbolo `L`, un espacio de no separación, la parte entera con coma cada tres dígitos, un punto y siempre dos decimales: `L 1,250.00`, `L 0.05`, `L 999,999,999.99`. Es un formateador propio del módulo: no usa `Intl` y **no cambia** el formato de importes de ningún otro módulo (`formatMoney` del detalle de proyecto queda como está). Antes de adoptarlo se comprobó que la aplicación no tenía una convención propia para lempiras.

## 2. Fórmulas

Sea una cotización con líneas `L`. Una línea **cuenta** si `incluida = true` y `incluida_en_linea_id IS NULL`.

| Magnitud | Definición |
| --- | --- |
| `importe` de una línea | `cantidad × precio_unitario`, exacto, sin redondeo (RF-115). Lo calcula la base; el administrador no lo escribe (RF-118) |
| `total_unico` | Σ `importe` de las líneas que cuentan con `cargo = 'unico'` |
| importe por período de un servicio | `cantidad × precio_unitario`; con tramos, `cantidad × tarifa` de cada tramo, con la misma cantidad en todos (RF-116) |
| `recurrente_mensual` | Σ del importe por período del **primer tramo** (o de la línea, si no hay tramos) de las líneas que cuentan con `cargo='recurrente'` y `periodicidad='mensual'`. Solo para el listado; el documento muestra cada servicio y su tabla de tramos y **no calcula un total de toda la vigencia** |
| `recurrente_anual` | Σ `cantidad × precio_unitario` de las líneas que cuentan con `cargo='recurrente'` y `periodicidad='anual'` |
| ajuste del primer período | `primer_periodo_importe`, tal como lo escribe el administrador: se aplica **una vez a toda la línea** y no se multiplica por la cantidad (RF-117) |
| `anticipo` | `modo='monto'` → `anticipo_monto`. `modo='porcentaje'` → `redondear(total_unico, porcentaje)`. `modo` nulo → no hay anticipo (se trata como 0 para validar, no se muestra) |
| `saldo` | `total_unico − anticipo` (exacto) |
| `hitos` | solo los de `cotizacion_hitos`; el anticipo positivo es el **primer** hito derivado y no se suma dos veces |

Reglas que **no** existen (RF-022, RF-077, RF-078, RF-113, RF-120): impuesto, descuento, prorrateo, conversión de moneda, suma de mensual con anual, suma de recurrentes al total único, cantidades fraccionarias.

### 2.1 Redondeo (DA-01, aprobado)

Redondeo decimal **mitad hacia arriba** a dos decimales de HNL. El porcentaje se representa en **puntos base**: un entero de 0 a 10000 que equivale al porcentaje con dos decimales multiplicado por 100 (33.33 % = 3333).

```text
anticipo_centavos = floor( (total_centavos × puntos_base + 5000) / 10000 )
puntos_base       = porcentaje × 100            (entero, 0 … 10000)
```

SQL equivalente: `round(total * porcentaje / 100, 2)` sobre `numeric` (mitad lejos de cero; todos los valores son ≥ 0, así que coincide con mitad hacia arriba). Es la **única** operación de redondeo del módulo: el importe de línea es un producto exacto de un entero por centavos y las sumas son exactas.

### 2.2 Límites y orden de comprobación (DA-07, aprobado)

| Límite | Valor | En centavos |
| --- | --- | --- |
| Cantidad | entero de 1 a 9 999 | — |
| Precio unitario, tarifa de tramo y ajuste del primer período | de 0 a 99,999,999.99 | ≤ 9 999 999 999 |
| Importe de línea y de cada período (`cantidad × precio`) | hasta 99,999,999.99 | ≤ 9 999 999 999 |
| Cada total de la cotización (`total_unico`, `recurrente_mensual`, `recurrente_anual`), el anticipo y cada hito | hasta 999,999,999.99 | ≤ 99 999 999 999 |
| Líneas por cotización | 100 | — |
| Tramos por servicio | 12 | — |

El límite del total **no** se deduce del límite por línea: 100 líneas en el máximo sumarían 9,999,999,999.00, diez veces más. Por eso cada nivel se comprueba por separado y en este orden, igual en SQL y en TypeScript:

1. **Cantidad**: entero entre 1 y 9 999.
2. **Precio unitario**: no negativo, hasta dos decimales, dentro de su límite.
3. **Producto** `cantidad × precio`: se calcula exacto. El mayor producto posible antes de comprobar el límite es 9 999 × 9 999 999 999 = 99 989 999 990 001 centavos, menor que 2^53 − 1.
4. **Importe de línea** (y de cada período en un servicio con tramos): dentro de su límite.
5. **Número de líneas y de tramos**.
6. **Suma**: como máximo 100 × 9 999 999 999 = 999 999 999 900 centavos, exacta.
7. **Cada total**: dentro de su límite.
8. **Solo entonces** el anticipo en porcentaje: 99 999 999 999 × 10 000 + 5 000 = 999 999 999 995 000, menor que 2^53 − 1.

Si un paso falla, los siguientes **no se ejecutan**: no se calcula un anticipo en porcentaje ni se emite sobre un total fuera de límite. En la base, los pasos 1 a 5 son restricciones y triggers que rechazan el cambio al guardar; el paso 7 lo rechaza el recálculo con `COT:TOPE_EXCEDIDO`, de modo que nunca se almacena un total fuera de límite, y `cotizacion_emitir` lo vuelve a comprobar. En TypeScript, la función de cálculo devuelve un resultado «fuera de límite» en lugar de un número, y toda operación intermedia verifica `Number.isSafeInteger`.

### 2.3 Conciliación (RF-019, RF-094, RF-110, RF-111, DA-12)

1. `0 ≤ anticipo ≤ total_unico`.
2. Si hay filas en `cotizacion_hitos`: `anticipo + Σ hitos = total_unico`, exacto.
3. Si no hay hitos y `saldo > 0`: `condiciones_pago_unico` no vacío. Sin anticipo definido el saldo es todo el total único, así que el cargo único exige igualmente sus condiciones de pago (DA-12).
4. Si `anticipo = 0`: no aparece hito de anticipo.
5. Los recurrentes no entran en 1, 2 ni 3.

### 2.4 Módulos incluidos en un paquete (RF-107, RF-119)

- Una línea de módulo cuyo elemento de catálogo forma parte de un paquete presente en la cotización y que **no** está marcada como `unidades_adicionales` queda como incluida (`incluida_en_linea_id` apunta a la línea del paquete): **no cuenta**, sea cual sea su cantidad. La marca la asigna la base al recalcular, no el navegador.
- Las unidades adicionales de ese módulo se cotizan en una línea aparte que el administrador añade y marca como `unidades_adicionales`: esa línea **sí cuenta**, con su cantidad y su precio unitario. El sistema nunca la crea por su cuenta.
- Una línea facturable de un módulo incluido que no lleve la marca es un cobro doble y bloquea la emisión (`MODULO_COBRADO_DOS_VECES`). Es una comprobación defensiva: en condiciones normales el recálculo ya la habrá dejado como incluida.

## 3. Vectores de prueba (sintéticos)

Los importes son ilustrativos y **no** son precios del negocio. Salvo que se indique, la cantidad es 1.

### 3.1 Sumas y anticipo en monto

| ID | Entrada | Resultado esperado |
| --- | --- | --- |
| V-01 | Paquete 1,000.00 + módulo 250.00 (incluido) | `total_unico = 1,250.00`; sin el módulo: `1,000.00` |
| V-02 | Líneas 0.10 + 0.20 | `0.30` exacto (la trampa clásica de coma flotante) |
| V-03 | Total 1,250.00; anticipo monto 400.00 | `saldo = 850.00` |
| V-04 | Total 1,250.00; anticipo monto 1,250.00 / 0.00 | `saldo = 0.00` / `1,250.00` (ambos válidos); 1,250.01 y −0.01 → rechazados |

### 3.2 Anticipo en porcentaje (DA-01)

| ID | Total | Porcentaje | Cálculo | Anticipo | Saldo |
| --- | --- | --- | --- | --- | --- |
| V-05 | 1,000.00 | 40.00 % | 100000 × 4000 = 400 000 000 → /10000 = 40 000 | 400.00 | 600.00 |
| V-06 | 333.33 | 33.33 % | 33333 × 3333 = 111 098 889 → +5000 → 11 110 | 111.10 | 222.23 |
| V-07 | 0.10 | 5.00 % | 10 × 500 = 5 000 → empate de medio centavo → **sube** a 1 | 0.01 | 0.09 |
| V-08 | 0.50 | 1.00 % | 50 × 100 = 5 000 → empate → 1 | 0.01 | 0.49 |
| V-09 | 0.04 | 12.50 % | 4 × 1250 = 5 000 → empate → 1 | 0.01 | 0.03 |
| V-10 | 1,000.00 | 0 % / 100 % | | 0.00 / 1,000.00 | 1,000.00 / 0.00 |
| V-11 | 999,999,999.99 | 99.99 % | 99 999 999 999 × 9 999 = 999 899 999 990 001 (< 2^53) → 99 989 999 999 | 999,899,999.99 | 100,000.00 |

Comprobación cruzada: en todos, `anticipo + saldo = total` exacto.

### 3.3 Hitos y recurrentes

| ID | Caso | Resultado |
| --- | --- | --- |
| V-12 | Total 1,000.00; anticipo 400.00; hitos 300.00 + 300.00 | Concilia (400 + 300 + 300). Con hitos 300.00 + 200.00 → `HITOS_NO_CONCILIAN` |
| V-13 | Mismo caso con anticipo 0.00 y hitos 600.00 + 400.00 | Concilia; **no** aparece hito de anticipo |
| V-14 | Total 1,000.00; sin hitos; anticipo 400.00; sin condiciones de pago único | `PAGO_UNICO_SIN_CONDICIONES` |
| V-15 | Solo recurrente (mensual 100.00): total único 0, anticipo 0, saldo 0 | Válido; sin condiciones de pago único |
| V-16 | Mensual 100.00 + anual 1,000.00 | Se muestran por separado; nunca 1,100.00 |
| V-17 | Mensual con tramos 1–3: 50.00; 4–6: 80.00; 7–∞: 100.00 | Válido; `recurrente_mensual = 50.00` (primer tramo) |
| V-18 | Tramos 2–3 …; 1–3 + 5–6; 1–4 + 4–6; 1–∞ + 4–6; dos abiertos | Todos `TRAMOS_INVALIDOS` (no empieza en 1 / hueco / solape / abierto no último / dos abiertos) |
| V-19 | Servicio anual sin `condiciones_pago_anual` | `RECURRENTE_ANUAL_SIN_CONDICIONES` |
| V-20 | Primer período: importe 40.00 con descripción; sin descripción | Con descripción: válido, **sin prorrateo**; sin descripción: `PRIMER_PERIODO_SIN_DESCRIPCION` |
| V-21 | Paquete que incluye el módulo M; se añade M como módulo | La línea de M queda `incluida_en_linea_id` y no suma |

### 3.4 Cantidad por precio unitario (DA-08)

| ID | Caso | Resultado |
| --- | --- | --- |
| V-22 | Paquete 1,000.00 × 1 y módulo 250.00 × 3 | Importe del módulo 750.00; `total_unico = 1,750.00` |
| V-23 | 0.10 × 3; 14.29 × 7 | 0.30 y 100.03, exactos |
| V-24 | Cantidad 1 y 9 999; cantidad 0, −1, 10 000, 1.5 y vacía | Las dos primeras válidas; las demás rechazadas al guardar (`CANTIDAD_FUERA_DE_RANGO`). Una línea nueva nace con cantidad 1 |
| V-25 | Mensual 100.00 × 5; anual 1,000.00 × 2 | 500.00 al mes y 2,000.00 al año, por separado; nunca se suman |
| V-26 | Mensual con cantidad 5 y tramos por unidad 1–3: 50.00; 4–6: 80.00; 7–∞: 100.00 | Importes por período 250.00, 400.00 y 500.00; `recurrente_mensual = 250.00`; la cantidad es la misma en los tres tramos |
| V-27 | Servicio con cantidad 5 y ajuste del primer período de 40.00 | El ajuste es 40.00, una vez por línea; nunca 200.00 |
| V-28 | Paquete P 1,000.00 × 2 que incluye M. (a) M × 3 a 250.00 sin marca. (b) Además, línea de M × 1 a 250.00 marcada `unidades_adicionales`. (c) Línea facturable de M sin la marca | (a) M queda incluido y no suma: `total_unico = 2,000.00`. (b) `total_unico = 2,250.00`. (c) `MODULO_COBRADO_DOS_VECES` |
| V-29 | Duplicado: origen con M × 3 a 250.00 y una línea manual × 2 a 80.00; el catálogo ahora tiene M a 300.00 | M × 3 a 300.00 = 900.00, con `precio_unitario_origen = 250.00` y comparación por unidad (250.00 → 300.00). La manual conserva × 2 a 80.00 y nace sin revisar |
| V-30 | Borrador con M × 4 y `precio_catalogo_ref = 250.00`; el catálogo cambia a 275.00 | `PRECIO_DERIVADO`. «Actualizar» → 4 × 275.00 = 1,100.00; «conservar» → 4 × 250.00 = 1,000.00; en ambos casos la referencia pasa a 275.00 |

### 3.5 Límites y condiciones de pago (DA-07, DA-12)

| ID | Caso | Resultado |
| --- | --- | --- |
| V-31 | 9 999 × 10,000.00; 9 999 × 10,001.00; 9 999 × 10,002.00; 2 × 50,000,000.00 | 99,990,000.00 y 99,999,999.00 válidos; 100,009,998.00 y 100,000,000.00 → `TOPE_EXCEDIDO` (importe de línea) |
| V-32 | Precio unitario 99,999,999.99 × 1; precio unitario 100,000,000.00; 9 999 × 99,999,999.99 | El primero válido; el segundo rechazado (precio); el tercero se calcula exacto (99 989 999 990 001 centavos, < 2^53) y se rechaza por importe de línea |
| V-33 | 10 líneas de 99,999,999.99; 11 líneas de 99,999,999.99 con anticipo del 50.00 % | 999,999,999.90 válido; 1,099,999,999.89 → `TOPE_EXCEDIDO` (total): el cambio se rechaza y el anticipo en porcentaje **no** se calcula |
| V-34 | 100 líneas y una más; 12 tramos y uno más | La línea 101 y el tramo 13 se rechazan |
| V-35 | Servicio con cantidad 9 999 y un tramo de 20,000.00 por unidad | 199,980,000.00 por período → `TOPE_EXCEDIDO` (importe de período) |
| V-36 | Total 1,000.00; sin anticipo definido; sin hitos; sin y con condiciones de pago único | Sin condiciones: `PAGO_UNICO_SIN_CONDICIONES`; con ellas: válido y sin anticipo ni saldo a la vista |

### 3.6 Captura y presentación de importes (DA-14)

| ID | Entrada | Resultado |
| --- | --- | --- |
| M-01 | `formatearHNL` de 125000, 0, 5 y 99999999999 centavos | `L 1,250.00`, `L 0.00`, `L 0.05`, `L 999,999,999.99` |
| M-02 | Captura `1250`, `1250.5`, `1250.50`, `1,250.50`, ` 1250.00 ` | 125000, 125050, 125050, 125050 y 125000 centavos |
| M-03 | Captura `1250,50`, `1.250,50`, `1 250.50`, `12,50`, `1,25`, `1250.505`, `-1`, `1e3`, `L 1,250.00`, `abc` y vacío | Todas rechazadas; ninguna se convierte en un importe |
| M-04 | Valor de la base `999999999.99` y `0.1` | 99 999 999 999 y 10 centavos exactos, por análisis de texto |
| M-05 | Porcentaje `33.33`, `100`, `0`; `33.333`, `100.01`, `-1` | 3333, 10000 y 0 puntos base; los tres últimos rechazados |
| M-06 | Las mismas entradas de M-02 y M-03 con la configuración regional del entorno de pruebas cambiada | Mismos resultados: la captura no depende de la configuración regional |

Los vectores V se ejecutan en Vitest y en pgTAP con los mismos datos. Los vectores M son de TypeScript (captura y presentación); en la base, las mismas entradas inválidas las rechazan los tipos y las restricciones de columna.

## 4. Fechas, vigencia y numeración

Honduras es UTC−6 todo el año (sin horario de verano). Los instantes siguientes son sintéticos.

| ID | Entrada | Resultado |
| --- | --- | --- |
| D-01 | Emitida 2026-11-01 08:00 (Honduras) | `fecha_emision = 2026-11-01`; `valida_hasta = 2026-11-15` |
| D-02 | Emitida 2026-11-01 23:59 (= 2026-11-02T05:59Z) | `fecha_emision = 2026-11-01` (día de Honduras, no de UTC) |
| D-03 | Emitida 2026-11-02T06:00Z | `fecha_emision = 2026-11-02` |
| D-04 | `valida_hasta = 2026-11-15`, ahora = 2026-11-16T05:59:59Z (15 nov 23:59:59 HN) | **no** vencida |
| D-05 | Mismo `valida_hasta`, ahora = 2026-11-16T06:00:00Z (16 nov 00:00 HN) | **vencida** |
| D-06 | Emitida 2026-12-31 23:59 HN (= 2027-01-01T05:59Z) | año de numeración **2026**; `valida_hasta = 2027-01-14` |
| D-07 | Emitida 2027-01-01 00:00 HN (= 2027-01-01T06:00Z) | año **2027**; secuencia reinicia en 0001 |
| D-08 | Revisión emitida en 2027 de una cotización de 2026 | número `COT-2026-NNNN-R1` (conserva año y número de la original) |

La documentación y la interfaz **no** describen la vigencia como «15 períodos de 24 horas» (RF-062, CE-035); dicen «Válida hasta el DD/MM/AAAA».

Formato del número (`cotizacion_formatear_numero`):

| ID | `(anio, n)` | Resultado |
| --- | --- | --- |
| N-01 | (2026, 1) | `COT-2026-0001` |
| N-02 | (2026, 9999) | `COT-2026-9999` |
| N-03 | (2026, 10000) | `COT-2026-10000` (nunca `COT-2026-1000`) |
| N-04 | (2026, 123456) | `COT-2026-123456` |
| N-05 | revisión 2 de N-01 | `COT-2026-0001-R2` |

## 5. Códigos de bloqueo de `cotizacion_validar`

La función devuelve un arreglo JSON `[{codigo, linea_id?, campo?}]`. **Vacío = se puede emitir.** El cliente traduce cada código a un mensaje en español y señala la línea o el campo. Nunca se muestra el código ni el texto técnico.

| Código | Cuándo | Requisito |
| --- | --- | --- |
| `SIN_LINEAS` | no hay líneas que cuenten | caso límite |
| `PROSPECTO_SIN_NOMBRE` | falta nombre de persona o empresa | RF-042 |
| `PROSPECTO_SIN_CONTACTO` | ni correo ni teléfono | RF-042 |
| `LINEA_SIN_DESCRIPCION`, `LINEA_SIN_PRECIO` | línea incompleta (falta la descripción o el precio unitario) | Historia 1, RF-008 |
| `CANTIDAD_FUERA_DE_RANGO` | cantidad que no es un entero entre 1 y 9 999 (defensivo: la base ya lo rechaza al guardar) | RF-115, RF-121 |
| `LINEA_CERO_SIN_CORTESIA` | línea manual con precio unitario cero sin marca de cortesía | caso límite |
| `PRECIO_DERIVADO` | el precio unitario del catálogo cambió y falta decidir (actualizar/conservar) | RF-108 |
| `ELEMENTO_RETIRADO` | línea de catálogo cuyo elemento fue retirado | RF-098 |
| `LINEA_MANUAL_SIN_REVISAR` | duplicado con línea manual sin revisar | RF-090 |
| `MODULO_COBRADO_DOS_VECES` | línea facturable de un módulo ya incluido en un paquete presente, sin la marca de unidades adicionales | RF-107, RF-119 |
| `ANTICIPO_FUERA_DE_RANGO` | < 0 o > total único | RF-019 |
| `ANTICIPO_SIN_CONFIRMAR` | duplicado/revisión con total distinto y anticipo sin confirmar | RF-093 |
| `HITOS_NO_CONCILIAN` | anticipo + hitos ≠ total único | RF-019 |
| `PAGO_UNICO_SIN_CONDICIONES` | sin hitos, saldo > 0 (haya o no anticipo definido) y sin condiciones del pago único | RF-110, DA-12 |
| `RECURRENTE_SIN_FECHA_INICIO`, `RECURRENTE_SIN_TARIFA`, `RECURRENTE_SIN_RENOVACION` | falta un dato obligatorio | RF-075 |
| `RECURRENTE_ANUAL_SIN_CONDICIONES` | anual sin condiciones de pago anual | RF-074 |
| `TRAMOS_INVALIDOS` | tramos mal formados | RF-076 |
| `PRIMER_PERIODO_SIN_DESCRIPCION` | ajuste del primer período sin descripción | RF-078 |
| `TOPE_EXCEDIDO` | precio unitario, importe de línea o de período, total, número de líneas o de tramos fuera de límite; `campo` dice cuál (defensivo: la base ya lo rechaza al guardar) | RF-121 |

`cotizacion_emitir` ejecuta la misma validación **dentro de la transacción**, con la fila bloqueada, y falla con `COT:NO_EMITIBLE` si hay algún bloqueo.
