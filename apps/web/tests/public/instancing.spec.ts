import { expect, test } from "@playwright/test";
import { parseGds } from "../../src/public/gds";
import { instanceFeature } from "../../src/public/Viewer";

function record(type: number, dtype: number, data = Buffer.alloc(0)) {
  if (data.length % 2) data = Buffer.concat([data, Buffer.alloc(1)]);
  const header = Buffer.alloc(4); header.writeUInt16BE(data.length + 4); header[2] = type; header[3] = dtype;
  return Buffer.concat([header, data]);
}
function shorts(...values: number[]) { const b = Buffer.alloc(values.length * 2); values.forEach((v, i) => b.writeUInt16BE(v, i * 2)); return b; }
function xy(...values: number[]) { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32BE(v, i * 4)); return record(16, 3, b); }
function real(value: number) { let exponent = 64; while (value >= 1) { value /= 16; exponent++; } while (value < 1 / 16) { value *= 16; exponent--; } const b = Buffer.alloc(8); b[0] = exponent; let mantissa = BigInt(Math.round(value * 2 ** 56)); for (let i = 7; i >= 1; i--) { b[i] = Number(mantissa & 255n); mantissa >>= 8n; } return b; }
function cell(name: string) { return Buffer.concat([record(5, 2, Buffer.alloc(24)), record(6, 6, Buffer.from(name))]); }
export function repeatedFixture(columns = 25, rows = 41, chainDepth = 0) {
  const polygon = Buffer.concat([record(8, 0), record(13, 2, shorts(7)), record(14, 2, shorts(0)), xy(0, 0, 10, 0, 10, 10, 0, 10, 0, 0), record(17, 0)]);
  let target = "TILE"; const chain: Buffer[] = [];
  for (let i = 0; i < chainDepth; i++) { const name = "SYNTHETIC_" + "X".repeat(220) + i; chain.push(cell(name), record(10, 0), record(18, 6, Buffer.from(target)), xy(0, 0), record(17, 0), record(7, 0)); target = name; }
  return Buffer.concat([record(0, 2, shorts(600)), record(1, 2, Buffer.alloc(24)), record(2, 6, Buffer.from("SYNTHETIC")), record(3, 5, Buffer.concat([real(1), real(1e-6)])),
    cell("TILE"), ...Array.from({ length: 200 }, () => polygon), record(7, 0), ...chain, cell("TOP"),
    record(11, 0), record(18, 6, Buffer.from(target)), record(19, 2, shorts(columns, rows)), xy(0, 0, columns * 20, 0, 0, rows * 20), record(17, 0),
    record(10, 0), record(18, 6, Buffer.from(target)), record(26, 1, shorts(0x8000)), record(27, 5, real(2)), record(28, 5, real(90)), xy(0, 0), record(17, 0), record(7, 0), record(4, 0)]);
}
const parse = (bytes: Buffer) => parseGds(Uint8Array.from(bytes).buffer, "synthetic-repeated.gds");

test("whole-layout reuse preserves all instances, mirrored geometry and bounded storage", () => {
  const layout = parse(repeatedFixture());
  expect(layout.incomplete).toBe(false); expect(layout.instances).toBe(1027); expect(layout.triangles).toBe(2462400);
  layout.bounds.forEach((v, i) => expect(v).toBeCloseTo([0, 0, 490, 810][i], 8)); expect(layout.layers[0].polygons).toBe(205200);
  expect(layout.rendering?.storedTriangles).toBe(4800); expect(layout.layers[0].positions.length).toBe(0);
  const mirrored = layout.layers[0].batches!.findIndex(b => b.mirrored);
  const feature = instanceFeature(layout.layers[0], mirrored, 0, 0)!;
  feature.bounds.forEach((v, i) => expect(v).toBeCloseTo([0, 0, 20, 20][i], 8)); expect(feature.area).toBe(400); expect(feature.instance).toContain("ref-2");
  expect(parse(repeatedFixture(100, 100)).layers).toEqual([]);
  expect(() => parseGds(Uint8Array.from(repeatedFixture(100, 100)).buffer, "synthetic.gds", "TOP")).toThrow("12,000,000");
  expect(parse(repeatedFixture(25, 41, 18)).warnings.join(" ")).toContain("实例路径超过显示预算");
});

test("full repeated layout supports 2D picking, selected-instance highlight and layer visibility without uploads", async ({ page }) => {
  const transfers: string[] = []; page.on("request", r => { if (r.method() !== "GET") transfers.push(r.url()); });
  await page.goto("/");
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic-repeated.gds", buffer: repeatedFixture(), mimeType: "application/octet-stream" });
  // Initial software-GPU rendering can outlast the default five-second assertion
  // on CI. Match the existing import budget; keep the whole-test timeout and all
  // full-layout, pixel, picking and no-upload assertions unchanged.
  await expect(page.locator(".global-status")).toContainText("本地解析完成", { timeout: 45_000 });
  await expect(page.locator(".incomplete-banner")).toHaveCount(0);
  await expect(page.locator(".inspector-pane")).toContainText("4,800");
  await page.getByRole("button", { name: "二维", exact: true }).click();
  const canvas = page.locator(".viewer-host canvas"), box = (await canvas.boundingBox())!;
  await page.locator(".layer-color").evaluate((element: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, "#00ff00");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect.poll(() => canvas.evaluate((source: HTMLCanvasElement) => {
    const copy = document.createElement("canvas"); copy.width = source.width; copy.height = source.height;
    const context = copy.getContext("2d")!; context.drawImage(source, 0, 0);
    const [r, g, b] = context.getImageData(source.width / 2, source.height / 2, 1, 1).data;
    return g > r * 2 && g > b * 2;
  })).toBe(true);
  await expect(canvas).toHaveAttribute("data-projection", "orthographic");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const tooltip = page.getByRole("tooltip"); await expect(tooltip).toContainText("TILE");
  const values = await tooltip.locator("dd").allTextContents(); expect(parseFloat(values[2])).toBeCloseTo(245, 2); expect(parseFloat(values[3])).toBeCloseTo(405, 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".inspector-pane")).toContainText("[12,20]");
  await page.getByRole("button", { name: "隐藏全部", exact: true }).click(); await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2); await expect(tooltip).toHaveCount(0);
  await page.getByRole("button", { name: "显示全部", exact: true }).click();
  await page.getByRole("button", { name: "三维", exact: true }).click(); await expect(canvas).toHaveAttribute("data-projection", "perspective");
  expect(transfers).toEqual([]);
});
