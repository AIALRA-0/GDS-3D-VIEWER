from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes.ai import router as ai_router
from app.routes.diff import router as diff_router
from app.routes.health import router as health_router
from app.routes.sessions import router as sessions_router
from app.services.session_service import ensure_storage


REPO_ROOT = Path(__file__).resolve().parents[3]
ASSET_ROOT = REPO_ROOT / "apps" / "api" / "data"

ensure_storage()

app = FastAPI(title="ICViewer API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(sessions_router)
app.include_router(ai_router)
app.include_router(diff_router)
app.mount("/review-assets", StaticFiles(directory=ASSET_ROOT), name="review-assets")
