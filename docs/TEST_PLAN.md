# Test Plan

## Backend

- health endpoint returns `ok`
- sample inventory returns both the default and OpenROAD-oriented bundles
- upload rejects invalid or empty payloads
- fixture sessions can be inspected without the frontend
- explain and command endpoints return fallback output without external AI credentials
- diff endpoint compares two manifests deterministically
- export endpoint emits a downloadable review session JSON

## Frontend

- cockpit loads and shows the backend sample gallery
- sample switching updates metadata, markers, and hierarchy
- layer panel toggles update the viewer
- marker selection and hierarchy selection stay synchronized
- bookmarks can be saved and restored
- explain and operator panels hit the backend
- exported session JSON can be re-imported through the upload flow
- URL scene state persists layer visibility, focus, marker, and performance mode

## Browser Automation

- Playwright smoke test opens the app
- switches from the default sample to the OpenROAD bundle
- runs explain and operator
- adds a note
- saves a bookmark
- exports a session JSON
- uploads a real GDS + sidecar bundle

## Executed Checks

- `pytest -q` in `apps/api`
- `npm run build` in `apps/web`
- `npm run test:e2e` in `apps/web` with the backend running on port `34000`
- `./scripts/smoke.sh` for local or live verification

## Manual Demo Checklist

- switch to the OpenROAD sample bundle
- orbit, pan, zoom, and double-click focus in the central viewer
- isolate one layer
- focus one review marker
- trigger an AI explanation
- run the operator and apply one returned action
- save a bookmark
- export or copy the scene link
- upload a GDS + sidecar bundle
