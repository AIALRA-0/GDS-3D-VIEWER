# Public preview verification

Verified on 2026-10-07 (America/Los_Angeles).

| Surface | Result |
| --- | --- |
| Public build | TypeScript checks and Vite production build passed |
| Original local build | Separate legacy production build passed |
| Public regression | 17 tests passed locally; all 17 covered against `https://gds3d.aialra.online`, including focused live verification after two network-failed navigations and an explicit sample-readiness correction |
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

The public regression checks real rendered geometry, layer visibility, review export/restore, scene replacement, theme changes, mobile panels and keyboard return, storage failure, rejected external resources, malformed and oversized input, delayed cancellation, GDS transforms/arrays, recursive references and GLB accessor bounds. Its screenshots use original synthetic geometry or the repository's existing fixed GDS fixture.

The initial live run had 14 passing tests, two `ERR_NETWORK_ACCESS_DENIED` failures before page loading, and one AI test that did not wait for sample parsing before confirming its target. The latter correctly lost consent when the parsed target changed; the test now waits for visible geometry before configuration. A single focused live run passed all three cases. No test or site restriction was weakened. AI requests use intercepted synthetic responses, never real keys or paid model calls. The README showcase uses only the original synthetic sample; its Markdown demonstration is explicitly labeled as intercepted test content and its key is cleared before capture.

The repository GDS fixture exceeds the full-design triangle budget. The tested behavior opens its cell directory and renders a selected smaller cell. This is not evidence that the whole design can be flattened within the public preview limits.

The local backend remains unexposed; this iteration only changes its project labels and export identity. Its backend tests and legacy browser smoke remain in CI; local Python lacked the backend dependencies, so no local backend pass is claimed. Public tests do not claim coverage of backend engineering features. Browser parsing is a bounded visual preview, not manufacturing or design sign-off.
