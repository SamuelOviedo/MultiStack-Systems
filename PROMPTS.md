# PROMPTS.md — MultiStack Systems

> Prompts reutilizables para trabajar con Claude Code en este proyecto.
> Reemplaza los valores entre `[CORCHETES]` antes de usar.

---

## Iniciar sesión

Usar al comienzo de cualquier conversación nueva con Claude Code:

```
Lee QUICK_CONTEXT.md antes de empezar.
Proyecto: MultiStack Systems — plataforma de gestión de proyectos para agencia web.
Área de trabajo: [dashboard de proyectos / portal de clientes / auth / tickets / otro].
Objetivo de esta sesión: [UNA sola cosa concreta].
No tocar: [archivos o módulos fuera de scope].
```

---

## Crear features

### Feature completa nueva

```
Quiero agregar la feature: [descripción concreta].

Antes de escribir código, dime:
1. Qué archivos nuevos necesitarías crear
2. Qué archivos existentes tendrías que modificar y por qué
3. Si necesita nueva tabla SQL — qué columnas, qué RLS policies
4. Si hay algún tipo en src/types/ que cambie o necesite agregarse
5. Si hay algún riesgo de romper algo existente

No escribas código todavía. Espera mi confirmación del plan.
```

### Feature en página existente

```
En [src/pages/NombrePagina.tsx], agregar: [qué exactamente].

Restricciones:
- Si necesita Supabase, la lógica va en src/lib/[archivo].ts, no en la página
- Usa el mismo patrón de error handling que ya existe en el archivo
- Usa los tipos de src/types/[archivo].ts, no definas tipos inline
- No reorganices imports ni toques lo que no está relacionado con este cambio

El cambio mínimo que logre el objetivo.
```

### Nuevo componente

```
Crear componente: src/components/[Nombre].tsx

Propósito: [para qué sirve]
Props: [qué recibe]
Comportamiento: [qué hace]

Sigue estos patrones del proyecto:
- Default export
- Props tipadas con interface, no type
- Estado local con useState si necesita estado
- useToast() para errores, no console.error
- Imports con @/ (no rutas relativas)
- No llames a supabase directamente — si necesita datos, recíbelos como props o usa lib/

Referencia de estilo: mira [src/components/ComponenteCercano.tsx] y sigue su estructura.
```

### Nuevo endpoint en lib/

```
Agregar función en src/lib/[projects|tickets|portal].ts

Función: [nombre]
Qué hace: [descripción]
Parámetros: [tipos]
Retorna: [tipo]

Sigue el patrón existente en el archivo:
  const { data, error } = await supabase.from(...)...
  if (error) throw error
  return data

No uses `as any`. Si hay un problema de tipos, dímelo antes de usar un cast.
No modifiques las otras funciones del archivo.
```

### Nueva migración SQL

```
Crear migración: supabase/migrations/[TIMESTAMP]_[descripcion].sql

Cambio: [qué tabla, qué columnas, qué modifica]

Incluir obligatoriamente:
1. El ALTER TABLE o CREATE TABLE
2. ALTER TABLE [tabla] ENABLE ROW LEVEL SECURITY (si es tabla nueva)
3. CREATE POLICY para cada operación necesaria (SELECT, INSERT, UPDATE, DELETE)
4. CREATE INDEX si habrá queries por esa columna
5. Si es RPC pública (portal): SECURITY DEFINER + GRANT EXECUTE TO anon

No edites ninguna migración existente. Solo crea el archivo nuevo.
Nombre del archivo: supabase/migrations/[YYYYMMDDHHMMSS]_[descripcion].sql
```

---

## Debuggear bugs

### Bug con síntomas conocidos

```
Bug: [descripción del síntoma exacto].
Ocurre cuando: [pasos para reproducir].
Archivo donde parece estar: [src/pages/X.tsx o src/lib/X.ts].
Lo que debería pasar: [comportamiento esperado].

Analiza el código y dime:
1. Cuál es la causa raíz
2. Qué cambio mínimo lo resuelve
3. Si el fix tiene algún side effect

No hagas el cambio todavía. Explica primero.
```

### Bug en Supabase query

```
La query en [src/lib/archivo.ts → función X] no devuelve [qué falta].

Query actual: [pega el código relevante]
Lo que devuelve: [qué llega realmente]
Lo que debería devolver: [campos/estructura esperada]

Revisa:
- ¿El .select() incluye todos los campos necesarios?
- ¿Hay un .eq() o .filter() que está excluyendo datos?
- ¿La política RLS podría estar filtrando filas?

Dame el fix sin cambiar el resto de la función.
```

