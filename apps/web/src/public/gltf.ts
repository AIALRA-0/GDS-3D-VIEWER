import { Matrix4, Quaternion, Vector3, Color } from "three";
import { LIMITS } from "./types";
import type { Layout, GeometryFeature } from "./types";

interface Accessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  sparse?: unknown;
}
interface Node {
  name?: string;
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}
interface Document {
  asset: { version: string };
  extensionsRequired?: string[];
  buffers: { uri?: string; byteLength: number }[];
  bufferViews: {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }[];
  accessors: Accessor[];
  nodes: Node[];
  scene?: number;
  scenes: { nodes: number[] }[];
  meshes: {
    name?: string;
    primitives: {
      mode?: number;
      attributes: { POSITION: number };
      indices?: number;
      material?: number;
      extensions?: unknown;
    }[];
  }[];
  materials?: {
    name?: string;
    pbrMetallicRoughness?: { baseColorFactor?: number[] };
  }[];
  images?: unknown[];
  animations?: unknown[];
}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const integer = (v: number, max: number) =>
  Number.isInteger(v) && v >= 0 && v < max;
const vector = (v: unknown, n: number): v is number[] =>
  Array.isArray(v) &&
  v.length === n &&
  v.every(
    (x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e12,
  );

// Decode geometry directly. No glTF loader, URL fetch, textures, scripts or extension plugins.
export function parseGltf(input: ArrayBuffer, filename: string): Layout {
  check(input.byteLength <= LIMITS.fileBytes, "文件超过 32 MB 限制");
  let text: string, binary: ArrayBuffer | undefined;
  const view = new DataView(input);
  if (input.byteLength >= 12 && view.getUint32(0, true) === 0x46546c67) {
    check(
      view.getUint32(4, true) === 2 &&
        view.getUint32(8, true) === input.byteLength,
      "无效的 GLB 头",
    );
    let offset = 12;
    let json: Uint8Array | undefined;
    while (offset < input.byteLength) {
      check(offset + 8 <= input.byteLength, "模型块头被截断");
      const length = view.getUint32(offset, true),
        kind = view.getUint32(offset + 4, true);
      offset += 8;
      check(
        length % 4 === 0 && offset + length <= input.byteLength,
        "模型块长度错误",
      );
      if (kind === 0x4e4f534a) {
        check(!json && offset === 20, "模型 JSON 块重复或顺序错误");
        json = new Uint8Array(input, offset, length);
      } else if (kind === 0x004e4942) {
        check(!binary, "二进制块重复");
        binary = input.slice(offset, offset + length);
      }
      offset += length;
    }
    check(json, "模型缺少 JSON 块");
    text = new TextDecoder().decode(json);
  } else text = new TextDecoder().decode(input);
  const doc = JSON.parse(text) as Document;
  check(doc.asset?.version === "2.0", "只支持 glTF 2.0");
  check(
    !doc.extensionsRequired?.length,
    "模型含必需扩展，请导出为无压缩静态网格",
  );
  check(
    !doc.images?.length,
    "公开预览只支持无纹理模型，请先移除纹理并嵌入几何缓冲区",
  );
  check(
    Array.isArray(doc.nodes) &&
      doc.nodes.length <= LIMITS.instances &&
      Array.isArray(doc.meshes) &&
      Array.isArray(doc.accessors) &&
      Array.isArray(doc.bufferViews) &&
      Array.isArray(doc.buffers) &&
      Array.isArray(doc.scenes),
    "模型结构无效或规模超过限制",
  );
  let bytes = 0;
  const buffers = doc.buffers.map((b, i) => {
    let result: ArrayBuffer;
    if (b.uri === undefined) {
      check(i === 0 && binary, "缺少嵌入二进制块");
      result = binary;
    } else {
      check(
        typeof b.uri === "string" &&
          /^data:application\/(octet-stream|gltf-buffer);base64,[A-Za-z0-9+/]*={0,2}$/.test(
            b.uri,
          ),
        "外部资源已禁用，请使用嵌入缓冲区的自包含模型",
      );
      const raw = atob(b.uri.slice(b.uri.indexOf(",") + 1));
      result = Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer;
    }
    bytes += result.byteLength;
    check(
      bytes <= LIMITS.fileBytes &&
        Number.isInteger(b.byteLength) &&
        b.byteLength >= 0 &&
        result.byteLength >= b.byteLength &&
        result.byteLength <= b.byteLength + 3,
      "缓冲区长度无效或超过限制",
    );
    return result;
  });
  function accessor(index: number, position: boolean): number[] {
    check(integer(index, doc.accessors.length), "访问器索引无效");
    const a = doc.accessors[index];
    check(
      !a.sparse &&
        integer(a.bufferView, doc.bufferViews.length) &&
        Number.isInteger(a.count) &&
        a.count >= 0 &&
        a.count <= LIMITS.triangles * 3,
      "访问器结构或数量不受支持",
    );
    check(
      position
        ? a.type === "VEC3" && a.componentType === 5126
        : a.type === "SCALAR" && [5121, 5123, 5125].includes(a.componentType),
      "只支持浮点位置及整数三角形索引",
    );
    const b = doc.bufferViews[a.bufferView];
    check(integer(b.buffer, buffers.length), "缓冲区索引无效");
    const width =
        a.componentType === 5121 ? 1 : a.componentType === 5123 ? 2 : 4,
      components = position ? 3 : 1,
      stride = b.byteStride ?? width * components;
    const start = b.byteOffset ?? 0,
      local = a.byteOffset ?? 0;
    check(
      Number.isInteger(stride) &&
        stride >= width * components &&
        stride <= 252 &&
        stride % width === 0 &&
        Number.isInteger(start) &&
        start >= 0 &&
        Number.isInteger(local) &&
        local >= 0 &&
        Number.isInteger(b.byteLength) &&
        b.byteLength >= 0 &&
        start + b.byteLength <= buffers[b.buffer].byteLength &&
        local + (a.count ? (a.count - 1) * stride + components * width : 0) <=
          b.byteLength,
      "访问器越过缓冲区边界",
    );
    const data = new DataView(buffers[b.buffer]);
    const result: number[] = [];
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < components; c++) {
        const p = start + local + i * stride + c * width;
        const v = position
          ? data.getFloat32(p, true)
          : width === 1
            ? data.getUint8(p)
            : width === 2
              ? data.getUint16(p, true)
              : data.getUint32(p, true);
        check(Number.isFinite(v) && Math.abs(v) <= 1e12, "模型含无效坐标");
        result.push(v);
      }
    return result;
  }
  const scene = doc.scenes[doc.scene ?? 0];
  check(scene && Array.isArray(scene.nodes), "模型缺少场景");
  const groups = new Map<
    number,
    {
      id: string;
      name: string;
      color: string;
      positions: number[];
      polygons: number;
      features: GeometryFeature[];
    }
  >();
  let instances = 0,
    triangles = 0;
  const point = new Vector3();
  const bounds: [number, number, number, number] = [
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
  ];
  const visit = (id: number, parent: Matrix4, stack: Set<number>, instance: string) => {
    check(
      integer(id, doc.nodes.length) &&
        stack.size < LIMITS.depth &&
        !stack.has(id),
      "模型节点索引、循环或深度错误",
    );
    check(++instances <= LIMITS.instances, "模型展开实例超过限制");
    const node = doc.nodes[id],
      matrix = new Matrix4();
    if (node.matrix) {
      check(vector(node.matrix, 16), "模型变换矩阵无效");
      matrix.fromArray(node.matrix);
    } else {
      const t = node.translation ?? [0, 0, 0],
        r = node.rotation ?? [0, 0, 0, 1],
        s = node.scale ?? [1, 1, 1];
      check(
        vector(t, 3) &&
          vector(r, 4) &&
          vector(s, 3) &&
          Math.abs(Math.hypot(...r) - 1) < 0.01,
        "模型变换无效",
      );
      matrix.compose(
        new Vector3(...t),
        new Quaternion(...r),
        new Vector3(...s),
      );
    }
    matrix.premultiply(parent);
    if (node.mesh !== undefined) {
      check(integer(node.mesh, doc.meshes.length), "模型网格索引错误");
      const mesh = doc.meshes[node.mesh];
      check(Array.isArray(mesh.primitives), "网格结构无效");
      for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
        check(
          (primitive.mode ?? 4) === 4 && !primitive.extensions,
          "只支持普通三角形网格",
        );
        const positions = accessor(primitive.attributes.POSITION, true);
        const indices =
          primitive.indices === undefined
            ? Array.from({ length: positions.length / 3 }, (_, i) => i)
            : accessor(primitive.indices, false);
        check(indices.length % 3 === 0, "三角形索引数量错误");
        triangles += indices.length / 3;
        check(triangles <= LIMITS.triangles, "三角形超过 2,000,000 个");
        const key = primitive.material ?? -1;
        check(
          key === -1 || integer(key, doc.materials?.length ?? 0),
          "材质索引无效",
        );
        let group = groups.get(key);
        if (!group) {
          const material = doc.materials?.[key],
            factor = material?.pbrMetallicRoughness?.baseColorFactor ?? [
              0.65, 0.72, 0.8, 1,
            ];
          check(
            vector(factor, 4) && factor.every((v) => v >= 0 && v <= 1),
            "材质颜色无效",
          );
          group = {
            id: `material-${key}`,
            name: (material?.name ?? mesh.name ?? `Material ${key + 1}`).slice(
              0,
              256,
            ),
            color: `#${new Color().setRGB(factor[0], factor[1], factor[2]).getHexString()}`,
            positions: [],
            polygons: 0,
            features: [],
          };
          groups.set(key, group);
        }
        group.polygons += indices.length / 3;
        const firstTriangle = group.positions.length / 9;
        const objectBounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
        for (const index of indices) {
          check(integer(index, positions.length / 3), "三角形索引越界");
          point.fromArray(positions, index * 3).applyMatrix4(matrix);
          check(
            [point.x, point.y, point.z].every(
              (v) => Number.isFinite(v) && Math.abs(v) <= 1e12,
            ),
            "变换后的模型坐标超过限制",
          );
          group.positions.push(point.x, point.y, point.z);
          objectBounds[0] = Math.min(objectBounds[0], point.x);
          objectBounds[1] = Math.min(objectBounds[1], point.z);
          objectBounds[2] = Math.max(objectBounds[2], point.x);
          objectBounds[3] = Math.max(objectBounds[3], point.z);
          bounds[0] = Math.min(bounds[0], point.x);
          bounds[1] = Math.min(bounds[1], point.z);
          bounds[2] = Math.max(bounds[2], point.x);
          bounds[3] = Math.max(bounds[3], point.z);
        }
        group.features.push({ id: `${instance}/primitive-${primitiveIndex}`, kind: "mesh", cell: (node.name ?? `Node ${id}`).slice(0, 256), instance, layer: group.id, firstTriangle, triangles: indices.length / 3, vertices: positions.length / 3, bounds: objectBounds });
      }
    }
    check(!node.children || Array.isArray(node.children), "子节点结构错误");
    for (const child of node.children ?? [])
      visit(child, matrix, new Set(stack).add(id), `${instance}/node-${child}`);
  };
  for (const id of scene.nodes) visit(id, new Matrix4(), new Set(), `node-${id}`);
  check(groups.size && triangles, "模型没有可显示的三角形");
  return {
    name: filename,
    format: "gltf",
    layers: [...groups.values()].map((g) => ({
      ...g,
      positions: new Float32Array(g.positions),
    })),
    cells: doc.nodes.map((n, i) => ({
      name: (n.name ?? `Node ${i}`).slice(0, 256),
      polygons: 0,
      references: n.children?.length ?? 0,
    })),
    tops: [],
    top: "Scene",
    bounds,
    unit: "model units",
    instances,
    triangles,
    warnings: [
      "模型按材质分组；模型单位和工艺高度取决于导出文件",
      ...(doc.animations?.length ? ["当前显示静态场景，未播放动画"] : []),
    ],
  };
}
