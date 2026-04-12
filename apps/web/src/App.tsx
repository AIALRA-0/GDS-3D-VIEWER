import { useEffect, useMemo, useState } from "react";
import SceneViewer from "./components/SceneViewer";
import { createSessionFromFiles, explainLayout, runOperator, buildDiffSummary, loadDefaultSession } from "./lib/api";
import {
  createLocalSessionPayloadReference,
  demoSessions
} from "./lib/demo";
import { readSceneStateFromUrl, writeSceneStateToUrl } from "./lib/url";
import type { DiffSummary, ExplainResult, LayoutManifest, OperatorResult, ReviewNote, ScenePanelId, SceneState, SessionPayload } from "../../../packages/shared/types";

const initialSession = demoSessions[0].session;

function panelLabel(panel: ScenePanelId): string {
  switch (panel) {
    case "viewer":
      return "Viewer";
    case "layers":
      return "Layers";
    case "hierarchy":
      return "Hierarchy";
    case "explain":
      return "Explain";
    case "operator":
      return "Operator";
    case "notes":
      return "Review";
  }
}

function formatBbox(manifest: LayoutManifest): string {
  const [x0, y0, z0, x1, y1, z1] = manifest.metrics.bbox;
  return `${x1 - x0} x ${y1 - y0} x ${z1 - z0}`;
}

function createDefaultSceneState(session: SessionPayload): SceneState {
  return {
    panel: "viewer",
    selectedLayerIds: session.manifest.layers.filter((layer) => layer.visible).slice(0, 3).map((layer) => layer.id),
    focusedNodeId: session.manifest.hierarchy[0]?.id ?? null,
    notes: session.state.notes
  };
}

