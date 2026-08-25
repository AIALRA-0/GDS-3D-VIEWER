# Coordination Log

| time | owner | note |
|------|-------|------|
| 2026-04-12 18:10 UTC | main | Initialized repo skeleton, planning docs, and shared collaboration contract. |
| 2026-04-12 18:35 UTC | frontend | Frontend assumes the backend will eventually expose session, explain, operator, metrics, and health endpoints; until then the cockpit falls back to deterministic local sample data and actions. |
| 2026-04-12 18:15 UTC | backend | Released the shared manifest schema lock after wiring session, sample, explain, command, diff, and asset-serving endpoints. |
| 2026-04-12 19:25 UTC | main | Integrated frontend and backend, aligned the API to `/api/sessions`, `/api/explain`, `/api/command`, and verified the full loop with Playwright against the live backend. |
| 2026-08-25 00:42 UTC | documentation | Privacy review requires backend-owned deployment examples to replace the historical production domain and host path with neutral placeholders. Impacted files are `scripts/deploy.sh`, `scripts/nginx/icviewer.conf`, `scripts/systemd/icviewer.service`, deployment documentation, MCP examples, and the manifest schema identifier. Runtime API contracts stay unchanged. |

## Frontend API Assumptions

- `POST /api/sessions` accepts a multipart bundle upload and returns a session payload.
- `POST /api/explain` accepts JSON `{ manifest, prompt }` and returns an explain payload.
- `POST /api/command` accepts JSON `{ manifest, prompt }` and returns operator actions.
- `GET /health` should stay lightweight and safe for smoke checks.
- If these endpoints are absent, the frontend keeps the demo working with local fallback generation.

## Shared Contract Notes

- `packages/shared/types.ts` includes optional transport fields such as `sessionId`, `assetUrl`, and `warnings`.
- `packages/shared/manifest.schema.json` now permits layer provenance fields like `gdsLayer`, `datatype`, and `polygonCount`.
