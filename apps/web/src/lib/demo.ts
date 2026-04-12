import type {
  DiffSummary,
  ExplainResult,
  LayoutLayer,
  LayoutManifest,
  LayoutMetrics,
  LayoutNode,
  LoadSource,
  OperatorAction,
  OperatorResult,
  ReviewNote,
  SceneState,
  SessionPayload
} from "../../../../packages/shared/types";

function makeLayers(): LayoutLayer[] {
  return [
    { id: "well", name: "N-Well", color: "#6f7f8c", visible: true, purpose: "Isolation and substrate control", thicknessNm: 180 },
    { id: "poly", name: "Poly", color: "#b56c43", visible: true, purpose: "Gate material and routing seed", thicknessNm: 90 },
    { id: "contact", name: "Contact", color: "#d6b48c", visible: true, purpose: "Via and contact bridges", thicknessNm: 45 },
    { id: "m1", name: "Metal 1", color: "#9da8b3", visible: true, purpose: "Local interconnect", thicknessNm: 120 },
    { id: "m2", name: "Metal 2", color: "#d7c4a4", visible: true, purpose: "Power and macro routing", thicknessNm: 140 }
  ];
}

function makeHierarchy(prefix: string): LayoutNode[] {
  return [
    { id: `${prefix}-top`, name: "top", kind: "chip", childCount: 4, instanceCount: 1280, polygonCount: 18540, bbox: [0, 0, 0, 12000, 7800, 12], focusLayerIds: ["m1", "m2"] },
    { id: `${prefix}-io`, name: "io_ring", kind: "macro", childCount: 8, instanceCount: 224, polygonCount: 3520, bbox: [200, 200, 0, 11800, 7600, 8], focusLayerIds: ["m2"] },
    { id: `${prefix}-core`, name: "core_tile", kind: "macro", childCount: 3, instanceCount: 804, polygonCount: 11600, bbox: [1800, 1600, 0, 10200, 6000, 6], focusLayerIds: ["m1", "m2"] },
    { id: `${prefix}-alu`, name: "alu", kind: "cell", childCount: 2, instanceCount: 96, polygonCount: 1740, bbox: [2500, 2100, 0, 5200, 4100, 4], focusLayerIds: ["poly", "m1"] },
    { id: `${prefix}-ctrl`, name: "control_plane", kind: "cell", childCount: 2, instanceCount: 74, polygonCount: 910, bbox: [5800, 2200, 0, 9000, 4200, 4], focusLayerIds: ["poly", "m1"] },
    { id: `${prefix}-sram`, name: "sram_window", kind: "cell", childCount: 1, instanceCount: 48, polygonCount: 1220, bbox: [2800, 4300, 0, 7700, 6700, 5], focusLayerIds: ["m2"] },
    { id: `${prefix}-io-pad`, name: "io_pad_bank", kind: "leaf", childCount: 0, instanceCount: 32, polygonCount: 440, bbox: [400, 400, 0, 1600, 7200, 3], focusLayerIds: ["contact", "m1"] }
  ];
}

function makeMetrics(layerCount: number): LayoutMetrics {
  return {
    bbox: [0, 0, 0, 12000, 7800, 12],
    cellCount: 48,
    instanceCount: 1280,
    polygonCount: 18540,
    netCount: 920,
    layerCount,
    estimatedAreaMm2: 0.94,
    utilizationPercent: 71.6
  };
}

function buildManifest(id: string, name: string, source: LoadSource, description: string, tags: string[], sourceFiles: string[]): LayoutManifest {
  const layers = makeLayers();
  return {
    id,
    name,
    source,
    format: "bundle",
    technology: "sky130",
    description,
    tags,
    sourceFiles,
    layers,
    hierarchy: makeHierarchy(id),
    metrics: makeMetrics(layers.length),
    notes: [
      "Geometry is normalized for browser review and retains layer provenance.",
      "AI explanations use manifest facts first and fall back to deterministic heuristics.",
      "OpenROAD/Virtuoso interoperability is represented through sidecars, not native databases."
    ],
    generatedAt: new Date().toISOString()
  };
}

function buildNotes(prefix: string): ReviewNote[] {
  return [
    { id: `${prefix}-n1`, author: "Frontend", message: "Review the io ring before routing the next revision.", layerIds: ["m2"], createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: `${prefix}-n2`, author: "Ops", message: "Control plane area looks stable, but the ALU window is a useful demo focus.", layerIds: ["poly", "m1"], createdAt: new Date(Date.now() - 1800000).toISOString() }
  ];
}

