# CONTRIBUTING_AI.md — Guía para trabajar con Claude Code

> Este documento define cómo colaborar con IA en este proyecto de forma efectiva, segura y sin acumular deuda técnica. Es específico para la arquitectura de MultiStack Systems.

---

## Cómo trabajar con Claude Code

### Principio base

Claude Code opera mejor cuando sabe exactamente qué contexto tiene, cuál es el objetivo puntual, y qué NO debe tocar. Sin ese encuadre, tenderá a refactorizar lo que no se pidió, agregar abstracciones innecesarias o repetir patrones inconsistentes ya existentes.

### Antes de cada sesión

Siempre abrir con contexto mínimo útil:

```
Contexto: estoy trabajando en [área concreta — portal de clientes / pipeline de proyectos / auth].
Objetivo: [una sola cosa a resolver].
No toques: [lo que no debe cambiar].
```

### Cómo dar instrucciones

**Efectivo:**
```
En src/lib/tickets.ts, la función getAllTickets() trae todos los registros sin límite.
Agrégale paginación: parámetros page (number, default 1) y pageSize (number, default 20).
Usa el patrón .range() de Supabase. No cambies nada más en el archivo.
```

**Inefectivo:**
```
Mejora el manejo de tickets.
```

La diferencia: archivo específico, función específica, cambio específico, qué no tocar.

### Regla de una cosa por sesión

Cada sesión debe resolver un problema. Mezclar "arregla el bug + refactoriza esto + agrega tests" en un solo prompt produce cambios difíciles de revisar y más probable de romper algo lateral.

---

## Cómo pedir cambios correctamente

### Estructura de un buen prompt

```
[CONTEXTO]     — dónde estamos en el código (archivo, función, línea si aplica)
[PROBLEMA]     — qué falla o qué necesita
[CAMBIO]       — qué hacer exactamente
[RESTRICCIÓN]  — qué NO tocar
[VALIDACIÓN]   — cómo saber que el cambio es correcto
```

### Ejemplos por tipo de cambio

**Bug fix:**
```
En src/pages/ProjectDetail.tsx, el handler handleStageComplete no actualiza
el estado local después de marcar la etapa. El objeto `stages` en el state
no refleja el cambio hasta que el usuario recarga.
Fix: después del await en handleStageComplete, actualizar `stages` en el state
con el nuevo completed_at. No toques el resto del componente.
```

**Nueva feature:**
```
Agregar campo `internal_notes` (textarea, no visible para clientes) al formulario
de edición de proyecto en ProjectDetail.tsx.
- Agregar en el type Project en src/types/projects.ts
- Agregar columna en nueva migración SQL (no editar las existentes)
- Agregar el textarea en la sección de edición del ProjectDetail
- Usar el mismo estilo visual que los otros textareas del componente
```

**Refactor:**
```
El patrón toast de error se repite 15+ veces:
  toast({ title: "Error", description: e.message, variant: "destructive" })

Crear una función helper toastError(e: unknown) en src/lib/utils.ts.
Reemplazar solo los casos en src/lib/tickets.ts y src/lib/projects.ts.
No tocar páginas ni componentes todavía.
```

**Migración:**
```
Agregar columna `archived_at` (timestamptz, nullable) a la tabla tickets.
Crear nueva migración: supabase/migrations/[timestamp]_tickets_archive.sql
Incluir: ALTER TABLE, index en archived_at, y update de RLS policies si aplica.
No modificar migraciones existentes.
```

### Qué incluir siempre al pedir un cambio

- Nombre exacto del archivo o archivos involucrados
- Si es una función: nombre de la función
- Si es un tipo: nombre del tipo y dónde se usa
- Qué efecto visual o funcional debe tener el cambio
- Qué NO debe cambiar (muy importante)

---

## Cómo evitar romper arquitectura

### Las tres reglas de contención

1. **Un cambio = un archivo principal** — si el cambio requiere modificar 5+ archivos no relacionados, está mal encuadrado. Dividirlo.
2. **Tipos primero** — si hay que cambiar un tipo en `src/types/`, hacer que Claude liste todos los usos antes de modificar.
3. **Migraciones solo hacia adelante** — nunca pedir editar una migración existente. Siempre nueva migración.

### Antes de pedir un cambio en estas zonas, leer [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) → Riesgos

| Zona | Qué preguntar antes de tocar |
|---|---|
| `useAuth.tsx` | ¿Realmente necesito tocar auth o puedo hacerlo desde otro lado? |
| `src/types/projects.ts` | ¿Qué archivos importan este tipo? ¿Cuántos se rompen? |
| `client.ts` | ¿Por qué necesito tocar el singleton de Supabase? |
| `ProjectDetail.tsx` | ¿Es un fix puntual o necesito refactorizar antes? |
| Cualquier migración SQL | ¿Puedo crear una nueva en vez de editar esta? |

### Cómo verificar que no rompiste arquitectura

Después de cualquier cambio pedirle a Claude:

```
Lista todos los archivos que modificaste y explica brevemente por qué cada uno fue necesario.
¿Algún cambio tiene efectos en archivos que no tocaste?
```

