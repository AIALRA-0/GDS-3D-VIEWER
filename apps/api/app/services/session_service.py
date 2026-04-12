from __future__ import annotations

import json
import uuid
from collections import Counter
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import gdstk

from app.schemas.models import (
    BookmarkModel,
    DiffSummaryModel,
    HierarchyNodeModel,
    LayerModel,
    ManifestModel,
    MarkerModel,
    MetricsModel,
    ReviewNoteModel,
    SampleSummaryModel,
    SelectionMetadataModel,
    SessionResponseModel,
    SessionStateModel,
)
from app.services.ai_service import build_local_command, build_local_explain
from app.services.diff_service import build_diff
from app.utils.legacy_gds2gltf import DEFAULT_LAYERSTACK, convert_gds_to_gltf


BASE_DIR = Path(__file__).resolve().parents[4]
DATA_DIR = BASE_DIR / "apps" / "api" / "data"
SESSION_DIR = DATA_DIR / "sessions"
SAMPLE_DIR = DATA_DIR / "samples"
PRESET_DIR = BASE_DIR / "packages" / "shared" / "presets"
FIXTURE_DIR = BASE_DIR / "fixtures"

DEFAULT_SAMPLE_ID = "default"
SAMPLE_REGISTRY: dict[str, dict[str, Any]] = {
    "default": {
        "name": "TinyTapeout Example",
        "technology": "sky130",
        "description": "Repository fixture used as the baseline sample session and smoke target.",
        "tags": ["sample", "tiny-tapeout", "fixture"],
        "gds": FIXTURE_DIR / "example" / "example.gds",
        "manifest": FIXTURE_DIR / "example" / "manifest.json",
    },
    "openroad-demo": {
        "name": "OpenROAD Bundle Demo",
        "technology": "openroad-sky130",
        "description": "OpenROAD-style sidecar bundle layered on top of the example GDS for engineering review.",
        "tags": ["openroad", "compat", "sample"],
        "gds": FIXTURE_DIR / "example" / "example.gds",
        "manifest": FIXTURE_DIR / "compat" / "openroad-manifest.json",
        "metrics": FIXTURE_DIR / "compat" / "openroad-metrics.json",
        "markers": FIXTURE_DIR / "compat" / "openroad-markers.json",
        "def_file": FIXTURE_DIR / "compat" / "openroad.def",
        "lef_file": FIXTURE_DIR / "compat" / "openroad.lef",
    },
}


def ensure_storage() -> None:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _bbox3d(
    bbox2d: tuple[tuple[float, float], tuple[float, float]] | None,
    zmax: float = 0.0,
) -> list[float]:
    if not bbox2d:
        return [0, 0, 0, 0, 0, zmax]
    return [bbox2d[0][0], bbox2d[0][1], 0.0, bbox2d[1][0], bbox2d[1][1], zmax]


def _bbox_center(bbox: list[float] | tuple[float, ...] | None) -> list[float]:
    if not bbox or len(bbox) < 6:
        return [0.0, 0.0, 0.0]
    return [
        float((bbox[0] + bbox[3]) / 2),
        float((bbox[1] + bbox[4]) / 2),
        float((bbox[2] + bbox[5]) / 2),
    ]


def _default_camera() -> dict[str, list[float]]:
    return {"position": [12.0, 11.0, 16.0], "target": [0.0, 1.2, 0.0]}


def _default_bookmark(manifest: ManifestModel) -> BookmarkModel:
    return BookmarkModel(
        id="bookmark-overview",
        name="Overview",
        camera=_default_camera(),
        selectedLayerIds=[layer.id for layer in manifest.layers[: min(4, len(manifest.layers))]],
        focusedNodeId=manifest.hierarchy[0].id if manifest.hierarchy else None,
        note="Default review anchor for the cockpit.",
        createdAt=_iso_now(),
    )


def _selection_from_node(node: HierarchyNodeModel | None) -> SelectionMetadataModel | None:
    if not node:
        return None
    return SelectionMetadataModel(
        id=node.id,
        name=node.name,
        kind=node.kind,
        bbox=node.bbox,
        focusLayerIds=node.focusLayerIds,
        polygonCount=node.polygonCount,
        instanceCount=node.instanceCount,
    )


