#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/apps/web"
npm install
npm run build

cd "$ROOT_DIR/apps/api"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

echo "Build complete. Deploy the frontend dist through Nginx and run uvicorn on port 34000."