function makeExplainResult(manifest: LayoutManifest, prompt: string): ExplainResult {
  const highlightLayers = manifest.layers.filter((layer) => layer.visible).slice(0, 3).map((layer) => layer.name);
  const summary = `${manifest.name} is a ${manifest.technology} review bundle with ${manifest.metrics.cellCount} cells, ${manifest.metrics.instanceCount} instances, and ${manifest.metrics.polygonCount} polygons. ${prompt ? `Prompt focus: ${prompt}` : "The current view emphasizes the control plane, io ring, and macro blocks."}`;
  return {
    summary,
    highlights: [
      `Visible layers: ${highlightLayers.join(", ")}`,
      `Bounding box: ${manifest.metrics.bbox[3]} x ${manifest.metrics.bbox[4]} layout units`,
      `Estimated area: ${manifest.metrics.estimatedAreaMm2.toFixed(2)} mm2`
    ],
    concerns: [
      manifest.metrics.utilizationPercent > 80 ? "Utilization is high enough to warrant congestion review." : "Routing headroom looks healthy for a hackathon demo.",
      "Verify that the layer stack matches the intended stream-out preset before comparing against commercial tool output."
    ],
    nextSteps: [
      "Isolate the ALU or control plane to discuss hierarchy.",
      "Attach any OpenROAD metrics JSON if available.",
      "Save the scene link after your final annotation pass."
    ],
    confidence: 0.84,
    source: "local-rule"
  };
}

function makeOperatorResult(manifest: LayoutManifest, prompt: string): OperatorResult {
  const lower = prompt.toLowerCase();
  const actions: OperatorAction[] = [];

  if (lower.includes("io")) {
    actions.push({ type: "focus", label: "Focus io ring", targetId: manifest.hierarchy.find((node) => node.id.includes("io"))?.id });
    actions.push({ type: "toggle-layer", label: "Surface Metal 2", targetId: "m2" });
  } else if (lower.includes("alu") || lower.includes("arithmetic")) {
    actions.push({ type: "focus", label: "Focus ALU", targetId: manifest.hierarchy.find((node) => node.id.includes("alu"))?.id });
    actions.push({ type: "isolate", label: "Isolate ALU layers", targetId: "m1" });
  } else if (lower.includes("control")) {
    actions.push({ type: "focus", label: "Focus control plane", targetId: manifest.hierarchy.find((node) => node.id.includes("ctrl"))?.id });
    actions.push({ type: "annotate", label: "Add review note", payload: "Control plane is the most presentation-friendly focus for the next pass." });
  } else {
    actions.push({ type: "focus", label: "Focus top hierarchy", targetId: manifest.hierarchy[0]?.id });
    actions.push({ type: "annotate", label: "Add review note", payload: "Continue with a broad review of the top-level layout." });
  }

  return {
    title: "Operator plan",
    rationale: `This operator run turns the prompt into a small set of deterministic viewer actions so the demo stays stable without a remote model. Prompt received: "${prompt || "inspect the current scene"}".`,
    actions,
    source: "local-rule"
  };
}

function makeDiffSummary(current: LayoutManifest, baseline: LayoutManifest): DiffSummary {
  const added = current.layers.filter((layer) => !baseline.layers.some((candidate) => candidate.id === layer.id)).map((layer) => layer.name);
  const removed = baseline.layers.filter((layer) => !current.layers.some((candidate) => candidate.id === layer.id)).map((layer) => layer.name);
  const changed = [
    `Cells: ${baseline.metrics.cellCount} -> ${current.metrics.cellCount}`,
    `Instances: ${baseline.metrics.instanceCount} -> ${current.metrics.instanceCount}`,
    `Polygons: ${baseline.metrics.polygonCount} -> ${current.metrics.polygonCount}`
  ];
  return {
    title: `${current.name} vs ${baseline.name}`,
    added,
    removed,
    changed,
    deltaLines: [
      `Layout area delta: ${(current.metrics.estimatedAreaMm2 - baseline.metrics.estimatedAreaMm2).toFixed(2)} mm2`,
      `Utilization delta: ${(current.metrics.utilizationPercent - baseline.metrics.utilizationPercent).toFixed(1)} points`,
      `Source files: ${current.sourceFiles.length} vs ${baseline.sourceFiles.length}`
    ]
  };
}

function withSource(payload: SessionPayload, source: LoadSource): SessionPayload {
  return {
    ...payload,
    manifest: {
      ...payload.manifest,
      source
    }
  };
}

export function createLocalSessionPayload(files: File[] = []): SessionPayload {
  const sourceFiles = files.length > 0 ? files.map((file) => file.name) : ["design.gds", "design.def", "metrics.json", "manifest.json"];
  const manifest = buildManifest(
    files[0] ? files[0].name.replace(/\.[^.]+$/, "") : "demo-shuttle",
    files[0] ? files[0].name.replace(/\.[^.]+$/, "") : "Skyline Control Plane",
    "upload",
    files.length > 0 ? "Uploaded bundle normalized into the browser cockpit." : "Reference sample bundle for the hackathon demo.",
    files.length > 0 ? ["Upload", "Review", "ICViewer"] : ["OpenROAD", "Hackathon", "Demo"],
    sourceFiles
  );

  const explain = makeExplainResult(manifest, "Generate a concise engineering summary.");
  const operator = makeOperatorResult(manifest, "Focus the best demo area.");
  const diff = makeDiffSummary(manifest, createLocalSessionPayloadReference().manifest);

  return withSource({
    manifest,
    state: {
      panel: "viewer",
      selectedLayerIds: manifest.layers.slice(0, 3).map((layer) => layer.id),
      focusedNodeId: manifest.hierarchy[0]?.id ?? null,
      notes: buildNotes(manifest.id)
    },
    explain,
    operator,
    diff
  }, files.length > 0 ? "upload" : "sample");
}

