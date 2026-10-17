# Instalar agentes y skills en MultiStack-Systems

## 1. Copiar al repo
Descomprime este paquete y copia su contenido en la raíz de `C:\MultiStack Systems\MultiStack-Systems\` (o de tu clon en Ubuntu):

```text
.claude/agents/      6 subagentes
.claude/skills/      29 skills revisadas
.claude/settings.json
.claude/SKILLS.md    inventario, versiones y licencias
.agents/product-marketing.md
scripts/setup-claude-plugins.sh
scripts/setup-claude-plugins.ps1
```

Si ya tienes un `.claude/settings.json`, combina su bloque `permissions.deny` con el tuyo en lugar de reemplazarlo.

## 2. Instalar el plugin de accesibilidad
- **Windows:** `powershell -ExecutionPolicy Bypass -File scripts\setup-claude-plugins.ps1`
- **Ubuntu:** `sh scripts/setup-claude-plugins.sh`

## 3. Verificar
1. Abre Claude Code en el repo.
2. Escribe `/` y confirma que aparecen `/impeccable`, `/copywriting`, `/l99`, `/godmode` y `/ghost`.
3. Corre `claude plugin validate .claude/skills` y `claude plugin validate .claude/agents`.
4. Pide: "usa el agente revisor sobre mis cambios actuales".

## 4. Completar el contexto de marketing
Pide al agente marketing: "completa .agents/product-marketing.md con la skill product-marketing". Te hará las preguntas de las secciones `[POR COMPLETAR]`.

## 5. Hacer commit
```bash
git add .claude .agents scripts INSTALAR.md
git commit -m "chore(claude): add subagents and reviewed skills"
```
