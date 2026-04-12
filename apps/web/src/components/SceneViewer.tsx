import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { UI_COPY, type UiLanguage } from "../lib/copy";
import type { CameraState, LayoutManifest, LayoutNode, PerformanceMode, ReviewMarker } from "../../../../packages/shared/types";

interface ViewerAction {
  id: number;
  type: "fit" | "reset" | "restore-camera" | "focus-marker";
  payload?: { nodeId?: string | null; markerId?: string | null } | CameraState;
}

interface SceneViewerProps {
  manifest: LayoutManifest;
  displayName: string;
  assetUrl?: string | null;
  selectedLayerIds: string[];
  focusedNodeId: string | null;
  selectedMarkerId: string | null;
  performanceMode: PerformanceMode;
  language: UiLanguage;
  action: ViewerAction | null;
  onNodeSelect: (nodeId: string) => void;
  onMarkerSelect: (markerId: string) => void;
  onCameraChange: (camera: CameraState) => void;
}

interface ViewerRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  root: THREE.Group;
  host: HTMLDivElement;
  frame: number;
  observer: ResizeObserver;
  hitMeshes: Map<string, { mesh: THREE.Mesh; node: LayoutNode }>;
  markerMeshes: Map<string, { mesh: THREE.Mesh; marker: ReviewMarker }>;
  markerPillars: THREE.Mesh[];
  targetGoal: THREE.Vector3;
  cameraGoal: THREE.Vector3;
  importedRoot: THREE.Object3D | null;
  disposeObjects: Array<() => void>;
  layoutCenter: { x: number; y: number; z: number };
  layoutScale: number;
  emitCameraState: () => void;
  fitBounds: (bbox: [number, number, number, number, number, number] | number[]) => void;
  resetCamera: () => void;
  interactionState: {
    active: boolean;
  };
}

const DETAIL_POLYGON_THRESHOLD = 25000;

function colorForSeverity(severity: ReviewMarker["severity"]): string {
  switch (severity) {
    case "critical":
      return "#f24e3d";
    case "warning":
      return "#f2a03d";
    case "info":
      return "#60bfd9";
  }
}

function roundCameraState(camera: THREE.PerspectiveCamera, target: THREE.Vector3): CameraState {
  const round = (value: number) => Number(value.toFixed(4));
  return {
    position: [round(camera.position.x), round(camera.position.y), round(camera.position.z)],
    target: [round(target.x), round(target.y), round(target.z)]
  };
}

