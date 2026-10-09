import { ShapeUtils, Vector2 } from "three";
import type { Layout, LayerMesh, GeometryFeature, ParseProgress } from "./types";

type Point = [number, number];
type Matrix = [number, number, number, number, number, number];
interface Element {
  kind: number;
  layer: number;
  datatype: number;
  xy: Point[];
  name: string;
  width: number;
  pathType: number;
  begin: number;
  end: number;
  reflect: boolean;
  angle: number;
  mag: number;
  cols: number;
  rows: number;
  absolute: boolean;
  byteOffset: number;
  text: string;
  presentation: number;
  properties: { attribute: number; value: string }[];
  attribute?: number;
}
interface Cell {
  name: string;
  polygons: Element[];
  refs: Element[];
  labels: Element[];
}
const COLORS = [
  "#a7b9d0",
  "#d9b990",
  "#91bcac",
  "#c7a4c4",
  "#8bb9c6",
  "#caca91",
  "#b0a5d2",
  "#d39891",
];
const FLAT_STORAGE_TRIANGLE_THRESHOLD = 2_000_000;
const PROGRESS_INTERVAL_MS = 100;
const PROGRESS_INTERVAL_WORK = 4096;
const PROGRESS_INTERVAL_BYTES = 256 * 1024;

function convexHull(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter((p, i) => i === 0 || p[0] !== sorted[i - 1][0] || p[1] !== sorted[i - 1][1]);
  if (unique.length < 3) return unique;
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [], upper: Point[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return [...lower, ...upper];
}
export const newElement = (kind: number): Element => ({
  kind,
  layer: 0,
  datatype: 0,
  xy: [],
  name: "",
  width: 0,
  pathType: 0,
  begin: 0,
  end: 0,
  reflect: false,
  angle: 0,
  mag: 1,
  cols: 1,
  rows: 1,
  absolute: false,
  byteOffset: 0,
  text: "",
  presentation: 0,
  properties: [],
});
function real8(view: DataView, offset: number): number {
  const byte = view.getUint8(offset);
  let fraction = 0;
  for (let i = 1; i < 8; i++) fraction += view.getUint8(offset + i) / 256 ** i;
  return (byte & 128 ? -1 : 1) * fraction * 16 ** ((byte & 127) - 64);
}
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function pathPolygon(e: Element): Point[] {
  if (e.xy.length < 2 || !e.width) return [];
  const points = e.xy
    .filter(
      (p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1],
    )
    .map((p) => [...p] as Point);
  if (points.length < 2) return [];
  const half = Math.abs(e.width) / 2;
  const normals: Point[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0],
      dy = points[i][1] - points[i - 1][1],
      length = Math.hypot(dx, dy);
    normals.push([-dy / length, dx / length]);
  }
  const ext = e.pathType === 2 ? half : 0;
  const begin = e.pathType === 4 ? e.begin : ext,
    end = e.pathType === 4 ? e.end : ext;
  points[0][0] -= normals[0][1] * begin;
  points[0][1] += normals[0][0] * begin;
  const last = points.length - 1,
    n = normals[normals.length - 1];
  points[last][0] += n[1] * end;
  points[last][1] -= n[0] * end;
  const left: Point[] = [],
    right: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = normals[Math.max(0, i - 1)],
      next = normals[Math.min(i, normals.length - 1)];
    const nx = prev[0] + next[0],
      ny = prev[1] + next[1],
      den = nx * next[0] + ny * next[1];
    if (Math.abs(den) < 0.1)
      throw new Error("路径转角过于尖锐，请先在版图工具中转为边界多边形");
    const ox = (nx * half) / den,
      oy = (ny * half) / den;
    left.push([points[i][0] + ox, points[i][1] + oy]);
    right.push([points[i][0] - ox, points[i][1] - oy]);
  }
  return [...left, ...right.reverse()];
}

