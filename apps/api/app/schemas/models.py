from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class LayerModel(BaseModel):
    id: str
    name: str
    color: str
    visible: bool = True
    purpose: str = "drawing"
    thicknessNm: int = 100
    gdsLayer: int = 0
    datatype: int = 0
    polygonCount: int = 0


class HierarchyNodeModel(BaseModel):
    id: str
    name: str
    kind: Literal["chip", "macro", "cell", "leaf"]
    childCount: int = 0
    instanceCount: int = 0
    polygonCount: int = 0
    bbox: list[float] = Field(default_factory=lambda: [0, 0, 0, 0, 0, 0])
    focusLayerIds: list[str] = Field(default_factory=list)


class MetricsModel(BaseModel):
    bbox: list[float] = Field(default_factory=lambda: [0, 0, 0, 0, 0, 0])
    cellCount: int = 0
    instanceCount: int = 0
    polygonCount: int = 0
    netCount: int = 0
    layerCount: int = 0
    estimatedAreaMm2: float = 0.0
    utilizationPercent: float = 0.0


class ManifestModel(BaseModel):
    id: str
    name: str
    source: Literal["sample", "upload", "remote"]
    format: Literal["gds", "gltf", "bundle"]
    technology: str = "generic"
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    sourceFiles: list[str] = Field(default_factory=list)
    layers: list[LayerModel] = Field(default_factory=list)
    hierarchy: list[HierarchyNodeModel] = Field(default_factory=list)
    metrics: MetricsModel = Field(default_factory=MetricsModel)
    notes: list[str] = Field(default_factory=list)
    generatedAt: str


class ExplainResultModel(BaseModel):
    summary: str
    highlights: list[str]
    concerns: list[str]
    nextSteps: list[str]
    confidence: float
    source: Literal["local-rule", "remote-ai"]


class OperatorActionModel(BaseModel):
    type: Literal["focus", "isolate", "toggle-layer", "annotate"]
    label: str
    targetId: str | None = None
    payload: str | None = None


class OperatorResultModel(BaseModel):
    title: str
    rationale: str
    actions: list[OperatorActionModel]
    source: Literal["local-rule", "remote-ai"]


class DiffSummaryModel(BaseModel):
    title: str
    added: list[str] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)
    changed: list[str] = Field(default_factory=list)
    deltaLines: list[str] = Field(default_factory=list)


class SessionStateModel(BaseModel):
    panel: str = "viewer"
    selectedLayerIds: list[str] = Field(default_factory=list)
    focusedNodeId: str | None = None
    notes: list[dict] = Field(default_factory=list)


class SessionResponseModel(BaseModel):
    sessionId: str
    assetUrl: str | None = None
    manifest: ManifestModel
    state: SessionStateModel = Field(default_factory=SessionStateModel)
    explain: ExplainResultModel
    operator: OperatorResultModel
    diff: DiffSummaryModel
    warnings: list[str] = Field(default_factory=list)


class ExplainRequestModel(BaseModel):
    manifest: ManifestModel
    prompt: str | None = None


class CommandRequestModel(BaseModel):
    manifest: ManifestModel
    prompt: str


class DiffRequestModel(BaseModel):
    left: ManifestModel
    right: ManifestModel
