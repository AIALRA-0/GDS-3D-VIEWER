#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_URL="${1:-http://127.0.0.1:4173}"

echo "[1/4] Backend health"
curl -fsS http://127.0.0.1:34000/health

echo "[2/4] Frontend shell"
curl -fsS "${TARGET_URL}" | head -n 20

echo "[3/4] API sample"
curl -fsS "${TARGET_URL%/}/api/samples/default" | head -n 20

echo "[4/4] Playwright smoke"
cd "${ROOT_DIR}/apps/web"
PLAYWRIGHT_BASE_URL="${TARGET_URL}" npm run test:e2e
