import { expect, test } from "@playwright/test";
import { parseGds } from "../../src/public/gds";
import type { ParseProgress } from "../../src/public/types";

function record(type: number, data = Buffer.alloc(0), dataType = 0) {
  if (data.length % 2) data = Buffer.concat([data, Buffer.alloc(1)]);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(data.length + 4);
  header[2] = type;
  header[3] = dataType;
  return Buffer.concat([header, data]);
}
function shorts(...values: number[]) {
  const data = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => data.writeUInt16BE(value, index * 2));
  return data;
}
function xy(...values: number[]) {
  const data = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => data.writeInt32BE(value, index * 4));
  return record(16, data, 3);
}
function real(value: number) {
  let exponent = 64;
  while (value >= 1) { value /= 16; exponent++; }
  while (value < 1 / 16) { value *= 16; exponent--; }
  const data = Buffer.alloc(8);
  data[0] = exponent;
  let mantissa = BigInt(Math.round(value * 2 ** 56));
  for (let index = 7; index >= 1; index--) { data[index] = Number(mantissa & 255n); mantissa >>= 8n; }
  return data;
}
function libraryStart() {
  return [
    record(0, shorts(600), 2),
    record(1, Buffer.alloc(24), 2),
    record(2, Buffer.from("SYNTHETIC"), 6),
    record(3, Buffer.concat([real(1), real(1e-6)]), 5),
  ];
}
function cellStart(name: string) {
  return [record(5, Buffer.alloc(24), 2), record(6, Buffer.from(name), 6)];
}
function boundary(layer = 7) {
  return [
    record(8),
    record(13, shorts(layer), 2),
    record(14, shorts(0), 2),
    xy(0, 0, 10, 0, 10, 10, 0, 10, 0, 0),
    record(17),
  ];
}
function sref(target: string, x = 0, y = 0, angle?: number) {
  return [
    record(10),
    record(18, Buffer.from(target), 6),
    ...(angle === undefined ? [] : [record(28, real(angle), 5)]),
    xy(x, y),
    record(17),
  ];
}
function aref(target: string, columns: number, rows: number, columnPitch = 20, rowPitch = 20, angle?: number) {
  return [
    record(11),
    record(18, Buffer.from(target), 6),
    record(19, shorts(columns, rows), 2),
    ...(angle === undefined ? [] : [record(28, real(angle), 5)]),
    xy(0, 0, columns * columnPitch, 0, 0, rows * rowPitch),
    record(17),
  ];
}
function arrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
function repeatedArrayFixture(columns: number, rows: number, polygonCount = 1) {
  const polygons = Array.from({ length: polygonCount }, () => boundary()).flat();
  return Buffer.concat([
    ...libraryStart(),
    ...cellStart("TILE"), ...polygons, record(7),
    ...cellStart("TOP"), ...aref("TILE", columns, rows), record(7), record(4),
  ]);
}
function manyBatchFixture(cellCount: number) {
  const parts: Buffer[] = [...libraryStart()];
  for (let index = 0; index < cellCount; index++) {
    const name = `P${index}`;
    parts.push(...cellStart(name), ...boundary(), record(7));
  }
  parts.push(...cellStart("TOP"));
  for (let index = 0; index < cellCount; index++) {
    const name = `P${index}`;
    parts.push(...aref(name, 150, 1));
  }
  parts.push(record(7), record(4));
  return Buffer.concat(parts);
}
function deepHierarchyFixture(depth: number) {
  const longName = (index: number) => `D${index}_` + "X".repeat(220);
  const parts: Buffer[] = [
    ...libraryStart(),
    ...cellStart("LEAF"), ...boundary(), record(7),
  ];
  let target = "LEAF";
  for (let index = 0; index < depth; index++) {
    const name = longName(index);
    parts.push(...cellStart(name), ...sref(target), record(7));
    target = name;
  }
  parts.push(record(4));
  return { bytes: Buffer.concat(parts), top: target };
}
function unknownRecords(count: number) {
  const data = Buffer.alloc(count * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.writeUInt16BE(4, offset);
    data[offset + 2] = 60;
  }
  return data;
}

test("GDS expands beyond the former batch and draw-count rejection thresholds", () => {
  const layout = parseGds(arrayBuffer(repeatedArrayFixture(100, 100, 200)), "synthetic.gds");
  expect(layout.incomplete).toBe(false);
  expect(layout.triangles).toBeGreaterThan(12_000_000);
  expect(layout.rendering?.kind).toBe("instanced");
  expect(layout.rendering?.storedTriangles).toBeLessThan(5_000);

  const batches = parseGds(arrayBuffer(manyBatchFixture(2_049)), "synthetic.gds");
  expect(batches.incomplete).toBe(false);
  expect(batches.layers.flatMap((layer) => layer.batches ?? [])).toHaveLength(2_049);
});