Si la respuesta incluye archivos que no esperabas, revisar antes de aceptar.

---

## Cómo hacer prompts efectivos

### Dar el código exacto que quieres cambiar

```
// En lugar de: "el formulario de nuevo proyecto no valida el nombre"
// Usar:
En src/components/dashboard/NewProjectModal.tsx, la función handleSubmit
no valida que `form.nombre_proyecto` sea non-empty antes de llamar a createProject().
Agregar validación: si está vacío, mostrar toast de error y no llamar a createProject().
```

### Especificar el resultado esperado

```
// Malo:
"Haz que los tickets se ordenen mejor"

// Bueno:
En src/pages/TicketsGlobal.tsx, los tickets deben ordenarse por defecto
por `created_at` descendente (más reciente primero).
El sort actual usa `updated_at`. Cambiar solo ese default, no la UI de ordenamiento.
```

### Pedir confirmación antes de cambios grandes

```
Antes de hacer cualquier cambio, lista los archivos que vas a tocar y
describe en una línea qué cambiarás en cada uno. Espera mi confirmación.
```

Esto evita sorpresas en cambios que parecían pequeños.

### Limitar el scope explícitamente

```
Solo modifica src/lib/tickets.ts. Si el cambio requiere tocar otros archivos,
dime cuáles y por qué, pero no los modifiques hasta que lo confirme.
```

### Pedir el mínimo viable

```
Necesito el cambio más pequeño posible que resuelva esto.
No refactorices, no extraigas helpers, no reorganices imports.
Solo lo necesario para que funcione.
```

---

## Reglas para refactors

### Cuándo hacer un refactor

Solo cuando:
- El código a refactorizar ya está fallando o bloqueando una feature
- Hay un PR dedicado solo al refactor (no mezclado con features)
- El equipo acordó hacerlo

### Cómo pedir un refactor de forma segura

**Paso 1 — Análisis sin cambios:**
```
Analiza src/pages/ProjectDetail.tsx y propón cómo dividirlo en componentes más pequeños.
No hagas cambios todavía. Solo dame el plan: qué extraerías, en qué archivos,
y qué estado/props tendría cada uno.
```

**Paso 2 — Confirmar el plan antes de ejecutar:**
Leer el plan, evaluar si tiene sentido, ajustar si es necesario.

**Paso 3 — Ejecutar por partes:**
```
Ejecuta solo el primer paso del plan: extraer StageManager como componente separado.
No toques el resto de ProjectDetail todavía.
```

### Reglas de refactor

- No mezclar refactor con fix de bug en el mismo commit
- No cambiar convenciones de naming en un refactor de lógica (dos cambios distintos)
- Si el refactor toca `src/types/`, hacerlo en un commit separado
- Un refactor que rompe tests (cuando los haya) no es un refactor válido
- No extraer abstracciones para un solo uso — esperar a que el patrón aparezca 3 veces

---

## Cómo validar cambios

### Checklist de revisión después de cada cambio

**Estructura:**
- [ ] ¿Los archivos modificados eran los esperados?
- [ ] ¿Se agregaron archivos que no se pidieron?
- [ ] ¿Se eliminó algún código que sí se necesitaba?

**Tipos:**
- [ ] Si cambió algo en `src/types/`, ¿se actualizaron todos los usos?
- [ ] ¿Hay `as any` nuevo que no estaba antes?
- [ ] ¿El build compila sin errores? (`npm run build`)

**Supabase:**
- [ ] Si hay nueva migración, ¿tiene RLS?
- [ ] Si cambia una función en `src/lib/`, ¿el select incluye todos los campos que el componente espera?
- [ ] Si toca RPC del portal, ¿se probó con token válido e inválido?

**Auth:**
- [ ] Si tocó `useAuth.tsx` o `ProtectedRoute.tsx`, ¿se probó login, logout y acceso denegado?

**Preguntas a hacerle a Claude después del cambio:**
```
¿Este cambio tiene algún side effect que no se mencionó?
¿Hay algún caso edge que no manejamos?
¿Rompiste alguna convención del proyecto?
```

### Cómo correr la validación técnica

```bash
npm run build    # Verificar que TypeScript compile
npm run lint     # Verificar ESLint
npm run test     # Correr tests (cuando existan)
```

---

## Cómo evitar deuda técnica

### Reglas de prevención

**No agregar dependencias sin justificación:**
```
// Antes de pedir que Claude instale una librería:
// ¿Ya hay algo instalado que resuelve esto?
// Ver package.json — hay librerías instaladas sin usar (@tanstack/react-query, recharts)
```

**No copy-paste de componentes shadcn si ya existe:**
```
// Antes de pedir un componente UI nuevo, verificar:
ls src/components/ui/
// shadcn ya tiene: accordion, alert, badge, button, card, dialog, drawer,
// dropdown-menu, form, input, label, select, table, tabs, textarea, toast...
```

**No agregar estado global para estado local:**
El estado de un modal, un filtro o un form siempre va en `useState` local. Solo va al Context si lo necesitan 3+ componentes no relacionados.

