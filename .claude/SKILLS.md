# Skills de MultiStack Systems

Inventario de las skills instaladas en `.claude/skills/`, revisadas el 2026-10-17.

## Cómo las usa cada agente

- **Precargada:** el agente recibe la skill completa en cada invocación, a través del campo `skills` de su archivo.
- **Bajo demanda:** el agente la invoca solo cuando la tarea lo pide, con la herramienta Skill.
- **Tú** puedes llamar cualquiera con `/nombre-de-la-skill`.

## Instaladas

| Skill | Agente | Uso | Origen (commit) | Licencia |
| --- | --- | --- | --- | --- |
| `frontend-design` | ui-system | Precargada | anthropics/skills (dbd4588) | Apache-2.0 |
| `impeccable` | ui-system, marketing | Bajo demanda | pbakaus/impeccable (08d5b47) | Apache-2.0 |
| `emil-design-eng` | ui-system | Bajo demanda | emilkowalski/skills (2d22863) | MIT |
| `animate` | ui-system | Bajo demanda | emilkowalski/skills (2d22863) | MIT |
| `review-animations` | ui-system | Solo manual | emilkowalski/skills (2d22863) | MIT |
| `animation-performance` | ui-system | Bajo demanda | emilkowalski/skills (2d22863) | MIT |
| `vercel-react-best-practices` | ui-system, revisor | Bajo demanda | vercel-labs/agent-skills (063bee9) | MIT |
| `vercel-composition-patterns` | ui-system | Bajo demanda | vercel-labs/agent-skills (063bee9) | MIT |
| `extract-design-system` | ui-system | Bajo demanda | arvindrk/extract-design-system (1873741) | MIT |
| `ui-ux-pro-max` | ui-system | Bajo demanda, solo productos nuevos | nextlevelbuilder/ui-ux-pro-max-skill (56ea9cf), con ajuste local | MIT |
| `ghost` | marketing | Precargada | Propia de MultiStack | — |
| `copywriting` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `copy-editing` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `cro` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `signup` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `seo-audit` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `ai-seo` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `schema` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `site-architecture` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `pricing` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `emails` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `product-marketing` | marketing | Bajo demanda | coreyhaines31/marketingskills (365b412) | MIT |
| `webapp-testing` | qa | Bajo demanda | anthropics/skills (dbd4588) | Apache-2.0 |
| AccessLint (plugin, 5 skills) | qa | Bajo demanda | AccessLint/skills, vía `scripts/setup-claude-plugins.*` | MIT |
| `supabase` | supabase | Precargada | supabase/agent-skills (c9be0e9) | MIT |
| `supabase-postgres-best-practices` | security (precargada), supabase | Precargada / bajo demanda | supabase/agent-skills (c9be0e9) | MIT |
| `web-design-guidelines` | revisor | Bajo demanda | vercel-labs/agent-skills (063bee9) | MIT |
| `skill-creator` | Tú / sesión principal | Bajo demanda | anthropics/skills (dbd4588) | Apache-2.0 |
| `l99` | Tú / sesión principal | Solo manual | Propia de MultiStack | — |
| `godmode` | Tú / sesión principal | Solo manual | Propia de MultiStack | — |
| `tarea` | Sesión principal | Bajo demanda y manual; entrada de toda tarea de desarrollo | Propia de MultiStack | — |
| Spec Kit (8 skills `speckit-*`) | Tú | Solo manual; planificación previa a `/tarea` (ver «Spec Kit») | github/spec-kit v1.3.2 (55264c2) | MIT |

## Spec Kit: planificación antes de `/tarea`

Instalado el 2026-11-09 con la integración `claude` y las opciones `--no-model-invocation --events false`. Sirve para escribir la especificación, el plan y la lista de tareas de una funcionalidad antes de implementarla. No implementa: la implementación sigue entrando por `/tarea`.

- **Solo las invocas tú.** Las ocho llevan `disable-model-invocation: true`: ni la sesión principal ni los subagentes pueden llamarlas.
- **Reglas:** `.specify/memory/constitution.md` resume para Spec Kit las reglas de `CLAUDE.md`. Si se contradicen, manda `CLAUDE.md`.
- **Dónde escribe:** en `specs/NNN-nombre/` y en `.specify/feature.json` (estado local, ignorado por git). No crea ramas, no hace commits y no toca `src/` ni `supabase/`.

| Comando | Cuándo | Qué produce |
| --- | --- | --- |
| `/speckit-specify <descripción>` | Al empezar una funcionalidad | `specs/NNN-nombre/spec.md` y su checklist de calidad |
| `/speckit-clarify` | Si la spec tiene huecos | Hasta 5 preguntas; las respuestas quedan en `spec.md` |
| `/speckit-plan <indicaciones técnicas>` | Con la spec aprobada | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` y el control de constitución |
| `/speckit-checklist <enfoque>` | Opcional | Un checklist de requisitos en `checklists/` |
| `/speckit-tasks` | Con el plan aprobado | `tasks.md`; no ejecuta ninguna tarea |
| `/speckit-analyze` | Antes de implementar | Informe de consistencia entre spec, plan y tareas; no modifica archivos |
| `/speckit-converge` | Después de implementar con `/tarea` | Compara el código con la spec y agrega a `tasks.md` lo que falte; no toca código |
| `/speckit-constitution` | Solo para enmendar la constitución | Reescribe `.specify/memory/constitution.md`; el texto lo apruebas tú antes |

**Flujo:** `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → revisas y apruebas → `/tarea` con la carpeta de la spec como insumo → `/bitacora`.

