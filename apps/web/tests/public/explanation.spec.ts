import { expect, test } from "@playwright/test";
import { validateEndpoint, explanationContext, SYSTEM_PROMPT } from "../../src/public/explanation";
import type { Layout } from "../../src/public/types";
test("fixed explanation context excludes file bytes and preserves unknown facts", () => {
  const layout: Layout = { name: "private-file.gds2", format: "gds", layers: [{ id: "1/0", name: "Layer", color: "#fff", positions: new Float32Array([1, 2, 3]), polygons: 1 }], cells: [{ name: "CELL", polygons: 1, references: 2 }], tops: ["CELL"], top: "CELL", bounds: [0, 0, 1, 1], unit: "µm", instances: 1, triangles: 1, warnings: [] };
  const context = explanationContext(layout);
  expect(context.cell.name).toBe("CELL");
  expect(context.unknown).toContain("电气连通性与网络名称未提供");
  expect(JSON.stringify(context)).not.toContain("positions");
  expect(JSON.stringify(context)).not.toContain("private-file");
  expect(SYSTEM_PROMPT).toContain("不可信数据");
});
test("model endpoints reject credential URLs and the website origin", () => {
  expect(validateEndpoint("https://models.example.invalid/v1/chat/completions")).toContain("/v1/chat/completions");
  expect(validateEndpoint("http://localhost:11434/v1/chat/completions")).toContain("localhost");
  for (const value of ["http://models.example.invalid/chat/completions", "https://key:secret@models.example.invalid/chat/completions", "https://models.example.invalid/chat/completions?key=secret", "https://gds3d.aialra.online/chat/completions", "file:///chat/completions"])
    expect(() => validateEndpoint(value, "https://gds3d.aialra.online")).toThrow();
});
