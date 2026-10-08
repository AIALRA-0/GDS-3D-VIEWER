# Public preview verification

Verified on 2026-10-07 (America/Los_Angeles).

| Surface | Result |
| --- | --- |
| Public build | TypeScript checks and Vite production build passed |
| Original local build | Separate legacy production build passed |
| Public regression | All 20 cases covered locally after focused repairs; 8 affected inspector/language/AI/source cases passed against `https://gds3d.aialra.online` |
| Dependency audit | 0 advisories using the official npm registry after compatible lockfile updates |
| Cloudflare entry | HTTPS homepage and HTML entry returned 200 through Cloudflare |
| Origin boundary | API, review-assets, legacy viewer, legacy HTML and dotfiles returned 404; POST and PUT returned 405 |
| AIALRA portal | Exactly one existing card renamed to GDS-3D-VIEWER with the new URL; all other homepage bytes preserved |
| Deployment payload | 10 static files only: HTML, compiled scripts/styles, favicon, third-party notices and an original synthetic GDS |
| Missing definitions and picking | Synthetic missing-target and missing-only cases passed; real-browser PATH hover/click preserved layer/datatype, coordinates, width and length |
| Browser explanation contract | Mocked direct-provider tests passed: consent, bounded summary, response masking, own-origin refusal, no key storage/export, refresh/clearing and stale cancellation |
| Product documentation | Chinese and English READMEs, eleven synthetic-only product screenshots, audit with zero errors/warnings, eight light/dark desktop/mobile renders and broken-image fallback passed |
| Markdown and controls | Headings, emphasis, nested lists, tables and code passed in the actual browser renderer; model HTML, images and active links refused; generate/cancel controls do not overlap at 220 pixel sidebar width |
| Languages and rename | Chinese default, English switch, source names/notes/geometry retained, language preference restored and previous-format review import passed; repository and public website use GDS-3D-VIEWER |
| Toolbar and inspector | Unified button sizing/background, requested button order, four tabs, keyboard tab navigation and 390 pixel layout passed; tab changes retain the same ephemeral AI key |
| Layer naming | Manual names, reset, exact local KLayout mapping, unchanged canvas, name-bearing review export/import, no storage/upload and external-entity refusal passed |
| GDS source records | Library/version/units, source-local text/type/presentation, geometry properties, SREF/AREF transforms and counted-only records passed with original synthetic fixtures |

The public regression checks real rendered geometry, layer visibility, review export/restore, scene replacement, theme changes, mobile panels and keyboard return, storage failure, rejected external resources, malformed and oversized input, delayed cancellation, GDS transforms/arrays, recursive references and GLB accessor bounds. Its screenshots use original synthetic geometry or the repository's existing fixed GDS fixture.

The previous release's initial live run had two Windows navigation failures and one sample-readiness correction, resolved with focused verification. In this iteration, the first local run passed 18 cases and found two issues: a new test used the wrong existing English button label, and source labels in an expansion-limited design incorrectly selected the text-only view. The test label was corrected; incomplete designs retain the smaller-cell directory workflow, while complete text-only cells open Source data. The two focused regressions passed, followed by the affected source/toolbar/transform checks and all eight live cases. No test assertion or site restriction was weakened. AI requests use intercepted synthetic responses, never real keys or paid model calls. The eleven updated README images use only the original synthetic sample; the Markdown demonstration is explicitly labeled as intercepted test content and its key is cleared before capture.

The repository GDS fixture exceeds the full-design triangle budget. The tested behavior opens its cell directory and renders a selected smaller cell. This is not evidence that the whole design can be flattened within the public preview limits.

The local backend remains unexposed and unchanged in this iteration. Its backend tests and legacy browser smoke remain in CI; no local backend pass is claimed. Public tests do not claim coverage of backend engineering features. Browser parsing is a bounded visual preview, not manufacturing or design sign-off.
