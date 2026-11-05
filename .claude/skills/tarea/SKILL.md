---
name: tarea
description: "Punto de entrada de toda tarea o plan de desarrollo en MultiStack. La sesión principal lee el estado, escribe el plan, espera la aprobación y después reparte los pasos entre los subagentes, que se ven como personajes en Pixel Agents. Úsala con /tarea seguido de la tarea o de un brief T-xxx, y siempre que el usuario pida un cambio de código."
argument-hint: "[tarea, o T-xxx]"
effort: high
---

# Tarea: primero el plan, después los subagentes

Tarea: $ARGUMENTS

Eres la sesión principal, el orquestador: planificas, delegas, integras y verificas. No editas código.

## 0. Contexto
1. Si existe `CLAUDE.local.md`, lee la última entrada de la bitácora y el estado vigente que indica.
2. Si la tarea es un identificador `T-xxx`, busca su brief en la carpeta de tareas que indica `CLAUDE.local.md` y úsalo como fuente de verdad. Si no lo encuentras, pide la ruta.
3. Ejecuta `git branch --show-current` y `git status --short`. Si hay cambios sin commitear ajenos a esta tarea, avisa antes de seguir.
4. Lee los archivos que la tarea toca y ejecuta `codegraph impact` sobre los símbolos compartidos afectados.

## 1. Plan (no edites ni delegues todavía)
Presenta:
- **Objetivo** en una frase y lo que queda **fuera de alcance**.
- **Rama**: la actual, o una nueva `feat/`, `fix/` o `chore/` desde `main`.
- La tabla de pasos:

| Paso | Agente | Qué hace | Archivos | Depende de | Cómo se verifica |
| --- | --- | --- | --- | --- | --- |

Reglas del plan:
- Cada paso tiene un solo agente: `ui-system`, `marketing`, `supabase`, `qa`, `security` o `revisor` (sección Delegación del CLAUDE.md).
- Marca con ∥ los pasos que pueden correr en paralelo porque no tocan los mismos archivos.
- Marca **Propietario** todo paso de producción o irreversible: migración remota, secreto, despliegue, push o merge. Se prepara y se documenta; no se ejecuta.
- Los últimos pasos siempre son `qa` y `revisor`. Agrega `security` si el cambio toca auth, `ProtectedRoute`, `src/pages/client/**` o `supabase/**`.
- Lista las decisiones abiertas con tu recomendación. Si alguna es de arquitectura, sugiere `/l99` antes de ejecutar.

Termina con "¿Apruebas el plan?" y detente.

## 2. Ejecución (solo con el plan aprobado)
1. Crea la lista de tareas, con un elemento por paso, y márcalo al terminarlo.
2. Delega cada paso con la herramienta Agent:
   - `subagent_type`: el agente del paso.
   - `description`: `<agente> · P<n> · <qué>`, en seis palabras como máximo. Es el rótulo del personaje en Pixel Agents.
   - `prompt`: un encargo autocontenido, porque el subagente no ve esta conversación. Incluye el objetivo del paso, los archivos, los criterios de aceptación y lo que no debe tocar. Termina con: "No hagas commit ni push. Entrega qué cambió, cómo se verificó y qué queda pendiente."
3. Lanza en el mismo mensaje los pasos marcados con ∥, y los demás en orden. Si dos pasos en paralelo editan código, usa aislamiento en worktree.
4. Compara cada entrega con su criterio. Si no lo cumple, devuélvela al mismo agente con lo que falta; no la corrijas tú.
5. Si el plan tiene que cambiar, detente y presenta el cambio antes de seguir.

## 3. Verificación
- El gate completo está en verde (lo corre `revisor`).
- No quedan hallazgos críticos de `revisor` ni de `security`. Si los hay, vuelve al punto 4 de la ejecución.

## 4. Cierre
1. Resume qué cambió por agente, el resultado del gate y lo que queda pendiente del propietario.
2. Propón el mensaje de commit convencional y la lista de archivos. Haz el commit local solo si el usuario lo aprueba, después de revisar `git diff --staged`. El push y el PR los hace el usuario.
3. Invoca la skill `bitacora`.

## Atajos
- Si la tarea es de un solo agente y un solo archivo, el plan puede ser una línea, pero igual espera la aprobación.
- Si la tarea es larga y cruza frontend y Supabase, sugiere `/godmode`.
- Las preguntas, explicaciones y revisiones de solo lectura no pasan por este flujo.
