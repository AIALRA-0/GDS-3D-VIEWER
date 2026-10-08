# Public workbench design

The public UI partially adopts the local AIALRA-TEMPLATE `tool-workbench-2.3.1` profile at the owner's explicit request. The source template is read-only. Its reference archive is copied into ignored project storage; its exact surface and geometry parameters are copied to `apps/web/src/public/tokens.json`. Source template history and project-control records are not copied.

The browser experience uses a 60 px top bar, 64 px activity rail, a 256 px navigation panel, a flexible center canvas, a 272 px inspector, 16 px panel gaps, 8 px panel corners, neutral dark/light surfaces and shared 36/32 px controls. Individual layer colors convey geometry grouping. Two sidebars can be collapsed, swapped and resized using pointer or keyboard controls. Rendered widths respect the center's minimum budget while preference widths are preserved.

Below 1050 px, sidebars become closable drawers so the canvas retains space. Drawers make background controls inert, constrain keyboard focus, close with Escape and restore focus. Native modal help uses the same return behavior. Errors preserve the current file and annotations. Preferences report storage failure instead of claiming success.

Project differences: chip geometry replaces generic documents and graphs; no generic file management, global command palette or arbitrary panel docking is introduced. The application displays Chinese operation labels with original file/cell identifiers. Review records use explicit file export rather than automatic persistence of chip data.

Runtime implementation: `apps/web/src/public/`. Public behavior regression: `apps/web/tests/public/`. Original local API experience: `apps/web/src/App.tsx` via `legacy.html`, excluded from the public production build.
