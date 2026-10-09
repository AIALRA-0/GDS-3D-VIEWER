<!-- APCF-META {"schema":1,"visibility":"public"} -->
<div align="center">

<h1>GDS-3D-VIEWER</h1>

<p><strong>Open chip layouts in your browser and inspect layers, cells and individual geometry</strong></p>

<p>No login · Browser-local files · 2D/3D · Hierarchy and measurements · Optional explanations</p>

<p>
  <a href="https://gds3d.aialra.online">Open live preview</a> ·
  <a href="https://github.com/AIALRA-0/GDS-3D-VIEWER">Source code</a> ·
  <a href="https://github.com/AIALRA-0/GDS-3D-VIEWER/archive/refs/heads/main.zip">Download source</a> ·
  <a href="README.md">简体中文</a>
</p>

![Dark workbench with synthetic geometry, layers and statistics](docs/assets/readme/public-dark.png)

Figure 1 The complete workbench running the original synthetic demonstration

</div>

## 1 First successful preview

1. Open the [live preview](https://gds3d.aialra.online) and select “Load demo” to try the synthetic layout
2. To inspect a local layout, select “Open file” or drag in a `.gds`, `.gds2`, `.gdsii`, `.gltf` or `.glb` file
3. Filter the Layers or Cells panel, hover over geometry for a quick fact, then click it to pin the details
4. To measure a GDS layout, select “Measure” and click two points on the 2D canvas, then select “3D view” to inspect the spatial layout

Chinese is the default interface; `EN` / `ZH` switches the interface and language of future explanations, saving only this language preference in the browser

Files are parsed in the current browser and are not uploaded; browsing the layout requires no account or model key. After refresh, reopen the source file

### 1.1 Detailed workflows

- [GDS records, layer names and maps](docs/GDS-RECORDS.md)
- [2D/3D, hierarchy, measurement and review workflows](docs/VIEWER-REFERENCE-FEATURES.md)
- [Supported formats and public-preview limits](docs/PUBLIC-PREVIEW.md)
- [Optional object explanations and key handling](docs/AI-HARNESS.md)
- [Palette, height and review interface examples](#2-product-showcase)
- [Full capability and limitation matrix](#4-capabilities-and-limits)

## 2 Product showcase

Every image uses the repository's original synthetic sample, without visitor designs or model credentials
The interface follows copied parameters from AIALRA-TEMPLATE; the template itself remains untouched
See [asset provenance](docs/assets/readme/PROVENANCE.md) for dimensions and reproduction

<div align="center">

![Light theme preserves the same workspace structure](docs/assets/readme/public-light.png)

Figure 2 Light theme preserves the same workspace structure

</div>

<div align="center">

![The hover tooltip reports the actual hit cell, layer and coordinates](docs/assets/readme/geometry-hover.png)

Figure 3 The hover tooltip reports the actual hit cell, layer and coordinates

</div>

<div align="center">

![Clicking pins and highlights a primitive with source, dimensions and instance path; PATHs also report width and length](docs/assets/readme/geometry-inspection.png)

Figure 4 Clicking pins and highlights a primitive with source, dimensions and instance path; PATHs also report width and length

</div>

<div align="center">

![Inspect smaller cells independently, including designs exceeding the full expansion budget](docs/assets/readme/cell-browser.png)

Figure 5 Consistent heights with the toggle in the Cells panel, which remains available for expansion-limited designs

</div>

<div align="center">

![The same synthetic cell with compact heights, retaining the camera for a direct visual comparison](docs/assets/readme/cell-compact.png)

Figure 5.1 Compact heights for the same synthetic cell, retaining the camera, colors and layer selection

</div>

<div align="center">

![Layer separation set to 10 with a lower viewing angle clearly reveals four layers; display heights are not physical thicknesses](docs/assets/readme/exploded-layers.png)

Figure 6 Layer separation set to 10 with a lower viewing angle clearly reveals four layers; display heights are not physical thicknesses

</div>

<div align="center">

![Record observations, save camera bookmarks and export restorable reviews](docs/assets/readme/review-records.png)

Figure 7 Record observations, save camera bookmarks and export restorable reviews

</div>

<div align="center">

![Verify the provider and summary before consenting; the key is empty and no real model is called](docs/assets/readme/ai-harness.png)

Figure 8 Verify the provider and summary before consenting; the key is empty and no real model is called

</div>

<div align="center">

<img src="docs/assets/readme/mobile-preview.png" width="390" alt="Collapsible panels preserve the preview on a 390 pixel viewport">

Figure 9 Collapsible panels preserve the preview on a 390 pixel viewport

</div>

<div align="center">

![English interface with the same layout and controls; the header button switches back to Chinese](docs/assets/readme/public-english.png)

Figure 10 English interface with the same layout and controls; the header button switches back to Chinese

</div>

<div align="center">

![Markdown headings, emphasis, tables and lists rendered from an intercepted demonstration response, without a real model call](docs/assets/readme/ai-markdown.png)

Figure 11 Formatted Markdown from an intercepted synthetic-summary demonstration, without a real model call; the key has been cleared

</div>

<div align="center">

![Orthographic 2D with a two-point ruler reporting distance and signed coordinate differences](docs/assets/readme/planar-ruler.png)

Figure 12 Orthographic 2D with a two-point ruler reporting distance and signed coordinate differences, without snapping

</div>

<div align="center">

![Ten built-in palettes and an original synthetic custom palette with default, copy, edit and delete actions](docs/assets/readme/palette-combinations.png)

Figure 13 Built-in and custom palettes, immediate layer-color editing, and browser-local saved preferences

</div>

<div align="center">

![Unified export dialog for review, PNG and layer name maps; unnamed layers also export numbered defaults](docs/assets/readme/export-dialog.png)

Figure 14 Export content and format choices; reviews retain layer colors while name maps exclude palettes and process thickness

</div>

<div align="center">

![Roomy palette color cards, hex values and save action; the entire color surface opens the picker](docs/assets/readme/palette-editor.png)

Figure 15 Roomy palette color cards, hex values and save action; the entire color surface opens the picker

</div>

<div align="center">

![All logic_tile occurrences outlined in the 2D top cell, with highlight, show-only, hide and restore actions](docs/assets/readme/cell-instance-highlights.png)

Figure 16 All logic_tile occurrences outlined in the 2D top cell, with highlight, show-only, hide and restore actions

</div>

<div align="center">

![Statistics comparison shows baseline/current cells and count deltas, without claiming geometric or electrical equivalence](docs/assets/readme/statistics-comparison.png)

Figure 17 Statistics comparison shows baseline/current cells and count deltas, without claiming geometric or electrical equivalence

</div>

## 3 Object explanations and keys

The interface defaults to Chinese. The header's `EN` / `ZH` button switches interface labels and the language of future AI explanations; only the language preference is saved
Switching languages preserves the loaded layout, layer selection and notes. Cell names and completed explanations retain their original text

The optional AI panel explains the current cell or clicked geometry using the fixed `gds-3d-viewer-explain-v1` harness
It requests five sections: known facts, geometry and hierarchy, possible uses, unknowns, and suggested observations
The prompt distinguishes geometric PATHs from electrically identified wires and requires uncertainty when evidence is missing
Markdown headings, emphasis, lists, quotes, tables and code blocks are formatted. Model HTML, images and clickable external links are disabled
Generate/cancel controls wrap in narrow sidebars. Changing language cancels pending requests and resets consent

- Keys live only in current-page memory, use a masked input, and are discarded on refresh, page departure or explicit clearing
- Keys never enter browser storage, review exports or the website server; the browser authenticates directly to the user-selected provider
- Only the confirmed summary is sent; names, instance paths and dimensions can be included, while source files and full vertex arrays are excluded
- The provider must permit browser cross-origin requests; failures appear locally and the website never proxies credentials

AI output and inferred uses need independent review. See [the harness contract](docs/AI-HARNESS.md) for protocol, fields, cancellation and the fixed prompt

## 4 Capabilities and limits

<div align="center">

Table 1 Public preview capabilities and boundaries

| Surface | Current behavior | Boundary |
| --- | --- | --- |
| Layouts | Boundaries, boxes, paths, references, arrays, text and element properties | Text appears in Source data rather than on the 3D canvas |
| Missing cells | Existing geometry, incomplete banner and missing-target list | Full rendering needs an export containing dependency cells |
| 3D models | Self-contained, uncompressed static triangle meshes | External resources and images refused; animation not played |
| Hover/selection | Cell, instance, kind, layer, coordinates and dimensions | Does not establish net names or electrical connectivity |
| Layer controls | Visibility, isolation, manual names, JSON/LYP map import/export and separation | Names come from the user or a map; display heights are illustrative |
| 2D and hierarchy | Orthographic 2D/3D switching, hierarchy tree, directory search and two-point ruler | No snapping or connectivity inference; bounded tree depth and row count |
| Reviews | Notes, bookmarks, camera and layer state export/restore | Retain source files separately |
| Statistics comparison | Baseline/current file and cell with layer, triangle and instance deltas | Size checks only, without geometric/electrical equivalence; incomplete previews are flagged |
| Parsing | 32 MB per file, 45-second limit | Over-budget designs open their cell directory |

</div>

A missing reference is not a suffix error: a file can reference external standard-cell definitions without embedding them
The inspector reports targets and referring cells; missing shapes are never fabricated
See [public preview details](docs/PUBLIC-PREVIEW.md) for exact limits
See [reference features and operations](docs/VIEWER-REFERENCE-FEATURES.md) for GDS3D/KLayout choices and original synthetic [JSON](fixtures/layer-maps/synthetic.json)/[grouped LYP](fixtures/layer-maps/synthetic-grouped.lyp) examples
These browser operations do not need a command shell. Process-stack reconstruction, wire tracing, DRC and LVS are outside the current name mapping and visual preview capabilities

## 5 Run locally

The public app needs Node.js; CI uses version 22. Run from the repository root:

```sh
# Install from the lockfile
npm ci
# Start the browser-local workbench; the terminal prints its local URL
npm run dev:web
# Check types and build static files
npm run build:web
```

The main entry is [`Workbench.tsx`](apps/web/src/public/Workbench.tsx); deploy only `apps/web/dist`
The original Python-backed workflow is documented in [local development](docs/LOCAL-WORKFLOW.md) and excluded from the public site

## 6 Verification and contributions

The 49 public regressions cover complete repeated designs, bounded source storage and instance picking, missing cells, transforms/arrays, null-word padding, 2D coordinates and zoomed measurements, map round trips, hierarchy browsing, hover/click facts, height modes, key lifetime, resource rejection, oversized files, review restoration and mobile layouts

Repeated `ERR_QUIC_PROTOCOL_ERROR` is a network-entry issue rather than a parser limit. [Network compatibility](docs/NETWORK-TROUBLESHOOTING.md) explains Cloudflare zone-wide settings, targeted hostname rules and browser workarounds
Public and legacy production builds pass. See [verification evidence](docs/VERIFICATION-PUBLIC.md) for scope and release checks

```sh
# Install the real browser used by regression tests
npx playwright install chromium --with-deps
# Run public parser and browser regressions
npm run test:public
# Build the separate original local workflow
npm run build:legacy
```

<div align="center">

Table 2 Source and documentation routes

| Route | Content |
| --- | --- |
| [`apps/web/src/public/`](apps/web/src/public/) | Browser parsing, picking, harness and redesigned UI |
| [`apps/web/tests/public/`](apps/web/tests/public/) | Public parser and real-browser regressions |
| [`scripts/nginx/gds-3d-viewer-public.conf`](scripts/nginx/gds-3d-viewer-public.conf) | Dedicated static host and request isolation |
| [Public preview](docs/PUBLIC-PREVIEW.md) | Formats, boundaries and deployment recovery |
| [Explanation harness](docs/AI-HARNESS.md) | Fixed framework and ephemeral key contract |
| [Compatibility specification](docs/COMPATIBILITY_SPEC.md) | Engineering context for the original local API workflow |
| [Issues](https://github.com/AIALRA-0/GDS-3D-VIEWER/issues) | Reproductions and suggestions using publishable synthetic data |

</div>

This repository maintains the workbench and public preview; [GDS-GLTF-3D-Viewer](https://github.com/AIALRA-0/GDS-GLTF-3D-Viewer) is the related original viewer
Follow [`AGENTS.md`](AGENTS.md) before changing shared contracts

## 7 Publication and rights

Cloudflare proxies the public entry. The origin serves static files only, without an upload API, legacy backend or shared sessions
Normal website requests still reach the site; optional explanations send confirmed summaries to the selected model provider

- The project card on the [AIALRA portal](https://aialra.online) reflects the current features and live entry
- The separate toolbar source icon opens this repository
- Within the viewer, the portal entry is retained only as a text link in Help

No project open-source license has been declared; public visibility alone does not grant unrestricted redistribution
The build retains [third-party notices](apps/web/public-static/NOTICE.txt)

The project uses the template’s full iteration control architecture. See [the workflow entry](docs/AGENT-WORKFLOW.md) for current state and rules; template runtime data and execution history are excluded.
