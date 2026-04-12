from fastapi import APIRouter

from app.schemas.models import DiffRequestModel, DiffSummaryModel
from app.services.diff_service import build_diff


router = APIRouter(prefix="/api", tags=["diff"])


@router.post("/diff", response_model=DiffSummaryModel)
def diff(request: DiffRequestModel) -> DiffSummaryModel:
    return build_diff(request.left, request.right)
