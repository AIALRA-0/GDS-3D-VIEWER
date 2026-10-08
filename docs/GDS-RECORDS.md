# GDS records and layer names

The public parser accepts `.gds`, `.gds2` and `.gdsii` as suffixes of the same binary GDSII stream. OASIS, CIF and DXF are different formats and are not parsed by this application. `Source data` reports record names, counts and whether they contribute parsed structure/geometry/metadata or are counted only. A count never implies that a record's complete content has been interpreted.

| Data | Current display | Limits |
| --- | --- | --- |
| HEADER, LIBNAME, UNITS | Library name, version, database unit and user unit | Coordinates displayed in µm; original units retained |
| BOUNDARY, BOX | Extruded geometry and click/hover facts | Illustrative heights; existing geometry limits apply |
| PATH | Geometry, width, length and area | Flush, square and custom extensions supported; round ends and negative absolute widths require conversion |
| SREF, AREF, STRANS, MAG, ANGLE, COLROW, XY | Rendered hierarchy plus source-cell reference records, array size, coordinates, angle, reflection and magnification | Source records are shown once, not once per expanded instance; absolute reference transformations remain unsupported |
| TEXT, TEXTTYPE, STRING, PRESENTATION | Searchable text, layer/texttype, coordinates, angle, magnification, reflection and presentation flags in Source data | Source-cell coordinates, not flattened world coordinates; text is not drawn on the canvas or treated as connectivity |
| PROPATTR, PROPVALUE | Selected geometry properties and source text/reference properties | Numeric keys; at most 128 properties per element, values/text at most 4096 characters |
| BGNLIB, BGNSTR, ENDSTR, ENDLIB | Structural parsing and record counts | Creation/modification timestamps are not decoded |
| Other records | Record name/hex type and count with “Counted only” status | Fonts, external-library references, element flags, PLEX, tape/mask and vendor extension payloads are not interpreted |
| NODE | Explicitly refused | Convert to supported geometry in the source layout tool |

GDS layer/datatype numbers do not establish actual process names. The default remains `Layer n/d`. Select a layer and enter a name such as `metal1` under Overview, then choose Save name. Reset name restores the original display name. Original layer IDs and geometry never change.

Import layer map reads a local KLayout `.lyp` file or a JSON object such as `{"7/3":"metal1"}`. For `.lyp`, only explicit numeric `layer/datatype` or `layer/datatype@1` sources with a nonempty name are imported, including nested group entries. Ranges, wildcards and other layout indices are skipped; if no exact names exist, import fails with an explanation. Conflicting names for the same layer are refused. This is name import, not a complete KLayout style/technology interpreter; colors and process thicknesses are unchanged.

Mapping files are limited to 1 MB and 10,000 entries, names to 128 characters. XML document types/entities are refused before parsing and no external resources are fetched. Malformed mappings retain current names and geometry. Numeric IDs are canonicalized, including leading zeros; conflicting aliases are refused. Names remain in page memory and are included only in explicit mapping/review exports, never browser storage. Opening another file clears them, selecting another cell of the same file retains them, and old reviews without names still import.

Export JSON and Export LYP write all explicit names, including names for layers absent from the current cell. LYP export escapes XML text and uses exact `n/d@1` sources. Exports exceeding the same 1 MB import budget are refused with a visible error, preserving names. Export is name-only: colors, visibility, fills, thicknesses, original KLayout grouping and styling are not retained. Original synthetic examples are available under `fixtures/layer-maps`; round trips cover those files, nested groups, Unicode and reserved XML characters.

Cell names are read automatically from STRNAME/SNAME and appear in the bounded hierarchy tree. A complete ENDLIB may be followed by zero null-word block padding, as emitted by some stream exporters; nonzero trailers, concatenated libraries, odd byte lengths and truncated records remain refused. [LayoutEditor's GDSII documentation](https://www.layouteditor.net/wiki/GDSII) describes the block-padding export option. No geometry or source-record counts are derived from padding.

An AI geometry summary includes only that geometry's optional `userProvidedLayerName`, not the complete mapping, labels or properties. The name is untrusted user data, not verified process evidence. Changing names invalidates AI consent and pending work; changing inspector tabs keeps the same mounted configuration and ephemeral key. Keys remain excluded from exports and storage.

Record identifiers are checked against [gdstk's GDSII record enum](https://heitzmann.github.io/gdstk/headers/gdsii.html). Layer-name limitations follow [KLayout's explanation of GDS2 layer aliases and layer-properties files](https://www.klayout.de/forum/discussion/506/how-can-i-save-layer-name-into-gds2).