### Bug de estado en componente

```
En [src/pages/X.tsx o src/components/X.tsx], el estado no se actualiza correctamente.

Síntoma: [qué pasa visualmente]
Causa sospechada: [qué crees que está mal]
Estado involucrado: [nombre del useState]

Lee el archivo y encuentra por qué [useState] no refleja el nuevo valor.
Solo toca el handler o el setter involucrado. No toques el render ni otros handlers.
```

### Bug de auth / acceso

```
Problema de autenticación:
- Síntoma: [qué pasa — redirect inesperado, acceso denegado, userType incorrecto, etc.]
- Ruta o componente afectado: [cuál]
- userType del usuario: [0/1/2 o desconocido]

Revisa en este orden:
1. src/hooks/useAuth.tsx — ¿el userType se está seteando bien?
2. src/components/ProtectedRoute.tsx — ¿el allowedTypes incluye el tipo correcto?
3. src/App.tsx — ¿la ruta tiene el ProtectedRoute con los tipos correctos?

No toques más de lo necesario para el fix.
```

---

## Refactors seguros

### Analizar antes de refactorizar

```
Quiero refactorizar [src/pages/X.tsx o src/components/X.tsx].

Antes de cualquier cambio, dime:
1. Qué hace cada sección del archivo
2. Qué otros archivos dependen de él (imports, props, callbacks)
3. Qué propones dividir o reorganizar
4. En qué orden lo harías para que en ningún paso el código quede roto
5. Qué riesgos tiene el refactor

No toques nada todavía.
```

### Extraer componente

```
En [src/pages/X.tsx], extraer la sección [describe visualmente qué sección]
como componente separado en src/components/[NombreNuevo].tsx.

El componente extraído debe:
- Recibir por props todo lo que necesita (no acceder a estado del padre directamente)
- Mantener el mismo comportamiento visual y funcional exacto
- Seguir el patrón de estructura de los otros componentes del proyecto

En la página original, reemplazar la sección con <NombreNuevo ... />.
No cambies nada más en la página.
```

### Extraer lógica a custom hook

```
En [src/pages/X.tsx], la lógica de [carga de datos / manejo de formulario / otro]
se puede extraer a un custom hook.

Crear: src/hooks/use[Nombre].ts

El hook debe:
- Encapsular [qué estados y funciones]
- Retornar [qué necesita el componente]
- Mantener el mismo comportamiento que tiene hoy

En la página, reemplazar el bloque con el hook.
No cambies el comportamiento ni el UI del componente.
```

### Eliminar duplicación

```
Este patrón aparece repetido en varios archivos:
[pega el código duplicado]

Aparece en:
- [src/archivo1.tsx]
- [src/archivo2.tsx]
- [src/archivo3.tsx]

Propón dónde extraerlo (src/lib/utils.ts, un hook, un componente) y cómo llamarlo.
Muéstrame el helper propuesto y cómo quedaría el código en uno de los archivos.
No hagas los cambios todavía — primero confirmo el plan.
```

---

## Analizar impacto

### Antes de cambiar un tipo

```
Voy a modificar el tipo/enum [NombreTipo] en src/types/[archivo].ts.
Cambio específico: [qué cambia].

Antes de hacerlo:
1. Lista TODOS los archivos que importan ese tipo
2. Para cada uno, indica qué líneas se verían afectadas
3. ¿Algún cambio podría romper RLS policies o queries en lib/?
4. ¿Hay algún STATUS_CONFIG o configuración visual que también deba actualizarse?

No hagas ningún cambio todavía.
```

### Antes de cambiar una función en lib/

```
Voy a modificar la función [nombre] en src/lib/[archivo].ts.
Cambio: [qué modifica — firma, retorno, comportamiento].

Antes de proceder:
1. ¿Qué archivos llaman a esta función?
2. ¿El cambio de retorno rompe algo en quien la consume?
3. ¿Hay componentes que desestructuran el resultado y se verían afectados?

Lista todo. No hagas cambios todavía.
```

### Antes de cambiar schema SQL

```
Quiero cambiar la tabla [nombre] — [qué cambio: nueva columna, renombrar, eliminar].

Analiza el impacto:
1. ¿Qué funciones en src/lib/ hacen queries a esa tabla?
2. ¿Alguna tiene un .select() que necesitaría actualizar?
3. ¿Los tipos en src/types/ necesitan actualizarse?
4. ¿Las RLS policies existentes se ven afectadas?
5. ¿Hay RPC functions en las migraciones que tocan esa tabla?

No escribas la migración todavía.
```

