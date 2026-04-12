import { useEffect, useMemo, useRef, useState } from "react";
import SceneViewer from "./components/SceneViewer";
import {
  buildDiffSummary,
  createSessionFromFiles,
  ensureDetailedSession,
  explainLayout,
  exportSessionPayload,
  loadDefaultSession,
  runOperator
} from "./lib/api";
import {
  DEFAULT_EXPLAIN_PROMPTS,
  DEFAULT_OPERATOR_PROMPTS,
  localizeManifestName,
  localizeModeLabel,
  localizeSeverityLabel,
  type UiLanguage,
  UI_COPY
} from "./lib/copy";
import { readSceneStateFromUrl, writeSceneStateToUrl } from "./lib/url";
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
  SceneBookmark,
  SceneState,
  SelectionMetadata,
  SessionPayload
} from "../../../packages/shared/types";

type BusyState = "idle" | "loading" | "uploading" | "explaining" | "operating" | "exporting" | "detailing";
type ViewerAction =
  | { id: number; type: "fit"; payload?: { nodeId?: string | null; markerId?: string | null } }
  | { id: number; type: "reset" }
  | { id: number; type: "restore-camera"; payload: CameraState }
  | { id: number; type: "focus-marker"; payload: { markerId: string } };

const DEFAULT_CAMERA: CameraState = {
  position: [12, 11, 16],
  target: [0, 1.2, 0]
};
const BUILD_STAMP = "2026-04-12T20:10Z";

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

function createBookmarkLabel(manifest: LayoutManifest, count: number, language: UiLanguage): string {
  return language === "zh"
    ? `${manifest.name.split(" ")[0]} 视角 ${count + 1}`
    : `${manifest.name.split(" ")[0]} view ${count + 1}`;
}

function isLargeLayout(manifest: LayoutManifest): boolean {
  return manifest.metrics.polygonCount >= 25000 || manifest.metrics.instanceCount >= 8000;
}

function defaultPerformanceMode(session: SessionPayload): PerformanceMode {
  if (session.exportMetadata && session.state.performanceMode) {
    return session.state.performanceMode;
  }
  return isLargeLayout(session.manifest) ? "simplified" : "full";
}

function createSceneState(session: SessionPayload): SceneState {
  const preserveSessionState = Boolean(session.exportMetadata);
  const selectedLayerIds =
    preserveSessionState && session.state.selectedLayerIds?.length > 0
      ? session.state.selectedLayerIds
      : session.manifest.layers.filter((layer) => layer.visible).map((layer) => layer.id);
  const focusedNodeId = preserveSessionState ? session.state.focusedNodeId ?? null : null;
  const selectedMarkerId = preserveSessionState ? session.state.selectedMarkerId ?? null : null;
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
              focusedNodeId: null,
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
    performanceMode: defaultPerformanceMode(session),
    camera: preserveSessionState ? session.state.camera ?? DEFAULT_CAMERA : DEFAULT_CAMERA,
    selectionMetadata: preserveSessionState
      ? session.state.selectionMetadata ??
        buildSelectionFromMarker(selectedMarker) ??
        buildSelectionFromNode(selectedNode) ??
        null
      : null
  };
}

