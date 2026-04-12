import type { ScenePanelId, SceneState } from "../../../../packages/shared/types";

const PANEL_IDS: ScenePanelId[] = ["viewer", "layers", "hierarchy", "explain", "operator", "notes"];

export function isScenePanel(value: string | null): value is ScenePanelId {
  return PANEL_IDS.includes(value as ScenePanelId);
}

export function readSceneStateFromUrl(defaults: SceneState): SceneState {
  const params = new URLSearchParams(window.location.search);
  const panelValue = params.get("panel");
  const panel = isScenePanel(panelValue) ? panelValue : defaults.panel;
  const selectedLayerIds = params.get("layers")
    ? params
        .get("layers")!
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : defaults.selectedLayerIds;
  const focusedNodeId = params.get("focus") ?? defaults.focusedNodeId;
  return {
    ...defaults,
    panel,
    selectedLayerIds,
    focusedNodeId
  };
}

export function writeSceneStateToUrl(state: SceneState, extra: Record<string, string | null | undefined> = {}): void {
  const url = new URL(window.location.href);
  url.searchParams.set("panel", state.panel);
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

  for (const [key, value] of Object.entries(extra)) {
    if (value && value.length > 0) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  }

  window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}