### Análisis de dependencias de un archivo

```
Analiza el archivo [ruta completa]:
1. Qué importa (dependencias)
2. Quién lo importa (dependientes)
3. Qué estado maneja
4. Qué efectos secundarios tiene (Supabase calls, toasts, navegación)
5. Cuál es el riesgo de modificarlo

Solo análisis. Sin cambios.
```

---

## Revisar arquitectura

### Auditoría de un módulo

```
Revisa el módulo de [proyectos / tickets / auth / portal]:

Archivos involucrados:
- src/pages/[X].tsx
- src/components/dashboard/[X].tsx
- src/lib/[X].ts
- src/types/[X].ts

Reporta:
1. ¿Sigue los patrones establecidos en el proyecto?
2. ¿Hay lógica de Supabase fuera de src/lib/?
3. ¿Hay tipos definidos inline que deberían estar en src/types/?
4. ¿Hay duplicación de lógica entre los archivos?
5. ¿Hay algún anti-pattern evidente?

Solo reporte. Sin cambios.
```

### Revisar consistencia de un archivo

```
Lee [src/ruta/archivo.tsx] y verifica:

1. ¿Los imports usan @/ (no rutas relativas)?
2. ¿Hay llamadas directas a supabase que deberían estar en lib/?
3. ¿El error handling sigue el patrón estándar del proyecto?
4. ¿Hay tipos inline que deberían estar en src/types/?
5. ¿Hay algún `as any` innecesario?
6. ¿El naming sigue las convenciones del proyecto?

Lista solo los problemas reales. Sin cambios.
```

### Revisar una migración SQL

```
Revisa la migración: supabase/migrations/[archivo].sql

Verifica:
1. ¿Tiene RLS habilitado en todas las tablas nuevas?
2. ¿Las policies cubren todas las operaciones necesarias (SELECT, INSERT, UPDATE, DELETE)?
3. ¿Las RPC functions públicas usan SECURITY DEFINER y GRANT EXECUTE TO anon?
4. ¿Hay algún campo que debería tener índice y no lo tiene?
5. ¿Los enums del SQL están sincronizados con src/types/?

Solo reporte de problemas.
```

---

## Generar tests

### Test unitario para función de lib/

```
Crear test unitario para [src/lib/archivo.ts → función X].

Archivo de test: src/lib/archivo.test.ts (o src/__tests__/archivo.test.ts)

Casos a cubrir:
1. Caso happy path — retorna dato esperado
2. Caso error de Supabase — propaga el error correctamente
3. [caso edge específico si aplica]

Usa Vitest (ya configurado). Mockea el cliente de Supabase, no hagas llamadas reales.
Sigue el patrón de test más cercano que encuentres en el proyecto.
Si no hay tests existentes como referencia, usa el estilo de Vitest estándar con `describe`, `it`, `expect`.
```

### Test de componente

```
Crear test para [src/components/X.tsx o src/pages/X.tsx].

Archivo: src/__tests__/[NombreComponente].test.tsx

Casos a cubrir:
1. Renderiza sin errores con props mínimas
2. [comportamiento específico a verificar]
3. [estado de error o loading si aplica]

Usa @testing-library/react (ya configurado).
Mockea las llamadas a src/lib/ — no Supabase directamente.
No testees detalles de implementación (clases CSS, estructura DOM interna).
Testea comportamiento visible: texto, interacciones, llamadas a funciones.
```

### Test de integración de flujo

```
Crear test de integración para el flujo: [descripción del flujo].

Ejemplo de flujo: crear proyecto → aparece en lista → se puede abrir.

Archivo: src/__tests__/flows/[nombre-flujo].test.tsx

Mockea: Supabase client completo (no hacer requests reales).
Verifica: que cada paso del flujo resulta en el estado visual correcto.
Usa: @testing-library/react + Vitest.
```

---

## Validar consistencia

### Checklist pre-commit

```
Revisión antes de commitear los cambios en [lista de archivos modificados]:

1. ¿Algún archivo tiene llamadas directas a supabase fuera de src/lib/?
2. ¿Hay tipos definidos inline que deberían estar en src/types/?
3. ¿Hay algún `as any` nuevo que no estaba antes?
4. ¿El error handling en componentes usa toast() estándar?
5. ¿Los imports usan @/ en todos los archivos tocados?
6. ¿Hay algún console.log o TODO olvidado?
7. ¿El build compila sin errores? (si no puedes correrlo, dímelo)

Lista solo los problemas reales encontrados.
```

### Verificar sincronía tipos SQL ↔ TypeScript

