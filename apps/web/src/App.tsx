import { useEffect, useMemo, useRef, useState } from "react";
import SceneViewer from "./components/SceneViewer";
import {
  buildDiffSummary,
  createSessionFromFiles,
  explainLayout,
  exportSessionPayload,
  loadDefaultSession,
  loadSampleSession,
  loadSamples,
  runOperator
} from "./lib/api";
import { readBundleHintFromUrl, readSceneStateFromUrl, writeSceneStateToUrl } from "./lib/url";
import type {
  CameraState,
  DiffSummary,
  ExplainResult,
  LayoutManifest,
  LayoutNode,
  OperatorAction,
  OperatorResult,
  PerformanceMode,
  ReviewMarker,
  ReviewNote,
  SampleSummary,
  SceneBookmark,
  ScenePanelId,
  SceneState,
  SelectionMetadata,
  SessionPayload
} from "../../../packages/shared/types";

type BusyState = "idle" | "loading" | "uploading" | "explaining" | "operating" | "exporting";
type ViewerAction =
  | { id: number; type: "fit"; payload?: { nodeId?: string | null; markerId?: string | null } }
  | { id: number; type: "reset" }
  | { id: number; type: "restore-camera"; payload: CameraState }
  | { id: number; type: "focus-marker"; payload: { markerId: string } };

const DEFAULT_CAMERA: CameraState = {
  position: [12, 11, 16],
  target: [0, 1.2, 0]
};
const BUILD_STAMP = "2026-04-12T19:11Z";

const PANEL_TABS: ScenePanelId[] = [
  "viewer",
  "layers",
  "hierarchy",
  "metrics",
  "markers",
  "explain",
  "operator",
  "notes",
  "bookmarks",
  "diff"
];

function panelLabel(panel: ScenePanelId): string {
  switch (panel) {
    case "viewer":
      return "Viewer";
    case "layers":
      return "Layers";
    case "hierarchy":
      return "Hierarchy";
    case "metrics":
      return "Metrics";
    case "markers":
      return "Markers";
    case "explain":
      return "Explain";
    case "operator":
      return "Operator";
    case "notes":
      return "Notes";
    case "bookmarks":
      return "Bookmarks";
    case "diff":
      return "Diff";
  }
}

function formatNumber(value: number | undefined): string {
  if (typeof value !== "number") {
    return "0";
  }
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function buildSelectionFromNode(node: LayoutNode | undefined): SelectionMetadata | null {
  if (!node) {
    return null;
  }
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    bbox: node.bbox,
    focusLayerIds: node.focusLayerIds,
    polygonCount: node.polygonCount,
    instanceCount: node.instanceCount,
    markerId: null
  };
}

function buildSelectionFromMarker(marker: ReviewMarker | undefined): SelectionMetadata | null {
  if (!marker) {
    return null;
  }
  return {
    id: marker.nodeId ?? marker.id,
    name: marker.title,
    kind: marker.category,
    bbox: marker.bbox ?? null,
    focusLayerIds: marker.focusLayerIds,
    polygonCount: 0,
    instanceCount: 0,
    markerId: marker.id
  };
}

function materializeManifest(session: SessionPayload, sceneState: SceneState): LayoutManifest {
  return {
    ...session.manifest,
    bookmarks: sceneState.bookmarks
  };
}

function materializeSession(
  session: SessionPayload,
  sceneState: SceneState,
  explain: ExplainResult,
  operator: OperatorResult,
  diff: DiffSummary
): SessionPayload {
  return {
    ...session,
    manifest: materializeManifest(session, sceneState),
    state: sceneState,
    explain,
    operator,
    diff
  };
}

function createBookmarkLabel(manifest: LayoutManifest, count: number): string {
  return `${manifest.name.split(" ")[0]} view ${count + 1}`;
}