export default function App() {
  const [session, setSession] = useState<SessionPayload>(() => initialSession);
  const [sceneState, setSceneState] = useState<SceneState>(() => readSceneStateFromUrl(createDefaultSceneState(initialSession)));
  const [explainPrompt, setExplainPrompt] = useState("Summarize the strongest engineering story in this layout.");
  const [operatorPrompt, setOperatorPrompt] = useState("Focus the control plane and isolate the most presentation-friendly macro.");
  const [reviewDraft, setReviewDraft] = useState("");
  const [explainResult, setExplainResult] = useState<ExplainResult>(initialSession.explain);
  const [operatorResult, setOperatorResult] = useState<OperatorResult>(initialSession.operator);
  const [diffResult, setDiffResult] = useState<DiffSummary>(initialSession.diff);
  const [statusMessage, setStatusMessage] = useState("Loaded local sample session.");
  const [isBusy, setIsBusy] = useState<"idle" | "uploading" | "explaining" | "operating">("idle");
  const [copied, setCopied] = useState(false);

  const referenceManifest = useMemo(() => createLocalSessionPayloadReference().manifest, []);

  useEffect(() => {
    let isMounted = true;

    void loadDefaultSession().then((remoteSession) => {
      if (!isMounted) {
        return;
      }

      setSession(remoteSession);
      setSceneState(readSceneStateFromUrl(createDefaultSceneState(remoteSession)));
      setExplainResult(remoteSession.explain);
      setOperatorResult(remoteSession.operator);
      setDiffResult(buildDiffSummary(remoteSession.manifest, referenceManifest));
      setStatusMessage(
        remoteSession.sessionId ? "Loaded backend sample session." : "Loaded local sample session."
      );
    });

    return () => {
      isMounted = false;
    };
  }, [referenceManifest]);

  useEffect(() => {
    const onPopState = () => {
      setSceneState((current) => readSceneStateFromUrl({ ...createDefaultSceneState(session), ...current }));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [session]);

  useEffect(() => {
    writeSceneStateToUrl(sceneState, { bundle: session.manifest.id });
  }, [sceneState, session.manifest.id]);

  useEffect(() => {
    setDiffResult(buildDiffSummary(session.manifest, referenceManifest));
  }, [session.manifest, referenceManifest]);

  useEffect(() => {
    const firstNodeId = session.manifest.hierarchy[0]?.id ?? null;
    if (!sceneState.focusedNodeId && firstNodeId) {
      setSceneState((current) => ({ ...current, focusedNodeId: firstNodeId }));
    }
  }, [sceneState.focusedNodeId, session.manifest.hierarchy]);

  async function loadSession(nextSession: SessionPayload, label: string) {
    setSession(nextSession);
    const nextState = {
      ...createDefaultSceneState(nextSession),
      panel: sceneState.panel
    };
    setSceneState(nextState);
    setExplainResult(nextSession.explain);
    setOperatorResult(nextSession.operator);
    setDiffResult(buildDiffSummary(nextSession.manifest, referenceManifest));
    setStatusMessage(label);
  }

  async function handleSampleLoad(id: string) {
    const chosen = demoSessions.find((entry) => entry.id === id)?.session ?? initialSession;
    await loadSession(chosen, `Loaded sample bundle: ${chosen.manifest.name}.`);
  }

  async function handleUpload(files: FileList | null) {
    const uploadFiles = files ? Array.from(files) : [];
    if (!uploadFiles.length) {
      return;
    }

    setIsBusy("uploading");
    const nextSession = await createSessionFromFiles(uploadFiles);
    await loadSession(nextSession, `Loaded uploaded bundle: ${uploadFiles.map((file) => file.name).join(", ")}.`);
    setIsBusy("idle");
  }

  async function handleExplain() {
    setIsBusy("explaining");
    const result = await explainLayout(session.manifest, explainPrompt);
    setExplainResult(result);
    setStatusMessage(result.source === "remote-ai" ? "Explain summary generated by the backend." : "Explain summary generated locally.");
    setIsBusy("idle");
  }

  async function handleOperator() {
    setIsBusy("operating");
    const result = await runOperator(session.manifest, operatorPrompt);
    setOperatorResult(result);
    setStatusMessage(result.source === "remote-ai" ? "Operator actions returned by the backend." : "Operator actions generated locally.");
    setIsBusy("idle");
  }

  function applyOperatorAction(action: OperatorResult["actions"][number]) {
    const targetId = action.targetId ?? null;
    const payload = action.payload ?? null;

    if (action.type === "focus" && targetId) {
      setSceneState((current) => ({ ...current, focusedNodeId: targetId, panel: "viewer" }));
      return;
    }

    if (action.type === "toggle-layer" && targetId) {
      setSceneState((current) => ({
        ...current,
        selectedLayerIds: current.selectedLayerIds.includes(targetId)
          ? current.selectedLayerIds.filter((layerId) => layerId !== targetId)
          : [...current.selectedLayerIds, targetId]
      }));
      return;
    }

    if (action.type === "isolate" && targetId) {
      setSceneState((current) => ({ ...current, selectedLayerIds: [targetId], panel: "layers" }));
      return;
    }

    if (action.type === "annotate" && payload) {
      setSceneState((current) => ({
        ...current,
        notes: [
          {
            id: `note-${Date.now()}`,
            author: "AI operator",
            message: payload,
            layerIds: current.selectedLayerIds,
            createdAt: new Date().toISOString()
          },
          ...current.notes
        ],
        panel: "notes"
      }));
    }
  }

  function toggleLayer(layerId: string) {
    setSceneState((current) => ({
      ...current,
      selectedLayerIds: current.selectedLayerIds.includes(layerId)
        ? current.selectedLayerIds.filter((candidate) => candidate !== layerId)
        : [...current.selectedLayerIds, layerId]
    }));
  }

  function clearLayers() {
    setSceneState((current) => ({ ...current, selectedLayerIds: [] }));
  }

  function selectAllLayers() {
    setSceneState((current) => ({ ...current, selectedLayerIds: session.manifest.layers.map((layer) => layer.id) }));
  }

  function focusNode(nodeId: string) {
    setSceneState((current) => ({ ...current, focusedNodeId: nodeId, panel: "hierarchy" }));
  }

  function addNote() {
    if (!reviewDraft.trim()) {
      return;
    }

    const note: ReviewNote = {
      id: `note-${Date.now()}`,
      author: "You",
      message: reviewDraft.trim(),
      layerIds: sceneState.selectedLayerIds,
      createdAt: new Date().toISOString()
    };

    setSceneState((current) => ({ ...current, notes: [note, ...current.notes], panel: "notes" }));
    setReviewDraft("");
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const selectedNode = session.manifest.hierarchy.find((node) => node.id === sceneState.focusedNodeId) ?? session.manifest.hierarchy[0];
  const panelSequence: ScenePanelId[] = ["viewer", "layers", "hierarchy", "explain", "operator", "notes"];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ICViewer cockpit</p>
          <h1>Industrial layout review for GDS, sidecars, and AI-assisted inspection.</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={copyShareLink} data-testid="copy-link-button">
            {copied ? "Copied link" : "Copy scene link"}
          </button>
          <span className="status-pill">{statusMessage}</span>
        </div>
      </header>

      <main className="cockpit-grid">
        <aside className="rail rail-left">
          <section className="panel load-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Load</p>
                <h2>Bundle input</h2>
              </div>
              <span className="mini-chip">{isBusy === "uploading" ? "Loading" : session.manifest.source}</span>
            </div>
            <div className="sample-list" data-testid="sample-list">
              {demoSessions.map((entry) => (
                <button key={entry.id} className={`sample-button ${entry.session.manifest.id === session.manifest.id ? "is-active" : ""}`} onClick={() => void handleSampleLoad(entry.id)}>
                  <span>{entry.label}</span>
                  <small>{entry.session.manifest.technology}</small>
                </button>
              ))}
            </div>
            <label className="upload-dropzone" data-testid="upload-zone">
              <input
                type="file"
                multiple
                accept=".gds,.gdsii,.gltf,.glb,.json,.zip"
                onChange={(event) => void handleUpload(event.target.files)}
                data-testid="upload-input"
              />
              <span>Drop a GDS bundle, sidecars, or JSON session to swap the cockpit.</span>
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
        </aside>

        <section className="center-stage">
          <div className="center-toolbar">
            <div className="toolbar-badge">{panelLabel(sceneState.panel)}</div>
            <div className="toolbar-meta">
              <span>{session.manifest.name}</span>
              <span>{session.manifest.tags.join(" · ")}</span>
            </div>
            <div className="toolbar-meta toolbar-meta-right">
              <span>{formatBbox(session.manifest)}</span>
              <span>{session.manifest.metrics.utilizationPercent.toFixed(1)}% util</span>
            </div>
          </div>
          <SceneViewer
            manifest={session.manifest}
            assetUrl={session.assetUrl}
            selectedLayerIds={sceneState.selectedLayerIds}
            focusedNodeId={sceneState.focusedNodeId}
            onNodeSelect={focusNode}
          />
          <div className="scene-footbar">
            <div>
              <label>Selected node</label>
              <strong>{selectedNode?.name ?? "None"}</strong>
            </div>
            <div>
              <label>Visible layers</label>
              <strong>{sceneState.selectedLayerIds.length || session.manifest.layers.length} active</strong>
            </div>
            <div>
              <label>Panel state</label>
              <strong>{panelLabel(sceneState.panel)}</strong>
            </div>
          </div>
        </section>

        <aside className="rail rail-right">
          <section className="panel inspect-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Inspect</p>
                <h2>Hierarchy and stats</h2>
              </div>
              <span className="mini-chip">{session.manifest.source}</span>
            </div>
            <div className="stats-grid" data-testid="stats-grid">
              <article>
                <label>Cells</label>
                <strong>{session.manifest.metrics.cellCount}</strong>
              </article>
              <article>
                <label>Instances</label>
                <strong>{session.manifest.metrics.instanceCount}</strong>
              </article>
              <article>
                <label>Polygons</label>
                <strong>{session.manifest.metrics.polygonCount}</strong>
              </article>
              <article>
                <label>Area</label>
                <strong>{session.manifest.metrics.estimatedAreaMm2.toFixed(2)} mm2</strong>
              </article>
            </div>
            <div className="hierarchy-list">
              {session.manifest.hierarchy.map((node) => (
                <button
                  key={node.id}
                  className={`hierarchy-row ${sceneState.focusedNodeId === node.id ? "is-active" : ""}`}
                  onClick={() => focusNode(node.id)}
                  data-testid={`node-${node.id}`}
                >
                  <span>
                    <strong>{node.name}</strong>
                    <small>{node.kind}</small>
                  </span>
                  <span>{node.instanceCount} inst</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel ai-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">AI explain</p>
                <h2>Scene summary</h2>
              </div>
              <button className="text-button" onClick={() => void handleExplain()} data-testid="explain-button">
                {isBusy === "explaining" ? "Working..." : "Refresh"}
              </button>
            </div>
            <textarea
              className="prompt-box"
              value={explainPrompt}
              onChange={(event) => setExplainPrompt(event.target.value)}
              rows={3}
            />
            <div className="response-copy" data-testid="explain-output">
              <p>{explainResult.summary}</p>
              <ul>
                {explainResult.highlights.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <small>Confidence {Math.round(explainResult.confidence * 100)}% · {explainResult.source}</small>
            </div>
          </section>

          <section className="panel operator-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">AI operator</p>
                <h2>Viewer actions</h2>
              </div>
              <button className="text-button" onClick={() => void handleOperator()} data-testid="operator-button">
                {isBusy === "operating" ? "Working..." : "Run"}
              </button>
            </div>
            <textarea
              className="prompt-box"
              value={operatorPrompt}
              onChange={(event) => setOperatorPrompt(event.target.value)}
              rows={3}
            />
            <div className="chip-row">
              {["Focus ALU", "Isolate io ring", "Annotate control plane"].map((prompt) => (
                <button key={prompt} className="chip-button" onClick={() => setOperatorPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
            <div className="response-copy">
              <p>{operatorResult.rationale}</p>
              <div className="action-stack">
                {operatorResult.actions.map((action) => (
                  <button key={`${action.type}-${action.label}`} className="action-button" onClick={() => applyOperatorAction(action)} data-testid={`action-${action.type}`}>
                    <strong>{action.label}</strong>
                    <small>{action.type}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="panel review-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Review</p>
                <h2>Notes and diff</h2>
              </div>
              <span className="mini-chip">{sceneState.notes.length} notes</span>
            </div>
            <div className="diff-card" data-testid="diff-card">
              <strong>{diffResult.title}</strong>
              <div className="diff-columns">
                <div>
                  <label>Added</label>
                  <p>{diffResult.added.length ? diffResult.added.join(", ") : "None"}</p>
                </div>
                <div>
                  <label>Changed</label>
                  <p>{diffResult.changed.join(" · ")}</p>
                </div>
              </div>
              <small>{diffResult.deltaLines.join(" | ")}</small>
            </div>
            <textarea
              className="prompt-box"
              rows={3}
              placeholder="Write a review note tied to the current layer selection."
              value={reviewDraft}
              onChange={(event) => setReviewDraft(event.target.value)}
              data-testid="note-input"
            />
            <button className="primary-button" onClick={addNote} data-testid="note-add-button">
              Add note
            </button>
            <div className="notes-list">
              {sceneState.notes.map((note) => (
                <article key={note.id} className="note-card">
                  <strong>{note.author}</strong>
                  <p>{note.message}</p>
                  <small>{new Date(note.createdAt).toLocaleString()}</small>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </main>

      <footer className="bottom-strip">
        {panelSequence.map((panel) => (
          <button
            key={panel}
            className={`panel-tab ${sceneState.panel === panel ? "is-active" : ""}`}
            onClick={() => setSceneState((current) => ({ ...current, panel }))}
          >
            {panelLabel(panel)}
          </button>
        ))}
      </footer>
    </div>
  );
}
