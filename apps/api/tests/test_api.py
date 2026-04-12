from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
FIXTURE_ROOT = Path(__file__).resolve().parents[3] / "fixtures"


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_sample_inventory_and_default_session() -> None:
    samples = client.get("/api/samples")
    assert samples.status_code == 200
    payload = samples.json()
    assert any(entry["id"] == "default" for entry in payload)
    assert any(entry["id"] == "openroad-demo" for entry in payload)

    response = client.get("/api/samples/default")
    assert response.status_code == 200
    session = response.json()
    assert session["manifest"]["name"]
    assert session["manifest"]["layers"]
    assert session["sessionId"] == "sample-default"
    assert session["state"]["bookmarks"]


def test_openroad_sample_has_sidecars_and_markers() -> None:
    response = client.get("/api/samples/openroad-demo")
    assert response.status_code == 200
    payload = response.json()
    assert payload["manifest"]["technology"] == "openroad-sky130"
    assert payload["manifest"]["markers"]
    assert payload["manifest"]["metrics"]["wirelengthUm"] > 0


def test_diff_endpoint() -> None:
    left = client.get("/api/samples/default").json()
    right = client.get("/api/samples/openroad-demo").json()
    response = client.post("/api/diff", json={"left": left["manifest"], "right": right["manifest"]})
    assert response.status_code == 200
    assert "Markers" in "\n".join(response.json()["deltaLines"])


def test_create_session_from_fixture_bundle_and_export() -> None:
    fixture_path = FIXTURE_ROOT / "example" / "example.gds"
    manifest_path = FIXTURE_ROOT / "compat" / "openroad-manifest.json"
    metrics_path = FIXTURE_ROOT / "compat" / "openroad-metrics.json"
    markers_path = FIXTURE_ROOT / "compat" / "openroad-markers.json"

    with (
        fixture_path.open("rb") as gds_handle,
        manifest_path.open("rb") as manifest_handle,
        metrics_path.open("rb") as metrics_handle,
        markers_path.open("rb") as markers_handle,
    ):
        response = client.post(
            "/api/sessions",
            data={"technology": "openroad-sky130"},
            files={
                "gds": ("example.gds", gds_handle, "application/octet-stream"),
                "manifest": ("openroad-manifest.json", manifest_handle, "application/json"),
                "metrics": ("openroad-metrics.json", metrics_handle, "application/json"),
                "markers": ("openroad-markers.json", markers_handle, "application/json"),
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["sessionId"]
    assert payload["manifest"]["metrics"]["cellCount"] > 0
    assert payload["manifest"]["markers"]

    exported = client.post("/api/export", json={"session": payload})
    assert exported.status_code == 200
    assert exported.headers["content-disposition"].endswith(".json\"")
    assert "sourceSessionId" in exported.text


def test_create_session_from_gds_only() -> None:
    fixture_path = FIXTURE_ROOT / "example" / "example.gds"

    with fixture_path.open("rb") as gds_handle:
        response = client.post(
            "/api/sessions",
            data={"technology": "sky130"},
            files={"gds": ("example.gds", gds_handle, "application/octet-stream")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["manifest"]["format"] == "gds"
    assert payload["manifest"]["layers"]
    assert payload["manifest"]["bookmarks"]


def test_create_session_rejects_empty_gds() -> None:
    response = client.post(
        "/api/sessions",
        data={"technology": "sky130"},
        files={"gds": ("empty.gds", b"", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_ai_fallback_endpoints() -> None:
    session = client.get("/api/samples/default").json()

    explain = client.post("/api/explain", json={"manifest": session["manifest"], "prompt": "Summarize"})
    assert explain.status_code == 200
    assert explain.json()["source"] == "local-rule"

    command = client.post("/api/command", json={"manifest": session["manifest"], "prompt": "Save a bookmark"})
    assert command.status_code == 200
    assert command.json()["actions"]
