import { useI18n } from "./i18n";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Layout, PickInfo, GeometryFeature } from "./types";
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
export interface CameraPose {
  position: number[];
  target: number[];
  projection?: "2d" | "3d";
  zoom?: number;
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
  onMode?: (mode: "2d" | "3d") => void;
  measuring?: boolean;
}
export const Viewer = forwardRef<ViewerHandle, Props>(function Viewer(
  { layout, visible, explode, theme, onSelect, onPick, selectedObject, layerNames, onMode, measuring = false },
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
      ruler: THREE.Line;
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
  const measurementPoints = useRef<number[][]>([]);
  const measure = useRef(measuring), modeChanged = useRef(onMode);
  measure.current = measuring; modeChanged.current = onMode;
  const changeMode = (next: "2d" | "3d") => {
    const r = runtime.current;
    if (!r) return;
    r.camera = next === "2d" ? r.orthographic : r.perspective;
    r.controls.object = r.camera;
    r.controls.enableRotate = next === "3d";
    r.controls.mouseButtons.LEFT = next === "2d" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
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
        if (name === "2d") { r.camera.zoom = 1; r.camera.updateProjectionMatrix(); }
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
            }
          : null;
      },
      restore(pose) {
        const r = runtime.current;
        if (r) {
          changeMode(pose.projection === "2d" ? "2d" : "3d");
          r.camera.position.fromArray(pose.position);
          r.camera.zoom = pose.zoom ?? 1;
          r.camera.updateProjectionMatrix();
          r.controls.target.fromArray(pose.target);
          r.controls.update();
          r.draw();
        }
      },
      screenshot() {
        const r = runtime.current;
        if (!r) return;
        r.draw();
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
    const centerX = (layout.bounds[0] + layout.bounds[2]) / 2,
      centerZ =
        layout.format === "gds"
          ? -(layout.bounds[1] + layout.bounds[3]) / 2
          : (layout.bounds[1] + layout.bounds[3]) / 2;
    const meshes: THREE.Mesh[] = [];
    for (const layer of layout.layers) {
      const points = new Float32Array(layer.positions);
      for (let i = 0; i < points.length; i += 3) {
        points[i] = (points[i] - centerX) * scale;
        points[i + 1] *=
          layout.format === "gds"
            ? Math.min(0.18, 2.5 / layout.layers.length)
            : scale;
        points[i + 2] = (points[i + 2] - centerZ) * scale;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshLambertMaterial({
          color: layer.color,
          side: THREE.DoubleSide,
        }),
      );
      mesh.userData.layerId = layer.id;
      group.add(mesh);
      meshes.push(mesh);
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
    const draw = () => renderer.render(scene, runtime.current?.camera ?? camera);
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
      caster = new THREE.Raycaster();
    let down = [0, 0];
    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    const hitTest = (e: PointerEvent): PickInfo | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, (-(e.clientY - rect.top) / rect.height) * 2 + 1);
      caster.setFromCamera(pointer, runtime.current?.camera ?? camera);
      const hit = caster.intersectObjects(meshes.filter((m) => m.visible), false)[0];
      if (!hit) return null;
      const mesh = hit.object as THREE.Mesh;
      const layer = layout.layers.find((l) => l.id === mesh.userData.layerId)!;
      const local = mesh.worldToLocal(hit.point.clone());
      const yScale = layout.format === "gds" ? Math.min(0.18, 2.5 / layout.layers.length) : scale;
      return {
        layerId: layer.id,
        feature: featureAtTriangle(layer.features ?? [], hit.faceIndex ?? -1),
        point: layout.format === "gds"
          ? [local.x / scale + centerX, -(local.z / scale + centerZ), local.y / yScale]
          : [local.x / scale + centerX, local.y / yScale, local.z / scale + centerZ],
        screen: [e.clientX - rect.left, e.clientY - rect.top],
      };
    };
    const pointerMove = (e: PointerEvent) => {
      if (hoverTimer) clearTimeout(hoverTimer);
      if (e.buttons) { setHover(null); return; }
      hoverTimer = setTimeout(() => setHover(hitTest(e)), 80);
    };
    const pointerLeave = () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      setHover(null);
    };
    const pointerDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
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
    runtime.current = { renderer, scene, camera, perspective: camera, orthographic, controls, meshes, size, draw, ruler };
    resize();
    return () => {
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
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
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
    r.meshes.forEach((m, i) => {
      m.visible = visible.includes(m.userData.layerId);
      m.position.y = i * explode * 0.1;
    });
    r.draw();
  }, [visible, explode, layout]);
  useEffect(() => {
    setHover(null);
    const r = runtime.current, feature = selectedObject?.feature;
    if (!r || !feature) return;
    const mesh = r.meshes.find((m) => m.userData.layerId === selectedObject.layerId);
    if (!mesh) return;
    const points = mesh.geometry.getAttribute("position").array.slice(feature.firstTriangle * 9, (feature.firstTriangle + feature.triangles) * 9);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
    const material = new THREE.MeshBasicMaterial({ color: 0xffc66d, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
    const outline = new THREE.Mesh(geometry, material);
    outline.renderOrder = 2;
    mesh.add(outline);
    r.draw();
    return () => { mesh.remove(outline); geometry.dispose(); material.dispose(); if (runtime.current === r) r.draw(); };
  }, [selectedObject, layout]);
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