def _seed_markers(manifest: ManifestModel) -> list[MarkerModel]:
    seeded: list[MarkerModel] = []
    for index, node in enumerate(manifest.hierarchy[:3]):
        severity = "warning" if index == 0 else "info"
        seeded.append(
            MarkerModel(
                id=f"marker-{index + 1}",
                title=f"Review {node.name}",
                message=f"Use {node.name} as a guided review stop during the live demo.",
                severity=severity,
                category="review",
                position=_bbox_center(node.bbox),
                bbox=node.bbox,
                focusLayerIds=node.focusLayerIds,
                nodeId=node.id,
            )
        )
    return seeded


def _sample_state(manifest: ManifestModel) -> SessionStateModel:
    selected_layers = [layer.id for layer in manifest.layers[: min(4, len(manifest.layers))]]
    focused = manifest.hierarchy[0] if manifest.hierarchy else None
    bookmarks = manifest.bookmarks or [_default_bookmark(manifest)]
    return SessionStateModel(
        panel="viewer",
        selectedLayerIds=selected_layers,
        focusedNodeId=focused.id if focused else None,
        selectedMarkerId=manifest.markers[0].id if manifest.markers else None,
        notes=[],
        bookmarks=bookmarks,
        performanceMode="full",
        camera=_default_camera(),
        selectionMetadata=_selection_from_node(focused),
    )


def load_preset(name: str) -> dict[tuple[int, int], dict[str, Any]]:
    preset_file = PRESET_DIR / f"{name}.json"
    if not preset_file.exists():
        preset_file = PRESET_DIR / "generic.json"

    with preset_file.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    layers: dict[tuple[int, int], dict[str, Any]] = {}
    for layer in payload.get("layers", []):
        gds_layer = layer.get("gdsLayer")
        if gds_layer is None:
            continue
        layers[(gds_layer, layer.get("datatype", 0))] = layer
    return layers


def _color_from_spec(layer: int, datatype: int) -> str:
    seed = (layer * 53 + datatype * 97) % 255
    return f"#{seed:02x}{(255 - seed):02x}{((seed * 3) % 255):02x}"


def _local_polygon_count(cell: gdstk.Cell) -> int:
    count = len(cell.polygons)
    for path in getattr(cell, "paths", []):
        if hasattr(path, "to_polygons"):
            count += len(path.to_polygons())
    return count


def _cell_focus_layers(cell: gdstk.Cell) -> list[tuple[int, int]]:
    focus: list[tuple[int, int]] = []
    seen: set[tuple[int, int]] = set()
    for polygon in cell.polygons[:32]:
        spec = (polygon.layer, polygon.datatype)
        if spec in seen:
            continue
        seen.add(spec)
        focus.append(spec)
    return focus[:6]


def _instance_count(cell: gdstk.Cell, depth: int = 0) -> int:
    if depth > 6:
        return len(cell.references)
    total = len(cell.references)
    for ref in cell.references[:200]:
        total += _instance_count(ref.cell, depth + 1)
    return total


