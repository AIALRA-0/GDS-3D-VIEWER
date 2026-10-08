import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  createSessionFromFiles,
  ensureDetailedSession,
  explainLayout,
  exportSessionPayload,
  runOperator,
} from "./lib/api";
import type {
  ExplainResult,
  OperatorAction,
  OperatorResult,
  ReviewNote,
  SessionPayload,
} from "../../../packages/shared/types";

type UiLanguage = "en" | "zh";
type BusyState = "idle" | "uploading" | "explaining" | "operating" | "exporting";
type DrawerPanel = "none" | "viewer" | "ai" | "info" | "review";

interface ViewerSelection {
  title: string;
  info: string;
}

interface ViewerShellApi {
  setControlsOpen(open: boolean): void;
  toggleControls(): void;
  getSelection(): ViewerSelection;
  clickButton(label: string): boolean;
  setToggle(label: string, enabled: boolean): boolean;
  setOnlyToggle(label: string): boolean;
  showAllLayers(): boolean;
}

declare global {
  interface Window {
    gds3dViewerShell?: ViewerShellApi;
  }
}

const EMPTY_EXPLAIN: ExplainResult = {
  summary: "",
  highlights: [],
  concerns: [],
  nextSteps: [],
  confidence: 0,
  source: "local-rule",
};

const EMPTY_OPERATOR: OperatorResult = {
  title: "",
  rationale: "",
  actions: [],
  source: "local-rule",
};

const TEXT = {
  en: {
    brand: "GDS-3D-VIEWER",
    load: "Load",
    viewer: "View",
    ai: "AI",
    info: "Data",
    review: "Notes",
    export: "Export",
    language: "中文",
    noLayout: "Empty",
    idle: "Idle.",
    loading: "Loading.",
    loaded: "Ready.",
    explain: "Explain",
    plan: "Operator",
    promptExplain: "Prompt",
    promptOperator: "Prompt",
    promptExplainDefault: "Explain the current selection.",
    promptOperatorDefault: "Plan viewer actions for the current selection.",
    selection: "Selection",
    selectionEmpty: "Whole layout",
    metrics: "Metrics",
    hierarchy: "Hierarchy",
    files: "Files",
    warnings: "Warnings",
    notes: "Notes",
    addNote: "Add",
    notePlaceholder: "Review note",
    drawerEmpty: "Empty.",
    explainEmpty: "No result.",
    operatorEmpty: "No action.",
    uploadHint: "GDS or session JSON",
    errors: "Error",
  },
  zh: {
    brand: "GDS-3D-VIEWER",
    load: "加载",
    viewer: "视图",
    ai: "AI",
    info: "信息",
    review: "记录",
    export: "导出",
    language: "English",
    noLayout: "空.",
    idle: "空闲.",
    loading: "加载中.",
    loaded: "已就绪.",
    explain: "解释",
    plan: "操作器",
    promptExplain: "提示",
    promptOperator: "提示",
    promptExplainDefault: "解释当前选择.",
    promptOperatorDefault: "为当前选择规划 viewer 动作.",
    selection: "当前选择",
    selectionEmpty: "整个版图",
    metrics: "指标",
    hierarchy: "层级",
    files: "文件",
    warnings: "警告",
    notes: "记录",
    addNote: "添加",
    notePlaceholder: "审阅记录",
    drawerEmpty: "空.",
    explainEmpty: "无结果.",
    operatorEmpty: "无动作.",
    uploadHint: "GDS 或 session JSON",
    errors: "错误",
  },
} as const;

function buildViewerUrl(assetUrl: string | null | undefined): string | null {
  if (!assetUrl) {
    return null;
  }
  return `/reference-viewer/index.html?model=${encodeURIComponent(assetUrl)}&ts=${Date.now()}`;
}

function compactLines(lines: string[]): string[] {
  return lines.filter(Boolean).slice(0, 8);
}

function buildSelectionPrompt(basePrompt: string, selection: ViewerSelection, language: UiLanguage): string {
  const prompt = basePrompt.trim();
  const scope = selection.title || (language === "zh" ? "整个版图" : "whole layout");
  const info = selection.info || (language === "zh" ? "无附加信息" : "no extra info");
  return `${prompt}\n\nScope: ${scope}\nDetails: ${info}`;
}

