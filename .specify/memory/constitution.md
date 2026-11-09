# Constitución de MultiStack Systems

Esta constitución resume, para las skills de Spec Kit, las reglas que ya rigen el proyecto. La fuente de autoridad es `CLAUDE.md`, junto con `.claude/rules/`. Este documento no añade políticas: si algo aquí contradice a esos archivos, mandan ellos y esta constitución se corrige.

## Principios fundamentales

### I. Stack e infraestructura existentes

- Toda spec y todo plan se construyen sobre el stack del proyecto: Vite, React y TypeScript; Supabase (Auth, Postgres con RLS y Edge Functions en Deno); Tailwind con shadcn/ui; TanStack Query; Vercel. Las versiones vigentes están en `CLAUDE.md`.
- Un plan que proponga reemplazar una pieza del stack, o sumar un servicio o una infraestructura nuevos, lo marca como decisión de arquitectura: pasa por `/l99` y por la aprobación del propietario antes de seguir.
- El plan respeta las «Reglas del código», las «Zonas delicadas» y el «Sistema de diseño» de `CLAUDE.md`. En particular: `src/lib/products.ts` es la única fuente de datos de productos, el acceso a datos pasa por `src/lib/*`, las URL del ecosistema salen de variables `VITE_*` y `src/integrations/supabase/types.ts` se regenera, no se edita.

### II. Seguridad: privilegio mínimo y fallo cerrado (no negociable)

- Toda ruta privada pasa por `ProtectedRoute` con el `allowedTypes` correcto. El dashboard administrativo es solo para el rol admin. Colaboradores y clientes conservan accesos separados, cada uno con el privilegio mínimo que necesita. Ninguna spec amplía el acceso de un rol sin la aprobación explícita del propietario y la revisión de `security`.
- Toda tabla nueva lleva RLS activo, privilegios mínimos y una prueba pgTAP de lo que pueden y no pueden hacer `anon`, cliente, colaborador y admin.
- Toda Edge Function falla cerrada: valida la entrada, verifica la sesión o la firma, se detiene si falta configuración y no registra en logs correos, IP, claves ni el contenido del visitante.
- Las variables `VITE_*` son públicas en el navegador: nada secreto ahí.
- Si un cambio toca auth o datos, el plan incluye la auditoría de `security`.

### III. Pruebas, CI y revisión

- El plan y las tareas terminan con el gate completo de `CLAUDE.md` (lint, typecheck, tests y build), el mismo que corre CI.
- La lógica nueva lleva tests nuevos, cada bug corregido lleva un test que falla sin el arreglo, y un cambio en la base de datos lleva su prueba pgTAP. Por eso las tareas de prueba para lógica nueva no son opcionales, aunque la plantilla de tareas las trate así.
- Ningún test usa credenciales reales, correos reales ni el proyecto de producción. Playwright corre solo contra entornos locales.
- Después de cualquier cambio de código revisa `revisor`; `qa` cubre tests y accesibilidad. Una funcionalidad está terminada cuando cumple la «Definición de terminado» de `CLAUDE.md`.

### IV. Migraciones y producción

- Las migraciones van solo hacia adelante: nunca se edita una existente; se crea una nueva con su prueba pgTAP.
- Producción la opera solo el propietario. Migraciones remotas, secretos, despliegue de funciones y Vercel aparecen en el plan y en las tareas como pasos del **Propietario**: se preparan y se documentan, nunca se ejecutan.

### V. Repositorio público y documentación privada

- Este repositorio es público. Ninguna spec, plan, lista de tareas ni checklist contiene secretos, datos personales, volcados SQL, logs, ni correos o teléfonos de clientes.
- La documentación operativa y de incidentes es privada y vive fuera de este repo. Nunca se copian su contenido, sus rutas ni sus identificadores a `specs/` ni a `.specify/`.
- Los documentos generados usan rutas relativas a la raíz del repo, nunca rutas absolutas de una máquina.

### VI. Ramas y commits

