# Instala los plugins de Claude Code del proyecto (Windows 11, PowerShell).
# Ejecutar una vez desde la raíz del repo: powershell -ExecutionPolicy Bypass -File scripts\setup-claude-plugins.ps1
$ErrorActionPreference = "Stop"

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Error "No se encontró el comando 'claude'. Instala Claude Code primero."
  exit 1
}

# AccessLint: auditoría WCAG 2.2 para el agente qa (incluye su servidor MCP).
claude plugin marketplace add AccessLint/skills
claude plugin install accesslint@accesslint --scope project

Write-Host "Listo. Abre Claude Code en el repo y verifica con: claude plugin list"
