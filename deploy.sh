#!/usr/bin/env bash
# deploy.sh — one-shot bootstrap for any machine.
# Usage: ./deploy.sh
# Prerequisites: Node.js ≥ 20, npm, Docker (with compose plugin).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "[deploy] checking prerequisites..."
for cmd in node npm docker; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "[deploy] ERROR: $cmd not found"; exit 1; }
done

# Ensure docker compose v2 is available
docker compose version >/dev/null 2>&1 || { echo "[deploy] ERROR: 'docker compose' (v2 plugin) not found"; exit 1; }

echo "[deploy] installing Node dependencies..."
npm install --prefer-offline 2>/dev/null || npm install

if [ ! -f .env ]; then
  echo "[deploy] .env not found — copying from .env.example"
  cp .env.example .env
  echo "[deploy] IMPORTANT: edit .env with your actual credentials before continuing."
  exit 1
fi

echo "[deploy] starting application..."
exec npm start
