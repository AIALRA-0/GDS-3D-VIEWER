export interface GeometryFeature {
  id: string;
  kind: "boundary" | "path" | "box" | "mesh";
  cell: string;
  instance: string;
  layer: string;
  datatype?: number;
  firstTriangle: number;
  triangles: number;
  vertices: number;
  bounds: [number, number, number, number];
  area?: number;
  pathWidth?: number;
  pathLength?: number;
  byteOffset?: number;
  properties?: { attribute: number; value: string }[];
  batch?: number;
  placement?: number;
}
export interface PickInfo {
  layerId: string;
  feature?: GeometryFeature;
  point: [number, number, number];
  screen: [number, number];
}
export interface LayerMesh {
  id: string;
  name: string;
  color: string;
  positions: Float32Array;
  polygons: number;
  features?: GeometryFeature[];
  batches?: { cell: string; positions: Float32Array; features: GeometryFeature[]; transforms: Float64Array; paths: string[]; mirrored: boolean }[];
}
export interface CellInfo {
  name: string;
  polygons: number;
  references: number;
}
export interface Layout {
  name: string;
  format: "gds" | "gltf";
  layers: LayerMesh[];
  cells: CellInfo[];
  tops: string[];
  top: string;
  bounds: [number, number, number, number];
  unit: string;
  instances: number;
  triangles: number;
  warnings: string[];
  missingReferences?: { source: string; target: string; count: number }[];
  incomplete?: boolean;
  rendering?: { kind: "instanced"; storedTriangles: number; placements: number };
  occurrences?: { cell: string; path: string; parent: number }[];
  gds?: {
    version?: number;
    library?: string;
    databaseUnitMeters: number;
    userUnitMeters: number;
    records: { type: number; count: number; handled: boolean }[];
    labels: { cell: string; layer: string; text: string; xy: [number, number]; angle: number; magnification: number; reflect: boolean; presentation: number; properties: { attribute: number; value: string }[] }[];
    references: { cell: string; target: string; kind: "SREF" | "AREF"; xy: [number, number][]; columns: number; rows: number; angle: number; magnification: number; reflect: boolean; absolute: boolean; properties: { attribute: number; value: string }[] }[];
  };
}
export const LIMITS = {
  fileBytes: 32 * 1024 * 1024,
  records: 1_000_000,
  cells: 20_000,
  instances: 150_000,
  polygons: 300_000,
  triangles: 2_000_000,
  drawnTriangles: 12_000_000,
  depth: 64,
  seconds: 45,
};