function createEmptySession(): SessionPayload {
  const generatedAt = new Date().toISOString();
  return {
    sessionId: "workspace-empty",
    assetUrl: null,
    manifest: {
      id: "workspace-empty",
      name: "Upload a GDS bundle",
      source: "remote",
      format: "gds",
      technology: "n/a",
      description: "Upload a GDS bundle to start reviewing a design.",
      tags: [],
      sourceFiles: [],
      layers: [],
      hierarchy: [],
      metrics: {
        bbox: [0, 0, 0, 0, 0, 0],
        cellCount: 0,
        instanceCount: 0,
        polygonCount: 0,
        netCount: 0,
        layerCount: 0,
        estimatedAreaMm2: 0,
        utilizationPercent: 0,
        wirelengthUm: 0,
        negativeSlackNs: 0
      },
      notes: [],
      markers: [],
      bookmarks: [],
      generatedAt
    },
    state: {
      panel: "viewer",
      selectedLayerIds: [],
      focusedNodeId: null,
      selectedMarkerId: null,
      notes: [],
      bookmarks: [],
      performanceMode: "simplified",
      camera: DEFAULT_CAMERA,
      selectionMetadata: null
    },
    explain: {
      summary: "Upload a layout to enable AI explain.",
      highlights: [],
      concerns: [],
      nextSteps: [],
      confidence: 0,
      source: "local-rule"
    },
    operator: {
      title: "Upload required",
      rationale: "Upload a layout to enable AI operator actions.",
      actions: [],
      source: "local-rule"
    },
    diff: {
      title: "No diff available",
      added: [],
      removed: [],
      changed: [],
      deltaLines: []
    },
    warnings: [],
    exportMetadata: null
  };
}

function buildAiScopeSummary(session: SessionPayload, state: SceneState, language: UiLanguage): string {
  const selection = state.selectionMetadata;
  const layerNames = session.manifest.layers
    .filter((layer) => state.selectedLayerIds.includes(layer.id))
    .map((layer) => layer.name);
  const scopeParts: string[] = [];

  if (selection?.name) {
    const kind = selection.kind ?? (language === "zh" ? "对象" : "item");
    scopeParts.push(language === "zh" ? `${kind}：${selection.name}` : `${kind}: ${selection.name}`);
  }

  if (selection?.markerId) {
    scopeParts.push(language === "zh" ? `标记：${selection.markerId}` : `marker: ${selection.markerId}`);
  }

  if (layerNames.length > 0) {
    const visibleNames = layerNames.slice(0, 6).join(", ");
    const suffix = layerNames.length > 6 ? (language === "zh" ? " 等" : " + more") : "";
    scopeParts.push(language === "zh" ? `层：${visibleNames}${suffix}` : `layers: ${visibleNames}${suffix}`);
  }

  if (scopeParts.length === 0) {
    return language === "zh" ? "整个已加载版图" : "the whole loaded layout";
  }

  return scopeParts.join(language === "zh" ? "；" : " | ");
}

function buildAiPrompt(basePrompt: string, session: SessionPayload, state: SceneState, language: UiLanguage): string {
  const trimmed = basePrompt.trim();
  const scope = buildAiScopeSummary(session, state, language);
  const selection = state.selectionMetadata;
  const focusLayers = selection?.focusLayerIds?.length ? selection.focusLayerIds : state.selectedLayerIds;
  const detailLines = [
    language === "zh" ? "当前工作区上下文：" : "Current cockpit context:",
    language === "zh" ? `范围：${scope}` : `Scope: ${scope}`,
    language === "zh"
      ? `选中层 ID：${focusLayers.length > 0 ? focusLayers.join(", ") : "无"}`
      : `Selected layer IDs: ${focusLayers.length > 0 ? focusLayers.join(", ") : "none"}`,
  ];

  if (selection?.bbox?.length === 6) {
    detailLines.push(
      language === "zh" ? `边界框：${selection.bbox.join(", ")}` : `Bounding box: ${selection.bbox.join(", ")}`
    );
  }

  return `${trimmed}\n\n${detailLines.join("\n")}`.trim();
}

