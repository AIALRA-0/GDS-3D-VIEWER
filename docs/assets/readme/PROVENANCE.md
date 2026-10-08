# Product screenshot provenance

Captured on 2026-10-07 (America/Los_Angeles) using the actual GDS-3D-VIEWER production build in Chromium through Playwright. All eleven images use original synthetic geometry from `apps/web/public-static/samples/demo.gds`, authored by `scripts/generate-browser-demo.py`. No visitor file, privately supplied design, account, browser toolbar or real API key was captured. No generated mockup replaces product evidence.

| File | View | Pixels |
| --- | --- | --- |
| public-dark.png | Full dark workbench | 1600 × 1000 |
| public-light.png | Full light workbench | 1600 × 1000 |
| geometry-hover.png | Actual hit tooltip on logic_tile | 1600 × 1000 |
| geometry-inspection.png | Pinned primitive facts and instance path | 1600 × 1000 |
| cell-browser.png | Cell directory and selected logic_tile | 1600 × 1000 |
| exploded-layers.png | Illustrative separated layers | 1600 × 1000 |
| review-records.png | Original synthetic review observation | 1600 × 1000 |
| ai-harness.png | Empty-key configuration, summary preview and consent | 1600 × 1320 |
| mobile-preview.png | Collapsed panels on a narrow viewport | 390 × 844 |
| public-english.png | English interface retaining the same demo geometry | 1600 × 1000 |
| ai-markdown.png | Actual Markdown renderer with an intercepted test response; no real model call, cleared key | 1600 × 1320 |

Reproduce by building the public entry, loading its sample, selecting `logic_tile`, changing view/layer separation and using the inspector and review panels. The AI configuration image shows an outgoing summary and an empty password field. The Markdown image uses a Playwright-intercepted response whose cell name and counts come from that synthetic summary; the response and captions explicitly label it as a format demonstration, and the synthetic key is cleared before capture. No image claims a real model result. Heights are illustrative; screenshots do not establish physical thickness or electrical connectivity.

The current captures include the unified toolbar, EN/ZH control after the sample icon, GitHub icon after Help, inspector subtabs and the layer-name editor. Display controls and AI examples select their corresponding inspector tabs. Source metadata tests use a separate original synthetic text/property fixture, which is never presented as a real chip design.

Earlier `gds-3d-viewer-cockpit.png` depicts the retained local API workflow; `gds-3d-viewer-hero.svg` is its historical illustration. Neither is current public UI evidence. The template archive/source project is excluded; only the owner's requested copied design parameters underpin the implemented interface. Dependency notices are preserved.
