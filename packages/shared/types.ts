export type ScenePanelId =
  | "viewer"
  | "layers"
  | "hierarchy"
  | "metrics"
  | "markers"
  | "explain"
  | "operator"
  | "notes"
  | "bookmarks"
  | "diff";

export type LoadSource = "sample" | "upload" | "remote";
export type MarkerSeverity = "info" | "warning" | "critical";
export type PerformanceMode = "full" | "simplified" | "hierarchy-preview";

export interface LayoutLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  purpose: string;
  thicknessNm: number;
  gdsLayer?: number;
  datatype?: number;
  polygonCount?: number;
  source?: string;
}

export interface LayoutNode {
  id: string;
  name: string;
  kind: "chip" | "macro" | "cell" | "leaf";
  childCount: number;
  instanceCount: number;
  polygonCount: number;
  bbox: [number, number, number, number, number, number];
  focusLayerIds: string[];
}

export interface LayoutMetrics {
  bbox: [number, number, number, number, number, number];
  cellCount: number;
  instanceCount: number;
  polygonCount: number;
  netCount: number;
  layerCount: number;
  estimatedAreaMm2: number;
  utilizationPercent: number;
  wirelengthUm?: number;
  negativeSlackNs?: number;
}

export interface ReviewMarker {
  id: string;
  title: string;
  message: string;
  severity: MarkerSeverity;
  category: string;
  position: [number, number, number];
  bbox?: [number, number, number, number, number, number] | null;
  focusLayerIds: string[];
  nodeId?: string | null;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface SceneBookmark {
  id: string;
  name: string;
  camera: CameraState;
  selectedLayerIds: string[];
  focusedNodeId?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface SelectionMetadata {
  id?: string | null;
  name?: string | null;
  kind?: string | null;
  bbox?: [number, number, number, number, number, number] | null;
  focusLayerIds?: string[];
  polygonCount?: number;
  instanceCount?: number;
  markerId?: string | null;
}

export interface LayoutManifest {
  id: string;
  name: string;
  source: LoadSource;
  format: "gds" | "gltf" | "bundle";
  technology: string;
  description: string;
  tags: string[];
  sourceFiles: string[];
  layers: LayoutLayer[];
  hierarchy: LayoutNode[];
  metrics: LayoutMetrics;
  notes: string[];
  markers?: ReviewMarker[];
  bookmarks?: SceneBookmark[];
  generatedAt: string;
}

export interface ReviewNote {
  id: string;
  author: string;
  message: string;
  layerIds: string[];
  createdAt: string;
}

export interface SceneState {
  panel: ScenePanelId;
  selectedLayerIds: string[];
  focusedNodeId: string | null;
  selectedMarkerId?: string | null;
  notes: ReviewNote[];
  bookmarks: SceneBookmark[];
  performanceMode: PerformanceMode;
  camera: CameraState;
  selectionMetadata?: SelectionMetadata | null;
}

export interface ExplainResult {
  summary: string;
  highlights: string[];
  concerns: string[];
  nextSteps: string[];
  confidence: number;
  source: "local-rule" | "remote-ai";
}

export interface OperatorAction {
  type:
    | "focus"
    | "focus-marker"
    | "isolate"
    | "toggle-layer"
    | "annotate"
    | "bookmark"
    | "show-all"
    | "performance-mode";
  label: string;
  targetId?: string;
  payload?: string;
}

export interface OperatorResult {
  title: string;
  rationale: string;
  actions: OperatorAction[];
  source: "local-rule" | "remote-ai";
}

export interface DiffSummary {
  title: string;
  added: string[];
  removed: string[];
  changed: string[];
  deltaLines: string[];
}

export interface ExportMetadata {
  formatVersion: string;
  exportedAt: string;
  exportedBy: string;
  sourceSessionId?: string | null;
}

export interface SessionPayload {
  sessionId: string;
  assetUrl?: string | null;
  manifest: LayoutManifest;
  state: SceneState;
  explain: ExplainResult;
  operator: OperatorResult;
  diff: DiffSummary;
  warnings?: string[];
  exportMetadata?: ExportMetadata | null;
}

export interface SampleSummary {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  technology: string;
  tags: string[];
  sourceFiles: string[];
  generatedAt: string;
}
