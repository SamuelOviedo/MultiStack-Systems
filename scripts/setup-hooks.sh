#!/bin/bash
# MultiStack Systems — instala el pre-commit hook de seguridad
# Uso: bash scripts/setup-hooks.sh

set -e

RED='\033[0;31m'
YEL='\033[1;33m'
GRN='\033[0;32m'
CYN='\033[0;36m'
BLD='\033[1m'
NC='\033[0m'

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "No estás en un repositorio git."; exit 1; }
HOOK="$ROOT/.git/hooks/pre-commit"
GITIGNORE="$ROOT/.gitignore"

printf "${CYN}[setup-hooks]${NC} Instalando pre-commit hook...\n"

# ── Escribir el hook ─────────────────────────────────────────────────────────

cat > "$HOOK" << 'END_OF_HOOK'
#!/bin/bash
# MultiStack Systems — pre-commit security hook
# Bloquea commits con secrets hardcodeados o archivos peligrosos.

RED='\033[0;31m'
YEL='\033[1;33m'
GRN='\033[0;32m'
CYN='\033[0;36m'
BLD='\033[1m'
NC='\033[0m'

TMPFAIL=$(mktemp 2>/dev/null || echo "/tmp/pre_commit_fail_$$")
rm -f "$TMPFAIL"

err()  { printf "${RED}✗${NC} ${BLD}%s${NC}\n" "$*"; }
line() { printf "  ${YEL}→${NC} %s\n" "$*"; }
ok()   { printf "${GRN}✓${NC} %s\n" "$*"; }

printf "${CYN}[pre-commit]${NC} Escaneando staged files...\n\n"

STAGED_ALL=$(git diff --cached --name-only)

# ── 1. Archivos que nunca deben subir ────────────────────────────────────────

block_path() {
  local pattern="$1" label="$2"
  local found
  found=$(printf '%s\n' "$STAGED_ALL" | grep -E "$pattern" || true)
  if [ -n "$found" ]; then
    err "Archivos $label detectados en staging:"
    printf '%s\n' "$found" | while IFS= read -r f; do line "$f"; done
    printf '\n'
    touch "$TMPFAIL"
  fi
}

block_path '^\.env($|\.)'   ".env / .env.*"
block_path '^dist/'         "de build (dist/)"
block_path '^\.vercel/'     "de deploy (.vercel/)"
block_path '^node_modules/' "node_modules/"

# ── 2. Patrones de secrets en código fuente ──────────────────────────────────

STAGED_SRC=$(printf '%s\n' "$STAGED_ALL" | grep -E '\.(ts|tsx|js|jsx|env)$' || true)

scan() {
  local label="$1" pattern="$2"
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    local hits
    hits=$(git show ":$file" 2>/dev/null | grep -En "$pattern" || true)
    if [ -n "$hits" ]; then
      err "$label en ${BLD}$file${NC}:"
      printf '%s\n' "$hits" | while IFS= read -r h; do line "línea $h"; done
      printf '\n'
      touch "$TMPFAIL"
    fi
  done < <(printf '%s\n' "$STAGED_SRC")
}

if [ -n "$STAGED_SRC" ]; then
  # API keys prefijo sk- (OpenAI, Stripe, etc.)
  scan "API key (sk-...)" \
    "sk-[a-zA-Z0-9_-]{20,}"

  # Google OAuth client secret
  scan "Google OAuth secret (GOCSPX-)" \
    "GOCSPX-[a-zA-Z0-9_-]+"

  # JWT en string literal (Supabase service role, tokens hardcodeados)
  scan "JWT hardcodeado (eyJ...)" \
    "['\"]eyJ[a-zA-Z0-9+/_=-]{20,}"

  # Resend API key
  scan "Resend API key (re_...)" \
    "re_[a-zA-Z0-9]{25,}"

  # Asignación directa: ALGO_KEY = "valor_largo" (excluye import.meta.env.X)
  scan "Secret hardcodeado (_KEY/_SECRET/_TOKEN/_PASSWORD)" \
    "[A-Z_]+(KEY|SECRET|TOKEN|PASSWORD)[[:space:]]*=[[:space:]]*['\"][a-zA-Z0-9+/_.@-]{12,}['\"]"
fi

# ── Resultado ────────────────────────────────────────────────────────────────

if [ -f "$TMPFAIL" ]; then
  rm -f "$TMPFAIL"
  printf "${RED}${BLD}Commit bloqueado.${NC} Corrige los problemas anteriores.\n"
  printf "Para unstage un archivo: ${YEL}git restore --staged <archivo>${NC}\n\n"
  exit 1
fi

ok "Sin problemas detectados — commit permitido."
exit 0
END_OF_HOOK

chmod +x "$HOOK"
printf "${GRN}✓${NC} Hook instalado: ${BLD}.git/hooks/pre-commit${NC}\n"

# ── Verificar / actualizar .gitignore ────────────────────────────────────────

printf "${CYN}[setup-hooks]${NC} Verificando .gitignore...\n"

add_if_missing() {
  local entry="$1"
  if ! grep -qxF "$entry" "$GITIGNORE" 2>/dev/null; then
    printf '\n%s\n' "$entry" >> "$GITIGNORE"
    printf "  ${YEL}+${NC} Añadido: ${BLD}%s${NC}\n" "$entry"
  else
    printf "  ${GRN}✓${NC} Ya existe: %s\n" "$entry"
  fi
}

add_if_missing ".env"
add_if_missing ".env.local"
add_if_missing ".env.production"
add_if_missing "dist/"
add_if_missing "node_modules/"
add_if_missing ".vercel/"

# ── Resumen ──────────────────────────────────────────────────────────────────

printf "\n${GRN}${BLD}✓ Setup completo.${NC}\n"
printf "  Hook activo en cada ${BLD}git commit${NC}.\n"
printf "  Probar manualmente: ${YEL}bash .git/hooks/pre-commit${NC}\n\n"
