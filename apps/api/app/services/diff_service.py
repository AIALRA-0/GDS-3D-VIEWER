from __future__ import annotations

from app.schemas.models import DiffSummaryModel, ManifestModel


def build_diff(left: ManifestModel, right: ManifestModel) -> DiffSummaryModel:
    left_layers = {layer.id: layer for layer in left.layers}
    right_layers = {layer.id: layer for layer in right.layers}

    added = sorted(set(right_layers) - set(left_layers))
    removed = sorted(set(left_layers) - set(right_layers))

    changed: list[str] = []
    for layer_id in sorted(set(left_layers) & set(right_layers)):
        left_layer = left_layers[layer_id]
        right_layer = right_layers[layer_id]
        if (
            left_layer.color != right_layer.color
            or left_layer.visible != right_layer.visible
            or left_layer.polygonCount != right_layer.polygonCount
        ):
            changed.append(layer_id)

    left_metrics = left.metrics
    right_metrics = right.metrics
    delta_lines = [
        f"Cells: {left_metrics.cellCount} -> {right_metrics.cellCount}",
        f"Instances: {left_metrics.instanceCount} -> {right_metrics.instanceCount}",
        f"Polygons: {left_metrics.polygonCount} -> {right_metrics.polygonCount}",
        f"Layers: {left_metrics.layerCount} -> {right_metrics.layerCount}",
    ]

    return DiffSummaryModel(
        title=f"{left.name} vs {right.name}",
        added=added,
        removed=removed,
        changed=changed,
        deltaLines=delta_lines,
    )
