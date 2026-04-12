from __future__ import annotations

import json
from pathlib import Path

from app.schemas.models import SessionResponseModel


BASE_DIR = Path(__file__).resolve().parents[4]
FIXTURE_DIR = BASE_DIR / "fixtures" / "example"


def load_sample_payload() -> SessionResponseModel:
    example_gds = FIXTURE_DIR / "example.gds"
    if example_gds.exists():
        from app.services.ai_service import build_local_command, build_local_explain
        from app.services.diff_service import build_diff
        from app.services.session_service import inspect_gds_file

        manifest_model = inspect_gds_file(example_gds, "sky130", ["fixtures/example/example.gds"])
        manifest_model.id = "example"
        manifest_model.source = "sample"
        manifest_model.tags = list(dict.fromkeys([*manifest_model.tags, "sample", "tiny-tapeout", "fixture"]))
        explain = build_local_explain(manifest_model)
        operator = build_local_command(manifest_model, "Focus the most presentation-friendly macro.")
        diff = build_diff(manifest_model, manifest_model)
        return SessionResponseModel(
            sessionId="sample-example",
            assetUrl=None,
            manifest=manifest_model,
            state={
                "panel": "viewer",
                "selectedLayerIds": [layer.id for layer in manifest_model.layers[:3]],
                "focusedNodeId": manifest_model.hierarchy[0].id if manifest_model.hierarchy else None,
                "notes": [],
            },
            explain=explain,
            operator=operator,
            diff=diff,
            warnings=[],
        )

    manifest_path = FIXTURE_DIR / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError("Sample fixture manifest was not found")

    with manifest_path.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    return SessionResponseModel.model_validate(
        {
            "sessionId": "sample-example",
            "assetUrl": None,
            "manifest": manifest,
            "state": {
                "panel": "viewer",
                "selectedLayerIds": [layer["id"] for layer in manifest.get("layers", [])[:3]],
                "focusedNodeId": manifest.get("hierarchy", [{}])[0].get("id") if manifest.get("hierarchy") else None,
                "notes": [],
            },
            "explain": {
                "summary": "Sample fixture session loaded from the bundled TinyTapeout example.",
                "highlights": [
                    f"Technology preset: {manifest.get('technology', 'generic')}",
                    f"Tracked layers: {len(manifest.get('layers', []))}",
                    f"Source files: {', '.join(manifest.get('sourceFiles', []))}",
                ],
                "concerns": [
                    "This sample uses procedural rendering until a converted glTF asset is generated.",
                    "Attach sidecars for richer OpenROAD or Virtuoso-export context.",
                ],
                "nextSteps": [
                    "Upload a real bundle to exercise the converter.",
                    "Try the operator panel to isolate a layer or add a note.",
                ],
                "confidence": 0.61,
                "source": "local-rule",
            },
            "operator": {
                "title": "Sample operator plan",
                "rationale": "The bundled fixture uses deterministic actions so the demo stays stable offline.",
                "actions": [
                    {"type": "focus", "label": "Focus top cell", "targetId": manifest.get("hierarchy", [{}])[0].get("id")},
                    {"type": "annotate", "label": "Add fixture note", "payload": "Sample fixture loaded successfully."},
                ],
                "source": "local-rule",
            },
            "diff": {
                "title": "Fixture baseline",
                "added": [],
                "removed": [],
                "changed": [],
                "deltaLines": ["This fixture acts as the baseline comparison bundle."],
            },
            "warnings": [],
        }
    )
