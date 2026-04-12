# Agent Locks

| path | owner | purpose | start | eta | status |
|------|-------|---------|-------|-----|--------|
| packages/shared/types.ts | frontend | add shared scene contracts for cockpit MVP | 2026-04-12 18:35 UTC | 2026-04-12 18:50 UTC | released |
| packages/shared/manifest.schema.json | backend | add canonical manifest schema and presets | 2026-04-12 18:09 UTC | 2026-04-12 18:40 UTC | released |

- Frontend shared contract now covers scene state, notes, explain, operator, diff payloads, and optional backend transport fields.
- Backend released the manifest schema lock after adding presets and layer provenance fields required by the API.
