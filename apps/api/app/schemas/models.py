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
    source: str = "gds"


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
    wirelengthUm: float = 0.0
    negativeSlackNs: float = 0.0


class MarkerModel(BaseModel):
    id: str
    title: str
    message: str = ""
    severity: Literal["info", "warning", "critical"] = "info"
    category: str = "review"
    position: list[float] = Field(default_factory=lambda: [0, 0, 0])
    bbox: list[float] | None = None
    focusLayerIds: list[str] = Field(default_factory=list)
    nodeId: str | None = None


class CameraStateModel(BaseModel):
    position: list[float] = Field(default_factory=lambda: [12.0, 11.0, 16.0])
    target: list[float] = Field(default_factory=lambda: [0.0, 1.2, 0.0])


class BookmarkModel(BaseModel):
    id: str
    name: str
    camera: CameraStateModel = Field(default_factory=CameraStateModel)
    selectedLayerIds: list[str] = Field(default_factory=list)
    focusedNodeId: str | None = None
    note: str | None = None
    createdAt: str


class SelectionMetadataModel(BaseModel):
    id: str | None = None
    name: str | None = None
    kind: str | None = None
    bbox: list[float] | None = None
    focusLayerIds: list[str] = Field(default_factory=list)
    polygonCount: int = 0
    instanceCount: int = 0
    markerId: str | None = None


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
    markers: list[MarkerModel] = Field(default_factory=list)
    bookmarks: list[BookmarkModel] = Field(default_factory=list)
    generatedAt: str


class ReviewNoteModel(BaseModel):
    id: str
    author: str
    message: str
    layerIds: list[str] = Field(default_factory=list)
    createdAt: str


class ExplainResultModel(BaseModel):
    summary: str
    highlights: list[str]
    concerns: list[str]
    nextSteps: list[str]
    confidence: float
    source: Literal["local-rule", "remote-ai"]


class OperatorActionModel(BaseModel):
    type: Literal[
        "focus",
        "focus-marker",
        "isolate",
        "toggle-layer",
        "annotate",
        "bookmark",
        "show-all",
        "performance-mode",
    ]
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


class ExportMetadataModel(BaseModel):
    formatVersion: str = "gds-3d-viewer-session-v1"
    exportedAt: str
    exportedBy: str = "GDS-3D-VIEWER"
    sourceSessionId: str | None = None


class SessionStateModel(BaseModel):
    panel: str = "viewer"
    selectedLayerIds: list[str] = Field(default_factory=list)
    focusedNodeId: str | None = None
    selectedMarkerId: str | None = None
    notes: list[ReviewNoteModel] = Field(default_factory=list)
    bookmarks: list[BookmarkModel] = Field(default_factory=list)
    performanceMode: Literal["full", "simplified", "hierarchy-preview"] = "full"
    camera: CameraStateModel = Field(default_factory=CameraStateModel)
    selectionMetadata: SelectionMetadataModel | None = None


class SessionResponseModel(BaseModel):
    sessionId: str
    assetUrl: str | None = None
    manifest: ManifestModel
    state: SessionStateModel = Field(default_factory=SessionStateModel)
    explain: ExplainResultModel
    operator: OperatorResultModel
    diff: DiffSummaryModel
    warnings: list[str] = Field(default_factory=list)
    exportMetadata: ExportMetadataModel | None = None


class SampleSummaryModel(BaseModel):
    id: str
    sessionId: str
    name: str
    description: str
    technology: str
    tags: list[str] = Field(default_factory=list)
    sourceFiles: list[str] = Field(default_factory=list)
    generatedAt: str


class ExplainRequestModel(BaseModel):
    manifest: ManifestModel
    prompt: str | None = None


class CommandRequestModel(BaseModel):
    manifest: ManifestModel
    prompt: str


class DiffRequestModel(BaseModel):
    left: ManifestModel
    right: ManifestModel


class ExportRequestModel(BaseModel):
    session: SessionResponseModel
