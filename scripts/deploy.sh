#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/gds-3d-viewer}"
SERVICE_NAME="${SERVICE_NAME:-gds-3d-viewer}"
SITE_NAME="${SITE_NAME:-gds-3d-viewer.example.com}"
SITE_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
SITE_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"
SYSTEMD_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"
BACKUP_SUFFIX="$(date +%s)"

mkdir -p "$DEPLOY_ROOT"
mkdir -p /var/www/certbot

echo "[1/8] Syncing repository into ${DEPLOY_ROOT}"
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "apps/web/node_modules" \
  --exclude "apps/api/.venv" \
  --exclude "apps/api/.pytest_cache" \
  --exclude "apps/web/playwright-report" \
  --exclude "apps/web/test-results" \
  "${ROOT_DIR}/" "${DEPLOY_ROOT}/"

echo "[2/8] Installing backend dependencies"
python3 -m venv "${DEPLOY_ROOT}/apps/api/.venv"
source "${DEPLOY_ROOT}/apps/api/.venv/bin/activate"
python -m pip install --upgrade pip
pip install -r "${DEPLOY_ROOT}/apps/api/requirements.txt"

echo "[3/8] Installing frontend dependencies"
cd "${DEPLOY_ROOT}"
npm install

echo "[4/8] Building frontend"
npm run build:web

echo "[5/8] Installing systemd service"
install -m 0644 "${DEPLOY_ROOT}/scripts/systemd/gds-3d-viewer.service" "${SYSTEMD_TARGET}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1 || true
systemctl restart "${SERVICE_NAME}"

echo "[6/8] Verifying backend health"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:34000/health >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:34000/health

echo "[7/8] Installing Nginx site"
if [ -f "${SITE_AVAILABLE}" ]; then
  cp "${SITE_AVAILABLE}" "${SITE_AVAILABLE}.bak.${BACKUP_SUFFIX}"
fi
install -m 0644 "${DEPLOY_ROOT}/scripts/nginx/gds-3d-viewer.conf" "${SITE_AVAILABLE}"
ln -sfn "${SITE_AVAILABLE}" "${SITE_ENABLED}"
nginx -t
systemctl reload nginx

echo "[8/8] Running local smoke"
curl -kfsS --resolve "${SITE_NAME}:443:127.0.0.1" "https://${SITE_NAME}/health"
curl -kfsS --resolve "${SITE_NAME}:443:127.0.0.1" "https://${SITE_NAME}/" | head -n 20

echo "Deployment finished for ${SITE_NAME}"
