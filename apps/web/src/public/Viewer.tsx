import { useI18n } from "./i18n";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Layout, PickInfo, GeometryFeature, LayerMesh } from "./types";
import { cellMatches, type CellFocus } from "./cellInstances";
import { rayIntersectsLocalBounds } from "./renderer-helper";
export function featureAtTriangle(features: GeometryFeature[], triangle: number) {
  let low = 0, high = features.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1, feature = features[mid];
    if (triangle < feature.firstTriangle) high = mid - 1;
    else if (triangle >= feature.firstTriangle + feature.triangles) low = mid + 1;
    else return feature;
  }
  return undefined;
}
export const featureKind = (kind?: string) => ({ boundary: "边界多边形", path: "路径几何", box: "框", mesh: "模型网格" }[kind ?? ""] ?? "图层几何");
export function packedLayerOffsets(bounds: [number, number][], gap: number): number[] {
  if (!bounds.length) return [];
  const extent = bounds.reduce((all, b) => [Math.min(all[0], b[0]), Math.max(all[1], b[1])], [Infinity, -Infinity]);
  const center = (extent[0] + extent[1]) / 2;
  const height = bounds.reduce((sum, b) => sum + b[1] - b[0], 0) + gap * (bounds.length - 1);
  let bottom = center - height / 2;
  return bounds.map(([min, max]) => { const offset = bottom - min; bottom += max - min + gap; return offset; });
}
export function instanceFeature(layer: LayerMesh, batchIndex: number, placement: number, triangle: number): GeometryFeature | undefined {
  const batch = layer.batches?.[batchIndex], feature = featureAtTriangle(batch?.features ?? [], triangle);
  if (!batch || !feature || placement < 0 || placement >= batch.paths.length) return undefined;
  const m = batch.transforms.subarray(placement * 6, placement * 6 + 6), bounds: GeometryFeature["bounds"] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = feature.firstTriangle * 9; i < (feature.firstTriangle + feature.triangles) * 9; i += 3) {
    const x = m[0] * batch.positions[i] - m[2] * batch.positions[i + 2] + m[4], y = m[1] * batch.positions[i] - m[3] * batch.positions[i + 2] + m[5];
    bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y); bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
  }
  const magnification = Math.hypot(m[0], m[1]), path = batch.paths[placement];
  return { ...feature, id: path + feature.id.slice(feature.cell.length), instance: path, bounds, batch: batchIndex, placement,
    ...(feature.area !== undefined ? { area: feature.area * Math.abs(m[0] * m[3] - m[1] * m[2]) } : {}),
    ...(feature.pathWidth !== undefined ? { pathWidth: feature.pathWidth * magnification, pathLength: feature.pathLength! * magnification } : {}) };
}
export type HeightMode = "consistent" | "compact";
export function displayHeightScale(layout: Layout, mode: HeightMode, scale: number) {
  if (layout.format !== "gds") return scale;
  return mode === "consistent" && layout.gds?.stack ? layout.gds.stack.pitch * scale : Math.min(0.18, 2.5 / Math.max(layout.layers.length, 1));
}
export interface CameraPose {
  position: number[];
  target: number[];
  projection?: "2d" | "3d";
  zoom?: number;
  rotation?: number;
  heightMode?: HeightMode;
}
export interface ViewerHandle {
  view: (name: string) => void;
  camera: () => CameraPose | null;
  restore: (pose: CameraPose) => void;
  screenshot: () => void;
}
interface Props {
  layout: Layout | null;
  visible: string[];
  explode: number;
  theme: string;
  onSelect: (id: string) => void;
  onPick?: (pick: PickInfo | null) => void;
  selectedObject?: PickInfo | null;
  layerNames?: Record<string, string>;
  layerColors?: Record<string, string>;
  onMode?: (mode: "2d" | "3d") => void;
  measuring?: boolean;
  cellFocus?: CellFocus | null;
  heightMode?: HeightMode;
  onHeightMode?: (mode: HeightMode) => void;
}
export const Viewer = forwardRef<ViewerHandle, Props>(function Viewer(
  { layout, visible, explode, theme, onSelect, onPick, selectedObject, layerNames, layerColors, onMode, measuring = false, cellFocus, heightMode = "consistent", onHeightMode },
  ref,
) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null),
    runtime = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
      perspective: THREE.PerspectiveCamera;
      orthographic: THREE.OrthographicCamera;
      controls: OrbitControls;
      meshes: THREE.Mesh[];
      size: number;
      draw: () => void;
      flush: () => void;
      ruler: THREE.Line;
      verticalBounds: [number, number][];
      grid: THREE.GridHelper;
      centerY: number;
      centerX: number;
      centerZ: number;
      scale: number;
      cellOutline: THREE.LineSegments;
      heightRatio: number;
    } | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const pick = useRef(onPick);
  pick.current = onPick;
  const [hover, setHover] = useState<PickInfo | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"2d" | "3d">("3d");
  const [measurement, setMeasurement] = useState<number[][]>([]);
  const focusCell = cellFocus?.cell;
  const focusedCellMatches = useMemo(
    () => focusCell === undefined ? null : cellMatches(layout, focusCell),
    [layout, focusCell],
  );
  const measurementPoints = useRef<number[][]>([]);
  const measure = useRef(measuring), modeChanged = useRef(onMode);
  measure.current = measuring; modeChanged.current = onMode;
  const height = useRef(heightMode), heightChanged = useRef(onHeightMode);
  height.current = heightMode; heightChanged.current = onHeightMode;
  const changeMode = (next: "2d" | "3d") => {
    const r = runtime.current;
    if (!r) return;
    r.camera = next === "2d" ? r.orthographic : r.perspective;
    r.controls.object = r.camera;
    r.controls.enableRotate = next === "3d";
    r.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    r.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    r.controls.mouseButtons.RIGHT = -1 as THREE.MOUSE; // Unmapped action: OrbitControls ignores right-button drags.
    r.controls.touches.ONE = next === "2d" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    setMode(next); modeChanged.current?.(next); setHover(null);
    r.renderer.domElement.dataset.projection = next === "2d" ? "orthographic" : "perspective";
  };
  useImperativeHandle(
    ref,
    () => ({
      view(name) {
        const r = runtime.current;
        if (!r) return;
        if (name === "fit") name = r.camera instanceof THREE.OrthographicCamera ? "2d" : "iso";
        changeMode(name === "2d" ? "2d" : "3d");
        const halfFov = Math.atan(
          Math.tan(THREE.MathUtils.degToRad(r.perspective.fov / 2)) *
            Math.min(r.perspective.aspect, 1),
        );
        const distance = ((r.size * 0.8) / Math.sin(halfFov)) * 1.1;
        const direction =
          name === "2d"
            ? new THREE.Vector3(0, 1, 0)
            : name === "top" ? new THREE.Vector3(0, 1, 0.0001)
            : name === "front"
              ? new THREE.Vector3(0, 0.12, 1)
              : new THREE.Vector3(0.7, 0.6, 0.7);
        r.camera.position.copy(direction.normalize().multiplyScalar(distance));
        if (name === "2d") { r.camera.up.set(0, 0, -1); r.camera.zoom = 1; r.camera.updateProjectionMatrix(); }
        r.controls.target.set(0, 0, 0);
        r.controls.update();
        r.draw();
      },
      camera() {
        const r = runtime.current;
        return r
          ? {
              position: r.camera.position.toArray(),
              target: r.controls.target.toArray(),
              projection: r.camera instanceof THREE.OrthographicCamera ? "2d" : "3d",
              zoom: r.camera.zoom,
              ...(r.renderer.domElement.dataset.heightMode ? { heightMode: height.current } : {}),
              ...(r.camera instanceof THREE.OrthographicCamera ? { rotation: Math.atan2(-r.camera.up.x, -r.camera.up.z) } : {}),
            }
          : null;
      },
      restore(pose) {
        const r = runtime.current;
        if (r) {
          heightChanged.current?.(pose.heightMode ?? "consistent");
          changeMode(pose.projection === "2d" ? "2d" : "3d");
          r.camera.position.fromArray(pose.position);
          r.camera.zoom = pose.zoom ?? 1;
          if (pose.projection === "2d") r.camera.up.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), pose.rotation ?? 0);
          r.camera.updateProjectionMatrix();
          r.controls.target.fromArray(pose.target);
          r.controls.update();
          r.draw();
        }
      },
      screenshot() {
        const r = runtime.current;
        if (!r) return;
        r.flush();
        r.renderer.domElement.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = "gds-3d-viewer-view.png";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      },
    }),
    [],
  );
  useEffect(() => {
    const container = host.current;
    if (!container || !layout || !layout.layers.length) return;
    setError("");
    setHover(null);
    setMeasurement([]);
    measurementPoints.current = [];
    setMode("3d"); modeChanged.current?.("3d");
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError("无法启动三维显示，请启用浏览器硬件加速后重新打开");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000),
      orthographic = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 1000),
      controls = new OrbitControls(camera, renderer.domElement);
    orthographic.up.set(0, 0, -1);
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = -1 as THREE.MOUSE;
    controls.zoomToCursor = true;
    controls.minDistance = 0.05;
    controls.maxDistance = 500;
    controls.minZoom = 0.05;
    controls.maxZoom = 1000;
    renderer.domElement.dataset.projection = "perspective";
    const group = new THREE.Group();
    scene.add(group);
    let minY = Infinity,
      maxY = -Infinity;
    for (const layer of layout.layers)
      for (let i = 1; i < layer.positions.length; i += 3) {
        minY = Math.min(minY, layer.positions[i]);
        maxY = Math.max(maxY, layer.positions[i]);
      }
    const span = Math.max(
        layout.bounds[2] - layout.bounds[0],
        layout.bounds[3] - layout.bounds[1],
        layout.format === "gltf" ? maxY - minY : 0,
        0.000001,
      ),
      scale = 12 / span;
    const yScale = displayHeightScale(layout, "consistent", scale);
    const centerX = (layout.bounds[0] + layout.bounds[2]) / 2,
      centerZ =
        layout.format === "gds"
          ? -(layout.bounds[1] + layout.bounds[3]) / 2
          : (layout.bounds[1] + layout.bounds[3]) / 2;
    const meshes: THREE.Mesh[] = [],
      materials = new Map<string, THREE.MeshLambertMaterial>(),
      instanceMatrix = new THREE.Matrix4();
    const verticalBounds: [number, number][] = layout.layers.map(() => [Infinity, -Infinity]);
    for (const [layerIndex, layer] of layout.layers.entries()) {
      const sources = layer.batches ?? [{ positions: layer.positions, mirrored: false, transforms: new Float64Array(), paths: [] }];
      let material = materials.get(layer.id);
      if (!material) {
        material = new THREE.MeshLambertMaterial({ color: layer.color, side: THREE.DoubleSide });
        materials.set(layer.id, material);
      }
      for (const [batchIndex, source] of sources.entries()) {
      const points = new Float32Array(source.positions);
      for (let i = 0; i < points.length; i += 3) {
        points[i] = (layer.batches ? points[i] * (source.mirrored ? -1 : 1) : points[i] - centerX) * scale;
        points[i + 1] *= yScale;
        points[i + 2] = (layer.batches ? points[i + 2] : points[i + 2] - centerZ) * scale;
        verticalBounds[layerIndex][0] = Math.min(verticalBounds[layerIndex][0], points[i + 1]);
        verticalBounds[layerIndex][1] = Math.max(verticalBounds[layerIndex][1], points[i + 1]);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      const mesh = layer.batches ? new THREE.InstancedMesh(geometry, material, source.paths.length) : new THREE.Mesh(geometry, material);
      if (mesh instanceof THREE.InstancedMesh) {
        const sign = source.mirrored ? -1 : 1;
        for (let index = 0; index < source.paths.length; index++) {
          const m = source.transforms.subarray(index * 6, index * 6 + 6);
          instanceMatrix.set(m[0] * sign, 0, -m[2], (m[4] - centerX) * scale, 0, 1, 0, 0, -m[1] * sign, 0, m[3], (-m[5] - centerZ) * scale, 0, 0, 0, 1);
          mesh.setMatrixAt(index, instanceMatrix);
        }
        mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
        mesh.userData.batchIndex = batchIndex;
        mesh.userData.originalMatrices = new Float32Array(mesh.instanceMatrix.array);
        mesh.userData.placements = source.paths.map((_, i) => i);
      }
      mesh.userData.layerId = layer.id;
      mesh.userData.layerIndex = layerIndex;
      group.add(mesh);
      meshes.push(mesh);
      }
    }
    const box = new THREE.Box3().setFromObject(group),
      center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);
    const size = Math.max(...box.getSize(new THREE.Vector3()).toArray(), 1);
    const grid = new THREE.GridHelper(30, 30, 0x555555, 0x383838);
    grid.position.y = box.min.y - center.y - 0.15;
    scene.add(grid);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x606060, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(8, 15, 10);
    scene.add(light);
    const ruler = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe88526, depthTest: false }));
    ruler.renderOrder = 5; scene.add(ruler);
    const cellOutline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffb35c, depthTest: false }));
    cellOutline.renderOrder = 4; group.add(cellOutline);
    scene.updateMatrixWorld(true);
    // Effects, resize and camera controls can all invalidate the same frame.
    // Render their final state once instead of repeatedly submitting the layout.
    let frame: number | undefined;
    const render = () => {
      frame = undefined;
      renderer.render(scene, runtime.current?.camera ?? camera);
    };
    const draw = () => { if (frame === undefined) frame = requestAnimationFrame(render); };
    const flush = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      render();
    };
    const rect = container.getBoundingClientRect();
    camera.aspect = rect.width / Math.max(rect.height, 1);
    const halfFov = Math.atan(
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        Math.min(camera.aspect, 1),
    );
    camera.position
      .set(0.7, 0.6, 0.7)
      .normalize()
      .multiplyScalar(((size * 0.8) / Math.sin(halfFov)) * 1.1);
    controls.target.set(0, 0, 0);
    controls.update();
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const aspect = width / height, half = size * 0.65;
      orthographic.left = -half * Math.max(aspect, 1);
      orthographic.right = -orthographic.left;
      orthographic.top = half / Math.min(aspect, 1);
      orthographic.bottom = -orthographic.top;
      orthographic.updateProjectionMatrix();
      renderer.setSize(width, height);
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    controls.addEventListener("change", draw);
    const pointer = new THREE.Vector2(),
      caster = new THREE.Raycaster(),
      localRayScratch = new THREE.Ray(),
      inverseMatrixScratch = new THREE.Matrix4(),
      pickCandidates: THREE.Mesh[] = [];
    let lastInstanceFeature: {
      layer: LayerMesh;
      batchIndex: number;
      placement: number;
      source?: GeometryFeature;
      result?: GeometryFeature;
    } | undefined;
    const getInstanceFeature = (layer: LayerMesh, batchIndex: number, placement: number, triangle: number) => {
      const source = featureAtTriangle(layer.batches?.[batchIndex]?.features ?? [], triangle);
      if (lastInstanceFeature?.layer === layer && lastInstanceFeature.batchIndex === batchIndex &&
          lastInstanceFeature.placement === placement && lastInstanceFeature.source === source)
        return lastInstanceFeature.result;
      const result = instanceFeature(layer, batchIndex, placement, triangle);
      lastInstanceFeature = { layer, batchIndex, placement, source, result };
      return result;
    };
    let down = [0, 0], last = [0, 0];
    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    const hitTest = (e: PointerEvent): PickInfo | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, (-(e.clientY - rect.top) / rect.height) * 2 + 1);
      const activeCamera = runtime.current?.camera ?? camera;
      activeCamera.updateMatrixWorld();
      caster.setFromCamera(pointer, activeCamera);
      pickCandidates.length = 0;
      for (const mesh of meshes) {
        if (!mesh.visible) continue;
        const bounds = mesh instanceof THREE.InstancedMesh ? mesh.boundingBox : mesh.geometry.boundingBox;
        if (!rayIntersectsLocalBounds(caster.ray, bounds, mesh.matrixWorld, localRayScratch, inverseMatrixScratch)) continue;
        pickCandidates.push(mesh);
      }
      const hit = caster.intersectObjects(pickCandidates, false)[0];
      if (!hit) return null;
      const mesh = hit.object as THREE.Mesh;
      const layer = layout.layers[mesh.userData.layerIndex];
      if (!layer) return null;
      const local = mesh.worldToLocal(hit.point.clone());
      return {
        layerId: layer.id,
        feature: mesh instanceof THREE.InstancedMesh && hit.instanceId !== undefined
          ? getInstanceFeature(layer, mesh.userData.batchIndex, mesh.userData.placements[hit.instanceId], hit.faceIndex ?? -1)
          : featureAtTriangle(layer.features ?? [], mesh.userData.triangleMap?.[hit.faceIndex ?? -1] ?? hit.faceIndex ?? -1),
        point: layout.format === "gds"
          ? [local.x / scale + centerX, -(local.z / scale + centerZ), local.y / yScale]
          : [local.x / scale + centerX, local.y / yScale, local.z / scale + centerZ],
        screen: [e.clientX - rect.left, e.clientY - rect.top],
      };
    };
    const pointerMove = (e: PointerEvent) => {
      if (hoverTimer) clearTimeout(hoverTimer);
      const current = runtime.current;
      if ((e.buttons & 1) && e.pointerType !== "touch" && current?.camera instanceof THREE.OrthographicCamera && !measure.current) {
        current.camera.up.applyAxisAngle(new THREE.Vector3(0, 1, 0), (e.clientX - last[0]) * 0.01);
        current.camera.lookAt(current.controls.target); current.draw();
      }
      last = [e.clientX, e.clientY];
      if (e.buttons) { setHover(null); return; }
      hoverTimer = setTimeout(() => setHover(hitTest(e)), 80);
    };
    const pointerLeave = () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      setHover(null);
    };
    const pointerDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
      last = down;
      pointerLeave();
    };
    const pointerUp = (e: PointerEvent) => {
      if (
        e.button !== 0 ||
        Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5
      )
        return;
      if (measure.current && runtime.current?.camera instanceof THREE.OrthographicCamera) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((e.clientY - rect.top) / rect.height) * 2);
        caster.setFromCamera(pointer, runtime.current.camera);
        const world = caster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        if (!world) return;
        const local = group.worldToLocal(world.clone());
        const point = [local.x / scale + centerX, -(local.z / scale + centerZ)];
        const previous = measurementPoints.current;
        const next = previous.length === 1 ? [...previous, point] : [point];
        measurementPoints.current = next; setMeasurement(next);
        const points = next.map(([x, y]) => group.localToWorld(new THREE.Vector3((x - centerX) * scale, 0, (-y - centerZ) * scale)));
        ruler.geometry.dispose();
        ruler.geometry = new THREE.BufferGeometry().setFromPoints(points);
        draw();
        return;
      }
      const result = hitTest(e);
      pick.current?.(result);
      if (result) select.current(result.layerId);
    };
    const lost = (e: Event) => {
      e.preventDefault();
      setError("三维显示资源不足，请导入较小单元或重新加载文件");
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerleave", pointerLeave);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    runtime.current = { renderer, scene, camera, perspective: camera, orthographic, controls, meshes, size, draw, flush, ruler, verticalBounds, grid, centerY: center.y, centerX, centerZ, scale, cellOutline, heightRatio: 1 };
    resize();
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      runtime.current = null;
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerleave", pointerLeave);
      if (hoverTimer) clearTimeout(hoverTimer);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      observer.disconnect();
      controls.dispose();
      ruler.geometry.dispose(); (ruler.material as THREE.Material).dispose();
      cellOutline.geometry.dispose(); (cellOutline.material as THREE.Material).dispose();
      meshes.forEach((m) => {
        m.geometry.dispose();
      });
      for (const material of new Set(meshes.map((mesh) => mesh.material as THREE.Material))) material.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [layout]);
  useEffect(() => {
    if (measuring) return;
    setMeasurement([]);
    measurementPoints.current = [];
    const r = runtime.current;
    if (r) { r.ruler.geometry.dispose(); r.ruler.geometry = new THREE.BufferGeometry(); r.draw(); }
  }, [measuring]);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    r.scene.background = new THREE.Color(
      theme === "dark" ? "#1e1e1e" : "#ffffff",
    );
    r.draw();
  }, [theme, layout]);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    const updatedMaterials = new Set<THREE.Material>();
    for (const mesh of r.meshes) {
      const material = mesh.material as THREE.MeshLambertMaterial;
      if (updatedMaterials.has(material)) continue;
      material.color.set(layerColors?.[mesh.userData.layerId] ?? layout!.layers[mesh.userData.layerIndex].color);
      updatedMaterials.add(material);
    }
    r.draw();
  }, [layerColors, layout]);
  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    const stack = layout?.gds?.stack;
    const ratio = layout?.format === "gds" ? displayHeightScale(layout, heightMode, r.scale) / displayHeightScale(layout, "consistent", r.scale) : 1;
    r.heightRatio = ratio;
    if (layout?.format === "gds") r.renderer.domElement.dataset.heightMode = heightMode;
    const scaledBounds = r.verticalBounds.map(([min, max]) => [min * ratio, max * ratio] as [number, number]);
    const stackIndices = new Map(stack?.layers.map((id, index) => [id, index]));
    const fileStack = !!stack && heightMode === "consistent";
    const offsets = fileStack ? layout!.layers.map(layer => stackIndices.get(layer.id)! * explode * 0.1) : layout?.format === "gds" ? packedLayerOffsets(scaledBounds, explode * 0.1) : r.verticalBounds.map((_, i) => i * explode * 0.1);
    if (fileStack && offsets.length) { const center = (Math.min(...offsets) + Math.max(...offsets)) / 2; for (let i = 0; i < offsets.length; i++) offsets[i] -= center; }
    r.meshes.forEach((m) => {
      m.visible = visible.includes(m.userData.layerId);
      m.scale.y = ratio;
      m.position.y = offsets[m.userData.layerIndex] + (1 - ratio) * r.centerY;
    });
    if (layout?.format === "gds") r.grid.position.y = scaledBounds.reduce((min, b, i) => Math.min(min, b[0] + offsets[i]), Infinity) - ratio * r.centerY - 0.15;
    r.scene.updateMatrixWorld(true);
    setHover(null);
    r.draw();
  }, [visible, explode, layout, heightMode]);
  useEffect(() => {
    const r = runtime.current;
    if (!r || !layout) return;
    const matches = focusedCellMatches;
    const visibleLayers = new Set(visible);
    const boxes = new Map<string, THREE.Box3>();
    const include = (path: string) => !cellFocus || cellFocus.mode === "highlight" ||
      (cellFocus.mode === "isolate" ? matches!.owners.has(path) : !matches!.owners.has(path));
    const collect = (owner: string | undefined, box: THREE.Box3) => {
      if (owner === undefined || cellFocus?.mode !== "highlight") return;
      const previous = boxes.get(owner);
      if (previous) previous.union(box); else boxes.set(owner, box.clone());
    };
    for (const mesh of r.meshes) {
      const layer = layout.layers[mesh.userData.layerIndex];
      const layerVisible = visibleLayers.has(layer.id);
      if (mesh instanceof THREE.InstancedMesh) {
        const batch = layer.batches![mesh.userData.batchIndex];
        const original = mesh.userData.originalMatrices as Float32Array;
        const filtering = !!cellFocus && cellFocus.mode !== "highlight";
        const sameFilter = filtering && mesh.userData.cellFilterMode === cellFocus!.mode && mesh.userData.cellFilterCell === cellFocus!.cell;
        if (sameFilter) { mesh.visible = layerVisible && !!mesh.count; continue; }
        const updateMatrices = filtering || !!mesh.userData.cellFiltered;
        if (!updateMatrices && cellFocus?.mode !== "highlight") { mesh.visible = layerVisible; continue; }
        const placements: number[] = [];
        const matrix = new THREE.Matrix4(), box = new THREE.Box3();
        for (const [index, path] of batch.paths.entries()) {
          if (!include(path)) continue;
          matrix.fromArray(original, index * 16);
          if (updateMatrices) mesh.setMatrixAt(placements.length, matrix);
          placements.push(index);
          if (layerVisible && matches?.owners.has(path)) {
            box.copy(mesh.geometry.boundingBox!).applyMatrix4(matrix);
            box.min.y *= r.heightRatio; box.max.y *= r.heightRatio;
            collect(matches.owners.get(path), box.translate(mesh.position));
          }
        }
        if (updateMatrices) {
          mesh.userData.placements = placements; mesh.count = placements.length;
          mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
        }
        mesh.userData.cellFiltered = filtering;
        if (filtering) {
          mesh.userData.cellFilterMode = cellFocus!.mode;
          mesh.userData.cellFilterCell = cellFocus!.cell;
        } else {
          delete mesh.userData.cellFilterMode;
          delete mesh.userData.cellFilterCell;
        }
        mesh.visible = layerVisible && !!mesh.count;
      } else {
        const features = layer.features ?? [];
        if (cellFocus && cellFocus.mode !== "highlight") {
          const accepted = features.filter(f => include(f.instance));
          const count = accepted.reduce((sum, f) => sum + f.triangles, 0);
          const indices = new Uint32Array(count * 3), triangleMap = new Uint32Array(count);
          let at = 0;
          for (const feature of accepted) for (let i = feature.firstTriangle; i < feature.firstTriangle + feature.triangles; i++) {
            triangleMap[at] = i;
            indices[at * 3] = i * 3; indices[at * 3 + 1] = i * 3 + 1; indices[at * 3 + 2] = i * 3 + 2; at++;
          }
          mesh.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          mesh.userData.triangleMap = triangleMap; mesh.visible = layerVisible && !!count;
        } else {
          mesh.geometry.setIndex(null); delete mesh.userData.triangleMap; mesh.visible = layerVisible;
        }
        if (layerVisible && cellFocus?.mode === "highlight") for (const feature of features) {
          const owner = matches!.owners.get(feature.instance);
          if (owner === undefined) continue;
          const b = feature.bounds, y = r.verticalBounds[mesh.userData.layerIndex];
          collect(owner, new THREE.Box3(
            new THREE.Vector3((b[0] - r.centerX) * r.scale, y[0] * r.heightRatio + mesh.position.y, (-b[3] - r.centerZ) * r.scale),
            new THREE.Vector3((b[2] - r.centerX) * r.scale, y[1] * r.heightRatio + mesh.position.y, (-b[1] - r.centerZ) * r.scale),
          ));
        }
      }
    }
    // A planar outline per occupied instance marks every location in both modes.
    const lines = new Float32Array(boxes.size * 24);
    let at = 0;
    for (const box of boxes.values()) {
      const { min, max } = box, y = max.y + 0.015;
      for (const point of [[min.x,y,min.z],[max.x,y,min.z],[max.x,y,min.z],[max.x,y,max.z],[max.x,y,max.z],[min.x,y,max.z],[min.x,y,max.z],[min.x,y,min.z]]) {
        lines.set(point, at); at += 3;
      }
    }
    r.cellOutline.geometry.dispose();
    r.cellOutline.geometry = new THREE.BufferGeometry();
    r.cellOutline.geometry.setAttribute("position", new THREE.BufferAttribute(lines, 3));
    r.renderer.domElement.dataset.cellHighlightCount = String(boxes.size);
    r.renderer.domElement.dataset.cellFocus = cellFocus?.mode ?? "none";
    setHover(null); r.draw();
  }, [cellFocus, layout, visible, explode, heightMode]);
  useEffect(() => {
    setHover(null);
    const r = runtime.current, feature = selectedObject?.feature;
    if (!r || !feature) return;
    const mesh = r.meshes.find((m) => m.userData.layerId === selectedObject.layerId && (feature.batch === undefined || m.userData.batchIndex === feature.batch));
    if (!mesh) return;
    const points = mesh.geometry.getAttribute("position").array.slice(feature.firstTriangle * 9, (feature.firstTriangle + feature.triangles) * 9);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
    const material = new THREE.MeshBasicMaterial({ color: 0xffc66d, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
    const outline = new THREE.Mesh(geometry, material);
    if (mesh instanceof THREE.InstancedMesh && feature.placement !== undefined) {
      const index = (mesh.userData.placements as number[]).indexOf(feature.placement);
      if (index < 0) { geometry.dispose(); material.dispose(); return; }
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix); outline.applyMatrix4(matrix);
    }
    outline.renderOrder = 2;
    mesh.add(outline);
    r.draw();
    return () => { mesh.remove(outline); geometry.dispose(); material.dispose(); if (runtime.current === r) r.draw(); };
  }, [selectedObject, layout, cellFocus]);
  useLayoutEffect(() => {
    if (!hover || !tooltip.current || !host.current) return;
    const tip = tooltip.current, bounds = host.current;
    tip.style.left = `${Math.max(8, Math.min(hover.screen[0] + 14, bounds.clientWidth - tip.offsetWidth - 8))}px`;
    tip.style.top = `${Math.max(8, Math.min(hover.screen[1] + 14, bounds.clientHeight - tip.offsetHeight - 8))}px`;
  });
  return (
    <div className="viewer-host" ref={host} data-testid="viewer-canvas">
      {hover && !measuring && <div ref={tooltip} className="geometry-tooltip" role="tooltip">
        <strong>{t(featureKind(hover.feature?.kind))}</strong>
        <dl>
          <dt>{t("单元")}</dt><dd>{hover.feature?.cell ?? t("模型")}</dd>
          <dt>{t("图层")}</dt><dd>{hover.layerId}</dd>
          {layerNames?.[hover.layerId] && <><dt>{t("图层名称")}</dt><dd>{layerNames[hover.layerId]}</dd></>}
          <dt>X</dt><dd>{hover.point[0].toFixed(3)} {layout?.unit}</dd>
          <dt>Y</dt><dd>{hover.point[1].toFixed(3)} {layout?.unit}</dd>
          {hover.feature?.pathWidth !== undefined && <><dt>{t("路径宽度")}</dt><dd>{hover.feature.pathWidth.toFixed(3)} {layout?.unit}</dd></>}
        </dl>
        <small> {t("点击固定到检查器")} </small>
      </div>}
      {measuring && mode === "2d" && <div className="ruler-result" role="status">
        <strong>{t("二维测量尺")}</strong>
        {measurement.length < 2 ? <span>{t(measurement.length ? "点击终点" : "点击起点，再点击终点")}</span> : <>
          <span>{t("距离")} {Math.hypot(measurement[1][0] - measurement[0][0], measurement[1][1] - measurement[0][1]).toFixed(3)} {layout?.unit}</span>
          <span>ΔX {(measurement[1][0] - measurement[0][0]).toFixed(3)} · ΔY {(measurement[1][1] - measurement[0][1]).toFixed(3)} {layout?.unit}</span>
          <small>{t("再次点击开始新的测量，不吸附几何")}</small>
        </>}
      </div>}
      {error && (
        <div className="canvas-error" role="alert">
          {t(error)}
        </div>
      )}
    </div>
  );
});
