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

## Qué hacen en tu máquina (revisado)

- **Ninguna skill ejecuta comandos al cargarse.** Ninguna usa inyección `` !`comando` ``.
- **`impeccable`** descarga su motor (un binario) desde las releases de GitHub de `pbakaus/impeccable` la primera vez que se usa, en una versión fija. En Windows usa `scripts/impeccable.cmd`.
- **`web-design-guidelines`** lee sus reglas desde GitHub en cada revisión. MultiStack fijó la URL al commit `434b7f9` para que las reglas no cambien sin que lo decidas.
- **`extract-design-system`** ejecuta `npx extract-design-system` y `npx playwright install chromium` cuando la usas.
- **AccessLint** ejecuta `npx @accesslint/cli@latest` y `npx @accesslint/chrome@latest`, y abre un Chrome controlado.
- **El agente qa** levanta el MCP `chrome-devtools-mcp@latest` solo mientras corre.
- **`skill-creator`** trae scripts de Python para evaluar skills; solo corren si lo pides.
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
