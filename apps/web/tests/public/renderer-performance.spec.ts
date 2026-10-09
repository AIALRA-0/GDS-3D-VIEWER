import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { rayIntersectsLocalBounds } from "../../src/public/renderer-helper";

test("picking broadphase preserves exact hits across rotation, reflection, height and translation", () => {
  const geometry = new THREE.BoxGeometry(3, 0.3, 5);
  geometry.computeBoundingBox();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  const raycaster = new THREE.Raycaster();
  const rayScratch = new THREE.Ray(), inverseScratch = new THREE.Matrix4();
  for (let index = 0; index < 120; index++) {
    mesh.position.set(index * 0.11 - 5, index * 0.03, index * -0.09);
    mesh.rotation.set(index * 0.071, index * 0.13, index * -0.053);
    mesh.scale.set(index % 2 ? -1.7 : 0.6, 0.01 + index / 80, 0.9);
    mesh.updateMatrixWorld(true);
    const center = mesh.getWorldPosition(new THREE.Vector3());
    const origin = center.clone().add(new THREE.Vector3(13, 17, 11));
    raycaster.set(origin, center.clone().sub(origin).normalize());
    expect(raycaster.intersectObject(mesh, false).length).toBeGreaterThan(0);
    expect(rayIntersectsLocalBounds(raycaster.ray, geometry.boundingBox, mesh.matrixWorld, rayScratch, inverseScratch)).toBe(true);
    const outside = new THREE.Ray(origin, origin.clone().sub(center).normalize());
    expect(rayIntersectsLocalBounds(outside, geometry.boundingBox, mesh.matrixWorld, rayScratch, inverseScratch)).toBe(false);
  }
  geometry.dispose(); material.dispose();
});

test("uncertain bounds and singular transforms fall back to exact picking", () => {
  const ray = new THREE.Ray(new THREE.Vector3(100, 100, 100), new THREE.Vector3(1, 0, 0));
  const scratch = new THREE.Ray(), inverse = new THREE.Matrix4(), matrix = new THREE.Matrix4();
  const box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  expect(rayIntersectsLocalBounds(ray, box, matrix, scratch, inverse)).toBe(false);
  expect(rayIntersectsLocalBounds(ray, null, matrix, scratch, inverse)).toBe(true);
  expect(rayIntersectsLocalBounds(ray, new THREE.Box3(), matrix, scratch, inverse)).toBe(true);
  expect(rayIntersectsLocalBounds(ray, box, matrix.makeScale(0, 1, 1), scratch, inverse)).toBe(true);
  box.min.x = -Infinity;
  expect(rayIntersectsLocalBounds(ray, box, matrix.identity(), scratch, inverse)).toBe(true);
});