def inspect_gds_file(gds_path: Path, technology: str, source_files: list[str]) -> ManifestModel:
    library = gdstk.read_gds(str(gds_path))
    preset = load_preset(technology)
    top = library.top_level()[0]

    layer_counter: Counter[tuple[int, int]] = Counter()
    max_z = 0.0
    for cell in library.cells:
        for polygon in cell.polygons:
            layer_counter[(polygon.layer, polygon.datatype)] += 1
        for path in getattr(cell, "paths", []):
            if hasattr(path, "layer") and hasattr(path, "datatype") and hasattr(path, "to_polygons"):
                layer_counter[(path.layer, path.datatype)] += len(path.to_polygons())

    layers: list[LayerModel] = []
    for (gds_layer, datatype), polygon_count in sorted(layer_counter.items()):
        layer_info = preset.get((gds_layer, datatype), {})
        zmax = float(layer_info.get("zmax", 0.4))
        max_z = max(max_z, zmax)
        layers.append(
            LayerModel(
                id=f"L{gds_layer}D{datatype}",
                name=layer_info.get("name", f"layer-{gds_layer}:{datatype}"),
                color=layer_info.get("color", _color_from_spec(gds_layer, datatype)),
                visible=True,
                purpose=layer_info.get("purpose", "drawing"),
                thicknessNm=int(layer_info.get("thicknessNm", max(int((zmax * 1000) or 120), 80))),
                gdsLayer=gds_layer,
                datatype=datatype,
                polygonCount=polygon_count,
                source="gds",
            )
        )

    hierarchy: list[HierarchyNodeModel] = []
    seen_cells: set[str] = set()

    def walk(cell: gdstk.Cell, depth: int = 0) -> None:
        if cell.name in seen_cells or depth > 2 or len(hierarchy) >= 36:
            return
        seen_cells.add(cell.name)

        bbox = _bbox3d(cell.bounding_box(), max_z)
        focus_layer_ids = [f"L{layer}D{datatype}" for layer, datatype in _cell_focus_layers(cell)]
        hierarchy.append(
            HierarchyNodeModel(
                id=cell.name,
                name=cell.name,
                kind="chip" if depth == 0 else ("macro" if cell.references else "leaf"),
                childCount=len(cell.references),
                instanceCount=_instance_count(cell),
                polygonCount=_local_polygon_count(cell),
                bbox=bbox,
                focusLayerIds=focus_layer_ids,
            )
        )
        for ref in cell.references[:24]:
            walk(ref.cell, depth + 1)

    walk(top)

    bbox = _bbox3d(top.bounding_box(), max_z)
    area_mm2 = max(((bbox[3] - bbox[0]) * (bbox[4] - bbox[1])) / 1_000_000.0, 0.0)
    metrics = MetricsModel(
        bbox=bbox,
        cellCount=len(library.cells),
        instanceCount=_instance_count(top),
        polygonCount=sum(layer.polygonCount for layer in layers),
        netCount=0,
        layerCount=len(layers),
        estimatedAreaMm2=round(area_mm2, 6),
        utilizationPercent=0.0,
        wirelengthUm=0.0,
        negativeSlackNs=0.0,
    )

    return ManifestModel(
        id=uuid.uuid4().hex[:10],
        name=top.name,
        source="upload",
        format="gds",
        technology=technology,
        description=f"Imported from {gds_path.name} for ICViewer review.",
        tags=["layout", technology, "uploaded"],
        sourceFiles=source_files,
        layers=layers,
        hierarchy=hierarchy,
        metrics=metrics,
        notes=[],
        markers=[],
        bookmarks=[],
        generatedAt=_iso_now(),
    )


def _merge_manifest_overrides(
    manifest: ManifestModel,
    manifest_override: dict[str, Any] | None,
    metrics_override: dict[str, Any] | None,
    markers_override: dict[str, Any] | list[dict[str, Any]] | None,
) -> ManifestModel:
    if manifest_override:
        if manifest_override.get("technology"):
            manifest.technology = str(manifest_override["technology"])
        if manifest_override.get("description"):
            manifest.description = str(manifest_override["description"])
        if manifest_override.get("name"):
            manifest.name = str(manifest_override["name"])
        manifest.tags = list(dict.fromkeys([*manifest.tags, *manifest_override.get("tags", [])]))
        manifest.notes = [*manifest.notes, *manifest_override.get("notes", [])]

        layer_overrides: dict[tuple[int | None, int], dict[str, Any]] = {}
        for layer in manifest_override.get("layers", []):
            key = (layer.get("gdsLayer"), layer.get("datatype", 0))
            layer_overrides[key] = layer

        for layer in manifest.layers:
            override = layer_overrides.get((layer.gdsLayer, layer.datatype))
            if not override:
                continue
            layer.name = override.get("name", layer.name)
            layer.color = override.get("color", layer.color)
            layer.purpose = override.get("purpose", layer.purpose)
            layer.thicknessNm = int(override.get("thicknessNm", layer.thicknessNm))
            layer.visible = bool(override.get("visible", layer.visible))
            layer.source = str(override.get("source", layer.source))

        if manifest_override.get("bookmarks"):
            manifest.bookmarks = [
                BookmarkModel.model_validate(bookmark) for bookmark in manifest_override.get("bookmarks", [])
            ]
        if manifest_override.get("markers"):
            manifest.markers = [MarkerModel.model_validate(marker) for marker in manifest_override.get("markers", [])]

    if metrics_override:
        for field, value in metrics_override.items():
            if hasattr(manifest.metrics, field):
                setattr(manifest.metrics, field, value)

    if markers_override:
        raw_markers = markers_override if isinstance(markers_override, list) else markers_override.get("markers", [])
        manifest.markers = [MarkerModel.model_validate(marker) for marker in raw_markers]

    if not manifest.markers:
        manifest.markers = _seed_markers(manifest)
    if not manifest.bookmarks:
        manifest.bookmarks = [_default_bookmark(manifest)]
    return manifest


def _resolve_tech_label(technology: str) -> str:
    return technology if technology else "generic"


