# ICViewer

ICViewer is an explainable 3D IC layout review cockpit built for a hackathon sprint. It turns a raw `GDS -> glTF viewer` foundation into a browser-based workflow for layout inspection, metadata analysis, AI-assisted explanation, and review sharing.

## Why This Project Exists

Traditional browser viewers can render geometry, but they usually stop at visualization. ICViewer adds the engineering context that makes a layout useful during demos, education, and early review:

- structured layer and hierarchy inspection
- explainable design summaries
- natural-language viewer actions
- OpenROAD and Virtuoso-export friendly sidecars
- deployment-ready frontend and API split

## MVP Scope

- Upload a GDS file and optional sidecars
- Convert the layout into a browser-renderable glTF scene
- Inspect layers, hierarchy, bounding box, polygon counts, and design metadata
- Load metrics and compatibility manifests from OpenROAD-style flows
- Ask the AI explainer for a summary or ask the AI operator to produce viewer actions
- Preserve review state with shareable scene parameters
- Run smoke validation with Playwright and backend tests

## Repository Layout

```text
apps/api     FastAPI backend for conversion, metadata, AI, and static assets
apps/web     Vite + React + TypeScript cockpit UI
packages/shared
             Shared manifest contract and frontend type definitions
fixtures     Example layouts and compatibility sidecars
scripts      Local helper scripts for smoke, setup, and deployment
docs         Proposal, milestones, test plan, deployment notes, and logs
```

## Quick Start

### 1. Backend

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 34000
```

### 2. Frontend

```bash
cd apps/web
npm install
npm run dev -- --host 0.0.0.0 --port 4173
```

### 3. AI Configuration

The backend is wired for a DeepSeek-compatible OpenAI-style API.

```bash
export DEEPSEEK_API_KEY="your-key"
export DEEPSEEK_MODEL="deepseek-chat"
export DEEPSEEK_BASE_URL="https://api.deepseek.com"
```

If those variables are missing, ICViewer falls back to deterministic rule-based summaries and commands so the demo still works offline.

## Useful Endpoints

- `GET /health`
- `GET /api/samples/default`
- `POST /api/sessions`
- `POST /api/explain`
- `POST /api/command`
- `POST /api/diff`

## Verification

```bash
cd apps/api
../../.venv/bin/pytest -q

cd ../web
npm run build
npm run test:e2e
```

## Compatibility Model

ICViewer treats `GDS` as the canonical geometry source and optional sidecars as engineering context:

- `manifest.json`
- `metrics.json`
- `DEF` / `LEF` flow artifacts
- technology presets such as `sky130` and `openroad-sky130`

That keeps the hackathon build realistic: we support outputs from commercial and open-source flows without trying to natively replace their databases.

## Deployment Target

- Public URL: `icviewer.aialra.online`
- Reverse proxy: Nginx
- Backend port: `34000`
- Cloudflare in front of the origin

Deployment notes and an Nginx example are documented in [docs/DEPLOYMENT.md](/aialra/ICViewer/repo/docs/DEPLOYMENT.md).
