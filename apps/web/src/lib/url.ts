import type { PerformanceMode, ScenePanelId, SceneState } from "../../../../packages/shared/types";

const PANEL_IDS: ScenePanelId[] = [
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

const PERFORMANCE_MODES: PerformanceMode[] = ["full", "simplified", "hierarchy-preview"];

export function isScenePanel(value: string | null): value is ScenePanelId {
  return PANEL_IDS.includes(value as ScenePanelId);
}

export function isPerformanceMode(value: string | null): value is PerformanceMode {
  return PERFORMANCE_MODES.includes(value as PerformanceMode);
}

export function readBundleHintFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("bundle");
}

export function readSceneStateFromUrl(defaults: SceneState): SceneState {
  const params = new URLSearchParams(window.location.search);
  const panelValue = params.get("panel");
  const perfValue = params.get("perf");
  const panel = isScenePanel(panelValue) ? panelValue : defaults.panel;
  const performanceMode = isPerformanceMode(perfValue) ? perfValue : defaults.performanceMode;
  const selectedLayerIds = params.get("layers")
    ? params
        .get("layers")!
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : defaults.selectedLayerIds;
  const focusedNodeId = params.get("focus") ?? defaults.focusedNodeId;
  const selectedMarkerId = params.get("marker") ?? defaults.selectedMarkerId;
  return {
    ...defaults,
    panel,
    performanceMode,
    selectedLayerIds,
    focusedNodeId,
    selectedMarkerId
  };
}

export function writeSceneStateToUrl(state: SceneState, extra: Record<string, string | null | undefined> = {}): void {
  const url = new URL(window.location.href);
  url.searchParams.set("panel", state.panel);
  url.searchParams.set("perf", state.performanceMode);
  if (state.selectedLayerIds.length > 0) {
    url.searchParams.set("layers", state.selectedLayerIds.join(","));
  } else {
    url.searchParams.delete("layers");
  }
  if (state.focusedNodeId) {
    url.searchParams.set("focus", state.focusedNodeId);
  } else {
    url.searchParams.delete("focus");
  }
  if (state.selectedMarkerId) {
    url.searchParams.set("marker", state.selectedMarkerId);
  } else {
    url.searchParams.delete("marker");
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value && value.length > 0) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  }

  const search = url.searchParams.toString();
  window.history.replaceState({}, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
}