def _normalize_layerstack(technology: str) -> dict[tuple[int, int], dict[str, Any]]:
    preset = load_preset(technology)
    return {
        key: {
            "name": value.get("name", f"layer-{key[0]}:{key[1]}"),
            "zmin": float(value.get("zmin", 0.0)),
            "zmax": float(value.get("zmax", 0.35)),
            "color": value.get(
                "rgba",
                DEFAULT_LAYERSTACK.get(key, {}).get("color", [0.6, 0.6, 0.6, 1.0]),
            ),
        }
        for key, value in preset.items()
    }


def _build_session_response(
    session_id: str,
    manifest: ManifestModel,
    asset_url: str | None,
    warnings: list[str],
    baseline_manifest: ManifestModel | None = None,
    notes: list[ReviewNoteModel] | None = None,
) -> SessionResponseModel:
    baseline = baseline_manifest or manifest
    state = _sample_state(manifest)
    if notes:
        state.notes = notes
    if manifest.bookmarks:
        state.bookmarks = manifest.bookmarks
    explain = build_local_explain(manifest)
    operator = build_local_command(manifest, "Focus the strongest review target and capture a bookmark.")
    diff = build_diff(baseline, manifest)
    return SessionResponseModel(
        sessionId=session_id,
        assetUrl=asset_url,
        manifest=manifest,
        state=state,
        explain=explain,
        operator=operator,
        diff=diff,
        warnings=warnings,
        exportMetadata=None,
    )


def _save_session_file(target_dir: Path, response: SessionResponseModel) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    with (target_dir / "session.json").open("w", encoding="utf-8") as handle:
        json.dump(response.model_dump(mode="json"), handle, indent=2)
    with (target_dir / "manifest.json").open("w", encoding="utf-8") as handle:
        json.dump(response.manifest.model_dump(mode="json"), handle, indent=2)


def _load_json_file(path: Path | None) -> dict[str, Any] | None:
    if not path or not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _generate_asset(gds_path: Path, output_dir: Path, technology: str, asset_prefix: str) -> tuple[str | None, list[str]]:
    warnings: list[str] = []
    asset_url: str | None = None
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "scene.gltf"
        convert_gds_to_gltf(gds_path, output_path, _normalize_layerstack(technology))
        asset_url = f"/review-assets/{asset_prefix}/scene.gltf"
    except Exception as exc:
        warnings.append(f"glTF conversion fell back to procedural mode: {exc}")
    return asset_url, warnings


def _build_sample_manifest(sample_id: str) -> tuple[ManifestModel, str | None, list[str]]:
    sample = SAMPLE_REGISTRY[sample_id]
    gds_path = sample["gds"]
    manifest_override = _load_json_file(sample.get("manifest"))
    metrics_override = _load_json_file(sample.get("metrics"))
    markers_override = _load_json_file(sample.get("markers"))

    source_files = [gds_path.name]
    for key in ("manifest", "metrics", "markers", "def_file", "lef_file"):
        file_path = sample.get(key)
        if file_path and Path(file_path).exists():
            source_files.append(Path(file_path).name)

    manifest = inspect_gds_file(gds_path, sample["technology"], source_files)
    manifest.id = sample_id
    manifest.source = "sample"
    manifest.format = "bundle" if len(source_files) > 1 else "gds"
    manifest.name = sample["name"]
    manifest.description = sample["description"]
    manifest.tags = list(dict.fromkeys([*manifest.tags, *sample["tags"]]))
    manifest = _merge_manifest_overrides(manifest, manifest_override, metrics_override, markers_override)

    sample_storage = SAMPLE_DIR / sample_id
    scene_asset = sample_storage / "scene.gltf"
    asset_url = f"/review-assets/samples/{sample_id}/scene.gltf" if scene_asset.exists() else None
    warnings: list[str] = []
    return manifest, asset_url, warnings


def create_sample_session(sample_id: str = DEFAULT_SAMPLE_ID) -> SessionResponseModel:
    if sample_id not in SAMPLE_REGISTRY:
        raise FileNotFoundError(f"Unknown sample: {sample_id}")

    cached_session = SAMPLE_DIR / sample_id / "session.json"
    if cached_session.exists():
        return SessionResponseModel.model_validate(json.loads(cached_session.read_text(encoding="utf-8")))

    manifest, asset_url, warnings = _build_sample_manifest(sample_id)
    baseline_manifest = manifest if sample_id == DEFAULT_SAMPLE_ID else _build_sample_manifest(DEFAULT_SAMPLE_ID)[0]
    response = _build_session_response(
        session_id=f"sample-{sample_id}",
        manifest=manifest,
        asset_url=asset_url,
        warnings=warnings,
        baseline_manifest=baseline_manifest,
    )
    _save_session_file(SAMPLE_DIR / sample_id, response)
    return response