export default function SceneViewer({
  manifest,
  displayName,
  assetUrl,
  selectedLayerIds,
  focusedNodeId,
  selectedMarkerId,
  performanceMode,
  language,
  action,
  onNodeSelect,
  onMarkerSelect,
  onCameraChange
}: SceneViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<ViewerRuntime | null>(null);
  const latestSelectionRef = useRef({
    selectedLayerIds,
    focusedNodeId,
    selectedMarkerId,
    performanceMode
  });
  const latestActionRef = useRef(action);
  const latestNodeSelectRef = useRef(onNodeSelect);
  const latestMarkerSelectRef = useRef(onMarkerSelect);
  const latestCameraChangeRef = useRef(onCameraChange);
  const lastHandledActionIdRef = useRef<number | null>(null);
  const copy = UI_COPY[language];
  const hasGeometry = manifest.metrics.layerCount > 0 || manifest.hierarchy.length > 0 || Boolean(assetUrl);

  useEffect(() => {
    latestSelectionRef.current = { selectedLayerIds, focusedNodeId, selectedMarkerId, performanceMode };
  }, [focusedNodeId, performanceMode, selectedLayerIds, selectedMarkerId]);

  useEffect(() => {
    latestActionRef.current = action;
  }, [action]);

  useEffect(() => {
    latestNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    latestMarkerSelectRef.current = onMarkerSelect;
  }, [onMarkerSelect]);

  useEffect(() => {
    latestCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    host.innerHTML = "";
    host.style.touchAction = "none";
    if (!hasGeometry) {
      return;
    }

    const scene = new THREE.Scene();
    const detailAssetUrl = assetUrl ?? null;
    const shouldRenderDetailedGeometry = Boolean(detailAssetUrl) && performanceMode === "full";
    const showNodeSummaries = !shouldRenderDetailedGeometry;
    const isHeavyGeometry = manifest.metrics.polygonCount >= DETAIL_POLYGON_THRESHOLD;
    const layerMatchers = manifest.layers.map((layer) => ({
      layerId: layer.id,
      suffix: `_${layer.name.toLowerCase()}`
    }));
    const layerNames = new Map(manifest.layers.map((layer) => [layer.name.toLowerCase(), layer.id]));
    const materialCache = new Map<string, THREE.MeshBasicMaterial>();

    const camera = new THREE.PerspectiveCamera(40, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 300);
    camera.position.set(12, 11, 16);

    const renderer = new THREE.WebGLRenderer({
      antialias: performanceMode === "full" && !isHeavyGeometry,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, performanceMode === "full" ? (isHeavyGeometry ? 0.72 : 0.9) : 0.85)
    );
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.sortObjects = false;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    const eventedControls = controls as OrbitControls & {
      addEventListener(type: "start" | "change" | "end", listener: () => void): void;
      removeEventListener(type: "start" | "change" | "end", listener: () => void): void;
    };
    controls.enableDamping = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 68;
    controls.target.set(0, 0.6, 0);
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    const tunedControls = controls as OrbitControls & {
      zoomToCursor?: boolean;
      screenSpacePanning?: boolean;
      panSpeed?: number;
      rotateSpeed?: number;
      zoomSpeed?: number;
    };
    tunedControls.zoomToCursor = true;
    tunedControls.screenSpacePanning = true;
    tunedControls.panSpeed = 1.1;
    tunedControls.rotateSpeed = 0.92;
    tunedControls.zoomSpeed = 1.08;

    const root = new THREE.Group();
    scene.add(root);

    const bbox = manifest.metrics.bbox;
    const centerX = (bbox[0] + bbox[3]) / 2;
    const centerY = (bbox[1] + bbox[4]) / 2;
    const centerZ = (bbox[2] + bbox[5]) / 2;
    const spanX = Math.max(bbox[3] - bbox[0], 1);
    const spanY = Math.max(bbox[4] - bbox[1], 1);
    const spanZ = Math.max(bbox[5] - bbox[2], 1);
    const layoutScale = 8.5 / Math.max(spanX, spanY, spanZ, 1);

    const hitMeshes = new Map<string, { mesh: THREE.Mesh; node: LayoutNode }>();
    const markerMeshes = new Map<string, { mesh: THREE.Mesh; marker: ReviewMarker }>();
    const markerPillars: THREE.Mesh[] = [];
    const disposeObjects: Array<() => void> = [];

    function toWorldPoint(x: number, y: number, z: number): THREE.Vector3 {
      return new THREE.Vector3(
        (x - centerX) * layoutScale,
        (z - centerZ) * layoutScale,
        (y - centerY) * layoutScale
      );
    }

    function toWorldBounds(nodeBbox: number[]) {
      const min = toWorldPoint(nodeBbox[0], nodeBbox[1], nodeBbox[2]);
      const max = toWorldPoint(nodeBbox[3], nodeBbox[4], nodeBbox[5]);
      const size = new THREE.Vector3(
        Math.max(Math.abs(max.x - min.x), 0.22),
        Math.max(Math.abs(max.y - min.y), 0.18),
        Math.max(Math.abs(max.z - min.z), 0.22)
      );
      const center = new THREE.Vector3(
        (min.x + max.x) / 2,
        (min.y + max.y) / 2,
        (min.z + max.z) / 2
      );
      return { center, size };
    }

    function fitBounds(targetBbox: [number, number, number, number, number, number] | number[]) {
      const { center, size } = toWorldBounds(targetBbox);
      const radius = Math.max(size.length() * 0.5, 1.35);
      const direction = camera.position.clone().sub(controls.target).normalize();
      if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() === 0) {
        direction.set(0.86, 0.72, 0.94).normalize();
      }
      runtime.targetGoal.copy(center);
      runtime.cameraGoal.copy(center.clone().add(direction.multiplyScalar(radius * 2.35)));
      commitCameraGoal();
    }

    function resetCamera() {
      runtime.targetGoal.set(0, 0.6, 0);
      runtime.cameraGoal.set(12, 11, 16);
      commitCameraGoal();
    }

    function buildNodeGeometry(node: LayoutNode) {
      const { center, size } = toWorldBounds(node.bbox);
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#708392"),
        transparent: true,
        opacity: performanceMode === "hierarchy-preview" ? 0.74 : 0.08,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(center);
      mesh.userData = { nodeId: node.id };
      root.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: "#2d3844",
          transparent: true,
          opacity: performanceMode === "hierarchy-preview" ? 0.84 : 0.32
        })
      );
      edges.position.copy(center);
      root.add(edges);
      mesh.updateMatrix();
      edges.updateMatrix();

      hitMeshes.set(node.id, { mesh, node });
      disposeObjects.push(() => {
        geometry.dispose();
        material.dispose();
        (edges.geometry as THREE.BufferGeometry).dispose();
        (edges.material as THREE.Material).dispose();
      });
    }

    function buildMarker(marker: ReviewMarker) {
      const markerGroup = new THREE.Group();
      const position = toWorldPoint(marker.position[0], marker.position[1], marker.position[2]);
      markerGroup.position.copy(position);
      markerGroup.userData = { markerId: marker.id };

      const sphereGeometry = new THREE.SphereGeometry(0.12, 24, 24);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorForSeverity(marker.severity)),
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.userData = { markerId: marker.id };
      markerGroup.add(sphere);

      const pillarGeometry = new THREE.CylinderGeometry(0.02, 0.02, Math.max(position.y + 1.5, 0.6), 8);
      const pillarMaterial = new THREE.MeshBasicMaterial({
        color: colorForSeverity(marker.severity),
        transparent: true,
        opacity: 0.45
      });
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(0, -(Math.max(position.y + 1.5, 0.6) / 2), 0);
      markerGroup.add(pillar);
      markerPillars.push(pillar);

      markerGroup.updateMatrixWorld(true);
      root.add(markerGroup);
      markerMeshes.set(marker.id, { mesh: sphere, marker });
      disposeObjects.push(() => {
        sphereGeometry.dispose();
        sphereMaterial.dispose();
        pillarGeometry.dispose();
        pillarMaterial.dispose();
      });
    }

    if (showNodeSummaries) {
      for (const node of manifest.hierarchy) {
        buildNodeGeometry(node);
      }
    }

    for (const marker of manifest.markers ?? []) {
      buildMarker(marker);
    }

    let importedRoot: THREE.Object3D | null = null;
    let transitionFrame = 0;
    if (shouldRenderDetailedGeometry) {
      const loader = new GLTFLoader();
      loader.load(
        detailAssetUrl!,
        (gltf) => {
          importedRoot = gltf.scene;
          const importedBounds = new THREE.Box3().setFromObject(importedRoot);
          const importedCenter = importedBounds.getCenter(new THREE.Vector3());
          const importedSize = importedBounds.getSize(new THREE.Vector3());
          const importedLargest = Math.max(importedSize.x, importedSize.y, importedSize.z, 1);
          const scaleFactor = 8.5 / importedLargest;
          importedRoot.scale.setScalar(scaleFactor);
          importedRoot.position.set(
            -importedCenter.x * scaleFactor,
            -importedCenter.y * scaleFactor,
            -importedCenter.z * scaleFactor
          );
          importedRoot.traverse((entry) => {
            const entryName = "name" in entry && typeof entry.name === "string" ? entry.name.toLowerCase() : "";
            const matchedLayer = layerMatchers.find(({ suffix }) => entryName.endsWith(suffix));
            let matchedLayerId = matchedLayer?.layerId;
            if ("material" in entry) {
              const material = entry.material as THREE.Material | THREE.Material[] | undefined;
              const materials = Array.isArray(material) ? material : material ? [material] : [];
              if (!matchedLayerId) {
                for (const item of materials) {
                  if (item.name && layerNames.has(item.name.toLowerCase())) {
                    matchedLayerId = layerNames.get(item.name.toLowerCase()) ?? matchedLayerId;
                    break;
                  }
                }
              }
              const replacements = materials.map((item) => {
                const cached = materialCache.get(item.uuid);
                if (cached) {
                  return cached;
                }
                const basic = new THREE.MeshBasicMaterial({
                  color: "color" in item ? (item.color as THREE.Color).clone() : new THREE.Color("#c8d2dd"),
                  transparent: true,
                  opacity: 0.96,
                  depthWrite: true
                });
                materialCache.set(item.uuid, basic);
                disposeObjects.push(() => basic.dispose());
                return basic;
              });
              entry.material = Array.isArray(material) ? replacements : replacements[0];
            }
            if (matchedLayerId) {
              entry.userData.layerId = matchedLayerId;
            }
            if ("frustumCulled" in entry) {
              entry.frustumCulled = true;
            }
            if ("matrixAutoUpdate" in entry) {
              entry.matrixAutoUpdate = false;
            }
            if ("updateMatrix" in entry && typeof entry.updateMatrix === "function") {
              entry.updateMatrix();
            }
          });
          importedRoot.updateMatrixWorld(true);
          root.add(importedRoot);
          renderScene(true);
        },
        undefined,
        () => {
          importedRoot = null;
        }
      );
    }

    const runtime: ViewerRuntime = {
      scene,
      camera,
      renderer,
      controls,
      root,
      host,
      frame: 0,
      observer: new ResizeObserver(() => {
        const width = host.clientWidth;
        const height = Math.max(host.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        renderScene(true);
      }),
      hitMeshes,
      markerMeshes,
      markerPillars,
      targetGoal: new THREE.Vector3(0, 0.6, 0),
      cameraGoal: new THREE.Vector3(12, 11, 16),
      importedRoot,
      disposeObjects,
      layoutCenter: { x: centerX, y: centerY, z: centerZ },
      layoutScale,
      interactionState: {
        active: false
      },
      emitCameraState: () => {
        latestCameraChangeRef.current(roundCameraState(camera, controls.target));
      },
      fitBounds,
      resetCamera
    };
    runtimeRef.current = runtime;
    runtime.observer.observe(host);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart = { x: 0, y: 0, button: 0 };

    function renderScene(forceEmit = false) {
      renderer.render(scene, camera);
      if (forceEmit) {
        runtime.emitCameraState();
      }
    }

    function commitCameraGoal(immediate = false) {
      if (transitionFrame) {
        window.cancelAnimationFrame(transitionFrame);
        transitionFrame = 0;
      }
      if (immediate) {
        controls.target.copy(runtime.targetGoal);
        camera.position.copy(runtime.cameraGoal);
        controls.update();
        renderScene(true);
        return;
      }
      scheduleTransition();
    }

    function stepTransition() {
      transitionFrame = 0;
      const targetDelta = controls.target.distanceTo(runtime.targetGoal);
      const cameraDelta = camera.position.distanceTo(runtime.cameraGoal);

      if (targetDelta < 0.01 && cameraDelta < 0.01) {
        controls.target.copy(runtime.targetGoal);
        camera.position.copy(runtime.cameraGoal);
        controls.update();
        renderScene(true);
        return;
      }

      controls.target.lerp(runtime.targetGoal, 0.18);
      camera.position.lerp(runtime.cameraGoal, 0.18);
      controls.update();
      renderScene(false);
      transitionFrame = window.requestAnimationFrame(stepTransition);
    }

    function scheduleTransition() {
      if (transitionFrame) {
        return;
      }
      transitionFrame = window.requestAnimationFrame(stepTransition);
    }

    function updatePointer(event: PointerEvent | MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    }

    function pickScene(event: PointerEvent | MouseEvent) {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const markerHit = raycaster.intersectObjects(Array.from(markerMeshes.values()).map((entry) => entry.mesh), false)[0];
      if (markerHit) {
        const markerId = (markerHit.object.userData as { markerId?: string }).markerId;
        if (markerId) {
          return { markerId };
        }
      }
      const nodeHit = raycaster.intersectObjects(Array.from(hitMeshes.values()).map((entry) => entry.mesh), false)[0];
      if (nodeHit) {
        const nodeId = (nodeHit.object.userData as { nodeId?: string }).nodeId;
        if (nodeId) {
          return { nodeId };
        }
      }
      return {};
    }

    function onPointerMove(event: PointerEvent) {
      const hit = pickScene(event);
      renderer.domElement.style.cursor = hit.markerId || hit.nodeId ? "pointer" : "grab";
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button === 1 || event.button === 2) {
        event.preventDefault();
      }
      pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
      renderer.domElement.style.cursor = event.button === 2 ? "grabbing" : "grab";
    }

    function onPointerUp(event: PointerEvent) {
      renderer.domElement.style.cursor = "grab";
      if (pointerStart.button !== 0) {
        return;
      }
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      if (moved > 5) {
        return;
      }
      const hit = pickScene(event);
      if (hit.markerId) {
        latestMarkerSelectRef.current(hit.markerId);
        return;
      }
      if (hit.nodeId) {
        latestNodeSelectRef.current(hit.nodeId);
      }
    }

    function onDoubleClick(event: MouseEvent) {
      const hit = pickScene(event);
      if (hit.markerId) {
        latestMarkerSelectRef.current(hit.markerId);
        const marker = manifest.markers?.find((entry) => entry.id === hit.markerId);
        if (marker?.bbox) {
          fitBounds(marker.bbox);
        }
        return;
      }
      if (hit.nodeId) {
        latestNodeSelectRef.current(hit.nodeId);
        const node = manifest.hierarchy.find((entry) => entry.id === hit.nodeId);
        if (node) {
          fitBounds(node.bbox);
        }
        return;
      }
      fitBounds(manifest.metrics.bbox);
    }

    const onControlStart = () => {
      runtime.interactionState.active = true;
      runtime.targetGoal.copy(controls.target);
      runtime.cameraGoal.copy(camera.position);
    };

    const onControlChange = () => {
      runtime.targetGoal.copy(controls.target);
      runtime.cameraGoal.copy(camera.position);
      renderScene(false);
    };

    const onControlEnd = () => {
      runtime.interactionState.active = false;
      runtime.targetGoal.copy(controls.target);
      runtime.cameraGoal.copy(camera.position);
      renderScene(true);
    };

    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onAuxClick = (event: MouseEvent) => event.preventDefault();
    const onWheel = (event: WheelEvent) => event.preventDefault();
    const onGesture = (event: Event) => event.preventDefault();

    eventedControls.addEventListener("start", onControlStart);
    eventedControls.addEventListener("change", onControlChange);
    eventedControls.addEventListener("end", onControlEnd);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("dblclick", onDoubleClick);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    renderer.domElement.addEventListener("auxclick", onAuxClick);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("gesturestart", onGesture);
    renderer.domElement.addEventListener("gesturechange", onGesture);
    renderer.domElement.addEventListener("gestureend", onGesture);

    function refreshVisualState() {
      const selection = latestSelectionRef.current;
      const selectedSet = new Set(selection.selectedLayerIds);

      for (const { mesh, node } of hitMeshes.values()) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        const isFocused = selection.focusedNodeId === node.id;
        const isVisibleLayer =
          selection.selectedLayerIds.length > 0 &&
          node.focusLayerIds.some((layerId) => selection.selectedLayerIds.includes(layerId));
        const baseOpacity =
          selection.performanceMode === "hierarchy-preview"
            ? isVisibleLayer
              ? 0.72
              : 0.14
            : isVisibleLayer
              ? 0.08
              : 0.02;
        material.opacity = isFocused ? 0.24 : baseOpacity;
        material.color.set(isFocused ? "#7b8ea2" : isVisibleLayer ? "#718796" : "#4f6070");
        mesh.scale.setScalar(isFocused ? 1.02 : 1);
      }

      for (const { mesh, marker } of markerMeshes.values()) {
        const active = selection.selectedMarkerId === marker.id;
        mesh.scale.setScalar(active ? 1.28 : 1);
      }

      if (runtime.importedRoot) {
        runtime.importedRoot.traverse((entry) => {
          const layerId = (entry.userData as { layerId?: string }).layerId;
          if (layerId) {
            entry.visible = selectedSet.has(layerId);
          }
        });
      }

      renderScene(true);
    }

    resetCamera();
    if (manifest.metrics.layerCount > 0) {
      const { center, size } = toWorldBounds(manifest.metrics.bbox);
      const radius = Math.max(size.length() * 0.5, 1.35);
      const direction = camera.position.clone().sub(controls.target).normalize();
      if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() === 0) {
        direction.set(0.86, 0.72, 0.94).normalize();
      }
      runtime.targetGoal.copy(center);
      runtime.cameraGoal.copy(center.clone().add(direction.multiplyScalar(radius * 2.35)));
      commitCameraGoal(true);
    } else {
      controls.update();
      renderScene(true);
    }
    refreshVisualState();

    return () => {
      if (transitionFrame) {
        window.cancelAnimationFrame(transitionFrame);
      }
      runtime.observer.disconnect();
      eventedControls.removeEventListener("start", onControlStart);
      eventedControls.removeEventListener("change", onControlChange);
      eventedControls.removeEventListener("end", onControlEnd);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      renderer.domElement.removeEventListener("auxclick", onAuxClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("gesturestart", onGesture);
      renderer.domElement.removeEventListener("gesturechange", onGesture);
      renderer.domElement.removeEventListener("gestureend", onGesture);
      controls.dispose();
      if (typeof renderer.forceContextLoss === "function") {
        renderer.forceContextLoss();
      }
      renderer.dispose();
      for (const dispose of disposeObjects) {
        dispose();
      }
      host.innerHTML = "";
      runtimeRef.current = null;
    };
  }, [assetUrl, hasGeometry, manifest, performanceMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    if (selectedMarkerId) {
      const marker = manifest.markers?.find((entry) => entry.id === selectedMarkerId);
      if (marker?.bbox) {
        runtime.fitBounds(marker.bbox);
        return;
      }
    }
    if (focusedNodeId) {
      const node = manifest.hierarchy.find((entry) => entry.id === focusedNodeId);
      if (node) {
        runtime.fitBounds(node.bbox);
      }
    }
  }, [focusedNodeId, manifest, selectedMarkerId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const selection = latestSelectionRef.current;
    const selectedSet = new Set(selection.selectedLayerIds);
    for (const { mesh, node } of runtime.hitMeshes.values()) {
      const material = mesh.material as THREE.MeshBasicMaterial;
      const isFocused = selection.focusedNodeId === node.id;
      const isVisibleLayer =
        selection.selectedLayerIds.length > 0 &&
        node.focusLayerIds.some((layerId) => selection.selectedLayerIds.includes(layerId));
      const baseOpacity =
        selection.performanceMode === "hierarchy-preview"
          ? isVisibleLayer
            ? 0.72
            : 0.14
          : isVisibleLayer
            ? 0.08
            : 0.02;
      material.opacity = isFocused ? 0.24 : baseOpacity;
      material.color.set(isFocused ? "#7b8ea2" : isVisibleLayer ? "#718796" : "#4f6070");
      mesh.scale.setScalar(isFocused ? 1.02 : 1);
    }
    for (const { mesh, marker } of runtime.markerMeshes.values()) {
      const active = selection.selectedMarkerId === marker.id;
      mesh.scale.setScalar(active ? 1.28 : 1);
    }
    if (runtime.importedRoot) {
      runtime.importedRoot.traverse((entry) => {
        const layerId = (entry.userData as { layerId?: string }).layerId;
        if (layerId) {
          entry.visible = selectedSet.has(layerId);
        }
      });
    }
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, [focusedNodeId, performanceMode, selectedLayerIds, selectedMarkerId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !action) {
      return;
    }
    if (lastHandledActionIdRef.current === action.id) {
      return;
    }
    lastHandledActionIdRef.current = action.id;

    if (action.type === "reset") {
      runtime.resetCamera();
      return;
    }

    if (action.type === "restore-camera" && action.payload && "position" in action.payload) {
      runtime.targetGoal.set(action.payload.target[0], action.payload.target[1], action.payload.target[2]);
      runtime.cameraGoal.set(action.payload.position[0], action.payload.position[1], action.payload.position[2]);
      runtime.controls.target.copy(runtime.targetGoal);
      runtime.camera.position.copy(runtime.cameraGoal);
      runtime.controls.update();
      runtime.renderer.render(runtime.scene, runtime.camera);
      runtime.emitCameraState();
      return;
    }

    if (action.type === "focus-marker" && action.payload && "markerId" in action.payload) {
      const payload = action.payload as { markerId?: string | null };
      const marker = manifest.markers?.find((entry) => entry.id === payload.markerId);
      if (marker?.bbox) {
        runtime.fitBounds(marker.bbox);
      }
      return;
    }

    if (action.type === "fit") {
      if (action.payload && "markerId" in action.payload) {
        const payload = action.payload as { markerId?: string | null; nodeId?: string | null };
        const marker = manifest.markers?.find((entry) => entry.id === payload.markerId);
        if (marker?.bbox) {
          runtime.fitBounds(marker.bbox);
          return;
        }
      }
      if (action.payload && "nodeId" in action.payload) {
        const payload = action.payload as { nodeId?: string | null };
        const node = manifest.hierarchy.find((entry) => entry.id === payload.nodeId);
        if (node) {
          runtime.fitBounds(node.bbox);
          return;
        }
      }
      runtime.fitBounds(manifest.metrics.bbox);
    }
  }, [action, manifest]);

  return (
    <div className="viewer-shell">
      <div className="viewer-meta">
        <div>
          <p className="eyebrow">{copy.viewer.eyebrow}</p>
          <h2>{displayName}</h2>
        </div>
        <p className="viewer-caption">{copy.viewer.caption}</p>
      </div>
      {hasGeometry ? (
        <div className="viewer-canvas" ref={hostRef} data-testid="scene-viewer" />
      ) : (
        <div className="viewer-empty" data-testid="scene-viewer">
          <strong>{copy.viewer.emptyTitle}</strong>
          <small>{copy.viewer.emptyHint}</small>
        </div>
      )}
      <div className="viewer-status">
        <span>{manifest.technology}</span>
        <span>{manifest.metrics.cellCount} {copy.viewer.cells}</span>
        <span>{manifest.metrics.instanceCount} {copy.viewer.instances}</span>
        <span>{manifest.markers?.length ?? 0} {copy.viewer.markers}</span>
      </div>
    </div>
  );
}
