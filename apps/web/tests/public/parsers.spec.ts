import { expect, test } from "@playwright/test";
import { parseGds } from "../../src/public/gds";
import { parseGltf } from "../../src/public/gltf";
function rec(type: number, dtype: number, data = Buffer.alloc(0)) {
  if (data.length % 2) data = Buffer.concat([data, Buffer.alloc(1)]);
  const head = Buffer.alloc(4);
  head.writeUInt16BE(data.length + 4);
  head[2] = type;
  head[3] = dtype;
  return Buffer.concat([head, data]);
}
function short(...values: number[]) {
  const b = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => b.writeUInt16BE(v, i * 2));
  return b;
}
function points(...values: number[]) {
  const b = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => b.writeInt32BE(v, i * 4));
  return rec(16, 3, b);
}
function real(value: number) {
  let exponent = 64;
  while (value >= 1) {
    value /= 16;
    exponent++;
  }
  while (value < 1 / 16) {
    value *= 16;
    exponent--;
  }
  const b = Buffer.alloc(8);
  b[0] = exponent;
  let v = BigInt(Math.round(value * 2 ** 56));
  for (let i = 7; i >= 1; i--) {
    b[i] = Number(v & 255n);
    v >>= 8n;
  }
  return b;
}
function cell(name: string) {
  return Buffer.concat([
    rec(5, 2, Buffer.alloc(24)),
    rec(6, 6, Buffer.from(name)),
  ]);
}
function file(elements: Buffer[]) {
  const b = Buffer.concat([
    rec(0, 2, short(600)),
    rec(1, 2, Buffer.alloc(24)),
    rec(2, 6, Buffer.from("TEST")),
    rec(3, 5, Buffer.concat([real(1), real(1e-6)])),
    ...elements,
    rec(4, 0),
  ]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
const polygon = Buffer.concat([
  rec(8, 0),
  rec(13, 2, short(1)),
  rec(14, 2, short(0)),
  points(0, 0, 10, 0, 10, 5, 0, 5, 0, 0),
  rec(17, 0),
]);

test("GDS null-word block padding is accepted but nonzero trailers and concatenated streams are refused", () => {
  const source = Buffer.from(file([cell("PADDED"), polygon, rec(7, 0)]));
  const padded = Buffer.concat([source, Buffer.alloc(2048 - source.length % 2048)]);
  const parse = (bytes: Buffer) => parseGds(Uint8Array.from(bytes).buffer, "synthetic.gds");
  expect(parse(padded)).toEqual(parse(source));
  const malicious = Buffer.from(padded); malicious[malicious.length - 1] = 1;
  expect(() => parse(malicious)).toThrow("额外数据");
  expect(() => parse(Buffer.concat([source, source]))).toThrow("额外数据");
  expect(() => parse(Buffer.concat([source, Buffer.alloc(1)]))).toThrow("额外数据");
  expect(() => parse(source.subarray(0, source.length - 2))).toThrow();
});
test("GDS units, rotated reflected references and array pitches have known bounds", () => {
  const child = [cell("CHILD"), polygon, rec(7, 0)];
  const rotated = [
    rec(10, 0),
    rec(18, 6, Buffer.from("CHILD")),
    rec(26, 1, short(0x8000)),
    rec(28, 5, real(90)),
    points(100, 200),
    rec(17, 0),
  ];
  const array = [
    rec(11, 0),
    rec(18, 6, Buffer.from("CHILD")),
    rec(19, 2, short(2, 3)),
    points(0, 0, 20, 0, 0, 30),
    rec(17, 0),
  ];
  const data = file([
    ...child,
    cell("ROTATED"),
    ...rotated,
    rec(7, 0),
    cell("ARRAY"),
    ...array,
    rec(7, 0),
  ]);
  const r = parseGds(data, "test.gds", "ROTATED");
  r.bounds.forEach((n, i) => expect(n).toBeCloseTo([100, 200, 105, 210][i]));
  expect(r.instances).toBe(2);
  expect(r.gds!.references[0]).toMatchObject({ cell: "ROTATED", target: "CHILD", kind: "SREF", angle: 90, reflect: true, xy: [[100, 200]] });
  expect(r.tops).toEqual(["ROTATED", "ARRAY"]);
  const a = parseGds(data, "test.gds", "ARRAY");
  a.bounds.forEach((n, i) => expect(n).toBeCloseTo([0, 0, 20, 25][i]));
  expect(a.instances).toBe(7);
  expect(a.gds!.references[1]).toMatchObject({ kind: "AREF", columns: 2, rows: 3, xy: [[0, 0], [20, 0], [0, 30]] });
  expect(a.layers[0].polygons).toBe(6);
  expect(a.layers[0].features).toHaveLength(6);
  expect(a.layers[0].features![0].cell).toBe("CHILD");
  expect(a.layers[0].features![0].area).toBeCloseTo(50);
  expect(a.layers[0].features![1].firstTriangle).toBe(a.layers[0].features![0].triangles);
  expect(new Set(a.layers[0].features!.map((f) => f.instance)).size).toBe(6);
  expect(r.layers[0].features![0].bounds).toEqual([100, 200, 105, 210]);
});
test("missing cells retain real geometry and report incomplete preview", () => {
  const missing = [rec(10, 0), rec(18, 6, Buffer.from("MISSING_GATE")), points(20, 30), rec(17, 0)];
  const data = file([cell("DEMO"), polygon, ...missing, rec(7, 0)]);
  const parsed = parseGds(data, "synthetic.gds2");
  expect(parsed.incomplete).toBe(true);
  expect(parsed.missingReferences).toEqual([{ source: "DEMO", target: "MISSING_GATE", count: 1 }]);
  expect(parsed.layers[0].polygons).toBe(1);
  expect(parsed.warnings.join(" ")).toContain("不完整预览");
  const metadata = parseGds(file([cell("EMPTY"), ...missing, rec(7, 0)]), "empty.gds2");
  expect(metadata.layers).toEqual([]);
  expect(metadata.cells[0].name).toBe("EMPTY");
  expect(metadata.incomplete).toBe(true);
});
test("cyclic GDS references are refused and large valid arrays remain complete", () => {
  const data = file([
    cell("CYCLE"),
    rec(10, 0),
    rec(18, 6, Buffer.from("CYCLE")),
    points(0, 0),
    rec(17, 0),
    rec(7, 0),
  ]);
  expect(() => parseGds(data, "cycle.gds")).toThrow(/循环/);
  const array = file([
    cell("CHILD"),
    polygon,
    rec(7, 0),
    cell("BIG"),
    rec(11, 0),
    rec(18, 6, Buffer.from("CHILD")),
    rec(19, 2, short(500, 500)),
    points(0, 0, 1000, 0, 0, 1000),
    rec(17, 0),
    rec(7, 0),
  ]);
  const large = parseGds(array, "big.gds");
  expect(large.instances).toBe(250_001);
  expect(large.triangles).toBe(3_000_000);
  expect(large.layers[0].polygons).toBe(250_000);
  expect(large.incomplete).toBe(false);
  const empty = file([
    cell("CHILD"), polygon, rec(7, 0), cell("EMPTY"),
    rec(11, 0), rec(18, 6, Buffer.from("CHILD")), rec(19, 2, short(0, 3)),
    points(0, 0, 0, 0, 0, 30), rec(17, 0), rec(7, 0),
  ]);
  expect(() => parseGds(empty, "empty.gds")).toThrow(/阵列/);
});
test("GLB geometry decodes without URL loading; node cycles and accessor overflow are refused", () => {
  const vertex = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) => vertex.writeFloatLE(n, i * 4));
  const doc = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0, children: [] as number[] }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  function binary() {
    const j = Buffer.from(JSON.stringify(doc)),
      padding = Buffer.alloc((4 - (j.length % 4)) % 4, 32),
      json = Buffer.concat([j, padding]),
      header = Buffer.alloc(20),
      bh = Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + json.length + 8 + vertex.length, 8);
    header.writeUInt32LE(json.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    bh.writeUInt32LE(vertex.length);
    bh.writeUInt32LE(0x004e4942, 4);
    const b = Buffer.concat([header, json, bh, vertex]);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }
  expect(parseGltf(binary(), "model.glb").triangles).toBe(1);
  doc.nodes[0].children = [0];
  expect(() => parseGltf(binary(), "cycle.glb")).toThrow(/循环/);
  doc.nodes[0].children = [];
  doc.accessors[0].count = 9;
  expect(() => parseGltf(binary(), "overflow.glb")).toThrow(/边界/);
});
