from __future__ import annotations

import json
import uuid
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import gdstk

from app.schemas.models import (
    DiffSummaryModel,
    HierarchyNodeModel,
    LayerModel,
    ManifestModel,
    MetricsModel,
    SessionResponseModel,
)
from app.services.ai_service import build_local_command, build_local_explain
from app.services.diff_service import build_diff
from app.services.fixtures import load_sample_payload
from app.utils.legacy_gds2gltf import DEFAULT_LAYERSTACK, convert_gds_to_gltf


BASE_DIR = Path(__file__).resolve().parents[4]
DATA_DIR = BASE_DIR / "apps" / "api" / "data" / "sessions"
PRESET_DIR = BASE_DIR / "packages" / "shared" / "presets"


def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


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


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _bbox3d(bbox2d: tuple[tuple[float, float], tuple[float, float]] | None, zmax: float = 0.0) -> list[float]:
    if not bbox2d:
        return [0, 0, 0, 0, 0, zmax]
    return [bbox2d[0][0], bbox2d[0][1], 0.0, bbox2d[1][0], bbox2d[1][1], zmax]


def _color_from_spec(layer: int, datatype: int) -> str:
    seed = (layer * 53 + datatype * 97) % 255
    return f"#{seed:02x}{(255 - seed):02x}{((seed * 3) % 255):02x}"


def _merge_manifest_overrides(
    manifest: ManifestModel,
    manifest_override: dict[str, Any] | None,
    metrics_override: dict[str, Any] | None,
) -> ManifestModel:
    if manifest_override:
        if manifest_override.get("technology"):
            manifest.technology = manifest_override["technology"]
        if manifest_override.get("description"):
            manifest.description = manifest_override["description"]
        manifest.tags = list(dict.fromkeys([*manifest.tags, *manifest_override.get("tags", [])]))
        manifest.notes = [*manifest.notes, *manifest_override.get("notes", [])]

        layer_overrides = {}
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

    if metrics_override:
        for field, value in metrics_override.items():
            if hasattr(manifest.metrics, field):
                setattr(manifest.metrics, field, value)

    return manifest


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
        generatedAt=_iso_now(),
    )


def create_sample_session() -> SessionResponseModel:
    return load_sample_payload()


def create_session_from_upload(
    gds_path: Path,
    technology: str,
    source_files: list[str],
    manifest_override: dict[str, Any] | None = None,
    metrics_override: dict[str, Any] | None = None,
) -> SessionResponseModel:
    ensure_storage()
    session_id = uuid.uuid4().hex
    session_dir = DATA_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    manifest = inspect_gds_file(gds_path, technology, source_files)
    manifest.id = session_id
    manifest.format = "bundle" if len(source_files) > 1 else "gds"
    if manifest_override or metrics_override:
        manifest = _merge_manifest_overrides(manifest, manifest_override, metrics_override)

    warnings: list[str] = []
    asset_url: str | None = None
    preset = load_preset(technology)
    try:
        normalized_layerstack = {
            key: {
                "name": value.get("name", f"layer-{key[0]}:{key[1]}"),
                "zmin": float(value.get("zmin", 0.0)),
                "zmax": float(value.get("zmax", 0.35)),
                "color": value.get("rgba", DEFAULT_LAYERSTACK.get(key, {}).get("color", [0.6, 0.6, 0.6, 1.0])),
            }
            for key, value in preset.items()
        }
        output_path = session_dir / "scene.gltf"
        convert_gds_to_gltf(gds_path, output_path, normalized_layerstack)
        asset_url = f"/assets/sessions/{session_id}/scene.gltf"
    except Exception as exc:
        warnings.append(f"glTF conversion fell back to procedural mode: {exc}")

    explain = build_local_explain(manifest)
    operator = build_local_command(manifest, "Highlight the strongest review target.")
    diff = build_diff(load_sample_payload().manifest, manifest)

    response = SessionResponseModel(
        sessionId=session_id,
        assetUrl=asset_url,
        manifest=manifest,
        explain=explain,
        operator=operator,
        diff=diff,
        warnings=warnings,
    )

    with (session_dir / "session.json").open("w", encoding="utf-8") as handle:
        json.dump(response.model_dump(mode="json"), handle, indent=2)
    return response


def read_session(session_id: str) -> SessionResponseModel:
    with (DATA_DIR / session_id / "session.json").open("r", encoding="utf-8") as handle:
        return SessionResponseModel.model_validate(json.load(handle))


def parse_json_upload(raw: bytes | None) -> dict[str, Any] | None:
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def blank_diff(manifest: ManifestModel) -> DiffSummaryModel:
    return build_diff(manifest, manifest)
