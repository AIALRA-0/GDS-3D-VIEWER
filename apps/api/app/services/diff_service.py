from __future__ import annotations

from app.schemas.models import DiffSummaryModel, ManifestModel


def _metric_delta(label: str, left: float | int, right: float | int) -> str:
    return f"{label}: {left} -> {right}"


def build_diff(left: ManifestModel, right: ManifestModel) -> DiffSummaryModel:
    left_layers = {layer.id: layer for layer in left.layers}
    right_layers = {layer.id: layer for layer in right.layers}

    added = [f"Layer {layer_id}" for layer_id in sorted(set(right_layers) - set(left_layers))]
    removed = [f"Layer {layer_id}" for layer_id in sorted(set(left_layers) - set(right_layers))]

    changed: list[str] = []
    for layer_id in sorted(set(left_layers) & set(right_layers)):
        left_layer = left_layers[layer_id]
        right_layer = right_layers[layer_id]
        if (
            left_layer.color != right_layer.color
            or left_layer.visible != right_layer.visible
            or left_layer.polygonCount != right_layer.polygonCount
            or left_layer.name != right_layer.name
        ):
            changed.append(f"Layer {layer_id}")

    left_nodes = {node.id for node in left.hierarchy}
    right_nodes = {node.id for node in right.hierarchy}
    if right_nodes - left_nodes:
        changed.append(f"Hierarchy +{len(right_nodes - left_nodes)}")
    if left_nodes - right_nodes:
        changed.append(f"Hierarchy -{len(left_nodes - right_nodes)}")

    left_markers = left.markers or []
    right_markers = right.markers or []
    left_bookmarks = left.bookmarks or []
    right_bookmarks = right.bookmarks or []

    delta_lines = [
        _metric_delta("Cells", left.metrics.cellCount, right.metrics.cellCount),
        _metric_delta("Instances", left.metrics.instanceCount, right.metrics.instanceCount),
        _metric_delta("Polygons", left.metrics.polygonCount, right.metrics.polygonCount),
        _metric_delta("Layers", left.metrics.layerCount, right.metrics.layerCount),
        _metric_delta("Area (mm2)", round(left.metrics.estimatedAreaMm2, 6), round(right.metrics.estimatedAreaMm2, 6)),
        _metric_delta(
            "Utilization (%)",
            round(left.metrics.utilizationPercent, 3),
            round(right.metrics.utilizationPercent, 3),
        ),
        _metric_delta("Markers", len(left_markers), len(right_markers)),
        _metric_delta("Bookmarks", len(left_bookmarks), len(right_bookmarks)),
    ]

    if left.metrics.wirelengthUm or right.metrics.wirelengthUm:
        delta_lines.append(
            _metric_delta(
                "Wirelength (um)",
                round(left.metrics.wirelengthUm, 3),
                round(right.metrics.wirelengthUm, 3),
            )
        )
    if left.metrics.negativeSlackNs or right.metrics.negativeSlackNs:
        delta_lines.append(
            _metric_delta(
                "Worst negative slack (ns)",
                round(left.metrics.negativeSlackNs, 3),
                round(right.metrics.negativeSlackNs, 3),
            )
        )

    return DiffSummaryModel(
        title=f"{left.name} vs {right.name}",
        added=added,
        removed=removed,
        changed=sorted(dict.fromkeys(changed)),
        deltaLines=delta_lines,
    )
