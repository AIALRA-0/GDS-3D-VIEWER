# Agent Locks

| path | owner | purpose | start | eta | status |
|------|-------|---------|-------|-----|--------|
| apps/web/src/public/gds.ts; apps/web/tests/public/gds-performance.spec.ts | PA-0006 | full GDS parsing and hierarchy/source-geometry performance | 2026-10-09 America/Los_Angeles | current turn | active |
| apps/web/src/public/Viewer.tsx; apps/web/src/public/renderer-helper.ts | PA-0007 | scene allocation and exact picking performance | 2026-10-09 America/Los_Angeles | current turn | active |
| apps/web/src/public/types.ts; apps/web/src/public/parser.worker.ts; apps/web/src/public/Workbench.tsx; apps/web/src/public/translations.en.ts; other affected tests; current IT-0003/TR-0003; README and documentation | main | integrate full parsing, progress, regressions and public delivery | 2026-10-09 America/Los_Angeles | current turn | active |
| .agent-project-control/rules/01-context-state.md; .agent-project-control/rules/03-verification-regression.md; .agent-project-control/scripts/; .agent-project-control/runtime/ scaffold markers | PA-0004 | adopt closeout v2 core while preserving native framework regressions | 2026-10-09 America/Los_Angeles | current turn | released |
| README.md; README.en.md | PA-0005 | clarify first-use steps and validate bilingual rendered entry | 2026-10-09 America/Los_Angeles | current turn | released |
| docs/AGENT-WORKFLOW.md; docs/agent-locks.md; current IT-0002/TR-0002 records; generated framework tree | main | integrate current core and README evidence without changing product source | 2026-10-09 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/AGENT-WORKFLOW.md; docs/NETWORK-TROUBLESHOOTING.md; docs/security/publication-risk-notes.md; .github/workflows/ci.yml | main | template framework adoption, local network investigation and conservative design iteration | 2026-10-08 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | compact/consistent height toggle, current captures and network investigation | 2026-10-08 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | custom dropdowns, planar rotation, palette transfer and stable illustrative heights | 2026-10-08 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | unified UI audit, top-cell instance tools and current screenshots | 2026-10-08 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | editable palettes, icon actions and export dialogs | 2026-10-08 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | bounded whole-layout instancing and QUIC access diagnosis | 2026-10-07 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | orthographic 2D, hierarchy, ruler, mapping round trips and current showcase | 2026-10-07 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | sidebar spacing, consistent actions, refreshed screenshots and portal card | 2026-10-07 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | unified toolbar, inspector tabs, layer aliases and GDS source metadata | 2026-10-07 America/Los_Angeles | current turn | released |
| packages/shared/types.ts | frontend | add shared scene contracts for cockpit MVP | 2026-04-12 18:35 UTC | 2026-04-12 18:50 UTC | released |
| packages/shared/manifest.schema.json | backend | add canonical manifest schema and presets | 2026-04-12 18:09 UTC | 2026-04-12 18:40 UTC | released |
| README.md | documentation | publish a bilingual, evidence-backed, privacy-safe project landing page | 2026-08-25 00:30 UTC | 2026-08-25 01:30 UTC | released |
| package.json; .github/workflows/ci.yml; docs/coordination.md; README.md; README.en.md | main | public static preview build, regression routing and public entry documentation | 2026-10-07 America/Los_Angeles | current turn | released |
| README.md; README.en.md; docs/coordination.md | main | geometry inspection, private local AI harness and complete product showcase | 2026-10-07 America/Los_Angeles | current turn | released |
| README.md; README.en.md; packages/shared/manifest.schema.json; .github/workflows/ci.yml; docs/coordination.md | main | GDS-3D-VIEWER naming, bilingual public UI and safe Markdown explanation rendering | 2026-10-07 America/Los_Angeles | current turn | released |

- Frontend shared contract now covers scene state, notes, explain, operator, diff payloads, and optional backend transport fields.
- Sidebar actions now share sizing and spacing, and the portal entry is a Help text link. Refreshed bilingual screenshots retain the existing scene, review and ephemeral-key contracts.
- Backend released the manifest schema lock after adding presets and layer provenance fields required by the API.
- Documentation released the README lock after adding aligned Chinese and English landing pages, verified screenshots, explicit test evidence, deployment placeholders, and security limitations.


- Public preview build and regression routes are released; the legacy local API entry remains separately testable and is excluded from public deployment
- Geometry inspection, missing-definition previews and the browser-direct ephemeral-key harness are released; both READMEs now describe the current public product with synthetic-only visual evidence
- GDS-3D-VIEWER identity, Chinese-default language switching and safe Markdown explanations are released; old review imports remain compatible and public documentation includes eleven synthetic-only product screenshots
- Unified toolbar, inspector subtabs and source metadata are released; layer IDs/geometry stay unchanged, names are explicit session data, and old name-free review imports remain compatible
- Viewer tools and documentation locks are released: orthographic 2D, transient ruler, bounded hierarchy, JSON/LYP exports, twelve synthetic screenshots and backward-compatible camera reviews preserve the browser-only boundary

- Whole-layout reuse and documentation locks released: repeated geometry retains exact instance inspection within explicit budgets; protocol guidance covers Cloudflare domains and no account or browser setting change is claimed

- Dropdown/rotation/transfer documentation locks released: themed keyboard dropdowns, planar rotation and middle-button pan, ten palettes with local JSON transfer, default-name map exports and file-wide illustrative heights; seventeen synthetic-only screenshots match the current preview

- Height-mode documentation locks released: consistent/compact toggle preserves camera, colors, filters and exact picking, reviews/bookmarks retain the mode, eighteen synthetic captures match the current preview; read-only network evidence distinguishes permission denial from QUIC and does not claim a complete fix
