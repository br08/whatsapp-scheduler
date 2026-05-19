#!/usr/bin/env bash
# deploy.sh — production bootstrap for a VPS.
# Run on first deploy and after every git pull.
# Prerequisites: Node.js ≥ 20, npm, Docker (with compose plugin).
# See docs/DEPLOY.md for the full deployment guide.
#
# What this script does:
#   1. Check prerequisites
#   2. Install Node dependencies (including build tools)
#   3. Compile TypeScript for production (src/ only, path aliases resolved)
#   4. Start infrastructure via docker compose (Postgres, Redis, Evolution API)
#   5. Wait for PostgreSQL to be ready
#   6. Apply database migrations
#   7. Restart systemd service (if installed) or print first-time setup instructions
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
echo "[deploy] checking prerequisites..."
for cmd in node npm docker; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "[deploy] ERROR: $cmd not found"; exit 1; }
done
docker compose version >/dev/null 2>&1 || { echo "[deploy] ERROR: 'docker compose' (v2 plugin) not found"; exit 1; }

# ── 2. Dependencies ───────────────────────────────────────────────────────────
echo "[deploy] installing Node dependencies..."
npm ci 2>/dev/null || npm install

# ── 3. Environment ────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "[deploy] .env not found — copying from .env.production.example"
  cp .env.production.example .env
  echo "[deploy] IMPORTANT: edit .env with your actual production credentials, then re-run this script."
  exit 1
fi

# ── 4. Build ──────────────────────────────────────────────────────────────────
echo "[deploy] building for production..."
npm run build

# ── 5. Infrastructure ─────────────────────────────────────────────────────────
echo "[deploy] starting infrastructure (docker compose)..."
docker compose up -d

# ── 6. Wait for PostgreSQL ────────────────────────────────────────────────────
echo "[deploy] waiting for PostgreSQL..."
DATABASE_URL="$(grep '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')"
DEADLINE=$(( $(date +%s) + 60 ))
until node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  if [ "$(date +%s)" -gt "$DEADLINE" ]; then
    echo "[deploy] ERROR: timed out waiting for PostgreSQL"
    exit 1
  fi
  printf '.'
  sleep 2
done
echo ""
echo "[deploy] PostgreSQL ready"

# ── 7. Migrations ─────────────────────────────────────────────────────────────
echo "[deploy] running database migrations..."
npm run migrate

# ── 8. Start / restart ────────────────────────────────────────────────────────
if systemctl is-active --quiet whatsapp-scheduler 2>/dev/null; then
  echo "[deploy] restarting systemd service..."
  sudo systemctl restart whatsapp-scheduler
  echo "[deploy] done. Check status with: sudo systemctl status whatsapp-scheduler"
else
  echo "[deploy] build and migrations complete."
  echo "[deploy] systemd service not installed yet — see docs/DEPLOY.md for first-time setup."
fi
