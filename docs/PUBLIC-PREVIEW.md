# GDS-3D-VIEWER public preview

Public entry: https://gds3d.aialra.online

The public preview is a static browser application behind a Cloudflare-proxied DNS record. It does not require a password. The origin serves only the reviewed contents of `apps/web/dist`; it does not run or proxy the Python API. Cloudflare Workers/Pages is not used by this deployment.

## Build and verify

```sh
npm ci
npm run build:web
npx playwright install chromium --with-deps
npm run test:public
```

The synthetic sample is authored by `scripts/generate-browser-demo.py`. It contains original demonstration geometry rather than a real chip design. The reference template archive is copied to ignored `.local-design-reference/` for consultation only; the source template is never edited or packaged. The copied interface parameters are in `apps/web/src/public/tokens.json` and the project implementation is authoritative for the UI.

## Public boundary

- Binary GDS layout inputs accept `.gds`, `.gds2` and `.gdsii` suffixes, case-insensitively, through both file selection and drag-and-drop
- File bytes remain in the visitor's browser. No upload endpoint, bundled AI credential, shared database or remote session exists
- Optional explanations use a fixed harness and the visitor's current-page key, never browser storage or the website server. After summary preview and consent, the browser directly authenticates to the chosen model provider. The provider receives that key and bounded summary, not source bytes; see [AI-HARNESS.md](AI-HARNESS.md)
- Each import uses a disposable Worker. Replacing or cancelling an import invalidates old results and stops the old task; parsing stops after 45 seconds
- Limits: 32 MB input, 1,000,000 GDS records, 20,000 cells, 150,000 expanded instances, 300,000 polygons, 2,000,000 triangles, hierarchy depth 64
- A GDS design that exceeds expansion limits opens its cell directory; selecting a smaller cell performs a new bounded parse. No truncated geometry is presented as the full design
- Missing reference targets retain existing geometry and display an explicit incomplete banner plus source/target/count details. Missing-only cells return their directory without fabricated shapes. Full rendering requires an export containing the dependency definitions
- Hover and clicks identify actual primitive triangle ranges, source cells, instance paths and coordinates. PATH geometry reports width/length; geometry alone does not establish electrical wire identity or connectivity
- GDS supports boundaries, boxes, flush/square/custom-extension paths, reflection, rotation, magnification and arrays. Round-ended paths, absolute path width, absolute reference transformations and NODE elements require conversion in a layout tool. Text labels are omitted with a warning
- glTF/GLB supports static, uncompressed triangle meshes with embedded binary buffers. External buffer URLs, images, required extensions, sparse accessors, invalid indices, recursive nodes and invalid coordinates are refused. Animation is not played
- Layer heights are illustrative. Layer separation and quantitative comparisons are visual aids, not physical process data, geometry XOR, design-rule checking or sign-off
- Preferences contain only theme, panel widths, panel placement and language. Chinese is the default; the header toggles English and Chinese without reparsing geometry or changing source names and user notes. Source files, notes and camera bookmarks are in memory. Review export contains annotations and view state; retain the source geometry separately. The new `gds-3d-viewer-review` export format still accepts previous `icviewer-review` imports
- Ordinary requests to fetch the website still reach the CDN/origin. No analytics script or file upload request is included
- The origin denies non-GET/HEAD requests, dotfiles, API paths, legacy routes and directory listings. Scripts and Workers remain same-origin; connections allow HTTPS model providers and explicit HTTP loopback addresses. Embedding is prohibited and browsing contexts are isolated

## Preserve the local API workflow

```sh
npm run dev:web -- --mode legacy
# Open http://127.0.0.1:4173/legacy.html with the original local API running
npm run build:legacy
```

The local workflow still supports the existing bundle inputs, backend explanation, command and export APIs. The public preview adds browser-direct optional explanations without exposing those backend services. `dist-local` and the legacy viewer assets must never be deployed as the public site.

## Deploy and recover

Deploy only `apps/web/dist` into a new release directory, promote an atomic `current` symlink, and use `scripts/nginx/gds-3d-viewer-public.conf` for the dedicated hostname. Validate the Nginx configuration before reloading. The certificate and Cloudflare DNS credentials remain outside the repository and outside the static directory. Retain the previous symlink target for rollback.

Add a single `gds-3d-viewer` entry to the existing AIALRA portal `APPS` array after the preview responds successfully. Check the actual homepage bytes before replacement so concurrent homepage changes are not overwritten. The portal's other cards and existing dirty changes are preserved.

The previous `icviewer.aialra.online` hostname redirects to the new entry using `scripts/nginx/icviewer-redirect.conf`. Retain its certificate, previous static release and configuration for existing bookmarks and rollback. Both hostnames reject legacy API paths and public mutations.
