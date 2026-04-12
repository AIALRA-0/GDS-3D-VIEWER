from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from app.schemas.models import ExportRequestModel, SampleSummaryModel, SessionResponseModel
from app.services.session_service import (
    DEFAULT_SAMPLE_ID,
    create_sample_session,
    create_session_from_upload,
    export_session,
    list_sample_summaries,
    parse_json_upload,
    read_session,
)


router = APIRouter(prefix="/api", tags=["sessions"])


@router.get("/samples", response_model=list[SampleSummaryModel])
def list_samples() -> list[SampleSummaryModel]:
    return list_sample_summaries()


@router.get("/samples/default", response_model=SessionResponseModel)
def sample_session() -> SessionResponseModel:
    return create_sample_session(DEFAULT_SAMPLE_ID)


@router.get("/samples/{sample_id}", response_model=SessionResponseModel)
def get_sample_session(sample_id: str) -> SessionResponseModel:
    try:
        return create_sample_session(sample_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Sample not found") from exc


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
    markers: UploadFile | None = File(default=None),
    def_file: UploadFile | None = File(default=None),
    lef_file: UploadFile | None = File(default=None),
    technology: str = Form(default="sky130"),
) -> SessionResponseModel:
    if not gds.filename:
        raise HTTPException(status_code=400, detail="A GDS file is required")

    gds_bytes = await gds.read()
    if not gds_bytes:
        raise HTTPException(status_code=400, detail="The uploaded GDS file is empty")

    manifest_bytes = await manifest.read() if manifest else None
    metrics_bytes = await metrics.read() if metrics else None
    markers_bytes = await markers.read() if markers else None

    manifest_override, manifest_warnings = parse_json_upload(manifest_bytes, manifest.filename or "manifest")
    metrics_override, metrics_warnings = parse_json_upload(metrics_bytes, metrics.filename or "metrics")
    markers_override, marker_warnings = parse_json_upload(markers_bytes, markers.filename or "markers")

    uploaded_files: dict[str, bytes] = {gds.filename: gds_bytes}
    for uploaded, payload in (
        (manifest, manifest_bytes),
        (metrics, metrics_bytes),
        (markers, markers_bytes),
    ):
        if uploaded and uploaded.filename and payload:
            uploaded_files[uploaded.filename] = payload

    for uploaded in (def_file, lef_file):
        if uploaded and uploaded.filename:
            payload = await uploaded.read()
            if payload:
                uploaded_files[uploaded.filename] = payload

    response = create_session_from_upload(
        uploaded_files=uploaded_files,
        technology=technology,
        manifest_override=manifest_override,
        metrics_override=metrics_override,
        markers_override=markers_override,
    )
    response.warnings.extend([*manifest_warnings, *metrics_warnings, *marker_warnings])
    return response


@router.post("/export")
def export(request: ExportRequestModel) -> Response:
    filename, raw = export_session(request.session)
    return Response(
        content=raw,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
