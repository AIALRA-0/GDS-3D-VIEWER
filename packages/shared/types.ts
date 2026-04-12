export type ScenePanelId = "viewer" | "layers" | "hierarchy" | "explain" | "operator" | "notes";

export type LoadSource = "sample" | "upload" | "remote";

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
  notes: ReviewNote[];
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
  type: "focus" | "isolate" | "toggle-layer" | "annotate";
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

export interface SessionPayload {
  sessionId?: string;
  assetUrl?: string | null;
  manifest: LayoutManifest;
  state: SceneState;
  explain: ExplainResult;
  operator: OperatorResult;
  diff: DiffSummary;
  warnings?: string[];
}
