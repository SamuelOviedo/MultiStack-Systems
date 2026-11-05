#!/usr/bin/env sh
# Instala los plugins de Claude Code del proyecto (Ubuntu / macOS / WSL).
# Ejecutar una vez desde la raíz del repo: sh scripts/setup-claude-plugins.sh
set -eu

if ! command -v claude >/dev/null 2>&1; then
  echo "No se encontró el comando 'claude'. Instala Claude Code primero." >&2
  exit 1
fi

# AccessLint: auditoría WCAG 2.2 para el agente qa (incluye su servidor MCP).
claude plugin marketplace add AccessLint/skills
claude plugin install accesslint@accesslint --scope project

echo "Listo. Abre Claude Code en el repo y verifica con: claude plugin list"
