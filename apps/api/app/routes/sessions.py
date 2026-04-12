from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.models import SessionResponseModel
from app.services.session_service import (
    BASE_DIR,
    create_sample_session,
    create_session_from_upload,
    parse_json_upload,
    read_session,
)


router = APIRouter(prefix="/api", tags=["sessions"])


@router.get("/samples/default", response_model=SessionResponseModel)
def sample_session() -> SessionResponseModel:
    return create_sample_session()


@router.get("/sessions/{session_id}", response_model=SessionResponseModel)
def get_session(session_id: str) -> SessionResponseModel:
    try:
        return read_session(session_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@router.post("/sessions", response_model=SessionResponseModel)
async def create_session(
    gds: UploadFile = File(...),
    manifest: UploadFile | None = File(default=None),
    metrics: UploadFile | None = File(default=None),
    def_file: UploadFile | None = File(default=None),
    lef_file: UploadFile | None = File(default=None),
    technology: str = Form(default="sky130"),
) -> SessionResponseModel:
    uploads_dir = BASE_DIR / "apps" / "api" / ".uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    if not gds.filename:
        raise HTTPException(status_code=400, detail="A GDS file is required")

    gds_path = uploads_dir / gds.filename
    gds_bytes = await gds.read()
    if not gds_bytes:
        raise HTTPException(status_code=400, detail="The uploaded GDS file is empty")
    gds_path.write_bytes(gds_bytes)

    manifest_bytes = await manifest.read() if manifest else None
    metrics_bytes = await metrics.read() if metrics else None
    manifest_override = parse_json_upload(manifest_bytes)
    metrics_override = parse_json_upload(metrics_bytes)

    for uploaded, payload in ((manifest, manifest_bytes), (metrics, metrics_bytes)):
        if uploaded and uploaded.filename and payload:
            (uploads_dir / uploaded.filename).write_bytes(payload)

    for uploaded in (def_file, lef_file):
        if uploaded and uploaded.filename:
            payload = await uploaded.read()
            if payload:
                (uploads_dir / uploaded.filename).write_bytes(payload)

    source_files = [gds.filename]
    for uploaded in (manifest, metrics, def_file, lef_file):
        if uploaded and uploaded.filename:
            source_files.append(uploaded.filename)

    return create_session_from_upload(
        gds_path=gds_path,
        technology=technology,
        source_files=source_files,
        manifest_override=manifest_override,
        metrics_override=metrics_override,
    )