function createSceneState(session: SessionPayload): SceneState {
  const selectedLayerIds =
    session.state.selectedLayerIds?.length > 0
      ? session.state.selectedLayerIds
      : session.manifest.layers.filter((layer) => layer.visible).slice(0, 4).map((layer) => layer.id);
  const focusedNodeId = session.state.focusedNodeId ?? session.manifest.hierarchy[0]?.id ?? null;
  const selectedMarkerId = session.state.selectedMarkerId ?? session.manifest.markers?.[0]?.id ?? null;
  const bookmarks =
    session.state.bookmarks?.length > 0
      ? session.state.bookmarks
      : session.manifest.bookmarks?.length
        ? session.manifest.bookmarks
        : [
            {
              id: "bookmark-overview",
              name: "Overview",
              camera: DEFAULT_CAMERA,
              selectedLayerIds,
              focusedNodeId,
              note: "Default review anchor.",
              createdAt: new Date().toISOString()
            }
          ];
  const selectedNode = session.manifest.hierarchy.find((node) => node.id === focusedNodeId);
  const selectedMarker = session.manifest.markers?.find((marker) => marker.id === selectedMarkerId);
  return {
    panel: session.state.panel ?? "viewer",
    selectedLayerIds,
    focusedNodeId,
    selectedMarkerId,
    notes: session.state.notes ?? [],
    bookmarks,
    performanceMode: session.state.performanceMode ?? "full",
    camera: session.state.camera ?? DEFAULT_CAMERA,
    selectionMetadata:
      session.state.selectionMetadata ??
      buildSelectionFromMarker(selectedMarker) ??
      buildSelectionFromNode(selectedNode) ??
      null
  };
}

function hasScenePayload(session: SessionPayload | null): session is SessionPayload {
  return Boolean(session);
}

