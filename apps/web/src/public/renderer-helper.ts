import * as THREE from "three";

/** Conservative local-space broadphase for Three.js' existing exact raycast. */
export function rayIntersectsLocalBounds(
  worldRay: THREE.Ray,
  localBounds: THREE.Box3 | null,
  matrixWorld: THREE.Matrix4,
  rayScratch: THREE.Ray,
  inverseScratch: THREE.Matrix4,
): boolean {
  if (!localBounds || localBounds.isEmpty()) return true;
  const { min, max } = localBounds;
  if (!Number.isFinite(min.x) || !Number.isFinite(min.y) || !Number.isFinite(min.z) ||
      !Number.isFinite(max.x) || !Number.isFinite(max.y) || !Number.isFinite(max.z)) return true;
  for (const element of matrixWorld.elements) if (!Number.isFinite(element)) return true;
  const determinant = matrixWorld.determinant();
  if (!Number.isFinite(determinant) || determinant === 0) return true;
  rayScratch.copy(worldRay);
  inverseScratch.copy(matrixWorld).invert();
  rayScratch.applyMatrix4(inverseScratch);
  const { origin, direction } = rayScratch;
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z) ||
      !Number.isFinite(direction.x) || !Number.isFinite(direction.y) || !Number.isFinite(direction.z)) return true;
  return rayScratch.intersectsBox(localBounds);
}