**No crear helpers para un solo uso:**
Si una utilidad solo se usa en un lugar, mantenerla inline. Extraer solo cuando hay 3+ usos.

### Cómo señalizar deuda técnica sin acumularla

Si al hacer un cambio Claude detecta deuda cercana, pedir que la documente en lugar de arreglarla:

```
Si ves deuda técnica o inconsistencias mientras haces este cambio,
anótala con un comentario TODO o dímela al final, pero no la arregles
a menos que bloquee directamente el cambio pedido.
```

---

## Cómo mantener consistencia

### Antes de crear algo nuevo, preguntar si ya existe

```
¿Ya existe un patrón en el proyecto para hacer [X]?
Antes de implementar, muéstrame cómo se hace en otro lugar del código.
```

Esto evita que Claude invente un nuevo patrón cuando ya hay uno establecido.

### Convenciones que Claude debe respetar siempre

**Naming:** ver tabla en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) → Convenciones

**Imports:** siempre con `@/` para paths internos, nunca relativos

**Error handling en lib/:**
```ts
const { data, error } = await supabase.from(...)...
if (error) throw error
return data
```

**Error handling en componentes:**
```ts
} catch (e: any) {
  toast({ title: 'Error', description: e.message, variant: 'destructive' })
}
```

**Componentes:** default export, props con interface, no prop types

### Cómo pedir que respete el estilo existente

```
Antes de implementar, lee [archivo de referencia] para entender el estilo actual.
El nuevo código debe ser visualmente indistinguible del existente.
Usa el mismo naming, el mismo patrón de error handling, el mismo orden de imports.
```

---

## Prácticas prohibidas

Las siguientes prácticas no deben pedirse ni aceptarse en este proyecto:

### En TypeScript

- **Prohibido:** `as any` como solución a un error de tipos. Solución correcta: tipar el dato apropiadamente o usar `unknown` con narrowing.
- **Prohibido:** Ignorar un error con `// @ts-ignore` sin comentario que explique el workaround y por qué.
- **Prohibido:** Tipos inline en componentes que ya están en `src/types/`.

### En Supabase / Base de datos

- **Prohibido:** Editar archivos en `supabase/migrations/` que ya existen. Solo agregar nuevos.
- **Prohibido:** Crear tablas sin RLS activo y sus policies.
- **Prohibido:** Llamar a `supabase` directamente desde un componente o página. Solo desde `src/lib/`.
- **Prohibido:** RPC functions públicas sin validación de token o session.

### En componentes

- **Prohibido:** Editar `src/components/ui/` manualmente. Si un componente shadcn necesita cambio, crear un wrapper en `src/components/`.
- **Prohibido:** Lógica de negocio (queries, transformaciones de datos) dentro del JSX o en el return.
- **Prohibido:** Componentes mayores a ~300 líneas sin plan de división acordado.

### En arquitectura

- **Prohibido:** Instalar una librería nueva sin revisar primero si algo en `package.json` ya lo resuelve.
- **Prohibido:** Crear estado global (Context, store) para algo que solo usa un componente.
- **Prohibido:** Mezclar una migración SQL con un fix de frontend en el mismo commit.
- **Prohibido:** Eliminar migraciones SQL aunque parezcan duplicadas — pueden tener dependencias.

### En flujo de trabajo

- **Prohibido:** Aceptar un cambio de Claude sin leer los archivos modificados.
- **Prohibido:** Pedir "mejora todo X" sin especificar qué es X concretamente.
- **Prohibido:** Combinar más de un objetivo en un solo prompt cuando ambos tocan partes críticas.
- **Prohibido:** Dejar un `TODO` o `console.log` en código antes de commitear.

---

## Prompts de referencia rápida

### Para empezar una sesión

```
Contexto: MultiStack Systems, plataforma de gestión de proyectos.
Área: [componente/página/función concreta].
Objetivo único: [qué resolver].
No tocar: [archivos o zonas fuera de scope].
Referencia: `PROJECT_CONTEXT.md` contiene arquitectura completa.
```

### Para pedir análisis antes de cambiar

```
Analiza [archivo o función] y dime:
1. Qué hace exactamente
2. Qué otros archivos dependen de él
3. Qué riesgos tiene el cambio que voy a pedir
No hagas cambios todavía.
```

### Para cambio mínimo

```
Cambio específico: [descripción exacta].
Restricción: modificar solo [archivo(s)].
Si necesitas tocar otros archivos, dímelo antes de hacerlo.
Preferencia: el cambio más pequeño que resuelva el problema.
```

### Para refactor controlado

```
Quiero refactorizar [componente/función].
Paso 1: dame el plan completo sin tocar código.
Paso 2 (solo si confirmo el plan): ejecuta [primer paso concreto].
```

### Para validar después de un cambio

```
Revisión:
1. Lista los archivos que modificaste
2. ¿Hay side effects en archivos no tocados?
3. ¿Algún `as any` nuevo?
4. ¿Rompiste alguna convención del proyecto?
5. ¿Hay algo que deba revisar manualmente?
```