def list_sample_summaries() -> list[SampleSummaryModel]:
    summaries: list[SampleSummaryModel] = []
    for sample_id in SAMPLE_REGISTRY:
        session = create_sample_session(sample_id)
        summaries.append(
            SampleSummaryModel(
                id=sample_id,
                sessionId=session.sessionId,
                name=session.manifest.name,
                description=session.manifest.description,
                technology=session.manifest.technology,
                tags=session.manifest.tags,
                sourceFiles=session.manifest.sourceFiles,
                generatedAt=session.manifest.generatedAt,
            )
        )
    return summaries


def create_session_from_upload(
    uploaded_files: dict[str, bytes],
    technology: str,
    manifest_override: dict[str, Any] | None = None,
    metrics_override: dict[str, Any] | None = None,
    markers_override: dict[str, Any] | list[dict[str, Any]] | None = None,
    notes: list[ReviewNoteModel] | None = None,
) -> SessionResponseModel:
    ensure_storage()
    session_id = uuid.uuid4().hex
    session_root = SESSION_DIR / session_id
    source_dir = session_root / "sources"
    source_dir.mkdir(parents=True, exist_ok=True)

    gds_name = next((name for name in uploaded_files if name.lower().endswith((".gds", ".gdsii"))), None)
    if not gds_name:
        raise FileNotFoundError("A GDS file is required for upload sessions")

    for filename, payload in uploaded_files.items():
        (source_dir / filename).write_bytes(payload)

    gds_path = source_dir / gds_name
    source_files = list(uploaded_files.keys())
    manifest = inspect_gds_file(gds_path, _resolve_tech_label(technology), source_files)
    manifest.id = session_id
    manifest.format = "bundle" if len(source_files) > 1 else "gds"
    manifest.source = "upload"
    manifest = _merge_manifest_overrides(manifest, manifest_override, metrics_override, markers_override)

    asset_url, warnings = _generate_asset(gds_path, session_root, technology, f"sessions/{session_id}")
    baseline_manifest = create_sample_session(DEFAULT_SAMPLE_ID).manifest
    response = _build_session_response(
        session_id=session_id,
        manifest=manifest,
        asset_url=asset_url,
        warnings=warnings,
        baseline_manifest=baseline_manifest,
        notes=notes,
    )
    _save_session_file(session_root, response)
    return response


def read_session(session_id: str) -> SessionResponseModel:
    direct_path = SESSION_DIR / session_id / "session.json"
    if direct_path.exists():
        return SessionResponseModel.model_validate(json.loads(direct_path.read_text(encoding="utf-8")))

    if session_id.startswith("sample-"):
        sample_id = session_id.removeprefix("sample-")
        sample_path = SAMPLE_DIR / sample_id / "session.json"
        if sample_path.exists():
            return SessionResponseModel.model_validate(json.loads(sample_path.read_text(encoding="utf-8")))
        return create_sample_session(sample_id)

    raise FileNotFoundError(session_id)


def export_session(session: SessionResponseModel) -> tuple[str, bytes]:
    payload = deepcopy(session.model_dump(mode="json"))
    payload["exportMetadata"] = {
        "formatVersion": "icviewer-session-v1",
        "exportedAt": _iso_now(),
        "exportedBy": "ICViewer",
        "sourceSessionId": session.sessionId,
    }
    raw = json.dumps(payload, indent=2).encode("utf-8")
    filename = f"{session.manifest.name.lower().replace(' ', '-')}-session.json"

    storage_root = SESSION_DIR / session.sessionId
    if session.sessionId.startswith("sample-"):
        storage_root = SAMPLE_DIR / session.sessionId.removeprefix("sample-")
    exports_dir = storage_root / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    (exports_dir / filename).write_bytes(raw)
    return filename, raw


def parse_json_upload(raw: bytes | None, label: str) -> tuple[dict[str, Any] | None, list[str]]:
    if not raw:
        return None, []
    try:
        parsed = json.loads(raw.decode("utf-8"))
        return parsed, []
    except json.JSONDecodeError as exc:
        return None, [f"Ignored {label} because it was not valid JSON: {exc.msg}."]


def blank_diff(manifest: ManifestModel) -> DiffSummaryModel:
    return build_diff(manifest, manifest)
