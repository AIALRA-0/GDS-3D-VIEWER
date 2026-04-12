from __future__ import annotations

from app.schemas.models import SessionResponseModel
from app.services.session_service import DEFAULT_SAMPLE_ID, create_sample_session


def load_sample_payload() -> SessionResponseModel:
    return create_sample_session(DEFAULT_SAMPLE_ID)
