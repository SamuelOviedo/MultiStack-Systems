# Oficina visual con Pixel Agents

[Pixel Agents](https://github.com/pablodelucca/pixel-agents) (extensión de VS Code `pablodelucca.pixel-agents`, licencia MIT) muestra cada sesión de Claude Code como un personaje en una oficina pixel art. La sesión principal es un personaje, y cada subagente que delega aparece como otro personaje mientras trabaja.

## Instalar (una vez por equipo)
1. Comprueba que tienes VS Code 1.105 o posterior: `code --version`.
2. Instala la extensión: `code --install-extension pablodelucca.pixel-agents`, o búscala en el Marketplace.
3. Abre el panel **Pixel Agents**, junto a la terminal.
4. Acepta el aviso de hooks. La extensión agrega sus hooks a tu `~/.claude/settings.json` de usuario y guarda antes una copia. No modifica el `.claude/settings.json` de este repo.

## Configuración obligatoria
- **Settings → Skip Permissions debe estar apagado.** Encenderlo lanza Claude con `--dangerously-skip-permissions`, que se salta las reglas `deny` de este repo.
- Con el CLI standalone (`npx pixel-agents`), nunca uses `--host 0.0.0.0`. El valor por defecto, `127.0.0.1`, basta.
- **Settings → Watch All Sessions** es opcional. Déjalo apagado si no quieres ver sesiones de otros proyectos.

## Qué envían los hooks
Los hooks envían a un servidor local (`127.0.0.1`, con token) el nombre de cada herramienta y su entrada: rutas, comandos y fragmentos de código. La extensión no tiene telemetría ni envía nada a Internet. Las reglas `deny` sobre `.env` evitan que su contenido llegue a esos eventos.

## Preparar la oficina
1. En **+ Agent → + Directory**, crea un Directory llamado `MultiStack` con la ruta de este repo.
2. En el editor de layout, pinta un Área `MultiStack` y asígnala a ese Directory, para que los personajes de este repo se sienten ahí.

## Trabajar
1. En **+ Agent → MultiStack**, abre la sesión principal. Se abre en una terminal de VS Code.
2. Asigna el trabajo con `/tarea <tarea>` o `/tarea T-xxx`.
3. Revisa el plan y apruébalo.
4. Sigue la oficina: cada paso delegado aparece como un personaje rotulado `<agente> · P<n> · <qué>`, y el personaje avisa cuando necesita un permiso.
5. Al terminar, la sesión principal resume, propone el commit y escribe la bitácora.
