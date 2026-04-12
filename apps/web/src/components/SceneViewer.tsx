import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LayoutManifest, LayoutNode } from "../../../../packages/shared/types";

interface SceneViewerProps {
  manifest: LayoutManifest;
  assetUrl?: string | null;
  selectedLayerIds: string[];
  focusedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
}

function nodeColor(node: LayoutNode, manifest: LayoutManifest): string {
  const visibleLayer = manifest.layers.find((layer) => node.focusLayerIds.includes(layer.id) && layer.visible);
  return visibleLayer?.color ?? "#6f7f8c";
}

export default function SceneViewer({ manifest, assetUrl, selectedLayerIds, focusedNodeId, onNodeSelect }: SceneViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onNodeSelectRef = useRef(onNodeSelect);

  const visibleLayerIds = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    host.innerHTML = "";

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#131821", 18, 45);

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 300);
    camera.position.set(12, 11, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 40;
    controls.target.set(0, 1.2, 0);

    const ambient = new THREE.AmbientLight("#f0eadf", 1.8);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight("#fff0db", 3.2);
    keyLight.position.set(8, 14, 10);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight("#7d9bb8", 0.7);
    rimLight.position.set(-10, 6, -8);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: "#0f141b", roughness: 1, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.9;
    scene.add(floor);

    const grid = new THREE.GridHelper(80, 40, "#33404d", "#1d2731");
    grid.position.y = -1.88;
    scene.add(grid);

    const root = new THREE.Group();
    root.rotation.x = -0.28;
    root.rotation.z = -0.1;
    scene.add(root);

    const bbox = manifest.metrics.bbox;
    const spanX = Math.max(1, bbox[3] - bbox[0]);
    const spanY = Math.max(1, bbox[4] - bbox[1]);
    const spanZ = Math.max(1, bbox[5] - bbox[2]);
    const scale = 8 / Math.max(spanX, spanY, spanZ);

    const boxMeshes: Array<{ mesh: THREE.Mesh; node: LayoutNode }> = [];

    function buildFallbackGeometry() {
      for (const [index, node] of manifest.hierarchy.entries()) {
        const nodeBounds = node.bbox;
        const width = Math.max((nodeBounds[3] - nodeBounds[0]) * scale, 0.7);
        const depth = Math.max((nodeBounds[4] - nodeBounds[1]) * scale, 0.7);
        const height = Math.max((nodeBounds[5] - nodeBounds[2]) * scale + 0.28, 0.28);
        const centerX = ((nodeBounds[0] + nodeBounds[3]) / 2 - (bbox[0] + bbox[3]) / 2) * scale;
        const centerY = ((nodeBounds[1] + nodeBounds[4]) / 2 - (bbox[1] + bbox[4]) / 2) * scale;
        const centerZ = index * 0.16;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const visible = node.focusLayerIds.some((layerId) => visibleLayerIds.has(layerId));
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(nodeColor(node, manifest)),
          roughness: 0.5,
          metalness: 0.2,
          transparent: true,
          opacity: visible ? 0.95 : 0.18,
          emissive: focusedNodeId === node.id ? new THREE.Color("#ffb56b") : new THREE.Color("#000000"),
          emissiveIntensity: focusedNodeId === node.id ? 0.28 : 0
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(centerX / 1000, centerZ, centerY / 1000);
        mesh.userData = { nodeId: node.id };
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
        boxMeshes.push({ mesh, node });

        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: focusedNodeId === node.id ? "#f1b17f" : "#2f3944", transparent: true, opacity: 0.7 })
        );
        edges.position.copy(mesh.position);
        root.add(edges);
      }
    }

    if (assetUrl) {
      const loader = new GLTFLoader();
      loader.load(
        assetUrl,
        (gltf) => {
          const imported = gltf.scene;
          imported.scale.setScalar(1 / 1000);
          imported.position.set(0, 0, 0);
          root.add(imported);
        },
        undefined,
        () => {
          buildFallbackGeometry();
        }
      );
    } else {
      buildFallbackGeometry();
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function updatePointer(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    }

    function onPointerMove(event: PointerEvent) {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const intersect = raycaster.intersectObjects(boxMeshes.map((entry) => entry.mesh), false)[0];
      const nodeId = (intersect?.object.userData as { nodeId?: string } | undefined)?.nodeId ?? null;
      renderer.domElement.style.cursor = nodeId ? "pointer" : "grab";
    }

    function onPointerDown(event: PointerEvent) {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const intersect = raycaster.intersectObjects(boxMeshes.map((entry) => entry.mesh), false)[0];
      const nodeId = (intersect?.object.userData as { nodeId?: string } | undefined)?.nodeId;
      if (nodeId) {
        onNodeSelectRef.current(nodeId);
      }
    }

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const clock = new THREE.Clock();
    let frame = 0;

    function animate() {
      frame += 1;
      const elapsed = clock.getElapsedTime();
      root.rotation.y = -0.25 + Math.sin(elapsed * 0.14) * 0.03;
      root.position.y = Math.sin(elapsed * 0.8) * 0.02;

      for (const { mesh, node } of boxMeshes) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        const isSelected = focusedNodeId === node.id;
        const isVisible = node.focusLayerIds.some((layerId) => visibleLayerIds.has(layerId));
        const shouldDim = visibleLayerIds.size > 0 && !isVisible;
        material.opacity = shouldDim ? 0.18 : 0.92;
        material.emissive = new THREE.Color(isSelected ? "#f7b16f" : "#000000");
        material.emissiveIntensity = isSelected ? 0.24 : 0;
        mesh.scale.setScalar(isSelected ? 1.035 : 1);
      }

      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    }

    animate();

    function onResize() {
      if (!hostRef.current) {
        return;
      }

      const { clientWidth, clientHeight } = hostRef.current;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    }

    const observer = new ResizeObserver(onResize);
    observer.observe(host);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      controls.dispose();
      renderer.dispose();
      for (const { mesh } of boxMeshes) {
        mesh.geometry.dispose();
        const material = mesh.material as THREE.Material;
        material.dispose();
      }
      host.innerHTML = "";
    };
  }, [manifest, assetUrl, selectedLayerIds, focusedNodeId, visibleLayerIds]);

  return (
    <div className="viewer-shell">
      <div className="viewer-meta">
        <div>
          <p className="eyebrow">Central viewer</p>
          <h2>{manifest.name}</h2>
        </div>
        <p className="viewer-caption">
          Drag to orbit, click a block to focus it, and use the layer rail to test visibility.
        </p>
      </div>
      <div className="viewer-canvas" ref={hostRef} data-testid="scene-viewer" />
      <div className="viewer-status">
        <span>{manifest.technology}</span>
        <span>{manifest.metrics.cellCount} cells</span>
        <span>{manifest.metrics.instanceCount} instances</span>
        <span>{manifest.metrics.polygonCount} polygons</span>
      </div>
    </div>
  );
}
