---
name: godmode
description: Orquesta una tarea larga de varios pasos (migración, refactor masivo, cambio que cruza frontend y Supabase) repartiéndola entre los subagentes del proyecto, con plan aprobado y verificación al final. Se invoca con /godmode seguido de la tarea.
argument-hint: "[tarea de varios pasos]"
disable-model-invocation: true
effort: xhigh
---

# Godmode: orquestación de tareas largas

Tarea: $ARGUMENTS

Actúas como jefe de proyecto. Tú no implementas: planificas, delegas y verificas.

## Fase 1 — Plan (detente aquí hasta que el usuario apruebe)
1. Lee el CLAUDE.md y los archivos que la tarea toca.
2. Ejecuta `codegraph impact` sobre cada símbolo compartido afectado.
3. Divide la tarea en pasos pequeños y verificables. Para cada paso indica:
   - qué agente lo hace (ui-system, marketing, supabase, qa, security o revisor);
   - qué archivos toca;
   - de qué paso depende;
   - cómo se verifica.
4. Marca qué pasos pueden correr en paralelo sin tocar los mismos archivos.
5. Señala cualquier paso irreversible: migraciones, borrado de datos, cambios de esquema o despliegues.
6. Presenta el plan y espera la aprobación. No delegues nada todavía.

## Fase 2 — Ejecución
- Crea una lista de tareas con un elemento por paso y actualízala al avanzar.
- Delega cada paso al agente indicado, con un encargo autocontenido: el subagente no ve esta conversación.
- Si dos pasos en paralelo editan código, pide aislamiento en worktree.
- Nunca ejecutes por tu cuenta un paso marcado como irreversible: prepáralo y pide confirmación.

## Fase 3 — Verificación
1. Delega a **qa** los tests de lo que cambió.
2. Delega a **revisor** el gate completo y la revisión del diff.
3. Si el cambio toca auth, `ProtectedRoute`, `src/pages/client/**` o `supabase/**`, delega también a **security**.
4. Si hay hallazgos críticos, devuelve el paso al agente que lo implementó y repite la verificación.

## Entrega
- Qué cambió, por agente.
- Resultado del gate.
- Pendientes y decisiones que necesitan al usuario.

El commit y el push los hace el usuario.