function cleanViewerText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export default function App() {
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (typeof window === "undefined") {
      return "en";
    }
    return window.localStorage.getItem("gds-3d-viewer-language") === "zh" ? "zh" : "en";
  });
  const [busyState, setBusyState] = useState<BusyState>("idle");
  const [drawer, setDrawer] = useState<DrawerPanel>("none");
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerSelection, setViewerSelection] = useState<ViewerSelection>({ title: "", info: "" });
  const [status, setStatus] = useState<string>(TEXT.en.idle);
  const [error, setError] = useState<string | null>(null);
  const [explainPrompt, setExplainPrompt] = useState<string>(TEXT.en.promptExplainDefault);
  const [operatorPrompt, setOperatorPrompt] = useState<string>(TEXT.en.promptOperatorDefault);
  const [explainResult, setExplainResult] = useState<ExplainResult>(EMPTY_EXPLAIN);
  const [operatorResult, setOperatorResult] = useState<OperatorResult>(EMPTY_OPERATOR);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const viewerShellRef = useRef<ViewerShellApi | null>(null);
  const copy = TEXT[language];

  useEffect(() => {
    window.localStorage.setItem("gds-3d-viewer-language", language);
  }, [language]);

  useEffect(() => {
    setExplainPrompt(TEXT[language].promptExplainDefault);
    setOperatorPrompt(TEXT[language].promptOperatorDefault);
    setStatus((current) => (current === TEXT.en.idle || current === TEXT.zh.idle ? TEXT[language].idle : current));
  }, [language]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !event.data || typeof event.data !== "object") {
        return;
      }
      if (event.data.type === "gds-3d-viewer-selection" && event.data.selection) {
        setViewerSelection({
          title: cleanViewerText(String(event.data.selection.title ?? "")),
          info: cleanViewerText(String(event.data.selection.info ?? "")),
        });
      }
      if (event.data.type === "gds-3d-viewer-ready") {
        setViewerReady(Boolean(event.data.ready));
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    viewerShellRef.current?.setControlsOpen(drawer === "viewer");
  }, [drawer]);

  const selectionLabel = useMemo(() => {
    if (!viewerSelection.title) {
      return copy.selectionEmpty;
    }
    return viewerSelection.info ? `${viewerSelection.title} | ${viewerSelection.info}` : viewerSelection.title;
  }, [copy.selectionEmpty, viewerSelection.info, viewerSelection.title]);

  const metricLines = useMemo(() => {
    const metrics = session?.manifest.metrics;
    return compactLines([
      metrics ? `Cells ${metrics.cellCount}` : "",
      metrics ? `Instances ${metrics.instanceCount}` : "",
      metrics ? `Polygons ${metrics.polygonCount}` : "",
      session ? `Layers ${session.manifest.layers.length}` : "",
      metrics ? `Area ${metrics.estimatedAreaMm2} mm2` : "",
      metrics ? `Util ${metrics.utilizationPercent}%` : "",
    ]);
  }, [session]);

  const hierarchyLines = useMemo(
    () =>
      (session?.manifest.hierarchy ?? [])
        .slice(0, 14)
        .map((node) => `${node.name} | ${node.kind} | x${node.instanceCount}`),
    [session],
  );

  const explainLines = useMemo(
    () =>
      compactLines([
        explainResult.summary,
        ...explainResult.highlights,
        ...explainResult.concerns,
        ...explainResult.nextSteps,
      ]),
    [explainResult],
  );

  const operatorLines = useMemo(
    () =>
      compactLines([
        operatorResult.title,
        operatorResult.rationale,
      ]),
    [operatorResult],
  );

  function closePanels() {
    setDrawer("none");
    viewerShellRef.current?.setControlsOpen(false);
  }

  function connectViewerShell() {
    const frameWindow = iframeRef.current?.contentWindow as (Window & { gds3dViewerShell?: ViewerShellApi }) | null;
    if (!frameWindow) {
      viewerShellRef.current = null;
      return;
    }

    const attach = () => {
      if (frameWindow.gds3dViewerShell) {
        viewerShellRef.current = frameWindow.gds3dViewerShell;
        viewerShellRef.current.setControlsOpen(drawer === "viewer");
        const selection = viewerShellRef.current.getSelection();
        setViewerSelection({
          title: cleanViewerText(selection.title),
          info: cleanViewerText(selection.info),
        });
        return;
      }
      window.setTimeout(attach, 120);
    };

    attach();
  }

  function toggleDrawer(next: DrawerPanel) {
    setDrawer((current) => (current === next ? "none" : next));
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    closePanels();
    setBusyState("uploading");
    setViewerReady(false);
    setStatus(copy.loading);
    setError(null);

    try {
      let nextSession = await createSessionFromFiles(Array.from(files));
      if (!nextSession.assetUrl && !nextSession.exportMetadata) {
        nextSession = await ensureDetailedSession(nextSession.sessionId);
      }

      startTransition(() => {
        setSession(nextSession);
        setViewerUrl(buildViewerUrl(nextSession.assetUrl));
        setExplainResult(nextSession.explain);
        setOperatorResult(nextSession.operator);
        setNotes(nextSession.state.notes ?? []);
        setViewerSelection({ title: nextSession.manifest.name, info: nextSession.manifest.technology });
      });

      setStatus(`${copy.loaded} ${nextSession.manifest.name}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
      setStatus(copy.errors);
    } finally {
      setBusyState("idle");
    }
  }

  async function handleExplain() {
    if (!session) {
      return;
    }
    setBusyState("explaining");
    setError(null);
    try {
      const result = await explainLayout(
        session.manifest,
        buildSelectionPrompt(explainPrompt, viewerSelection, language),
      );
      setExplainResult(result);
      setDrawer("ai");
      setStatus(result.source === "remote-ai" ? "DeepSeek" : "Local");
    } catch (explainError) {
      setError(explainError instanceof Error ? explainError.message : "Explain failed");
      setStatus(copy.errors);
    } finally {
      setBusyState("idle");
    }
  }

  async function handleOperator() {
    if (!session) {
      return;
    }
    setBusyState("operating");
    setError(null);
    try {
      const result = await runOperator(
        session.manifest,
        buildSelectionPrompt(operatorPrompt, viewerSelection, language),
      );
      setOperatorResult(result);
      setDrawer("ai");
      setStatus(result.source === "remote-ai" ? "DeepSeek" : "Local");
    } catch (operatorError) {
      setError(operatorError instanceof Error ? operatorError.message : "Operator failed");
      setStatus(copy.errors);
    } finally {
      setBusyState("idle");
    }
  }

  function canRunOperatorAction(action: OperatorAction): boolean {
    return ["toggle-layer", "isolate", "show-all", "annotate", "bookmark", "focus"].includes(action.type);
  }

  function addGeneratedNote(message: string, author: string) {
    const note: ReviewNote = {
      id: `note-${Date.now()}`,
      author,
      message,
      layerIds: [],
      createdAt: new Date().toISOString(),
    };
    setNotes((current) => [note, ...current]);
  }

  function applyOperatorAction(action: OperatorAction) {
    if (!session) {
      return;
    }

    const viewer = viewerShellRef.current;
    const targetLayer = session.manifest.layers.find((layer) => layer.id === action.targetId);
    let success = false;

    switch (action.type) {
      case "toggle-layer":
        if (viewer && targetLayer) {
          success = viewer.setToggle(targetLayer.name, action.payload !== "false");
        }
        break;
      case "show-all":
        success = viewer?.showAllLayers() ?? false;
        break;
      case "isolate":
        if (viewer && targetLayer) {
          success = viewer.setOnlyToggle(targetLayer.name);
        } else {
          success = viewer?.clickButton("Isolate selection / Back") ?? false;
        }
        break;
      case "focus":
        success = viewer?.clickButton("Zoom selection") ?? false;
        break;
      case "annotate":
        if (action.payload) {
          addGeneratedNote(action.payload, action.label);
          success = true;
        }
        break;
      case "bookmark":
        addGeneratedNote(action.payload || action.label, action.label);
        success = true;
        break;
      default:
        success = false;
    }

    setStatus(success ? action.label : `${action.label} unavailable`);
  }

  function addNote() {
    if (!noteDraft.trim()) {
      return;
    }
    addGeneratedNote(noteDraft.trim(), copy.review);
    setNoteDraft("");
    setStatus(copy.review);
  }

  async function exportCurrentSession() {
    if (!session) {
      return;
    }
    setBusyState("exporting");
    setError(null);
    try {
      const payload: SessionPayload = {
        ...session,
        explain: explainResult,
        operator: operatorResult,
        state: {
          ...session.state,
          notes,
        },
      };
      const blob = await exportSessionPayload(payload);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${session.manifest.name.toLowerCase().replace(/\s+/g, "-")}-session.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(copy.export);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed");
      setStatus(copy.errors);
    } finally {
      setBusyState("idle");
    }
  }

  return (
    <div className="shell">
      <div className="viewer-stage">
        {viewerUrl ? (
          <iframe
            key={viewerUrl}
            ref={iframeRef}
            className="viewer-frame"
            src={viewerUrl}
            title="GDS-3D-VIEWER core"
            onLoad={connectViewerShell}
          />
        ) : (
          <div className="empty-stage">
            <strong>{copy.noLayout}</strong>
            <span>{copy.uploadHint}</span>
          </div>
        )}

        <div className="topbar">
          <div className="brand-block">
            <strong>{copy.brand}</strong>
            <span>{session?.manifest.name ?? copy.noLayout}</span>
          </div>
          <div className="topbar-actions">
            <button className="pill-button" onClick={() => uploadInputRef.current?.click()}>
              {busyState === "uploading" ? copy.loading : copy.load}
            </button>
            <button className="pill-button" onClick={() => setLanguage((current) => (current === "en" ? "zh" : "en"))}>
              {copy.language}
            </button>
            <button className="pill-button" onClick={exportCurrentSession} disabled={!session || busyState === "exporting"}>
              {copy.export}
            </button>
            <span className="status-chip">{status}</span>
          </div>
          <input
            ref={uploadInputRef}
            className="hidden-input"
            type="file"
            multiple
            accept=".gds,.gdsii,.json,.def,.lef"
            onChange={(event) => void handleUpload(event.target.files)}
            data-testid="upload-input"
          />
        </div>

        <div className="action-rail">
          <button
            className={`rail-button ${drawer === "viewer" ? "is-active" : ""}`}
            onClick={() => toggleDrawer("viewer")}
            disabled={!viewerUrl}
            data-testid="viewer-drawer-button"
          >
            {copy.viewer}
          </button>
          <button
            className={`rail-button ${drawer === "ai" ? "is-active" : ""}`}
            onClick={() => toggleDrawer("ai")}
            disabled={!session}
            data-testid="ai-drawer-button"
          >
            {copy.ai}
          </button>
          <button
            className={`rail-button ${drawer === "info" ? "is-active" : ""}`}
            onClick={() => toggleDrawer("info")}
            disabled={!session}
            data-testid="info-drawer-button"
          >
            {copy.info}
          </button>
          <button
            className={`rail-button ${drawer === "review" ? "is-active" : ""}`}
            onClick={() => toggleDrawer("review")}
            disabled={!session}
            data-testid="review-drawer-button"
          >
            {copy.review}
          </button>
        </div>

        {(busyState !== "idle" || (!viewerReady && viewerUrl)) && (
          <div className="busy-overlay">
            <strong>{copy.loading}</strong>
          </div>
        )}

        {error ? <div className="error-chip">{error}</div> : null}
      </div>

      {drawer !== "none" && drawer !== "viewer" && (
        <>
          <button className="drawer-backdrop" onClick={closePanels} aria-label="Close drawer" />
          <aside className="drawer" data-testid="side-drawer">
            <div className="drawer-header">
              <strong>{copy[drawer]}</strong>
              <button className="icon-button" onClick={closePanels}>
                ×
              </button>
            </div>

            {drawer === "ai" && (
              <div className="drawer-stack">
                <div className="drawer-block">
                  <label>{copy.selection}</label>
                  <strong>{selectionLabel}</strong>
                </div>
                <div className="drawer-block">
                  <label>{copy.promptExplain}</label>
                  <textarea value={explainPrompt} onChange={(event) => setExplainPrompt(event.target.value)} rows={3} />
                  <button className="drawer-button" onClick={() => void handleExplain()} data-testid="explain-button" disabled={!session || busyState === "explaining"}>
                    {copy.explain}
                  </button>
                </div>
                <div className="drawer-block">
                  <label>{copy.explain}</label>
                  {explainLines.length > 0 ? (
                    <ul className="drawer-list">
                      {explainLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <strong>{copy.explainEmpty}</strong>
                  )}
                </div>
                <div className="drawer-block">
                  <label>{copy.promptOperator}</label>
                  <textarea value={operatorPrompt} onChange={(event) => setOperatorPrompt(event.target.value)} rows={3} />
                  <button className="drawer-button" onClick={() => void handleOperator()} data-testid="operator-button" disabled={!session || busyState === "operating"}>
                    {copy.plan}
                  </button>
                </div>
                <div className="drawer-block">
                  <label>{copy.plan}</label>
                  {operatorLines.length > 0 ? (
                    <ul className="drawer-list">
                      {operatorLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  {operatorResult.actions.length > 0 ? (
                    <div className="action-list">
                      {operatorResult.actions.map((action) => (
                        <button
                          key={`${action.type}-${action.label}-${action.targetId ?? ""}`}
                          className="action-item"
                          onClick={() => applyOperatorAction(action)}
                          disabled={!canRunOperatorAction(action)}
                        >
                          <strong>{action.label}</strong>
                          <span>{action.type}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <strong>{copy.operatorEmpty}</strong>
                  )}
                </div>
              </div>
            )}

            {drawer === "info" && (
              <div className="drawer-stack">
                <div className="drawer-block">
                  <label>{copy.selection}</label>
                  <strong>{selectionLabel}</strong>
                </div>
                <div className="drawer-block">
                  <label>{copy.metrics}</label>
                  <ul className="drawer-list">
                    {metricLines.length > 0 ? metricLines.map((line) => <li key={line}>{line}</li>) : <li>{copy.drawerEmpty}</li>}
                  </ul>
                </div>
                <div className="drawer-block">
                  <label>{copy.hierarchy}</label>
                  <ul className="drawer-list">
                    {hierarchyLines.length > 0 ? hierarchyLines.map((line) => <li key={line}>{line}</li>) : <li>{copy.drawerEmpty}</li>}
                  </ul>
                </div>
                <div className="drawer-block">
                  <label>{copy.files}</label>
                  <ul className="drawer-list">
                    {(session?.manifest.sourceFiles?.length ? session.manifest.sourceFiles : [copy.drawerEmpty]).map((file) => (
                      <li key={file}>{file}</li>
                    ))}
                  </ul>
                </div>
                <div className="drawer-block">
                  <label>{copy.warnings}</label>
                  <ul className="drawer-list">
                    {(session?.warnings?.length ? session.warnings : [copy.drawerEmpty]).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {drawer === "review" && (
              <div className="drawer-stack">
                <div className="drawer-block">
                  <label>{copy.notes}</label>
                  <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} placeholder={copy.notePlaceholder} data-testid="note-input" />
                  <button className="drawer-button" onClick={addNote} data-testid="note-add-button">
                    {copy.addNote}
                  </button>
                </div>
                <div className="drawer-block">
                  <label>{copy.notes}</label>
                  <div className="note-list">
                    {notes.length > 0 ? (
                      notes.map((note) => (
                        <article key={note.id} className="note-item">
                          <strong>{note.author}</strong>
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                          <p>{note.message}</p>
                        </article>
                      ))
                    ) : (
                      <strong>{copy.drawerEmpty}</strong>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
