# Coordination Log

Sidebar presentation follow-up (2026-10-07 America/Los_Angeles): `apps/web/src/public/Workbench.tsx` and `workbench.css` unify action controls and remove the inspector portal card; `README.md`, `README.en.md` and eleven synthetic product screenshots reflect that UI and a clearer four-layer separation example. The AIALRA portal card retains its destination with updated bilingual feature text. No geometry, review schema, provider transport or backend contract changes.

| time | owner | note |
|------|-------|------|
| 2026-04-12 18:10 UTC | main | Initialized repo skeleton, planning docs, and shared collaboration contract. |
| 2026-04-12 18:35 UTC | frontend | Frontend assumes the backend will eventually expose session, explain, operator, metrics, and health endpoints; until then the cockpit falls back to deterministic local sample data and actions. |
| 2026-04-12 18:15 UTC | backend | Released the shared manifest schema lock after wiring session, sample, explain, command, diff, and asset-serving endpoints. |
| 2026-04-12 19:25 UTC | main | Integrated frontend and backend, aligned the API to `/api/sessions`, `/api/explain`, `/api/command`, and verified the full loop with Playwright against the live backend. |
| 2026-08-25 00:42 UTC | documentation | Privacy review requires backend-owned deployment examples to replace the historical production domain and host path with neutral placeholders. Impacted files are `scripts/deploy.sh`, `scripts/nginx/gds-3d-viewer.conf`, `scripts/systemd/gds-3d-viewer.service`, deployment documentation, MCP examples, and the manifest schema identifier. Runtime API contracts stay unchanged. |

## Frontend API Assumptions

- `POST /api/sessions` accepts a multipart bundle upload and returns a session payload.
- `POST /api/explain` accepts JSON `{ manifest, prompt }` and returns an explain payload.
- `POST /api/command` accepts JSON `{ manifest, prompt }` and returns operator actions.
- `GET /health` should stay lightweight and safe for smoke checks.
- If these endpoints are absent, the frontend keeps the demo working with local fallback generation.

## Shared Contract Notes

- `packages/shared/types.ts` includes optional transport fields such as `sessionId`, `assetUrl`, and `warnings`.
- `packages/shared/manifest.schema.json` now permits layer provenance fields like `gdsLayer`, `datatype`, and `polygonCount`.

## Public preview contract (2026-10-07)

The public entry parses GDS and self-contained glTF/GLB in a disposable browser Worker. No backend endpoint, cloud session, remote AI, or legacy third-party viewer bundle is deployed. The original React/FastAPI workflow remains available through the local legacy build and legacy.html. Public review files store notes, bookmarks and camera state; they do not contain the source geometry. Large GDS files can open a cell directory without expanding the entire design.

## Object inspection and explanation contract (2026-10-07)

Public geometry retains bounded source metadata and per-layer triangle ranges for object picking. Missing cell definitions are reported explicitly while existing geometry remains viewable; incomplete geometry is never marked complete. AI is optional browser-to-provider communication after preview and consent, using an in-memory visitor credential and the fixed `gds-3d-viewer-explain-v1` context. No layout-file upload or server-side AI proxy is added. `scripts/nginx/gds-3d-viewer-public.conf` therefore permits browser HTTPS model connections and loopback HTTP while retaining static-only routes and method restrictions. This frontend change requires that deployment-header update. README files document the current public product and keep the original API workflow in separate documentation.

## GDS-3D-VIEWER identity and language contract (2026-10-07)

The owner requested a complete product rename to GDS-3D-VIEWER and a Chinese-default Chinese/English public UI. Naming updates necessarily include package/workflow callers, local backend titles, deployment names and documentation across ownership paths; functionality and published third-party rights are retained. Previously exported review files remain importable. Markdown explanations render as safe React elements without executing HTML or fetching remote images; generation/cancellation use a dedicated wrapping action row. Language switching applies to interface text and the fixed explanation prompt without retaining credentials or changing source geometry.


- Public frontend contract: unified icon toolbar orders sample then language and help then GitHub; inspector tabs preserve mounted AI state, source metadata retains local text/reference coordinates and bounded properties, layer aliases remain separate from geometry and travel only in review exports. Old reviews without names remain valid. No backend or template edits.

## Viewer tools contract (2026-10-07)

The public frontend now switches between an orthographic GDS XY view and perspective 3D without reparsing, adds a transient unsnapped planar ruler, and derives a bounded hierarchy from stored source names/references. Review/bookmark camera projection and zoom are optional backward-compatible fields validated on import. Explicit layer names travel in JSON/LYP mapping exports as well as reviews; both mapping directions retain the 1 MB limit, XML escaping and no-key/no-geometry contract. Stream parsing accepts only null-word padding after a complete ENDLIB and retains nonzero-trailer and expansion checks. Reference features are implemented independently; no upstream GPL code, private sample or original template content is published. Five map fixtures use separate browser contexts to avoid Chromium burst-download throttling while preserving all round-trip assertions.

## Whole-layout rendering contract

Repeated GDS layouts preflight the hierarchy before allocating flat vertices and can use per-cell/layer instancing. Source triangles remain capped at two million, with independent twelve-million drawn-triangle, 150,000 placement, 2,048 batch, depth/time and path-character budgets. Reflections use mirrored templates rather than unsupported negative instance scales. Picking creates transformed object facts on demand, without uploading source data; layer separation uses layer indices rather than batch indices. Worker transfer includes geometry and placement buffers. No backend or original template changes; private supplied files remain local. Protocol troubleshooting documents zone-wide or single-host Cloudflare fixes without claiming unavailable DNS-only credentials applied them.

## 2026-10-08 Palette and action contract

Frontend adds browser-local palette preferences containing only explicit names/colors/default, per-layer ephemeral overrides, and optional validated `layerColors` in backward-compatible version-1 reviews. Existing AI key and provider boundaries are unchanged. Export actions use native dialogs and shared labeled icon controls. GDS zero spacing packs actual rendered surfaces, retaining illustrative thickness and stable camera/selection; glTF source depth is preserved. No API, template, dependency or workflow change.
