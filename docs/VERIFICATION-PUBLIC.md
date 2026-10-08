# Public preview verification

Verified on 2026-10-07 (America/Los_Angeles).

| Surface | Result |
| --- | --- |
| Public build | TypeScript checks and Vite production build passed |
| Original local build | Separate legacy production build passed |
| Public regression | 8 tests passed locally and against `https://icviewer.aialra.online` |
| Dependency audit | 0 advisories using the official npm registry after compatible lockfile updates |
| Cloudflare entry | HTTPS homepage and HTML entry returned 200 through Cloudflare |
| Origin boundary | API, review-assets, legacy viewer, legacy HTML and dotfiles returned 404; POST and PUT returned 405 |
| AIALRA portal | One ICViewer card added, with all original homepage bytes preserved; clicking the card opened the live viewer and rendered the synthetic sample |
| Deployment payload | 10 static files only: HTML, compiled scripts/styles, favicon, third-party notices and an original synthetic GDS |

The public regression checks real rendered geometry, layer visibility, review export/restore, scene replacement, theme changes, mobile panels and keyboard return, storage failure, rejected external resources, malformed and oversized input, delayed cancellation, GDS transforms/arrays, recursive references and GLB accessor bounds. Its screenshots use original synthetic geometry or the repository's existing fixed GDS fixture.

The repository GDS fixture exceeds the full-design triangle budget. The tested behavior opens its cell directory and renders a selected smaller cell. This is not evidence that the whole design can be flattened within the public preview limits.

The local backend was not exposed or changed. Its existing backend tests and legacy browser smoke remain in CI; the public tests do not claim coverage of backend engineering features. Browser parsing is a bounded visual preview, not manufacturing or design sign-off.
