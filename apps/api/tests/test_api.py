from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_sample_session() -> None:
    response = client.get("/api/samples/default")
    assert response.status_code == 200
    payload = response.json()
    assert payload["manifest"]["name"]
    assert payload["manifest"]["layers"]
    assert payload["sessionId"] == "sample-example"


def test_diff_endpoint() -> None:
    sample = client.get("/api/samples/default").json()
    response = client.post("/api/diff", json={"left": sample["manifest"], "right": sample["manifest"]})
    assert response.status_code == 200
    assert "deltaLines" in response.json()


def test_create_session_from_fixture() -> None:
    fixture_path = Path(__file__).resolve().parents[3] / "fixtures" / "example" / "example.gds"
    with fixture_path.open("rb") as handle:
        response = client.post(
            "/api/sessions",
            data={"technology": "sky130"},
            files={"gds": ("example.gds", handle, "application/octet-stream")},
        )
    assert response.status_code == 200
    payload = response.json()
    assert payload["sessionId"]
    assert payload["manifest"]["metrics"]["cellCount"] > 0
