# AGENTS.md

This repository keeps a lightweight multi-agent protocol even when a single operator is driving the sprint. The goal is traceability, safe shared edits, and fast handoffs under hackathon pressure.

## Ownership

### Frontend

Primary paths:

- `apps/web/**`
- `tests/e2e/**`
- `docs/demo-script.md`

Responsibilities:

- cockpit shell
- 3D viewer interactions
- upload UX
- explain and diff panels
- URL state sync
- Playwright smoke coverage

### Backend

Primary paths:

- `apps/api/**`
- `fixtures/**`
- `scripts/**`
- `tests/api/**`

Responsibilities:

- GDS to glTF conversion
- metadata extraction
- explain and command APIs
- diff and compatibility handling
- fixture generation
- backend smoke coverage

## Shared Paths

- `packages/shared/**`
- `.github/workflows/**`
- `README.md`
- `docs/coordination.md`
- `docs/agent-locks.md`

## Lock Procedure

Before editing a shared path, add a row to `docs/agent-locks.md`:

```md
| path | owner | purpose | start | eta | status |
|------|-------|---------|-------|-----|--------|
| packages/shared/manifest.schema.json | backend | add metrics fields | 18:05 | 18:15 | editing |
```

When the edit is complete:

- mark `status` as `released`
- append one short note about the contract change

## Cross-Owner Rule

If one side needs to modify the other side's primary path:

1. record the reason in `docs/coordination.md`
2. list impacted files and the new contract
3. prefer asking the owner to patch it unless the change is blocking

## Definition Of Done

### Frontend

- complete loading, empty, and error states
- wired to real API responses
- one Playwright smoke test

### Backend

- endpoints are reproducible
- validation and error handling exist
- smoke coverage exists
- invalid files do not crash the service
