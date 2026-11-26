#!/usr/bin/env bash
# Haat Studio: install, verify and run, in that order.
#
#   ./run.sh              install → .env → photos → checks → start the dev server
#   ./run.sh --no-checks  same, but skip tests / typecheck / lint
#   ./run.sh --prod       build and start the production server instead of dev
#   PORT=3100 ./run.sh    choose the port (default 3100; 3000 is often taken)
#
# Safe to run again: every step skips work that is already done.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3100}"
CHECKS=1
MODE=dev
for arg in "$@"; do
  case "$arg" in
    --no-checks) CHECKS=0 ;;
    --prod) MODE=prod ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)"; exit 1 ;;
  esac
done

step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
step "1/6  Checking Node.js and npm"
command -v node >/dev/null || fail "Node.js is not installed. Install Node 22 or newer: https://nodejs.org"
command -v npm  >/dev/null || fail "npm is not installed (it ships with Node.js)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node $(node -v) is too old; this project needs Node 22 or newer."
ok "node $(node -v), npm $(npm -v)"

# ── 2. Dependencies ───────────────────────────────────────────────────────────
step "2/6  Installing dependencies (npm ci)"
# npm ci installs exactly what package-lock.json lists, so everyone gets the same versions.
if [ -d node_modules ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
  ok "node_modules is up to date with package-lock.json — skipped"
else
  npm ci --no-audit --no-fund
  ok "dependencies installed"
fi

# ── 3. Config: .env ───────────────────────────────────────────────────────────
step "3/6  Config file (.env)"
if [ -f .env ]; then
  ok ".env already exists — left untouched"
else
  cp .env.example .env
  ok "created .env from .env.example"
  warn "open .env and paste your keys (HF_TOKEN, GEMINI_API_KEY or GROQ_API_KEY)"
fi
# Report which keys are filled in, without printing their values.
has_key() { grep -Eq "^$1=.+" .env; }
has_key HF_TOKEN && ok "HF_TOKEN set (real try-ons work)" \
  || warn "HF_TOKEN empty — try-on needs it (free: https://huggingface.co/settings/tokens)"
if has_key GEMINI_API_KEY || has_key GROQ_API_KEY; then
  ok "a text-AI key is set (AI captions and research)"
else
  warn "no GEMINI_API_KEY / GROQ_API_KEY — captions and research use templates"
fi

# ── 4. Example photos ─────────────────────────────────────────────────────────
step "4/6  Downloading preset models and sample garments (npm run setup)"
# Not committed to git (licensing); fetched from FASHN's public examples. Already-downloaded files are kept.
if npm run --silent setup; then
  ok "photos ready in public/presets and public/samples"
else
  warn "some photos failed to download (no internet?). The app still runs; re-run ./run.sh later."
fi

# ── 5. Verify ─────────────────────────────────────────────────────────────────
if [ "$CHECKS" -eq 1 ]; then
  step "5/6  Verifying: unit tests, types, lint"
  # `if !` rather than `cmd && ok`: set -e ignores a failure on the left of &&.
  if ! npm test --silent;         then fail "unit tests failed (see above)"; fi; ok "unit tests pass (no network used)"
  if ! npm run --silent typecheck; then fail "type errors (see above)";      fi; ok "TypeScript types check"
  if ! npm run --silent lint;      then fail "lint errors (see above)";      fi; ok "lint clean"
else
  step "5/6  Verifying — skipped (--no-checks)"
fi

# ── 6. Run ────────────────────────────────────────────────────────────────────
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "port $PORT is already in use. Stop that server, or run: PORT=3300 ./run.sh"
fi

if [ "$MODE" = prod ]; then
  step "6/6  Building and starting the production server on http://localhost:$PORT"
  npm run build
  PORT="$PORT" npm run start:standalone
else
  step "6/6  Starting the dev server on http://localhost:$PORT  (Ctrl+C to stop)"
  exec npm run dev -- --port "$PORT"
fi