// The storage strategy is selected before hierarchy expansion; input size does not reject a GDS layout.
export function parseGds(
  buffer: ArrayBuffer,
  filename: string,
  selectedTop?: string,
  onProgress?: (progress: ParseProgress) => void,
): Layout {
  const view = new DataView(buffer),
    decoder = new TextDecoder("ascii");
  if (
    buffer.byteLength < 6 ||
    view.getUint16(0) !== 6 ||
    view.getUint8(2) !== 0
  )
    throw new Error("不是有效的 GDS 文件头");
  const cells = new Map<string, Cell>();
  let cell: Cell | null = null,
    element: Element | null = null;
  let unit = 0.001,
    finished = false;
  let progressStage: ParseProgress["stage"] | undefined;
  let lastProgressAt = 0, lastProgressCompleted = 0;
  const now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
  const reportProgress = (stage: ParseProgress["stage"], completed: number, total?: number, force = false) => {
    if (!onProgress) return;
    const timestamp = now(), changed = stage !== progressStage;
    const workInterval = stage === "records" ? PROGRESS_INTERVAL_BYTES : PROGRESS_INTERVAL_WORK;
    if (!force && !changed && completed - lastProgressCompleted < workInterval && timestamp - lastProgressAt < PROGRESS_INTERVAL_MS) return;
    onProgress(total === undefined ? { stage, completed } : { stage, completed, total });
    progressStage = stage; lastProgressAt = timestamp; lastProgressCompleted = completed;
  };
  const warnings = new Set<string>();
  let version: number | undefined, library: string | undefined, userUnitMeters = 1e-6;
  const recordCounts = new Map<number, number>();
  const handled = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 25, 26, 27, 28, 33, 43, 44, 45, 46, 48, 49]);
  reportProgress("records", 0, buffer.byteLength, true);
  for (let pos = 0; pos < buffer.byteLength;) {
    if (pos + 4 > buffer.byteLength) throw new Error("文件记录被截断");
    const length = view.getUint16(pos),
      type = view.getUint8(pos + 2),
      data = pos + 4,
      size = length - 4;
    recordCounts.set(type, (recordCounts.get(type) ?? 0) + 1);
    if (length < 4 || length % 2 || pos + length > buffer.byteLength)
      throw new Error("无效或截断的文件记录");
    const need = (n: number) => {
      if (size < n) throw new Error("记录字段被截断");
    };
    const string = () =>
      decoder
        .decode(new Uint8Array(buffer, data, size))
        .replace(/\0+$/g, "");
    if (type === 0) { need(2); version = view.getUint16(data); }
    else if (type === 2) library = string();
    else if (type === 3) {
      need(16);
      unit = real8(view, data + 8) * 1e6;
      const databasePerUser = real8(view, data);
      userUnitMeters = unit / 1e6 / databasePerUser;
      if (!Number.isFinite(userUnitMeters) || databasePerUser <= 0) throw new Error("无效的版图单位");
      if (!Number.isFinite(unit) || unit <= 0)
        throw new Error("无效的版图单位");
    } else if (type === 5) {
      if (cell) throw new Error("单元记录嵌套错误");
      cell = { name: "", polygons: [], refs: [], labels: [] };
    } else if (type === 6) {
      if (!cell) throw new Error("单元名称出现在单元之外");
      cell.name = string();
    } else if (type === 7) {
      if (!cell?.name || element || cells.has(cell.name))
        throw new Error("单元名称为空、重复或元素未结束");
      cells.set(cell.name, cell);
      cell = null;
    } else if ([8, 9, 10, 11, 12, 45].includes(type)) {
      if (!cell || element) throw new Error("元素结构错误");
      element = newElement(type);
      element.byteOffset = pos;
    } else if (type === 21) {
      throw new Error("暂不支持 NODE 元素，请先转换为边界多边形");
    } else if (type === 17) {
      if (!cell || !element) throw new Error("元素结束记录错误");
      if ([8, 9, 45].includes(element.kind)) cell.polygons.push(element);
      if ([10, 11].includes(element.kind)) cell.refs.push(element);
      if (element.kind === 12) cell.labels.push(element);
      element = null;
    } else if (type === 4) {
      finished = true;
      if (cell || element) throw new Error("未结束的单元或元素");
      // Stream exporters may pad the last physical block with null words.
      // Accept only zero padding after a complete ENDLIB, never another library/payload.
      if (length !== 4 || view.getUint8(pos + 3) !== 0 || buffer.byteLength % 2 ||
          new Uint8Array(buffer, pos + length).some((byte) => byte !== 0))
        throw new Error("库结束记录后存在额外数据");
      break;
    } else if (element) {
      if (type === 13) {
        need(2);
        element.layer = view.getUint16(data);
      } else if (type === 14 || type === 46 || type === 22) {
        need(2);
        element.datatype = view.getUint16(data);
      } else if (type === 15) {
        need(4);
        element.width = view.getInt32(data);
      } else if (type === 16) {
        if (size % 8) throw new Error("坐标记录长度错误");
        for (let i = 0; i < size; i += 8)
          element.xy.push([
            view.getInt32(data + i),
            view.getInt32(data + i + 4),
          ]);
      } else if (type === 25) element.text = string();
      else if (type === 23) { need(2); element.presentation = view.getUint16(data); }
      else if (type === 43) { need(2); element.attribute = view.getUint16(data); }
      else if (type === 44) {
        if (element.attribute === undefined) throw new Error("元素属性缺少编号");
        element.properties.push({ attribute: element.attribute, value: string() });
        element.attribute = undefined;
      }
      else if (type === 18) element.name = string();
      else if (type === 19) {
        need(4);
        element.cols = view.getUint16(data);
        element.rows = view.getUint16(data + 2);
        if (!element.cols || !element.rows) throw new Error("阵列规模必须大于零");
      } else if (type === 26) {
        need(2);
        const flags = view.getUint16(data);
        element.reflect = Boolean(flags & 0x8000);
        element.absolute = Boolean(flags & 6);
      } else if (type === 27) {
        need(8);
        element.mag = real8(view, data);
        if (
          !Number.isFinite(element.mag) ||
          element.mag <= 0
        )
          throw new Error("无效的引用缩放");
      } else if (type === 28) {
        need(8);
        element.angle = real8(view, data);
        if (!Number.isFinite(element.angle)) throw new Error("无效的引用角度");
      } else if (type === 33) {
        need(2);
        element.pathType = view.getUint16(data);
      } else if (type === 48) {
        need(4);
        element.begin = view.getInt32(data);
      } else if (type === 49) {
        need(4);
        element.end = view.getInt32(data);
      }
    }
    pos += length;
    reportProgress("records", pos, buffer.byteLength);
  }
  if (!finished || !cells.size) throw new Error("文件没有完整的版图库");
  reportProgress("records", buffer.byteLength, buffer.byteLength, true);
  reportProgress("hierarchy", 0, undefined, true);
  const layerIds = new Set<string>();
  let sourceSpan = 0.000001;
  for (const cell of cells.values()) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const element of cell.polygons) {
      layerIds.add(`${element.layer}/${element.datatype}`);
      const padding = element.kind === 9 ? Math.abs(element.width) / 2 : 0;
      for (const [x, y] of element.xy) { minX = Math.min(minX, x - padding); minY = Math.min(minY, y - padding); maxX = Math.max(maxX, x + padding); maxY = Math.max(maxY, y + padding); }
    }
    if (Number.isFinite(minX)) {
      const spanX = (maxX - minX) * unit, spanY = (maxY - minY) * unit;
      if (!Number.isFinite(spanX) || !Number.isFinite(spanY)) throw new Error("展开范围不是有限数值");
      sourceSpan = Math.max(sourceSpan, spanX, spanY);
    }
  }
  const stackLayers = [...layerIds].sort((a, b) => { const aa = a.split("/").map(Number), bb = b.split("/").map(Number); return aa[0] - bb[0] || aa[1] - bb[1]; });
  const stackIndex = new Map(stackLayers.map((id, index) => [id, index]));
  const gds: NonNullable<Layout["gds"]> = {
    stack: { layers: stackLayers, pitch: sourceSpan * 0.02 },
    version, library, databaseUnitMeters: unit / 1e6, userUnitMeters,
    records: [...recordCounts].map(([type, count]) => ({ type, count, handled: handled.has(type) })),
    labels: [], references: [],
  };
  // Source metadata is collected once per record, never multiplied by the hierarchy.
  for (const c of cells.values()) {
    for (const e of c.labels) {
      if (e.xy.length !== 1) throw new Error("文字坐标记录错误");
      const labelPosition: [number, number] = [e.xy[0][0] * unit, e.xy[0][1] * unit];
      if (!labelPosition.every(Number.isFinite)) throw new Error("文字坐标不是有限数值");
      gds.labels.push({ cell: c.name, layer: `${e.layer}/${e.datatype}`, text: e.text, xy: labelPosition, angle: e.angle, magnification: e.mag, reflect: e.reflect, presentation: e.presentation, properties: e.properties });
    }
    for (const e of c.refs) {
      const referencePoints = e.xy.map(([x, y]) => [x * unit, y * unit] as [number, number]);
      if (referencePoints.some((point) => !point.every(Number.isFinite))) throw new Error("引用坐标不是有限数值");
      gds.references.push({ cell: c.name, target: e.name, kind: e.kind === 11 ? "AREF" : "SREF", xy: referencePoints, columns: e.cols, rows: e.rows, angle: e.angle, magnification: e.mag, reflect: e.reflect, absolute: e.absolute, properties: e.properties });
    }
  }
  if (gds.labels.length) warnings.add("文字标签可在源数据中查看，未叠加到三维画布");
  if (gds.records.some((r) => !r.handled)) warnings.add("部分记录仅统计而未解释，可在源数据中查看记录类型");
  const referenced = new Set(
    [...cells.values()].flatMap((c) => c.refs.map((r) => r.name)),
  );
  const missingReferences = [...cells.values()].flatMap((c) => {
    const missing = new Map<string, number>();
    for (const r of c.refs) if (!cells.has(r.name)) missing.set(r.name, (missing.get(r.name) ?? 0) + r.cols * r.rows);
    return [...missing].map(([target, count]) => ({ source: c.name, target, count }));
  });
  const missingVisited = new Set<string>();
  const tops = [...cells.keys()].filter((n) => !referenced.has(n));
  if (!tops.length) throw new Error("单元引用存在循环，找不到顶层单元");
  const top = selectedTop ?? tops[0];
  if (!cells.has(top)) throw new Error("所选单元不存在");
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      color: string;
      positions: number[];
      polygons: number;
      features: GeometryFeature[];
      boundsHull: Point[];
    }
  >();
  let instances = 0,
    polygons = 0,
    triangles = 0;
  let directOnly = false;
  let hierarchyCompleted = 0, geometryCompleted = 0;
  const occurrences: NonNullable<Layout["occurrences"]> = [];
  const occurrence = (cell: string, path: string, parent: number) => {
    const index = occurrences.length;
    occurrences.push({ cell, path, parent });
    return index;
  };
  const bounds: [number, number, number, number] = [
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
  ];
  const addGeometry = (name: string, matrix: Matrix, instance: string, current: Cell) => {
    for (const [elementIndex, e] of current.polygons.entries()) {
      polygons++;
      if (e.kind === 9 && (e.pathType === 1 || ![0, 2, 4].includes(e.pathType)))
        throw new Error("圆端或未知路径类型需要先转为边界多边形");
      if (e.kind === 9 && e.width < 0)
        throw new Error("绝对宽度路径需要先转为边界多边形");
      let points = e.kind === 9 ? pathPolygon(e) : e.xy;
      if (
        points.length > 1 &&
        points[0][0] === points[points.length - 1][0] &&
        points[0][1] === points[points.length - 1][1]
      )
        points = points.slice(0, -1);
      if (points.length < 3) {
        warnings.add("跳过了无面积元素");
        geometryCompleted++; reportProgress("geometry", geometryCompleted);
        continue;
      }
      const world = points.map(
        ([x, y]) =>
          new Vector2(
            (matrix[0] * x + matrix[2] * y + matrix[4]) * unit,
            (matrix[1] * x + matrix[3] * y + matrix[5]) * unit,
          ),
      );
      if (
        world.some(
          (p) =>
            !Number.isFinite(p.x) ||
            !Number.isFinite(p.y) ||
            !Number.isFinite(Math.fround(p.x)) ||
            !Number.isFinite(Math.fround(p.y)),
        )
      )
        throw new Error("展开坐标超出可表示范围");
      const faces = ShapeUtils.triangulateShape(world, []);
      if (!faces.length) throw new Error("多边形无法三角化");
      triangles += faces.length * 2 + points.length * 2;
      const id = `${e.layer}/${e.datatype}`;
      let group = groups.get(id);
      if (!group) {
        group = {
          id,
          name: `Layer ${id}`,
          color: COLORS[groups.size % COLORS.length],
          positions: [],
          polygons: 0,
          features: [],
          boundsHull: [],
        };
        groups.set(id, group);
      }
      if (directOnly) {
        const roundedPoints = world.map((p) => [Math.fround(p.x), Math.fround(-p.y)] as Point);
        group.boundsHull = convexHull([...group.boundsHull, ...roundedPoints]);
      }
      group.polygons++;
      const objectBounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
      let twiceArea = 0;
      for (let i = 0; i < world.length; i++) {
        const a = world[i], b = world[(i + 1) % world.length];
        objectBounds[0] = Math.min(objectBounds[0], a.x);
        objectBounds[1] = Math.min(objectBounds[1], a.y);
        objectBounds[2] = Math.max(objectBounds[2], a.x);
        objectBounds[3] = Math.max(objectBounds[3], a.y);
        twiceArea += a.x * b.y - b.x * a.y;
      }
      const magnification = Math.hypot(matrix[0], matrix[1]);
      const pathWidth = Math.abs(e.width) * unit * magnification;
      const pathLength = e.xy.reduce((sum, p, i, a) => sum + (i ? Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0), 0) * unit * magnification;
      if (!Number.isFinite(magnification) || (e.kind === 9 && (!Number.isFinite(pathWidth) || !Number.isFinite(pathLength))))
        throw new Error("几何属性不是有限数值");
      group.features.push({
        id: `${instance}/element-${elementIndex + 1}`,
        kind: e.kind === 9 ? "path" : e.kind === 45 ? "box" : "boundary",
        cell: name, instance, layer: id, datatype: e.datatype,
        firstTriangle: group.positions.length / 9,
        triangles: faces.length * 2 + points.length * 2,
        vertices: world.length, bounds: objectBounds, area: Math.abs(twiceArea) / 2,
        byteOffset: e.byteOffset,
        ...(e.properties.length ? { properties: e.properties } : {}),
        ...(e.kind === 9 ? {
          pathWidth,
          pathLength,
        } : {}),
      });
      for (const p of world) {
        bounds[0] = Math.min(bounds[0], p.x);
        bounds[1] = Math.min(bounds[1], p.y);
        bounds[2] = Math.max(bounds[2], p.x);
        bounds[3] = Math.max(bounds[3], p.y);
      }
      // Layer index is illustrative; no unverified physical process height is implied.
      const z = stackIndex.get(id)! * 0.3;
      const put = (p: Vector2, h: number) =>
        group!.positions.push(p.x, h, -p.y);
      for (const f of faces) {
        for (const i of f) put(world[i], z + 0.3);
        for (const i of [...f].reverse()) put(world[i], z);
      }
      for (let i = 0; i < world.length; i++) {
        const a = world[i],
          b = world[(i + 1) % world.length];
        put(a, z);
        put(b, z);
        put(b, z + 0.3);
        put(a, z);
        put(b, z + 0.3);
        put(a, z + 0.3);
      }
      geometryCompleted++; reportProgress("geometry", geometryCompleted);
    }
  };
  const referencePlacement = (matrix: Matrix, reference: Element, row: number, col: number): Matrix => {
    if (reference.absolute)
      throw new Error("暂不支持引用的绝对角度或绝对缩放，请先展开版图");
    if (reference.xy.length !== (reference.kind === 11 ? 3 : 1))
      throw new Error("引用坐标记录错误");
    const theta = reference.angle * Math.PI / 180,
      c = Math.cos(theta) * reference.mag,
      s = Math.sin(theta) * reference.mag,
      reflect = reference.reflect ? -1 : 1;
    const x = reference.xy[0][0] + (reference.kind === 11
      ? col * (reference.xy[1][0] - reference.xy[0][0]) / reference.cols +
        row * (reference.xy[2][0] - reference.xy[0][0]) / reference.rows
      : 0);
    const y = reference.xy[0][1] + (reference.kind === 11
      ? col * (reference.xy[1][1] - reference.xy[0][1]) / reference.cols +
        row * (reference.xy[2][1] - reference.xy[0][1]) / reference.rows
      : 0);
    const result = multiply(matrix, [c, s, -s * reflect, c * reflect, x, y]);
    if (result.some((value) => !Number.isFinite(value))) throw new Error("展开坐标不是有限数值");
    return result;
  };
  const visit = (rootName: string, rootMatrix: Matrix, rootInstance: string, rootParent = -1) => {
    type Frame = {
      name: string; matrix: Matrix; instance: string; parent: number;
      entered: boolean; current?: Cell; currentIndex: number;
      referenceIndex: number; row: number; col: number;
    };
    const active = new Set<string>();
    const frames: Frame[] = [{ name: rootName, matrix: rootMatrix, instance: rootInstance, parent: rootParent, entered: false, currentIndex: -1, referenceIndex: 0, row: 0, col: 0 }];
    while (frames.length) {
      const frame = frames[frames.length - 1];
      if (!frame.entered) {
        if (active.has(frame.name)) throw new Error("单元引用存在循环");
        active.add(frame.name);
        frame.entered = true;
        instances++;
        frame.currentIndex = directOnly ? -1 : occurrence(frame.name, frame.instance, frame.parent);
        frame.current = cells.get(frame.name);
        if (!frame.current) {
          missingVisited.add(frame.name);
          active.delete(frame.name); frames.pop();
          if (!directOnly) { hierarchyCompleted++; }
          continue;
        }
        addGeometry(frame.name, frame.matrix, frame.instance, frame.current);
        if (!directOnly) { hierarchyCompleted++; }
        if (directOnly) { active.delete(frame.name); frames.pop(); continue; }
      }
      const current = frame.current!;
      if (frame.referenceIndex >= current.refs.length) {
        active.delete(frame.name); frames.pop(); continue;
      }
      const referenceIndex = frame.referenceIndex;
      const reference = current.refs[referenceIndex];
      const row = frame.row, col = frame.col;
      if (frame.col + 1 < reference.cols) frame.col++;
      else if (frame.row + 1 < reference.rows) { frame.col = 0; frame.row++; }
      else { frame.referenceIndex++; frame.row = frame.col = 0; }
      frames.push({
        name: reference.name,
        matrix: referencePlacement(frame.matrix, reference, row, col),
        instance: `${frame.instance}/ref-${referenceIndex + 1}[${col},${row}]:${reference.name}`,
        parent: frame.currentIndex,
        entered: false, currentIndex: -1, referenceIndex: 0, row: 0, col: 0,
      });
    }
  };
  // This count only selects flat versus instanced storage; it never rejects a layout.
  const estimates = new Map<string, number>();
  const estimate = (rootName: string): number => {
    type EstimateFrame = { name: string; nextReference: number; entered: boolean };
    const active = new Set<string>();
    const frames: EstimateFrame[] = [{ name: rootName, nextReference: 0, entered: false }];
    while (frames.length) {
      const frame = frames[frames.length - 1];
      const current = cells.get(frame.name);
      if (!frame.entered) {
        if (active.has(frame.name)) throw new Error("单元引用存在循环");
        active.add(frame.name); frame.entered = true;
      }
      if (!current) {
        estimates.set(frame.name, 0);
        active.delete(frame.name); frames.pop();
        continue;
      }
      if (frame.nextReference < current.refs.length) {
        const reference = current.refs[frame.nextReference++];
        if (!cells.has(reference.name)) { estimates.set(reference.name, 0); continue; }
        if (active.has(reference.name)) throw new Error("单元引用存在循环");
        if (!estimates.has(reference.name)) frames.push({ name: reference.name, nextReference: 0, entered: false });
        continue;
      }
      let count = 0;
      for (const element of current.polygons) {
        const last = element.xy[element.xy.length - 1];
        const closed = element.xy.length > 1 && element.xy[0][0] === last[0] && element.xy[0][1] === last[1];
        const estimate = Math.max(0, (element.kind === 9 ? element.xy.length * 2 : element.xy.length - (closed ? 1 : 0)) * 4 - 4);
        count = Math.min(FLAT_STORAGE_TRIANGLE_THRESHOLD + 1, count + estimate);
      }
      for (const reference of current.refs) {
        const child = estimates.get(reference.name) ?? 0;
        const multiplicity = reference.cols * reference.rows;
        if (child && multiplicity > (FLAT_STORAGE_TRIANGLE_THRESHOLD + 1 - count) / child) {
          count = FLAT_STORAGE_TRIANGLE_THRESHOLD + 1;
          break;
        }
        count = Math.min(FLAT_STORAGE_TRIANGLE_THRESHOLD + 1, count + child * multiplicity);
      }
      estimates.set(frame.name, count);
      active.delete(frame.name); frames.pop();
      hierarchyCompleted++; reportProgress("hierarchy", hierarchyCompleted);
    }
    return estimates.get(rootName) ?? 0;
  };
  const instanced = (): Layout => {
    const placements = new Map<string, { matrix: Matrix; path: string }[]>();
    type PlaceFrame = {
      name: string; matrix: Matrix; path: string; parent: number;
      entered: boolean; current?: Cell; currentIndex: number;
      referenceIndex: number; row: number; col: number;
    };
    const active = new Set<string>();
    const frames: PlaceFrame[] = [{ name: top, matrix: [1, 0, 0, 1, 0, 0], path: top, parent: -1, entered: false, currentIndex: -1, referenceIndex: 0, row: 0, col: 0 }];
    while (frames.length) {
      const frame = frames[frames.length - 1];
      if (!frame.entered) {
        if (active.has(frame.name)) throw new Error("单元引用存在循环");
        active.add(frame.name); frame.entered = true;
        instances++;
        frame.currentIndex = occurrence(frame.name, frame.path, frame.parent);
        frame.current = cells.get(frame.name);
        if (!frame.current) {
          missingVisited.add(frame.name);
          active.delete(frame.name); frames.pop();
          hierarchyCompleted++; reportProgress("hierarchy", hierarchyCompleted);
          continue;
        }
        if (frame.matrix.some((value) => !Number.isFinite(value))) throw new Error("展开坐标不是有限数值");
        if (frame.current.polygons.length) {
          const list = placements.get(frame.name) ?? [];
          list.push({ matrix: [frame.matrix[0], frame.matrix[1], frame.matrix[2], frame.matrix[3], frame.matrix[4] * unit, frame.matrix[5] * unit], path: frame.path });
          placements.set(frame.name, list);
        }
        hierarchyCompleted++; reportProgress("hierarchy", hierarchyCompleted);
      }
      const current = frame.current!;
      if (frame.referenceIndex >= current.refs.length) {
        active.delete(frame.name); frames.pop(); continue;
      }
      const referenceIndex = frame.referenceIndex;
      const reference = current.refs[referenceIndex];
      const row = frame.row, col = frame.col;
      if (frame.col + 1 < reference.cols) frame.col++;
      else if (frame.row + 1 < reference.rows) { frame.col = 0; frame.row++; }
      else { frame.referenceIndex++; frame.row = frame.col = 0; }
      frames.push({
        name: reference.name,
        matrix: referencePlacement(frame.matrix, reference, row, col),
        path: `${frame.path}/ref-${referenceIndex + 1}[${col},${row}]:${reference.name}`,
        parent: frame.currentIndex,
        entered: false, currentIndex: -1, referenceIndex: 0, row: 0, col: 0,
      });
    }
    const expandedInstances = instances, output = new Map<string, LayerMesh>(), wholeBounds: Layout["bounds"] = [Infinity, Infinity, -Infinity, -Infinity];
    let storedTriangles = 0, drawnTriangles = 0;
    reportProgress("geometry", 0, undefined, true);
    directOnly = true;
    for (const [name, copies] of placements) {
      groups.clear(); instances = polygons = triangles = 0; bounds[0] = bounds[1] = Infinity; bounds[2] = bounds[3] = -Infinity;
      visit(name, [1, 0, 0, 1, 0, 0], name);
      for (const source of groups.values()) {
        let layer = output.get(source.id);
        if (!layer) { layer = { id: source.id, name: source.name, color: COLORS[output.size % COLORS.length], positions: new Float32Array(), polygons: 0, batches: [] }; output.set(source.id, layer); }
        layer.polygons += source.polygons * copies.length;
        drawnTriangles += source.positions.length / 9 * copies.length;
        for (const mirrored of [false, true]) {
          const selected = copies.filter(p => (p.matrix[0] * p.matrix[3] - p.matrix[1] * p.matrix[2] < 0) === mirrored); if (!selected.length) continue;
          storedTriangles += source.positions.length / 9;
          const points = new Float32Array(source.positions);
          const transforms = new Float64Array(selected.flatMap(p => p.matrix));
          layer.batches!.push({ cell: name, positions: points, features: source.features, transforms, paths: selected.map(p => p.path), mirrored });
          const supportBounds = new Map<string, [number, number, number, number]>();
          for (const { matrix: m } of selected) {
            const key = `${m[0]},${m[1]},${m[2]},${m[3]}`;
            let extents = supportBounds.get(key);
            if (!extents) {
              extents = [Infinity, Infinity, -Infinity, -Infinity];
              for (const [x, z] of source.boundsHull) {
                const transformedX = m[0] * x - m[2] * z, transformedY = m[1] * x - m[3] * z;
                if (!Number.isFinite(transformedX) || !Number.isFinite(transformedY)) throw new Error("展开坐标不是有限数值");
                extents[0] = Math.min(extents[0], transformedX); extents[1] = Math.min(extents[1], transformedY);
                extents[2] = Math.max(extents[2], transformedX); extents[3] = Math.max(extents[3], transformedY);
              }
              supportBounds.set(key, extents);
            }
            const x0 = extents[0] + m[4], y0 = extents[1] + m[5], x1 = extents[2] + m[4], y1 = extents[3] + m[5];
            if (![x0, y0, x1, y1].every(Number.isFinite)) throw new Error("展开坐标不是有限数值");
            wholeBounds[0] = Math.min(wholeBounds[0], x0); wholeBounds[1] = Math.min(wholeBounds[1], y0);
            wholeBounds[2] = Math.max(wholeBounds[2], x1); wholeBounds[3] = Math.max(wholeBounds[3], y1);
            geometryCompleted++; reportProgress("geometry", geometryCompleted);
          }
        }
      }
    }
    if (missingVisited.size) warnings.add(`不完整预览：当前展开缺少 ${missingVisited.size} 种引用目标，只显示文件中实际存在的几何；完整器件形状需要配套单元库`);
    warnings.add("重复单元复用源几何，完整显示当前顶层；显示高度不代表真实工艺厚度");
    reportProgress("geometry", geometryCompleted, undefined, true);
    return { name: filename, format: "gds", layers: [...output.values()], cells: [...cells.values()].map(c => ({ name: c.name, polygons: c.polygons.length, references: c.refs.length })), tops, top, bounds: output.size ? wholeBounds : [0, 0, 0, 0], unit: "µm", instances: expandedInstances, triangles: drawnTriangles, warnings: [...warnings], missingReferences, incomplete: missingVisited.size > 0, occurrences, gds, rendering: { kind: "instanced", storedTriangles, placements: expandedInstances } };
  };
  const triangleEstimate = estimate(top);
  if (triangleEstimate > FLAT_STORAGE_TRIANGLE_THRESHOLD) return instanced();
  reportProgress("geometry", 0, undefined, true);
  visit(top, [1, 0, 0, 1, 0, 0], top);
  if (!groups.size && !missingVisited.size && !cells.get(top)?.labels.length) throw new Error("所选单元没有可渲染的几何");
  if (missingVisited.size) warnings.add(`不完整预览：当前展开缺少 ${missingVisited.size} 种引用目标，只显示文件中实际存在的几何；完整器件形状需要配套单元库`);
  if (tops.length > 1) warnings.add("文件含多个顶层单元，可在单元面板中选择");
  warnings.add("同一文件共用图层层序与示意厚度，缺少的图层保留位置；不代表真实工艺厚度");
  const layers: LayerMesh[] = [...groups.values()].map(({ boundsHull: _boundsHull, ...g }) => ({
    ...g,
    positions: new Float32Array(g.positions),
  }));
  reportProgress("geometry", geometryCompleted, undefined, true);
  return {
    name: filename,
    format: "gds",
    layers,
    cells: [...cells.values()].map((c) => ({
      name: c.name,
      polygons: c.polygons.length,
      references: c.refs.length,
    })),
    tops,
    top,
    bounds: groups.size ? bounds : [0, 0, 0, 0],
    unit: "µm",
    instances,
    occurrences,
    triangles,
    warnings: [...warnings],
    missingReferences,
    incomplete: missingVisited.size > 0,
    gds,
  };
}