**No se instaló, a propósito:** `speckit-implement` y el workflow «Full SDD Cycle», porque implementan sin pasar por `/tarea`. Tampoco hay extensiones (git, hooks) ni eventos en `.claude/settings.json`. Donde una skill sugiera `/speckit-implement`, usa `/tarea`.

**Antes de commitear una spec:** revisa que no tenga rutas absolutas de tu máquina, datos personales ni contenido de la documentación privada.

**Actualizar Spec Kit:** es una instalación gestionada. Sus archivos se comparan por hash con `.specify/integrations/*.manifest.json`, así que no los edites ni reemplaces a mano (`.gitattributes` los mantiene en LF por la misma razón).

1. En una rama `chore/`, ejecuta el CLI fijado a un commit revisado: `uvx --from "git+https://github.com/github/spec-kit.git@<commit>" specify integration upgrade claude`. Sin `--force` actualiza las skills y deja como están los scripts y las plantillas de `.specify/`; refrescarlos exige `--force`, que es una decisión aparte.
2. La actualización vuelve a crear `speckit-implement`: borra `.claude/skills/speckit-implement/` y su línea en `.specify/integrations/claude.manifest.json`. Si reaparece el workflow, quítalo con `specify workflow remove speckit`.
3. Comprueba con el mismo CLI que `specify integration status` dice `OK`, revisa el diff y confirma que las ocho siguen con `disable-model-invocation: true`.

## Qué hacen en tu máquina (revisado)

- **Ninguna skill ejecuta comandos al cargarse.** Ninguna usa inyección `` !`comando` ``.
- **`impeccable`** descarga su motor (un binario) desde las releases de GitHub de `pbakaus/impeccable` la primera vez que se usa, en una versión fija. En Windows usa `scripts/impeccable.cmd`.
- **`web-design-guidelines`** lee sus reglas desde GitHub en cada revisión. MultiStack fijó la URL al commit `434b7f9` para que las reglas no cambien sin que lo decidas.
- **`extract-design-system`** ejecuta `npx extract-design-system` y `npx playwright install chromium` cuando la usas.
- **AccessLint** ejecuta `npx @accesslint/cli@latest` y `npx @accesslint/chrome@latest`, y abre un Chrome controlado.
- **El agente qa** levanta el MCP `chrome-devtools-mcp@latest` solo mientras corre.
- **`skill-creator`** trae scripts de Python para evaluar skills; solo corren si lo pides.
- **Spec Kit** ejecuta scripts de bash de `.specify/scripts/bash/` cuando usas una skill `speckit-*`. Solo leen y escriben dentro de `specs/` y `.specify/`; no usan red ni git.
- **`ui-ux-pro-max`** corre `scripts/search.py` con Python 3 sobre archivos CSV locales; no usa red. MultiStack le hizo tres ajustes respecto al original:
  - Cambió `${CLAUDE_PLUGIN_ROOT}` por `${CLAUDE_SKILL_DIR}`, porque la variable original solo funciona dentro de un plugin.
  - Restringió su descripción a productos nuevos sin marca.
  - Quitó su carpeta de tests.

## No instaladas por defecto

| Skill | Existe | Por qué no se instaló | Cómo agregarla si la quieres |
| --- | --- | --- | --- |
| Scroll World | Sí (cth9191/scroll-world, oso95/scroll-world) | Genera video con Higgsfield o Monid, servicios de pago por clip | `npx skills add cth9191/scroll-world -a claude-code` |
| Anatomy | Sí (wheresryan22/anatomy) | Ilustraciones isométricas para docs; trae 90 scripts y requiere Node 20.10+ y Chrome | `npx skills add wheresryan22/anatomy -a claude-code` |
| Token Optimizer | Sí (alexgreensh/token-optimizer) | Audita tu configuración de Claude Code, no tu base de datos; mejor a nivel de usuario | `npx skills add alexgreensh/token-optimizer -a claude-code -g` |
| Napkin | Sí (blader/napkin) | Es memoria de errores entre sesiones, no bocetos de tests; duplica la memoria nativa de los agentes | — |
| Caveman | Sí (JuliusBrussee/caveman) | Solo recorta tokens de salida | — |
| Claude-Mem | Sí (thedotmack/claude-mem) | Duplica la memoria nativa y genera CLAUDE.md por carpeta | — |
| Headroom | Sí (headroomlabs-ai/headroom) | Proxy que intercepta todo el tráfico de Claude Code | — |
| Monetization | Varias genéricas | Cubierta por `pricing` de Corey Haines | — |
| /UDA | No encontrada | No existe un repo verificable | — |
| /Buddha | No encontrada | Cubierta por `l99` | — |

## Actualizar una skill

1. Clona el repo original y revisa el diff contra la versión de esta tabla.
2. Reemplaza la carpeta en `.claude/skills/` y actualiza el commit aquí.
3. Corre `claude plugin validate .claude/skills` para validar el formato.