export default function App() {
  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [sceneState, setSceneState] = useState<SceneState | null>(null);
  const [referenceManifest, setReferenceManifest] = useState<LayoutManifest | null>(null);
  const [explainPrompt, setExplainPrompt] = useState("Summarize the strongest engineering story in this layout.");
  const [operatorPrompt, setOperatorPrompt] = useState("Focus the control plane, save a bookmark, and suggest the best demo path.");
  const [reviewDraft, setReviewDraft] = useState("");
  const [bookmarkDraft, setBookmarkDraft] = useState("");
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);
  const [operatorResult, setOperatorResult] = useState<OperatorResult | null>(null);
  const [diffResult, setDiffResult] = useState<DiffSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState("Booting ICViewer cockpit.");
  const [busyState, setBusyState] = useState<BusyState>("loading");
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewerAction, setViewerAction] = useState<ViewerAction | null>(null);
  const bootstrappedRef = useRef(false);

  const selectedNode = useMemo(() => {
    if (!session || !sceneState) {
      return null;
    }
    return session.manifest.hierarchy.find((node) => node.id === sceneState.focusedNodeId) ?? session.manifest.hierarchy[0] ?? null;
  }, [session, sceneState]);

  const selectedMarker = useMemo(() => {
    if (!session || !sceneState) {
      return null;
    }
    return session.manifest.markers?.find((marker) => marker.id === sceneState.selectedMarkerId) ?? null;
  }, [session, sceneState]);

  const viewerManifest = useMemo(() => {
    return session?.manifest ?? null;
  }, [session]);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;

    async function bootstrap() {
      try {
        const [sampleInventory, defaultSession] = await Promise.all([loadSamples(), loadDefaultSession()]);

        const hintedBundle = readBundleHintFromUrl();
        const shouldLoadHint = hintedBundle && sampleInventory.some((entry) => entry.id === hintedBundle);
        const currentSession = shouldLoadHint ? await loadSampleSession(hintedBundle) : defaultSession;

        const defaultState = createSceneState(currentSession);
        const nextState = readSceneStateFromUrl(defaultState);
        setSamples(sampleInventory);
        setReferenceManifest(materializeManifest(defaultSession, createSceneState(defaultSession)));
        setSession(currentSession);
        setSceneState(nextState);
        setExplainResult(currentSession.explain);
        setOperatorResult(currentSession.operator);
        setDiffResult(currentSession.diff);
        setBusyState("idle");
        setStatusMessage(`Loaded backend session: ${currentSession.manifest.name}.`);
        setErrorMessage(null);
      } catch (error) {
        setBusyState("idle");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load ICViewer.");
        setStatusMessage("Backend bootstrap failed.");
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!session || !sceneState) {
      return;
    }

    const onPopState = () => {
      setSceneState((current) => (current ? readSceneStateFromUrl({ ...current }) : current));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [session, sceneState]);

  useEffect(() => {
    if (!session || !sceneState) {
      return;
    }
    writeSceneStateToUrl(sceneState, {
      bundle: samples.some((entry) => entry.sessionId === session.sessionId)
        ? samples.find((entry) => entry.sessionId === session.sessionId)?.id ?? session.manifest.id
        : session.manifest.id
    });
  }, [samples, sceneState, session]);

  useEffect(() => {
    if (!session || !sceneState || !referenceManifest) {
      return;
    }

    let active = true;
    const currentManifest = materializeManifest(session, sceneState);
    void buildDiffSummary(currentManifest, referenceManifest)
      .then((result) => {
        if (active) {
          setDiffResult(result);
        }
      })
      .catch(() => {
        if (active && session.diff) {
          setDiffResult(session.diff);
        }
      });

    return () => {
      active = false;
    };
  }, [referenceManifest, sceneState?.bookmarks, session]);

  async function loadResolvedSession(nextSession: SessionPayload, label: string) {
    const nextState = readSceneStateFromUrl(createSceneState(nextSession));
    setSession(nextSession);
    setSceneState(nextState);
    setExplainResult(nextSession.explain);
    setOperatorResult(nextSession.operator);
    setDiffResult(nextSession.diff);
    setStatusMessage(label);
    setErrorMessage(null);
  }

  async function handleSampleLoad(sampleId: string) {
    setBusyState("loading");
    try {
      const nextSession = await loadSampleSession(sampleId);
      await loadResolvedSession(nextSession, `Loaded sample bundle: ${nextSession.manifest.name}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load sample.");
      setStatusMessage("Sample load failed.");
    } finally {
      setBusyState("idle");
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setBusyState("uploading");
    try {
      const uploadFiles = Array.from(files);
      const nextSession = await createSessionFromFiles(uploadFiles);
      await loadResolvedSession(
        nextSession,
        nextSession.exportMetadata
          ? `Imported exported session: ${nextSession.manifest.name}.`
          : `Loaded uploaded bundle: ${uploadFiles.map((file) => file.name).join(", ")}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
      setStatusMessage("Upload failed.");
    } finally {
      setBusyState("idle");
    }
  }

  async function handleExplain() {
    if (!session || !sceneState) {
      return;
    }
    setBusyState("explaining");
    try {
      const result = await explainLayout(materializeManifest(session, sceneState), explainPrompt);
      setExplainResult(result);
      setStatusMessage(result.source === "remote-ai" ? "Explain summary generated by DeepSeek." : "Explain summary generated locally.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Explain failed.");
      setStatusMessage("Explain failed.");
    } finally {
      setBusyState("idle");
    }
  }

  async function handleOperator() {
    if (!session || !sceneState) {
      return;
    }
    setBusyState("operating");
    try {
      const result = await runOperator(materializeManifest(session, sceneState), operatorPrompt);
      setOperatorResult(result);
      setStatusMessage(result.source === "remote-ai" ? "Operator actions returned by DeepSeek." : "Operator actions generated locally.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Operator failed.");
      setStatusMessage("Operator failed.");
    } finally {
      setBusyState("idle");
    }
  }

  function updateSelection(
    updater: (current: SceneState) => SceneState
  ) {
    setSceneState((current) => (current ? updater(current) : current));
  }

  function focusNode(nodeId: string) {
    if (!session) {
      return;
    }
    const node = session.manifest.hierarchy.find((entry) => entry.id === nodeId);
    updateSelection((current) => ({
      ...current,
      panel: "hierarchy",
      focusedNodeId: nodeId,
      selectedMarkerId: null,
      selectionMetadata: buildSelectionFromNode(node) ?? current.selectionMetadata
    }));
    setViewerAction({ id: Date.now(), type: "fit", payload: { nodeId } });
  }

  function focusMarker(markerId: string) {
    if (!session) {
      return;
    }
    const marker = session.manifest.markers?.find((entry) => entry.id === markerId);
    if (!marker) {
      return;
    }
    updateSelection((current) => ({
      ...current,
      panel: "markers",
      focusedNodeId: marker.nodeId ?? current.focusedNodeId,
      selectedMarkerId: markerId,
      selectionMetadata: buildSelectionFromMarker(marker)
    }));
    setViewerAction({ id: Date.now(), type: "focus-marker", payload: { markerId } });
  }

  function applyOperatorAction(action: OperatorAction) {
    if (!session || !sceneState) {
      return;
    }

    if (action.type === "focus" && action.targetId) {
      focusNode(action.targetId);
      return;
    }

    if (action.type === "focus-marker" && action.targetId) {
      focusMarker(action.targetId);
      return;
    }

    if (action.type === "toggle-layer" && action.targetId) {
      updateSelection((current) => {
        const hasLayer = current.selectedLayerIds.includes(action.targetId!);
        const shouldEnable = action.payload === "true" ? true : action.payload === "false" ? false : !hasLayer;
        return {
          ...current,
          selectedLayerIds: shouldEnable
            ? Array.from(new Set([...current.selectedLayerIds, action.targetId!]))
            : current.selectedLayerIds.filter((layerId) => layerId !== action.targetId)
        };
      });
      return;
    }

    if (action.type === "isolate" && action.targetId) {
      updateSelection((current) => ({
        ...current,
        panel: "layers",
        selectedLayerIds: [action.targetId!]
      }));
      return;
    }

    if (action.type === "show-all") {
      updateSelection((current) => ({
        ...current,
        selectedLayerIds: session.manifest.layers.map((layer) => layer.id),
        selectedMarkerId: null
      }));
      setViewerAction({ id: Date.now(), type: "fit", payload: { nodeId: sceneState.focusedNodeId } });
      return;
    }

    if (action.type === "bookmark") {
      saveBookmark("AI bookmark");
      return;
    }

    if (action.type === "performance-mode" && action.payload) {
      setPerformanceMode(action.payload as PerformanceMode);
      return;
    }

    if (action.type === "annotate" && action.payload) {
      updateSelection((current) => ({
        ...current,
        panel: "notes",
        notes: [
          {
            id: `note-${Date.now()}`,
            author: "AI operator",
            message: action.payload!,
            layerIds: current.selectedLayerIds,
            createdAt: new Date().toISOString()
          },
          ...current.notes
        ]
      }));
    }
  }

  function toggleLayer(layerId: string) {
    updateSelection((current) => ({
      ...current,
      panel: "layers",
      selectedLayerIds: current.selectedLayerIds.includes(layerId)
        ? current.selectedLayerIds.filter((candidate) => candidate !== layerId)
        : [...current.selectedLayerIds, layerId]
    }));
  }

  function clearLayers() {
    updateSelection((current) => ({ ...current, selectedLayerIds: [] }));
  }

  function selectAllLayers() {
    if (!session) {
      return;
    }
    updateSelection((current) => ({ ...current, selectedLayerIds: session.manifest.layers.map((layer) => layer.id) }));
  }

  function addNote() {
    if (!sceneState || !reviewDraft.trim()) {
      return;
    }
    const note: ReviewNote = {
      id: `note-${Date.now()}`,
      author: "You",
      message: reviewDraft.trim(),
      layerIds: sceneState.selectedLayerIds,
      createdAt: new Date().toISOString()
    };
    updateSelection((current) => ({
      ...current,
      panel: "notes",
      notes: [note, ...current.notes]
    }));
    setReviewDraft("");
    setStatusMessage("Review note added.");
  }

  function saveBookmark(proposedLabel?: string) {
    if (!session || !sceneState) {
      return;
    }
    const label = (proposedLabel ?? bookmarkDraft).trim() || createBookmarkLabel(session.manifest, sceneState.bookmarks.length);
    const bookmark: SceneBookmark = {
      id: `bookmark-${Date.now()}`,
      name: label,
      camera: sceneState.camera,
      selectedLayerIds: sceneState.selectedLayerIds,
      focusedNodeId: sceneState.focusedNodeId,
      note: selectedMarker?.message ?? null,
      createdAt: new Date().toISOString()
    };
    updateSelection((current) => ({
      ...current,
      panel: "bookmarks",
      bookmarks: [bookmark, ...current.bookmarks]
    }));
    setBookmarkDraft("");
    setStatusMessage(`Saved bookmark: ${label}.`);
  }

  function restoreBookmark(bookmark: SceneBookmark) {
    updateSelection((current) => ({
      ...current,
      panel: "bookmarks",
      selectedLayerIds: bookmark.selectedLayerIds,
      focusedNodeId: bookmark.focusedNodeId ?? current.focusedNodeId,
      selectedMarkerId: null,
      camera: bookmark.camera,
      selectionMetadata:
        buildSelectionFromNode(session?.manifest.hierarchy.find((node) => node.id === bookmark.focusedNodeId)) ??
        current.selectionMetadata
    }));
    setViewerAction({ id: Date.now(), type: "restore-camera", payload: bookmark.camera });
  }

  function setPerformanceMode(mode: PerformanceMode) {
    updateSelection((current) => ({
      ...current,
      performanceMode: mode
    }));
    setStatusMessage(`Performance mode: ${mode}.`);
  }

  async function exportCurrentSession() {
    if (!session || !sceneState || !explainResult || !operatorResult || !diffResult) {
      return;
    }

    setBusyState("exporting");
    try {
      const blob = await exportSessionPayload(materializeSession(session, sceneState, explainResult, operatorResult, diffResult));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${session.manifest.name.toLowerCase().replace(/\s+/g, "-")}-session.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatusMessage("Exported review session JSON.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Export failed.");
      setStatusMessage("Export failed.");
    } finally {
      setBusyState("idle");
    }
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setStatusMessage("Shareable scene link copied.");
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!hasScenePayload(session) || !sceneState || !explainResult || !operatorResult || !diffResult || !viewerManifest) {
    return (
      <div className="boot-state">
        <div className="boot-card">
          <p className="eyebrow">ICViewer cockpit</p>
          <h1>Loading the review cockpit.</h1>
          <p>{errorMessage ?? "Fetching sample inventory, baseline session, and viewer assets."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" data-build={BUILD_STAMP}>
      <header className="topbar">
        <div>
          <p className="eyebrow">ICViewer cockpit</p>
          <h1>Explainable 3D IC layout review for GDS, sidecars, and AI-assisted inspection.</h1>
          <p className="hero-copy">
            Backend-backed sample sessions, OpenROAD-compatible sidecars, CAD-style camera controls, and exportable review state in one cockpit.
          </p>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={exportCurrentSession} disabled={busyState === "exporting"} data-testid="export-session-button">
            {busyState === "exporting" ? "Exporting" : "Export session"}
          </button>
          <button className="ghost-button" onClick={copyShareLink} data-testid="copy-link-button">
            {copied ? "Copied link" : "Copy scene link"}
          </button>
          <span className="status-pill">{statusMessage}</span>
        </div>
      </header>

      <div className="panel-tab-row">
        {PANEL_TABS.map((panel) => (
          <button
            key={panel}
            className={`panel-tab ${sceneState.panel === panel ? "is-active" : ""}`}
            onClick={() => updateSelection((current) => ({ ...current, panel }))}
          >
            {panelLabel(panel)}
          </button>
        ))}
      </div>

      <main className="cockpit-grid">
        <aside className="rail rail-left">
          <section className="panel load-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Load</p>
                <h2>Sample gallery</h2>
              </div>
              <span className="mini-chip">{busyState === "uploading" || busyState === "loading" ? "Working" : session.manifest.source}</span>
            </div>
            <div className="sample-list" data-testid="sample-list">
              {samples.map((entry) => (
                <button
                  key={entry.id}
                  className={`sample-button ${entry.sessionId === session.sessionId ? "is-active" : ""}`}
                  onClick={() => void handleSampleLoad(entry.id)}
                >
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{entry.description}</small>
                  </span>
                  <small>{entry.technology}</small>
                </button>
              ))}
            </div>
            <label className="upload-dropzone" data-testid="upload-zone">
              <input
                type="file"
                multiple
                accept=".gds,.gdsii,.json,.def,.lef"
                onChange={(event) => void handleUpload(event.target.files)}
                data-testid="upload-input"
              />
              <span>Drop a GDS bundle with manifest/metrics/markers sidecars, or import an exported session JSON.</span>
            </label>
            <div className="metadata-grid">
              <div>
                <label>Source files</label>
                <strong>{session.manifest.sourceFiles.join(", ")}</strong>
              </div>
              <div>
                <label>Format</label>
                <strong>{session.manifest.format.toUpperCase()}</strong>
              </div>
              <div>
                <label>Technology</label>
                <strong>{session.manifest.technology}</strong>
              </div>
              <div>
                <label>Warnings</label>
                <strong>{session.warnings?.length ?? 0}</strong>
              </div>
            </div>
          </section>

          <section className="panel layers-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Layers</p>
                <h2>Visibility rail</h2>
              </div>
              <div className="inline-actions">
                <button className="text-button" onClick={selectAllLayers}>All</button>
                <button className="text-button" onClick={clearLayers}>None</button>
              </div>
            </div>
            <div className="layer-list">
              {session.manifest.layers.map((layer) => {
                const active = sceneState.selectedLayerIds.includes(layer.id);
                return (
                  <button
                    key={layer.id}
                    className={`layer-row ${active ? "is-active" : ""}`}
                    onClick={() => toggleLayer(layer.id)}
                    data-testid={`layer-${layer.id}`}
                  >
                    <span className="layer-swatch" style={{ background: layer.color }} />
                    <span className="layer-copy">
                      <strong>{layer.name}</strong>
                      <small>{layer.purpose}</small>
                    </span>
                    <span className="layer-thickness">{layer.thicknessNm} nm</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel markers-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Markers</p>
                <h2>Review stops</h2>
              </div>
              <span className="mini-chip">{session.manifest.markers?.length ?? 0}</span>
            </div>
            <div className="marker-list">
              {(session.manifest.markers ?? []).map((marker) => (
                <button
                  key={marker.id}
                  className={`marker-row ${sceneState.selectedMarkerId === marker.id ? "is-active" : ""}`}
                  onClick={() => focusMarker(marker.id)}
                >
                  <span className={`severity severity-${marker.severity}`} />
                  <span className="marker-copy">
                    <strong>{marker.title}</strong>
                    <small>{marker.category}</small>
                  </span>
                  <span className="marker-pill">{marker.severity}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="center-stage">
          <div className="panel center-toolbar">
            <div className="toolbar-meta">
              <span className="toolbar-badge">Bundle {session.manifest.id}</span>
              <span>{session.manifest.tags.slice(0, 3).join(" · ")}</span>
            </div>
            <div className="inline-actions toolbar-actions">
              <button className="text-button" onClick={() => setViewerAction({ id: Date.now(), type: "fit", payload: { nodeId: sceneState.focusedNodeId, markerId: sceneState.selectedMarkerId } })}>
                Fit
              </button>
              <button className="text-button" onClick={() => setViewerAction({ id: Date.now(), type: "reset" })}>
                Reset
              </button>
              <button className="text-button" onClick={() => {
                selectAllLayers();
                setViewerAction({ id: Date.now(), type: "fit", payload: { nodeId: sceneState.focusedNodeId } });
              }}>
                Show all
              </button>
              <button className="primary-button" onClick={() => saveBookmark()} data-testid="save-bookmark-button">
                Save bookmark
              </button>
            </div>
          </div>

          <div className="toolbar-band">
            {(["full", "simplified", "hierarchy-preview"] as PerformanceMode[]).map((mode) => (
              <button
                key={mode}
                className={`chip-button ${sceneState.performanceMode === mode ? "is-active" : ""}`}
                onClick={() => setPerformanceMode(mode)}
                data-testid={`performance-${mode}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <SceneViewer
            manifest={viewerManifest}
            assetUrl={sceneState.performanceMode === "hierarchy-preview" ? null : session.assetUrl}
            selectedLayerIds={sceneState.selectedLayerIds}
            focusedNodeId={sceneState.focusedNodeId}
            selectedMarkerId={sceneState.selectedMarkerId ?? null}
            performanceMode={sceneState.performanceMode}
            action={viewerAction}
            onNodeSelect={(nodeId) => focusNode(nodeId)}
            onMarkerSelect={(markerId) => focusMarker(markerId)}
            onCameraChange={(camera) => {
              setSceneState((current) => {
                if (!current) {
                  return current;
                }
                const samePosition = JSON.stringify(current.camera.position) === JSON.stringify(camera.position);
                const sameTarget = JSON.stringify(current.camera.target) === JSON.stringify(camera.target);
                if (samePosition && sameTarget) {
                  return current;
                }
                return { ...current, camera };
              });
            }}
          />

          <div className="panel scene-footbar">
            <div>
              <label>Selection</label>
              <strong>{sceneState.selectionMetadata?.name ?? selectedNode?.name ?? "Overview"}</strong>
            </div>
            <div>
              <label>Mode</label>
              <strong>{sceneState.performanceMode}</strong>
            </div>
            <div>
              <label>Markers</label>
              <strong>{session.manifest.markers?.length ?? 0}</strong>
            </div>
            <div>
              <label>Bookmarks</label>
              <strong>{sceneState.bookmarks.length}</strong>
            </div>
          </div>
        </section>

        <aside className="rail rail-right">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Overview</p>
                <h2>Metrics and hierarchy</h2>
              </div>
              <span className="mini-chip">{session.manifest.metrics.layerCount} layers</span>
            </div>
            <div className="stats-grid" data-testid="stats-grid">
              <div>
                <label>Cells</label>
                <strong>{formatNumber(session.manifest.metrics.cellCount)}</strong>
              </div>
              <div>
                <label>Instances</label>
                <strong>{formatNumber(session.manifest.metrics.instanceCount)}</strong>
              </div>
              <div>
                <label>Polygons</label>
                <strong>{formatNumber(session.manifest.metrics.polygonCount)}</strong>
              </div>
              <div>
                <label>Area</label>
                <strong>{formatNumber(session.manifest.metrics.estimatedAreaMm2)} mm²</strong>
              </div>
              <div>
                <label>Utilization</label>
                <strong>{formatNumber(session.manifest.metrics.utilizationPercent)}%</strong>
              </div>
              <div>
                <label>Wirelength</label>
                <strong>{formatNumber(session.manifest.metrics.wirelengthUm)} um</strong>
              </div>
            </div>

            <div className="selection-card">
              <label>Selection metadata</label>
              <strong>{sceneState.selectionMetadata?.name ?? "No selection"}</strong>
              <small>
                {(sceneState.selectionMetadata?.focusLayerIds ?? []).join(", ") || "Focus a hierarchy node or marker to inspect its engineering context."}
              </small>
            </div>

            <div className="hierarchy-list">
              {session.manifest.hierarchy.map((node) => (
                <button
                  key={node.id}
                  className={`hierarchy-row ${sceneState.focusedNodeId === node.id ? "is-active" : ""}`}
                  onClick={() => focusNode(node.id)}
                >
                  <span>
                    <strong>{node.name}</strong>
                    <small>{node.kind}</small>
                  </span>
                  <small>{formatNumber(node.instanceCount)} inst</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Explain</p>
                <h2>AI explainer</h2>
              </div>
              <span className="mini-chip">{explainResult.source}</span>
            </div>
            <textarea value={explainPrompt} onChange={(event) => setExplainPrompt(event.target.value)} rows={3} />
            <button className="primary-button" onClick={() => void handleExplain()} disabled={busyState === "explaining"} data-testid="explain-button">
              {busyState === "explaining" ? "Explaining" : "Run explain"}
            </button>
            <div className="response-copy" data-testid="explain-output">
              <strong>{explainResult.summary}</strong>
              <small>Confidence {Math.round(explainResult.confidence * 100)}%</small>
              <ul className="plain-list">
                {explainResult.highlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Operator</p>
                <h2>AI action planner</h2>
              </div>
              <span className="mini-chip">{operatorResult.source}</span>
            </div>
            <textarea value={operatorPrompt} onChange={(event) => setOperatorPrompt(event.target.value)} rows={3} />
            <button className="primary-button" onClick={() => void handleOperator()} disabled={busyState === "operating"} data-testid="operator-button">
              {busyState === "operating" ? "Running" : "Run operator"}
            </button>
            <div className="action-stack">
              {operatorResult.actions.map((action) => (
                <button key={`${action.type}-${action.label}-${action.targetId ?? ""}`} className="action-button" onClick={() => applyOperatorAction(action)}>
                  <strong>{action.label}</strong>
                  <small>{action.type}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Review</p>
                <h2>Notes, bookmarks, and diff</h2>
              </div>
              <span className="mini-chip">{sceneState.notes.length} notes</span>
            </div>

            <div className="bookmark-bar">
              <input
                value={bookmarkDraft}
                onChange={(event) => setBookmarkDraft(event.target.value)}
                placeholder="Bookmark label"
              />
              <button className="text-button" onClick={() => saveBookmark()}>
                Save
              </button>
            </div>

            <div className="bookmark-list">
              {sceneState.bookmarks.map((bookmark) => (
                <button key={bookmark.id} className="bookmark-row" onClick={() => restoreBookmark(bookmark)}>
                  <span>
                    <strong>{bookmark.name}</strong>
                    <small>{new Date(bookmark.createdAt).toLocaleTimeString()}</small>
                  </span>
                  <small>{bookmark.selectedLayerIds.length} layers</small>
                </button>
              ))}
            </div>

            <textarea
              value={reviewDraft}
              onChange={(event) => setReviewDraft(event.target.value)}
              rows={3}
              placeholder="Leave a review note tied to the current visible layers."
              data-testid="note-input"
            />
            <button className="primary-button" onClick={addNote} data-testid="note-add-button">
              Add note
            </button>

            <div className="notes-list">
              {sceneState.notes.map((note) => (
                <article key={note.id} className="note-card">
                  <strong>{note.author}</strong>
                  <small>{new Date(note.createdAt).toLocaleString()}</small>
                  <p>{note.message}</p>
                </article>
              ))}
            </div>

            <div className="diff-columns">
              <div className="diff-card">
                <label>Added</label>
                {(diffResult.added.length > 0 ? diffResult.added : ["No additions"]).map((line) => (
                  <strong key={line}>{line}</strong>
                ))}
              </div>
              <div className="diff-card">
                <label>Changed</label>
                {(diffResult.changed.length > 0 ? diffResult.changed : ["No changes"]).map((line) => (
                  <strong key={line}>{line}</strong>
                ))}
              </div>
              <div className="diff-card">
                <label>Delta</label>
                {diffResult.deltaLines.map((line) => (
                  <strong key={line}>{line}</strong>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </main>

      {errorMessage ? <div className="toast-error">{errorMessage}</div> : null}
    </div>
  );
}
