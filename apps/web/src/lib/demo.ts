import type {
  DiffSummary,
  ExplainResult,
  LayoutManifest,
  OperatorResult,
  SampleSummary,
  SceneState,
  SessionPayload
} from "../../../../packages/shared/types";

const fallbackManifest: LayoutManifest = {
  id: "fallback-demo",
  name: "Fallback Demo",
  source: "sample",
  format: "bundle",
  technology: "sky130",
  description: "Local fallback payload kept only as a compile-time safety net.",
  tags: ["fallback"],
  sourceFiles: ["fallback.gds"],
  layers: [
    { id: "m1", name: "Metal 1", color: "#9da8b3", visible: true, purpose: "routing", thicknessNm: 120 },
    { id: "m2", name: "Metal 2", color: "#d7c4a4", visible: true, purpose: "power", thicknessNm: 140 }
  ],
  hierarchy: [
    {
      id: "fallback-top",
      name: "top",
      kind: "chip",
      childCount: 0,
      instanceCount: 32,
      polygonCount: 240,
      bbox: [0, 0, 0, 1200, 900, 10],
      focusLayerIds: ["m1", "m2"]
    }
  ],
  metrics: {
    bbox: [0, 0, 0, 1200, 900, 10],
    cellCount: 1,
    instanceCount: 32,
    polygonCount: 240,
    netCount: 16,
    layerCount: 2,
    estimatedAreaMm2: 0.01,
    utilizationPercent: 48
  },
  notes: [],
  markers: [],
  bookmarks: [],
  generatedAt: new Date().toISOString()
};

const fallbackState: SceneState = {
  panel: "viewer",
  selectedLayerIds: ["m1", "m2"],
  focusedNodeId: "fallback-top",
  selectedMarkerId: null,
  notes: [],
  bookmarks: [
    {
      id: "bookmark-overview",
      name: "Overview",
      camera: { position: [12, 11, 16], target: [0, 1.2, 0] },
      selectedLayerIds: ["m1", "m2"],
      focusedNodeId: "fallback-top",
      note: "Fallback overview",
      createdAt: new Date().toISOString()
    }
  ],
  performanceMode: "full",
  camera: { position: [12, 11, 16], target: [0, 1.2, 0] },
  selectionMetadata: {
    id: "fallback-top",
    name: "top",
    kind: "chip",
    bbox: [0, 0, 0, 1200, 900, 10],
    focusLayerIds: ["m1", "m2"],
    polygonCount: 240,
    instanceCount: 32,
    markerId: null
  }
};

const fallbackExplain: ExplainResult = {
  summary: "Fallback explanation generated locally.",
  highlights: ["Fallback mode is only used if the backend bootstrap fails."],
  concerns: ["Use the backend-backed sessions for the real demo path."],
  nextSteps: ["Restore backend connectivity."],
  confidence: 0.2,
  source: "local-rule"
};

const fallbackOperator: OperatorResult = {
  title: "Fallback operator",
  rationale: "Local fallback action set.",
  actions: [{ type: "focus", label: "Focus top", targetId: "fallback-top" }],
  source: "local-rule"
};

const fallbackDiff: DiffSummary = {
  title: "Fallback baseline",
  added: [],
  removed: [],
  changed: [],
  deltaLines: ["Fallback diff only."]
};

export function createLocalSessionPayload(): SessionPayload {
  return {
    sessionId: "fallback-demo",
    assetUrl: null,
    manifest: fallbackManifest,
    state: fallbackState,
    explain: fallbackExplain,
    operator: fallbackOperator,
    diff: fallbackDiff,
    warnings: ["Backend unavailable. Fallback payload loaded."]
  };
}

export function createLocalExplainResult(): ExplainResult {
  return fallbackExplain;
}

export function createLocalOperatorResult(): OperatorResult {
  return fallbackOperator;
}

export function createLocalDiffSummary(): DiffSummary {
  return fallbackDiff;
}

export function createLocalSessionPayloadReference(): SessionPayload {
  return createLocalSessionPayload();
}

export const demoSessions: Array<{ id: string; label: string; session: SessionPayload }> = [
  { id: "fallback", label: "Fallback Demo", session: createLocalSessionPayload() }
];

export const demoSamples: SampleSummary[] = [
  {
    id: "fallback",
    sessionId: "fallback-demo",
    name: "Fallback Demo",
    description: fallbackManifest.description,
    technology: fallbackManifest.technology,
    tags: fallbackManifest.tags,
    sourceFiles: fallbackManifest.sourceFiles,
    generatedAt: fallbackManifest.generatedAt
  }
];