export default function App() {
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (typeof window === "undefined") {
      return "en";
    }
    return window.localStorage.getItem("icviewer-language") === "zh" ? "zh" : "en";
  });
  const [session, setSession] = useState<SessionPayload>(() => createEmptySession());
  const [sceneState, setSceneState] = useState<SceneState>(() => createSceneState(createEmptySession()));
  const [referenceManifest, setReferenceManifest] = useState<LayoutManifest | null>(null);
  const [explainPrompt, setExplainPrompt] = useState(DEFAULT_EXPLAIN_PROMPTS.en);
  const [operatorPrompt, setOperatorPrompt] = useState(DEFAULT_OPERATOR_PROMPTS.en);
  const [reviewDraft, setReviewDraft] = useState("");
  const [bookmarkDraft, setBookmarkDraft] = useState("");
  const [explainResult, setExplainResult] = useState<ExplainResult>(() => createEmptySession().explain);
  const [operatorResult, setOperatorResult] = useState<OperatorResult>(() => createEmptySession().operator);
  const [diffResult, setDiffResult] = useState<DiffSummary>(() => createEmptySession().diff);
  const [statusMessage, setStatusMessage] = useState(UI_COPY.en.status.booting);
  const [busyState, setBusyState] = useState<BusyState>("loading");
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewerAction, setViewerAction] = useState<ViewerAction | null>(null);
  const bootstrappedRef = useRef(false);
  const previousLanguageRef = useRef<UiLanguage>(language);
  const copy = UI_COPY[language];
  const workspaceLoaded = session.manifest.id !== "workspace-empty";

  const selectedNode = useMemo(() => {
    if (!sceneState) {
      return null;
    }
    if (!sceneState.focusedNodeId) {
      return null;
    }
    return session.manifest.hierarchy.find((node) => node.id === sceneState.focusedNodeId) ?? null;
  }, [session, sceneState]);

  const selectedMarker = useMemo(() => {
    if (!sceneState) {
      return null;
    }
    return session.manifest.markers?.find((marker) => marker.id === sceneState.selectedMarkerId) ?? null;
  }, [session, sceneState]);

  const viewerManifest = useMemo(() => {
    return session.manifest;
  }, [session]);
  const aiScopeSummary = useMemo(
    () => buildAiScopeSummary(session, sceneState, language),
    [language, sceneState, session]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("icviewer-language", language);
    }
  }, [language]);

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    if (previousLanguage === language) {
      return;
    }

    setExplainPrompt((current) =>
      current === DEFAULT_EXPLAIN_PROMPTS[previousLanguage] ? DEFAULT_EXPLAIN_PROMPTS[language] : current
    );
    setOperatorPrompt((current) =>
      current === DEFAULT_OPERATOR_PROMPTS[previousLanguage] ? DEFAULT_OPERATOR_PROMPTS[language] : current
    );
    previousLanguageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;

    async function bootstrap() {
      try {
        const defaultSession = await loadDefaultSession();
        const emptySession = createEmptySession();
        setReferenceManifest(materializeManifest(defaultSession, createSceneState(defaultSession)));
        setSession(emptySession);
        setSceneState(readSceneStateFromUrl(createSceneState(emptySession)));
        setExplainResult(emptySession.explain);
        setOperatorResult(emptySession.operator);
        setDiffResult(emptySession.diff);
        setBusyState("idle");
        setStatusMessage(copy.status.readyBlank);
        setErrorMessage(null);
      } catch (error) {
        setBusyState("idle");
        setErrorMessage(error instanceof Error ? error.message : copy.status.backendFailed);
        setStatusMessage(copy.status.backendFailed);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!sceneState) {
      return;
    }

    const onPopState = () => {
      setSceneState((current) => (current ? readSceneStateFromUrl({ ...current }) : current));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [session, sceneState]);

  useEffect(() => {
    if (!sceneState) {
      return;
    }
    writeSceneStateToUrl(sceneState, {
      bundle: workspaceLoaded ? session.manifest.id : null
    });
  }, [sceneState, session, workspaceLoaded]);

  useEffect(() => {
    if (!sceneState || !referenceManifest || !workspaceLoaded) {
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
    const nextState = createSceneState(nextSession);
    setSession(nextSession);
    setSceneState(nextState);
    setExplainResult(nextSession.explain);
    setOperatorResult(nextSession.operator);
    setDiffResult(nextSession.diff);
    setStatusMessage(label);
    setErrorMessage(null);
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setBusyState("uploading");
    try {
      const uploadFiles = Array.from(files);
      const nextSession = await createSessionFromFiles(uploadFiles);
      const performanceSuffix = isLargeLayout(nextSession.manifest)
        ? language === "zh"
          ? " 已自动进入简化模式以保证流畅交互。"
          : " Started in simplified mode for smooth interaction."
        : "";
      await loadResolvedSession(
        nextSession,
        nextSession.exportMetadata
          ? `${copy.status.importedSession(localizeManifestName(nextSession.manifest, language))}${performanceSuffix}`
          : `${copy.status.uploadedBundle(uploadFiles.map((file) => file.name).join(", "))}${performanceSuffix}`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.status.uploadFailed);
      setStatusMessage(copy.status.uploadFailed);
    } finally {
      setBusyState("idle");
    }
  }

  async function handleExplain() {
    if (!sceneState || !workspaceLoaded) {
      return;
    }
    setBusyState("explaining");
    try {
      const result = await explainLayout(materializeManifest(session, sceneState), buildAiPrompt(explainPrompt, session, sceneState, language));
      setExplainResult(result);
      setStatusMessage(result.source === "remote-ai" ? copy.status.explainRemote : copy.status.explainLocal);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.status.explainFailed);
      setStatusMessage(copy.status.explainFailed);
    } finally {
      setBusyState("idle");
    }
  }

  async function handleOperator() {
    if (!sceneState || !workspaceLoaded) {
      return;
    }
    setBusyState("operating");
    try {
      const result = await runOperator(materializeManifest(session, sceneState), buildAiPrompt(operatorPrompt, session, sceneState, language));
      setOperatorResult(result);
      setStatusMessage(result.source === "remote-ai" ? copy.status.operatorRemote : copy.status.operatorLocal);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.status.operatorFailed);
      setStatusMessage(copy.status.operatorFailed);
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
    if (!workspaceLoaded) {
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
    if (!workspaceLoaded) {
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
    if (!sceneState || !workspaceLoaded) {
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
          panel: "layers",
          performanceMode: current.performanceMode === "full" ? "simplified" : current.performanceMode,
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
        performanceMode: current.performanceMode === "full" ? "simplified" : current.performanceMode,
        selectedLayerIds: [action.targetId!]
      }));
      return;
    }

    if (action.type === "show-all") {
      updateSelection((current) => ({
        ...current,
        panel: "layers",
        performanceMode: current.performanceMode === "full" ? "simplified" : current.performanceMode,
        selectedLayerIds: session.manifest.layers.map((layer) => layer.id),
        selectedMarkerId: null
      }));
      setViewerAction({ id: Date.now(), type: "fit", payload: { nodeId: sceneState.focusedNodeId } });
      return;
    }

    if (action.type === "bookmark") {
      saveBookmark(language === "zh" ? "AI 书签" : "AI bookmark");
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
            author: language === "zh" ? "AI 操作器" : "AI operator",
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
      performanceMode: current.performanceMode === "full" ? "simplified" : current.performanceMode,
      selectedLayerIds: current.selectedLayerIds.includes(layerId)
        ? current.selectedLayerIds.filter((candidate) => candidate !== layerId)
        : [...current.selectedLayerIds, layerId]
    }));
  }

  function clearLayers() {
    updateSelection((current) => ({
      ...current,
      panel: "layers",
      performanceMode: current.performanceMode === "full" ? "simplified" : current.performanceMode,
      selectedLayerIds: []
    }));
  }

  function selectAllLayers() {
    if (!workspaceLoaded) {
      return;
    }
    updateSelection((current) => ({
      ...current,
      panel: "layers",
      performanceMode: current.performanceMode === "full" ? "simplified" : current.performanceMode,
      selectedLayerIds: session.manifest.layers.map((layer) => layer.id)
    }));
  }

  function addNote() {
    if (!sceneState || !reviewDraft.trim()) {
      return;
    }
    const note: ReviewNote = {
      id: `note-${Date.now()}`,
      author: language === "zh" ? "你" : "You",
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
    setStatusMessage(copy.status.noteAdded);
  }

  function saveBookmark(proposedLabel?: string) {
    if (!sceneState || !workspaceLoaded) {
      return;
    }
    const label = (proposedLabel ?? bookmarkDraft).trim() || createBookmarkLabel(session.manifest, sceneState.bookmarks.length, language);
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
    setStatusMessage(copy.status.bookmarkSaved(label));
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

  async function setPerformanceMode(mode: PerformanceMode) {
    if (!session) {
      return;
    }

    if (mode === "full" && !session.assetUrl && !session.exportMetadata) {
      setBusyState("detailing");
      setStatusMessage(copy.status.detailGenerating);
      try {
        const refreshed = await ensureDetailedSession(session.sessionId);
        setSession((current) => (current ? { ...current, ...refreshed } : refreshed));
        updateSelection((current) => (current ? { ...current, performanceMode: "full" } : current));
        setStatusMessage(copy.status.detailReady);
      } catch (error) {
        updateSelection((current) => (current ? { ...current, performanceMode: "simplified" } : current));
        setErrorMessage(error instanceof Error ? error.message : copy.status.detailFailed);
        setStatusMessage(copy.status.detailFailed);
      } finally {
        setBusyState("idle");
      }
      return;
    }

    updateSelection((current) => ({
      ...current,
      performanceMode: mode
    }));
    setStatusMessage(copy.status.performanceMode(localizeModeLabel(mode, language)));
  }

  async function exportCurrentSession() {
    if (!sceneState || !explainResult || !operatorResult || !diffResult || !workspaceLoaded) {
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
      setStatusMessage(copy.status.exportDone);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : copy.status.exportFailed);
      setStatusMessage(copy.status.exportFailed);
    } finally {
      setBusyState("idle");
    }
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setStatusMessage(copy.status.linkCopied);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (busyState === "loading" || !sceneState || !explainResult || !operatorResult || !diffResult || !viewerManifest) {
    return (
      <div className="boot-state">
        <div className="boot-card">
          <p className="eyebrow">{copy.boot.eyebrow}</p>
          <h1>{copy.boot.title}</h1>
          <p>{errorMessage ?? copy.boot.subtitle}</p>
        </div>
      </div>
    );
  }

  const localizedManifestName = localizeManifestName(session.manifest, language);

  return (
    <div className="app-shell" data-build={BUILD_STAMP}>
      <header className="topbar">
        <div>
          <p className="eyebrow">{copy.topbar.eyebrow}</p>
          <h1>{copy.topbar.title}</h1>
          <p className="hero-copy">{copy.topbar.hero}</p>
        </div>
        <div className="topbar-actions">
          <button
            className="ghost-button"
            onClick={() => setLanguage((current) => (current === "en" ? "zh" : "en"))}
            data-testid="language-toggle-button"
          >
            {copy.topbar.switchLanguage}
          </button>
          <button
            className="ghost-button"
            onClick={exportCurrentSession}
            disabled={busyState === "exporting" || !workspaceLoaded}
            data-testid="export-session-button"
          >
            {busyState === "exporting" ? copy.topbar.exporting : copy.topbar.exportSession}
          </button>
          <button className="ghost-button" onClick={copyShareLink} data-testid="copy-link-button">
            {copied ? copy.topbar.copiedLink : copy.topbar.copySceneLink}
          </button>
          <span className="status-pill">{statusMessage}</span>
        </div>
      </header>

      <main className="cockpit-grid workspace-layout">
        <aside className="rail rail-left">
          <section className="panel hierarchy-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{copy.overview.eyebrow}</p>
                <h2>{copy.overview.hierarchyTitle}</h2>
              </div>
              <span className="mini-chip">{workspaceLoaded ? session.manifest.hierarchy.length : 0}</span>
            </div>
            {workspaceLoaded ? (
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
                    <small>{formatNumber(node.instanceCount)} {copy.overview.instancesShort}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-copy">{copy.overview.emptyHierarchy}</p>
            )}
          </section>
        </aside>

        <section className="center-stage">
          <section className="panel load-panel inline-load-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{copy.load.eyebrow}</p>
                <h2>{copy.load.title}</h2>
              </div>
              <span className="mini-chip">
                {busyState === "uploading" ? copy.load.working : copy.load.uploadBadge}
              </span>
            </div>
            <label className="upload-dropzone" data-testid="upload-zone">
              <input
                type="file"
                multiple
                accept=".gds,.gdsii,.json,.def,.lef"
                onChange={(event) => void handleUpload(event.target.files)}
                data-testid="upload-input"
              />
              <span>{copy.load.uploadHint}</span>
            </label>
            {workspaceLoaded ? (
              <div className="metadata-grid">
                <div>
                  <label>{copy.load.sourceFiles}</label>
                  <strong>{session.manifest.sourceFiles.join(", ")}</strong>
                </div>
                <div>
                  <label>{copy.load.format}</label>
                  <strong>{session.manifest.format.toUpperCase()}</strong>
                </div>
                <div>
                  <label>{copy.load.technology}</label>
                  <strong>{session.manifest.technology}</strong>
                </div>
                <div>
                  <label>{copy.load.warnings}</label>
                  <strong>{session.warnings?.length ?? 0}</strong>
                </div>
              </div>
            ) : null}
            {session.warnings?.length ? (
              <div className="warning-list">
                {session.warnings.map((warning) => (
                  <small key={warning}>{warning}</small>
                ))}
              </div>
            ) : null}
          </section>

          <div className="panel center-toolbar">
            <div className="toolbar-meta">
              <span className="toolbar-badge">
                {workspaceLoaded ? `${copy.center.bundle} ${session.manifest.id}` : copy.viewer.emptyBadge}
              </span>
              <span>{workspaceLoaded ? session.manifest.tags.slice(0, 3).join(" · ") : copy.viewer.emptyHint}</span>
            </div>
            <div className="inline-actions toolbar-actions">
              <button
                className="text-button"
                disabled={!workspaceLoaded}
                onClick={() =>
                  setViewerAction({ id: Date.now(), type: "fit", payload: { nodeId: sceneState.focusedNodeId, markerId: sceneState.selectedMarkerId } })
                }
              >
                {copy.center.fit}
              </button>
              <button className="text-button" onClick={() => setViewerAction({ id: Date.now(), type: "reset" })}>
                {copy.center.reset}
              </button>
              <button
                className="text-button"
                disabled={!workspaceLoaded}
                onClick={() => {
                  selectAllLayers();
                  setViewerAction({ id: Date.now(), type: "fit", payload: { nodeId: sceneState.focusedNodeId } });
                }}
              >
                {copy.center.showAll}
              </button>
              <button className="primary-button" onClick={() => saveBookmark()} data-testid="save-bookmark-button" disabled={!workspaceLoaded}>
                {copy.center.saveBookmark}
              </button>
            </div>
          </div>

          <div className="toolbar-band">
            {(["full", "simplified", "hierarchy-preview"] as PerformanceMode[]).map((mode) => (
              <button
                key={mode}
                className={`chip-button ${sceneState.performanceMode === mode ? "is-active" : ""}`}
                onClick={() => void setPerformanceMode(mode)}
                disabled={busyState === "detailing" || !workspaceLoaded}
                data-testid={`performance-${mode}`}
              >
                {localizeModeLabel(mode, language)}
              </button>
            ))}
            {!session.assetUrl && workspaceLoaded && !session.exportMetadata ? (
              <span className="mini-chip">{copy.status.detailDeferred}</span>
            ) : null}
          </div>

          <SceneViewer
            manifest={viewerManifest}
            displayName={workspaceLoaded ? localizedManifestName : copy.viewer.emptyTitle}
            assetUrl={workspaceLoaded && sceneState.performanceMode !== "hierarchy-preview" ? session.assetUrl : null}
            selectedLayerIds={sceneState.selectedLayerIds}
            focusedNodeId={sceneState.focusedNodeId}
            selectedMarkerId={sceneState.selectedMarkerId ?? null}
            performanceMode={sceneState.performanceMode}
            language={language}
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
              <label>{copy.sceneFoot.selection}</label>
              <strong>{workspaceLoaded ? sceneState.selectionMetadata?.name ?? selectedNode?.name ?? copy.sceneFoot.overview : copy.viewer.emptySelection}</strong>
            </div>
            <div>
              <label>{copy.sceneFoot.mode}</label>
              <strong>{localizeModeLabel(sceneState.performanceMode, language)}</strong>
            </div>
            <div>
              <label>{copy.sceneFoot.markers}</label>
              <strong>{session.manifest.markers?.length ?? 0}</strong>
            </div>
            <div>
              <label>{copy.sceneFoot.bookmarks}</label>
              <strong>{sceneState.bookmarks.length}</strong>
            </div>
          </div>
        </section>

        <aside className="rail rail-right">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{copy.explain.eyebrow}</p>
                <h2>{copy.explain.title}</h2>
              </div>
              <span className="mini-chip">{explainResult.source}</span>
            </div>
            <textarea value={explainPrompt} onChange={(event) => setExplainPrompt(event.target.value)} rows={3} />
            <div className="selection-card ai-context-card">
              <label>{copy.explain.selectionLabel}</label>
              <strong>{workspaceLoaded ? aiScopeSummary : copy.explain.selectionIdle}</strong>
              <small>{workspaceLoaded ? copy.overview.selectionHelp : copy.explain.empty}</small>
            </div>
            <button className="primary-button" onClick={() => void handleExplain()} disabled={busyState === "explaining" || !workspaceLoaded} data-testid="explain-button">
              {busyState === "explaining"
                ? copy.explain.running
                : sceneState.selectionMetadata?.name
                  ? copy.explain.runSelection
                  : copy.explain.run}
            </button>
            <div className="response-copy" data-testid="explain-output">
              {workspaceLoaded ? (
                <>
                  <strong>{explainResult.summary}</strong>
                  <small>{copy.explain.confidence} {Math.round(explainResult.confidence * 100)}%</small>
                  <ul className="plain-list">
                    {explainResult.highlights.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <strong>{copy.explain.empty}</strong>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{copy.operator.eyebrow}</p>
                <h2>{copy.operator.title}</h2>
              </div>
              <span className="mini-chip">{operatorResult.source}</span>
            </div>
            <textarea value={operatorPrompt} onChange={(event) => setOperatorPrompt(event.target.value)} rows={3} />
            <div className="selection-card ai-context-card">
              <label>{copy.operator.selectionLabel}</label>
              <strong>{workspaceLoaded ? aiScopeSummary : copy.operator.selectionIdle}</strong>
              <small>{workspaceLoaded ? copy.overview.selectionHelp : copy.operator.empty}</small>
            </div>
            <button className="primary-button" onClick={() => void handleOperator()} disabled={busyState === "operating" || !workspaceLoaded} data-testid="operator-button">
              {busyState === "operating"
                ? copy.operator.running
                : sceneState.selectionMetadata?.name
                  ? copy.operator.runSelection
                  : copy.operator.run}
            </button>
            <div className="action-stack">
              {workspaceLoaded ? (
                operatorResult.actions.map((action) => (
                  <button key={`${action.type}-${action.label}-${action.targetId ?? ""}`} className="action-button" onClick={() => applyOperatorAction(action)}>
                    <strong>{action.label}</strong>
                    <small>{action.type}</small>
                  </button>
                ))
              ) : (
                <p className="empty-copy">{copy.operator.empty}</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{copy.overview.eyebrow}</p>
                <h2>{copy.overview.metricsTitle}</h2>
              </div>
              <span className="mini-chip">{session.manifest.metrics.layerCount} {copy.overview.layers}</span>
            </div>
            <div className="stats-grid" data-testid="stats-grid">
              <div>
                <label>{copy.overview.cells}</label>
                <strong>{formatNumber(session.manifest.metrics.cellCount)}</strong>
              </div>
              <div>
                <label>{copy.overview.instances}</label>
                <strong>{formatNumber(session.manifest.metrics.instanceCount)}</strong>
              </div>
              <div>
                <label>{copy.overview.polygons}</label>
                <strong>{formatNumber(session.manifest.metrics.polygonCount)}</strong>
              </div>
              <div>
                <label>{copy.overview.area}</label>
                <strong>{formatNumber(session.manifest.metrics.estimatedAreaMm2)} mm²</strong>
              </div>
              <div>
                <label>{copy.overview.utilization}</label>
                <strong>{formatNumber(session.manifest.metrics.utilizationPercent)}%</strong>
              </div>
              <div>
                <label>{copy.overview.wirelength}</label>
                <strong>{formatNumber(session.manifest.metrics.wirelengthUm)} um</strong>
              </div>
            </div>

            <div className="selection-card">
              <label>{copy.overview.selectionMetadata}</label>
              <strong>{sceneState.selectionMetadata?.name ?? copy.overview.noSelection}</strong>
              <small>
                {(sceneState.selectionMetadata?.focusLayerIds ?? []).join(", ") || copy.overview.selectionHelp}
              </small>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{copy.layers.eyebrow}</p>
                <h2>{copy.layers.title}</h2>
              </div>
              <div className="inline-actions">
                <button className="text-button" onClick={selectAllLayers} disabled={!workspaceLoaded}>{copy.layers.all}</button>
                <button className="text-button" onClick={clearLayers} disabled={!workspaceLoaded}>{copy.layers.none}</button>
              </div>
            </div>
            <div className="layer-list">
              {workspaceLoaded ? (
                session.manifest.layers.map((layer) => {
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
                })
              ) : (
                <p className="empty-copy">{copy.layers.empty}</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{copy.markers.eyebrow}</p>
                <h2>{copy.markers.title}</h2>
              </div>
              <span className="mini-chip">{session.manifest.markers?.length ?? 0}</span>
            </div>
            <div className="marker-list">
              {workspaceLoaded ? (
                (session.manifest.markers ?? []).map((marker) => (
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
                    <span className="marker-pill">{localizeSeverityLabel(marker.severity, language)}</span>
                  </button>
                ))
              ) : (
                <p className="empty-copy">{copy.markers.empty}</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{copy.review.eyebrow}</p>
                <h2>{copy.review.title}</h2>
              </div>
              <span className="mini-chip">{sceneState.notes.length} {copy.review.noteCount}</span>
            </div>

            <div className="bookmark-bar">
              <input
                value={bookmarkDraft}
                onChange={(event) => setBookmarkDraft(event.target.value)}
                placeholder={copy.review.bookmarkLabel}
              />
              <button className="text-button" onClick={() => saveBookmark()} disabled={!workspaceLoaded}>
                {copy.review.save}
              </button>
            </div>

            <div className="bookmark-list">
              {sceneState.bookmarks.map((bookmark) => (
                <button key={bookmark.id} className="bookmark-row" onClick={() => restoreBookmark(bookmark)}>
                  <span>
                    <strong>{bookmark.id === "bookmark-overview" ? copy.sceneFoot.overview : bookmark.name}</strong>
                    <small>{new Date(bookmark.createdAt).toLocaleTimeString()}</small>
                  </span>
                  <small>{bookmark.selectedLayerIds.length} {copy.overview.layers}</small>
                </button>
              ))}
            </div>

            <textarea
              value={reviewDraft}
              onChange={(event) => setReviewDraft(event.target.value)}
              rows={3}
              placeholder={copy.review.notePlaceholder}
              data-testid="note-input"
            />
            <button className="primary-button" onClick={addNote} data-testid="note-add-button" disabled={!workspaceLoaded}>
              {copy.review.addNote}
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
                <label>{copy.review.added}</label>
                {(diffResult.added.length > 0 ? diffResult.added : [copy.review.noAdditions]).map((line) => (
                  <strong key={line}>{line}</strong>
                ))}
              </div>
              <div className="diff-card">
                <label>{copy.review.changed}</label>
                {(diffResult.changed.length > 0 ? diffResult.changed : [copy.review.noChanges]).map((line) => (
                  <strong key={line}>{line}</strong>
                ))}
              </div>
              <div className="diff-card">
                <label>{copy.review.delta}</label>
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