```
Verifica que los enums de SQL estén sincronizados con TypeScript.

SQL (supabase/migrations/): revisar los CHECK constraints de:
- proyectos_clientes.estado
- tickets.type, tickets.priority, tickets.status
- project_stages.stage_key
- project_services.service_type
- project_maintenance.status

TypeScript (src/types/):
- ProjectStatus en types/projects.ts
- ProjectStageKey en types/projects.ts
- TicketType, TicketPriority, TicketStatus en types/tickets.ts

Reporta cualquier valor que esté en uno pero no en el otro.
```

### Verificar cobertura de RLS

```
Revisa las migraciones en supabase/migrations/ y verifica:

Para cada tabla creada:
1. ¿Tiene ALTER TABLE ENABLE ROW LEVEL SECURITY?
2. ¿Tiene policy para SELECT?
3. ¿Tiene policy para INSERT?
4. ¿Tiene policy para UPDATE?
5. ¿Tiene policy para DELETE?
6. ¿Las policies tienen la condición correcta (auth.uid() = user_id o EXISTS subquery)?

Lista las tablas que tengan policies faltantes.
```

---

## Evitar deuda técnica

### Auditoría de dependencias no usadas

```
Revisa package.json y el código en src/ y determina:

1. ¿@tanstack/react-query tiene algún import en src/? Si no, ¿vale la pena eliminarlo o usarlo?
2. ¿recharts tiene algún import en src/?
3. ¿react-hook-form se usa consistentemente o solo en algunos archivos?
4. ¿Hay otras librerías en dependencies que no aparecen en src/?

No hagas cambios. Solo el reporte con evidencia (qué buscaste y qué encontraste).
```

### Detectar código muerto

```
En [src/pages/X.tsx o src/lib/X.ts], busca:

1. Funciones declaradas pero nunca llamadas en el archivo
2. Variables de estado (useState) que se setean pero nunca se leen
3. Imports que no se usan
4. Props tipadas que el componente recibe pero nunca usa

Lista cada caso con la línea aproximada. No elimines nada todavía.
```

### Detectar patrones inconsistentes

```
Tengo estos tres archivos que hacen algo similar:
- [src/archivo1.tsx]
- [src/archivo2.tsx]
- [src/archivo3.tsx]

Compáralos y reporta:
1. ¿Usan el mismo patrón para [form handling / error handling / data fetching]?
2. ¿Cuál es el patrón más correcto según las convenciones del proyecto?
3. ¿Vale la pena unificarlos ahora o documentar la inconsistencia?

Solo análisis. Sin cambios.
```

### Evaluación de nueva dependencia

```
Quiero agregar la librería [nombre] para [para qué].

Antes de instalarla, evalúa:
1. ¿Hay algo ya instalado en package.json que resuelva lo mismo?
2. ¿El caso de uso es suficientemente complejo para justificar una dependencia?
3. ¿Se puede resolver con código propio en menos de 30 líneas?
4. ¿La librería tiene mantenimiento activo y es compatible con React 18?

Dame tu recomendación: instalar / usar alternativa existente / implementar inline.
```

### Detectar over-engineering

```
Lee [src/ruta/archivo.tsx] con ojo crítico:

1. ¿Hay abstracciones que solo se usan una vez?
2. ¿Hay lógica de "preparar para el futuro" que no tiene uso actual?
3. ¿Hay más estados de los que la UI realmente necesita?
4. ¿Hay tipos más complejos de lo que los datos realmente son?

El estándar: si el código hace exactamente lo que se necesita hoy, sin más, está bien.
Lista solo lo que claramente sobra.
```

---

## Prompts de emergencia

### Entender código desconocido rápido

```
Lee [src/ruta/archivo.tsx] y explícame en menos de 10 líneas:
- Qué hace
- Qué datos consume y de dónde
- Qué efectos secundarios tiene
- Qué rompería si lo borro
```

### Encontrar dónde está algo

```
¿En qué archivo(s) del proyecto se maneja [funcionalidad concreta]?
Busca en src/ y supabase/.
Dame rutas de archivo y nombres de función. Sin código todavía.
```

### Entender por qué algo falla

```
Esto falla: [error exacto o comportamiento]
Contexto: [en qué página/acción ocurre]
Lee los archivos relevantes y explica la causa antes de proponer solución.
```

### Revertir a patrón correcto

```
[src/ruta/archivo.tsx] tiene código que no sigue los patrones del proyecto.
Problema específico: [qué está mal — llamada a supabase directa, tipo inline, etc.]
Corrígelo para que siga el patrón estándar. Solo eso. Sin cambiar lógica de negocio.
```
