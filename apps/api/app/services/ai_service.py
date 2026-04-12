from __future__ import annotations

import json
import os
from typing import Any

import httpx

from app.schemas.models import (
    ExplainResultModel,
    ManifestModel,
    OperatorActionModel,
    OperatorResultModel,
)


def _top_layers(manifest: ManifestModel) -> list[str]:
    ranked = sorted(manifest.layers, key=lambda layer: layer.polygonCount, reverse=True)
    return [layer.name for layer in ranked[:3]]


def build_local_explain(manifest: ManifestModel) -> ExplainResultModel:
    layers = _top_layers(manifest)
    marker_count = len(manifest.markers or [])
    bookmark_count = len(manifest.bookmarks or [])
    summary = (
        f"{manifest.name} is a {manifest.technology} layout with {manifest.metrics.layerCount} tracked layers, "
        f"{manifest.metrics.instanceCount} instances, {manifest.metrics.polygonCount} polygons, "
        f"and {marker_count} review markers."
    )
    return ExplainResultModel(
        summary=summary,
        highlights=[
            f"Top cell area is approximately {manifest.metrics.estimatedAreaMm2:.4f} mm².",
            f"Most active layers: {', '.join(layers) if layers else 'none detected'}.",
            f"Hierarchy snapshot contains {len(manifest.hierarchy)} summarized nodes and {bookmark_count} saved viewpoints.",
        ],
        concerns=[
            "Virtuoso-native database inspection is intentionally out of scope; use exported GDS plus sidecars.",
            "Layer semantics depend on the selected technology preset and uploaded manifest quality.",
        ],
        nextSteps=[
            "Inspect the densest metal layers and macro hierarchy.",
            "Attach metrics.json, markers.json, or DEF/LEF sidecars for richer engineering context.",
            "Use bookmarks to capture stable demo viewpoints before live review.",
        ],
        confidence=0.58,
        source="local-rule",
    )


def build_local_command(manifest: ManifestModel, prompt: str) -> OperatorResultModel:
    prompt_lc = prompt.lower()
    actions: list[OperatorActionModel] = []

    for layer in manifest.layers:
        if layer.name.lower() in prompt_lc or layer.id.lower() in prompt_lc:
            if "hide" in prompt_lc:
                actions.append(
                    OperatorActionModel(
                        type="toggle-layer",
                        label=f"Hide {layer.name}",
                        targetId=layer.id,
                        payload="false",
                    )
                )
            elif "show" in prompt_lc:
                actions.append(
                    OperatorActionModel(
                        type="toggle-layer",
                        label=f"Show {layer.name}",
                        targetId=layer.id,
                        payload="true",
                    )
                )
            else:
                actions.append(
                    OperatorActionModel(type="isolate", label=f"Isolate {layer.name}", targetId=layer.id)
                )

    for node in manifest.hierarchy:
        if node.name.lower() in prompt_lc:
            actions.append(OperatorActionModel(type="focus", label=f"Focus {node.name}", targetId=node.id))
            break

    for marker in manifest.markers or []:
        if marker.title.lower() in prompt_lc or marker.category.lower() in prompt_lc:
            actions.append(
                OperatorActionModel(
                    type="focus-marker",
                    label=f"Focus marker {marker.title}",
                    targetId=marker.id,
                )
            )
            break

    if "bookmark" in prompt_lc or "save view" in prompt_lc:
        actions.append(OperatorActionModel(type="bookmark", label="Save current bookmark"))

    if "performance" in prompt_lc:
        mode = "hierarchy-preview" if "preview" in prompt_lc else "simplified"
        actions.append(
            OperatorActionModel(
                type="performance-mode",
                label=f"Switch to {mode}",
                payload=mode,
            )
        )

    if "show all" in prompt_lc or "reset" in prompt_lc:
        actions.append(OperatorActionModel(type="show-all", label="Show all layers and clear isolation"))

    if "note" in prompt_lc or "annotate" in prompt_lc:
        actions.append(
            OperatorActionModel(
                type="annotate",
                label="Add review note",
                payload="Flag this region for follow-up during the live demo.",
            )
        )

    if not actions and manifest.layers:
        layer = manifest.layers[0]
        actions.append(OperatorActionModel(type="isolate", label=f"Isolate {layer.name}", targetId=layer.id))

    return OperatorResultModel(
        title="Suggested cockpit actions",
        rationale="A deterministic operator translated the prompt into reversible viewer actions.",
        actions=actions,
        source="local-rule",
    )


async def _try_remote_json(system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        return None

    base_url = os.getenv("DEEPSEEK_CHAT_URL")
    if not base_url:
        base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/") + "/chat/completions"

    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.post(base_url, headers=headers, json=payload)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)


async def build_explain(manifest: ManifestModel, prompt: str | None = None) -> ExplainResultModel:
    local = build_local_explain(manifest)
    if not os.getenv("DEEPSEEK_API_KEY"):
        return local

    system_prompt = (
        "You are an IC layout review copilot. Return JSON with keys summary, highlights, concerns, "
        "nextSteps, confidence. Keep every field concise and engineering-focused."
    )
    user_prompt = json.dumps(
        {
            "prompt": prompt or "Summarize this layout for a review cockpit.",
            "manifest": manifest.model_dump(mode="json"),
        }
    )
    try:
        remote = await _try_remote_json(system_prompt, user_prompt)
        if not remote:
            return local
        return ExplainResultModel(
            summary=remote.get("summary", local.summary),
            highlights=remote.get("highlights", local.highlights),
            concerns=remote.get("concerns", local.concerns),
            nextSteps=remote.get("nextSteps", local.nextSteps),
            confidence=float(remote.get("confidence", 0.78)),
            source="remote-ai",
        )
    except Exception:
        return local


async def build_command(manifest: ManifestModel, prompt: str) -> OperatorResultModel:
    local = build_local_command(manifest, prompt)
    if not os.getenv("DEEPSEEK_API_KEY"):
        return local

    system_prompt = (
        "You are an IC layout viewer operator. Return JSON with keys title, rationale, actions. "
        "Each action must use one of: focus, focus-marker, isolate, toggle-layer, annotate, bookmark, show-all, performance-mode."
    )
    user_prompt = json.dumps(
        {
            "prompt": prompt,
            "layers": [layer.model_dump(mode="json") for layer in manifest.layers],
            "hierarchy": [node.model_dump(mode="json") for node in manifest.hierarchy[:24]],
            "markers": [marker.model_dump(mode="json") for marker in (manifest.markers or [])[:12]],
        }
    )
    try:
        remote = await _try_remote_json(system_prompt, user_prompt)
        if not remote:
            return local
        actions = [OperatorActionModel.model_validate(action) for action in remote.get("actions", [])]
        return OperatorResultModel(
            title=remote.get("title", local.title),
            rationale=remote.get("rationale", local.rationale),
            actions=actions or local.actions,
            source="remote-ai",
        )
    except Exception:
        return local
