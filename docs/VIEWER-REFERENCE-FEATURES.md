# Viewer features and reference decisions

The current browser viewer implements orthographic 2D/perspective 3D switching, a two-point planar ruler, expandable cell hierarchy, layer-name JSON/LYP round trips and structured hover facts. These are independently implemented viewer behaviors; no GDS3D or KLayout source code, binaries, models or screenshots are included.

## Reference features

[GDS3D's README](https://github.com/trilomix/GDS3D/blob/master/README.md) describes a process-definition file, hierarchy selection, rulers, exploded layers, net tracing, multi-layout assembly and GMSH export. Its process file supplies physical heights, thicknesses and metal/via roles. Our name-only maps do not supply these, so this iteration does not claim physical stack reconstruction, electrical tracing, assembly or simulation exports. That fork's README identifies GPL2 for the version containing Gmsh code and LGPL2.1 compatibility without it.

[KLayout's main-window manual](https://www.klayout.org/downloads/master/doc-qt5/manual/main_window.html) describes expandable cell hierarchy, layer filtering/styling and rulers. Its [2.5D documentation](https://www.klayout.org/downloads/dropbox/offline-manual.pdf) explains vertical layer extrusion driven by a material-stack script. We adopt browsing and measurement interactions; KLayout's editing, DRC, LVS and script engine remain separate desktop-tool capabilities. The [KLayout repository](https://github.com/KLayout/klayout) identifies GPL3 licensing.

## Use in this viewer

- **2D** uses an orthographic camera. Left/right drag pans; scroll zooms. **3D**, **Top** and **Front** use perspective views. Fitting the design preserves the selected projection. Both views use the same parsed geometry and selection, with no file upload or reparse on projection changes.
- **Measure** enters 2D and takes two clicks in the current cell's XY plane. It reports Euclidean distance and signed ΔX/ΔY in the layout unit. A third click starts another measurement. Measurements do not snap, establish connectivity or persist in review exports.
- **Hierarchy** reads stored cell/reference names and groups repeated direct target references, including array instance counts. Missing definitions are disabled, cyclic branches stop, depth is capped at 32 and displayed rows at 300. Search uses the full cell directory, making cells outside the displayed tree reachable. Existing parser expansion limits are unchanged.
- **Layer maps** import/export explicit user names as JSON or KLayout LYP. Colors, fills, visibility, height and thickness are not exported. Exact default-layout sources are required; unsupported ranges, wildcards and other layout indices are skipped. See [record/name details](GDS-RECORDS.md) and original synthetic [JSON](../fixtures/layer-maps/synthetic.json)/[grouped LYP](../fixtures/layer-maps/synthetic-grouped.lyp) examples. These examples describe demo geometry, not a real process.
- **Hover** displays cell, layer ID, optional user name, X, Y and optional PATH width as label/value rows. Coordinates belong to the displayed cell, while source properties retain their original identity.

Cell names come from GDS STRNAME/SNAME records. Physical layer names generally require a process map; arbitrary text labels or properties are not treated as authoritative layer names. Display heights remain illustrative.

A command shell is unnecessary for these browser operations. The public site has no command executor or backend upload API. Batch conversion or trusted process automation would be a separate local workflow, rather than arbitrary commands inside the public viewer.