test("GDS walks deep long hierarchy paths without recursion or display-length rejection", () => {
  const fixture = deepHierarchyFixture(100);
  const layout = parseGds(arrayBuffer(fixture.bytes), "synthetic.gds");
  expect(layout.top).toBe(fixture.top);
  expect(layout.incomplete).toBe(false);
  expect(layout.occurrences).toHaveLength(101);
  expect(layout.occurrences![layout.occurrences!.length - 1].path.length).toBeGreaterThan(20_000);
});

test("GDS reports real record byte progress and accepts over one million records and over 32 MB", () => {
  const base = Buffer.concat([
    ...libraryStart(), ...cellStart("TOP"), ...boundary(), record(7),
  ]);
  const recordCount = 1_000_001;
  const recordBytes = unknownRecords(recordCount);
  const bytes = Buffer.concat([base, recordBytes, record(4)]);
  const reports: ParseProgress[] = [];
  const layout = parseGds(arrayBuffer(bytes), "synthetic.gds", undefined, (item) => reports.push(item));
  expect(layout.gds?.records.find((item) => item.type === 60)?.count).toBe(recordCount);
  expect(reports.map((item) => item.stage).filter((stage, index, all) => index === 0 || stage !== all[index - 1])).toEqual(["records", "hierarchy", "geometry"]);
  const recordReports = reports.filter((item) => item.stage === "records");
  expect(recordReports[0]).toEqual({ stage: "records", completed: 0, total: bytes.byteLength });
  expect(recordReports[recordReports.length - 1]).toEqual({ stage: "records", completed: bytes.byteLength, total: bytes.byteLength });
  expect(recordReports.map((item) => item.completed)).toEqual([...recordReports.map((item) => item.completed)].sort((a, b) => a - b));
  expect(reports.filter((item) => item.stage !== "records").every((item) => item.total === undefined)).toBe(true);
  expect(recordReports.length).toBeLessThan(20_000);

  const maxPayload = Buffer.alloc(65_530);
  const largeRecord = record(60, maxPayload);
  const largeBytes = Buffer.concat([base, ...Array.from({ length: 513 }, () => largeRecord), record(4)]);
  expect(largeBytes.byteLength).toBeGreaterThan(32 * 1024 * 1024);
  const largeLayout = parseGds(arrayBuffer(largeBytes), "synthetic.gds");
  expect(largeLayout.incomplete).toBe(false);
  expect(largeLayout.gds?.records.find((item) => item.type === 60)?.count).toBe(513);
});

test("GDS expands AREF placement counts above the former instance budget", () => {
  const layout = parseGds(arrayBuffer(repeatedArrayFixture(200, 1_000)), "synthetic.gds");
  expect(layout.instances).toBe(200_001);
  expect(layout.incomplete).toBe(false);
  expect(layout.rendering?.placements).toBe(200_001);
  expect(layout.layers[0].batches?.[0].paths).toHaveLength(200_000);
});

test("instanced bounds match a full point scan under rotation", () => {
  const bytes = Buffer.concat([
    ...libraryStart(),
    ...cellStart("SHAPE"), ...boundary(), record(7),
    ...cellStart("TOP"), ...aref("SHAPE", 65_535, 3, 20, 20, 37), record(7), record(4),
  ]);
  const layout = parseGds(arrayBuffer(bytes), "synthetic.gds");
  const scanned: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const layer of layout.layers) for (const batch of layer.batches ?? []) {
    for (let placement = 0; placement < batch.paths.length; placement++) {
      const m = batch.transforms.subarray(placement * 6, placement * 6 + 6);
      for (let offset = 0; offset < batch.positions.length; offset += 3) {
        const x = m[0] * batch.positions[offset] - m[2] * batch.positions[offset + 2] + m[4];
        const y = m[1] * batch.positions[offset] - m[3] * batch.positions[offset + 2] + m[5];
        scanned[0] = Math.min(scanned[0], x); scanned[1] = Math.min(scanned[1], y);
        scanned[2] = Math.max(scanned[2], x); scanned[3] = Math.max(scanned[3], y);
      }
    }
  }
  layout.bounds.forEach((value, index) => expect(value).toBeCloseTo(scanned[index], 10));
});
