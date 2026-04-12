from fastapi import APIRouter

from app.schemas.models import (
    CommandRequestModel,
    ExplainRequestModel,
    ExplainResultModel,
    OperatorResultModel,
)
from app.services.ai_service import build_command, build_explain


router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/explain", response_model=ExplainResultModel)
async def explain(request: ExplainRequestModel) -> ExplainResultModel:
    return await build_explain(request.manifest, request.prompt)


@router.post("/command", response_model=OperatorResultModel)
async def command(request: CommandRequestModel) -> OperatorResultModel:
    return await build_command(request.manifest, request.prompt)
