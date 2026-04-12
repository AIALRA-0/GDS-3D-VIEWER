# Test Plan

## Backend

- health endpoint returns `ok`
- upload rejects invalid or empty payloads
- fixture sessions can be inspected without the frontend
- explain and command endpoints return fallback output without external AI credentials
- diff endpoint compares two manifests deterministically

## Frontend

- cockpit loads and shows the default shell
- sample design can be loaded
- layer panel toggles update the viewer
- explain panel can request a summary
- URL scene state persists layer visibility and selected panel

## Browser Automation

- Playwright smoke test opens the app
- loads the sample layout
- confirms that the canvas, stats panel, and AI panel are visible

## Executed Checks

- `pytest -q` in `apps/api`
- `npm run build` in `apps/web`
- `npm run test:e2e` in `apps/web` with the backend running on port `34000`

## Manual Demo Checklist

- upload a GDS bundle
- verify metrics sidecar rendering
- isolate one layer
- trigger an AI explanation
- export or copy the scene link