- Las ramas de trabajo son `feat/`, `fix/` o `chore/`, con commits convencionales (`feat(scope): …`, `fix(security): …`).
- Spec Kit no crea ramas ni hace commits. El identificador `NNN-nombre` de una spec nombra su carpeta en `specs/`; el campo «Feature Branch» de las plantillas lleva ese identificador y no es el nombre de una rama de git.
- Un cambio, un propósito: si una tarea toca 5 o más archivos no relacionados, se divide.

### VII. Implementación por la sesión principal y autorización del propietario

- Spec Kit sirve para especificar, planificar y analizar. No implementa: `speckit-implement` y el workflow automático no están instalados ni se instalan.
- La implementación entra solo por la sesión principal: plan, aprobación, delegación a los subagentes, verificación y bitácora. `/tarea` es la vía por defecto; `/godmode` queda solo para la excepción que `CLAUDE.md` permite de forma explícita, una tarea larga que cruza frontend y Supabase. Donde una skill de Spec Kit sugiera `/speckit-implement`, el paso que corresponde es `/tarea`.
- `tasks.md` es un insumo para el plan de `/tarea`, no una orden de ejecución. Generar una spec, un plan o una lista de tareas no ejecuta ninguna tarea ni instala dependencias.
- Commits, push, merge, despliegues y operaciones con credenciales requieren la autorización del propietario. El commit local se hace solo con su aprobación; el push, el PR, el merge y todo lo de producción los ejecuta él. Las notas de plantilla del tipo «commit after each task» no aplican.

## Decisiones que se consultan antes de planificar

Una spec o un plan que requiera cualquiera de estos puntos lo presenta como decisión abierta para el propietario y no lo da por aprobado:

- Cambiar el sistema de tokens o el copy de productos.
- Borrar dependencias, crear rutas nuevas, o modificar CI o `.claude/settings.json`.
- Cualquier paso que deba ejecutarse en producción.

Antes de planificar un cambio en un símbolo compartido o en una zona delicada, se ejecuta `codegraph impact` y se lee la sección Riesgos de `docs/context/PROJECT_CONTEXT.md`.

## Flujo de trabajo y controles

1. El propietario invoca las skills de Spec Kit; ninguna se invoca sola. Orden habitual: `/speckit-specify` → `/speckit-clarify` (si hay huecos) → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`.
2. El propietario revisa y aprueba la spec, el plan y las tareas.
3. La implementación se asigna con `/tarea`, con la carpeta de la spec como insumo, y se cierra con `/bitacora`.

En «Constitution Check», `/speckit-plan` comprueba como mínimo:

- **C1 Stack:** no reemplaza ni añade infraestructura sin una decisión de arquitectura aprobada (I).
- **C2 Acceso:** rutas privadas con `ProtectedRoute`; ningún rol gana acceso sin aprobación (II).
- **C3 Datos:** tabla nueva con RLS, privilegios mínimos y pgTAP por rol; Edge Functions con fallo cerrado (II).
- **C4 Pruebas:** gate completo, tests para la lógica nueva y revisión de `revisor`, más `security` si toca auth o datos (III).
- **C5 Migraciones y producción:** migración nueva, nunca editada; pasos de producción marcados como **Propietario** (IV).
- **C6 Repo público:** sin secretos, datos personales, contenido privado ni rutas absolutas locales (V).
- **C7 Flujo:** sin ramas ni commits automáticos; implementación por `/tarea`; consultas previas listadas como decisiones abiertas (VI, VII).

## Gobernanza

- `CLAUDE.md` es la fuente de autoridad. Cuando cambia una regla recogida aquí, esta constitución se actualiza para reflejarla.
- Toda enmienda la aprueba el propietario antes de escribirse. `/speckit-constitution` solo la invoca él.
- Versionado semántico: MAJOR si se elimina o redefine un principio, MINOR si se añade un principio o una sección, PATCH para aclaraciones.
- Cumplimiento: `/speckit-plan` aplica los controles C1 a C7, `/speckit-analyze` trata cualquier incumplimiento como crítico, y `revisor` y `security` lo verifican durante la implementación.

**Version**: 1.0.0 | **Ratified**: 2026-11-09 | **Last Amended**: 2026-11-09
