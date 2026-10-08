# Compatibility Spec

## Canonical Source

GDS-3D-VIEWER treats `GDS` as the source of truth for geometry conversion and visualization.

## Optional Sidecars

- `manifest.json`
- `metrics.json`
- `lef`
- `def`
- technology preset JSON

## Intended Flow Support

### OpenROAD / OpenLane

- stream-out `GDS`
- optionally attach `DEF`, `LEF`, and metrics JSON
- optionally attach a generated manifest for named layers and tool provenance

### Virtuoso

- export or stream out `GDS`
- attach technology metadata through a sidecar manifest
- treat OpenAccess-native state as out of scope for the hackathon MVP

## Design Goal

Support engineering interoperability without binding the web viewer to any proprietary runtime or database.