export function createLocalExplainResult(manifest: LayoutManifest, prompt: string): ExplainResult {
  return makeExplainResult(manifest, prompt);
}

export function createLocalOperatorResult(manifest: LayoutManifest, prompt: string): OperatorResult {
  return makeOperatorResult(manifest, prompt);
}

export function createLocalDiffSummary(current: LayoutManifest, baseline: LayoutManifest): DiffSummary {
  return makeDiffSummary(current, baseline);
}

export function createLocalSessionPayloadReference(): SessionPayload {
  const manifest = buildManifest(
    "reference-shuttle",
    "Reference Shuttle",
    "sample",
    "Baseline sample used for diffing and demo comparison.",
    ["Reference", "Benchmark", "Demo"],
    ["reference.gds", "reference.metrics.json"]
  );

  const explain = makeExplainResult(manifest, "Generate the baseline explanation.");
  const operator = makeOperatorResult(manifest, "Hold the baseline selection.");
  const diff = {
    title: "Reference baseline",
    added: [],
    removed: [],
    changed: [],
    deltaLines: ["This baseline is used as the comparison anchor for the diff panel."]
  };

  return withSource({
    manifest,
    state: {
      panel: "viewer",
      selectedLayerIds: manifest.layers.slice(0, 3).map((layer) => layer.id),
      focusedNodeId: manifest.hierarchy[0]?.id ?? null,
      notes: buildNotes(manifest.id)
    },
    explain,
    operator,
    diff
  }, "sample");
}

export const demoSessions: Array<{ id: string; label: string; session: SessionPayload }> = [
  {
    id: "skyline",
    label: "Skyline Control Plane",
    session: createLocalSessionPayload()
  },
  {
    id: "copper",
    label: "Copper Ridge PLL",
    session: withSource(
      {
        manifest: buildManifest(
          "copper-ridge",
          "Copper Ridge PLL",
          "sample",
          "A more analog-flavored bundle for showing layout review across mixed geometry.",
          ["PLL", "Analog", "Virtuoso"],
          ["pll.gds", "pll.lef", "pll.metrics.json"]
        ),
        state: {
          panel: "viewer",
          selectedLayerIds: ["well", "poly", "m1"],
          focusedNodeId: "copper-ridge-core",
          notes: buildNotes("copper-ridge")
        },
        explain: makeExplainResult(buildManifest("copper-ridge", "Copper Ridge PLL", "sample", "A more analog-flavored bundle for showing layout review across mixed geometry.", ["PLL", "Analog", "Virtuoso"], ["pll.gds", "pll.lef", "pll.metrics.json"]), "Explain the analog review risks."),
        operator: makeOperatorResult(buildManifest("copper-ridge", "Copper Ridge PLL", "sample", "A more analog-flavored bundle for showing layout review across mixed geometry.", ["PLL", "Analog", "Virtuoso"], ["pll.gds", "pll.lef", "pll.metrics.json"]), "Focus the control logic."),
        diff: makeDiffSummary(
          buildManifest("copper-ridge", "Copper Ridge PLL", "sample", "A more analog-flavored bundle for showing layout review across mixed geometry.", ["PLL", "Analog", "Virtuoso"], ["pll.gds", "pll.lef", "pll.metrics.json"]),
          createLocalSessionPayloadReference().manifest
        )
      },
      "sample"
    )
  },
  {
    id: "tiny",
    label: "Tiny Tapeout Tile",
    session: withSource(
      {
        manifest: buildManifest(
          "tiny-tapeout-tile",
          "Tiny Tapeout Tile",
          "sample",
          "Compact synthetic tile that makes hierarchy and note flow easy to demo.",
          ["TinyTapeout", "Synthetic", "Education"],
          ["tile.gds", "tile.json"]
        ),
        state: {
          panel: "viewer",
          selectedLayerIds: ["poly", "m1", "m2"],
          focusedNodeId: "tiny-tapeout-tile-alu",
          notes: buildNotes("tiny-tapeout-tile")
        },
        explain: makeExplainResult(buildManifest("tiny-tapeout-tile", "Tiny Tapeout Tile", "sample", "Compact synthetic tile that makes hierarchy and note flow easy to demo.", ["TinyTapeout", "Synthetic", "Education"], ["tile.gds", "tile.json"]), "Summarize the educational demo tile."),
        operator: makeOperatorResult(buildManifest("tiny-tapeout-tile", "Tiny Tapeout Tile", "sample", "Compact synthetic tile that makes hierarchy and note flow easy to demo.", ["TinyTapeout", "Synthetic", "Education"], ["tile.gds", "tile.json"]), "Isolate the ALU"),
        diff: makeDiffSummary(
          buildManifest("tiny-tapeout-tile", "Tiny Tapeout Tile", "sample", "Compact synthetic tile that makes hierarchy and note flow easy to demo.", ["TinyTapeout", "Synthetic", "Education"], ["tile.gds", "tile.json"]),
          createLocalSessionPayloadReference().manifest
        )
      },
      "sample"
    )
  }
];
