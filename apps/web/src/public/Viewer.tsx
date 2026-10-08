import { useI18n } from "./i18n";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
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
}
export const Viewer = forwardRef<ViewerHandle, Props>(function Viewer(
  { layout, visible, explode, theme, onSelect, onPick, selectedObject },
  ref,
) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null),
    runtime = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      meshes: THREE.Mesh[];
      size: number;
      draw: () => void;
    } | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const pick = useRef(onPick);
  pick.current = onPick;
  const [hover, setHover] = useState<PickInfo | null>(null);
  const [error, setError] = useState("");
  useImperativeHandle(
    ref,
    () => ({
      view(name) {
        const r = runtime.current;
        if (!r) return;
        const halfFov = Math.atan(
          Math.tan(THREE.MathUtils.degToRad(r.camera.fov / 2)) *
            Math.min(r.camera.aspect, 1),
        );
        const distance = ((r.size * 0.8) / Math.sin(halfFov)) * 1.1;
        const direction =
          name === "top"
            ? new THREE.Vector3(0, 1, 0.0001)
            : name === "front"
              ? new THREE.Vector3(0, 0.12, 1)
              : new THREE.Vector3(0.7, 0.6, 0.7);
        r.camera.position.copy(direction.normalize().multiplyScalar(distance));
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
            }
          : null;
      },
      restore(pose) {
        const r = runtime.current;
        if (r) {
          r.camera.position.fromArray(pose.position);
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
      controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.zoomToCursor = true;
    controls.minDistance = 0.05;
    controls.maxDistance = 500;
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
    const draw = () => renderer.render(scene, camera);
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
      caster.setFromCamera(pointer, camera);
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
    runtime.current = { renderer, scene, camera, controls, meshes, size, draw };
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
  return (
    <div className="viewer-host" ref={host} data-testid="viewer-canvas">
      {hover && <div className="geometry-tooltip" role="tooltip" style={{ left: Math.min(hover.screen[0] + 14, Math.max(8, (host.current?.clientWidth ?? 300) - 262)), top: Math.min(hover.screen[1] + 14, Math.max(8, (host.current?.clientHeight ?? 300) - 150)) }}>
        <strong>{t(featureKind(hover.feature?.kind))}</strong>
        <span>{hover.feature?.cell ?? t("模型")} · {hover.layerId}</span>
        <span>X {hover.point[0].toFixed(3)} · Y {hover.point[1].toFixed(3)} {layout?.unit}</span>
        {hover.feature?.pathWidth !== undefined && <span> {t("路径宽度")} {hover.feature.pathWidth.toFixed(3)} {layout?.unit}</span>}
        <small> {t("点击固定到检查器")} </small>
      </div>}
      {error && (
        <div className="canvas-error" role="alert">
          {t(error)}
        </div>
      )}
    </div>
  );
});
