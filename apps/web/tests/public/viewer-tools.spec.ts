import { expect, test, type Page } from "@playwright/test";
import { metadataFixture } from "./metadata-fixture";
import { exportLayerNames, validateLayerNames } from "../../src/public/layerNames";
import { readFileSync } from "node:fs";

async function download(page: Page, label: string) {
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: label, exact: true }).click();
  const file = await pending, stream = await file.createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return { name: file.suggestedFilename(), buffer: Buffer.concat(chunks) };
}
async function load(page: Page) {
  await page.goto("/");
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic.gds", mimeType: "application/octet-stream", buffer: metadataFixture() });
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
}

test("mapping canonicalization rejects ambiguous aliases and exports deterministic names", () => {
  expect(validateLayerNames({ "00007/03": " metal1 " })).toEqual({ "7/3": "metal1" });
  expect(() => validateLayerNames({ "7/3": "metal1", "007/03": "metal2" })).toThrow("冲突");
  expect(() => validateLayerNames({ "65536/0": "metal" })).toThrow();
  const map = { "10/0": "M<&\"'", "7/3": "中文 metal1" };
  expect(JSON.parse(exportLayerNames(map, "json"))).toEqual(map);
  expect(exportLayerNames(map, "lyp")).toContain("M&lt;&amp;&quot;&apos;");
  const large = Object.fromEntries(Array.from({ length: 6000 }, (_, index) => [`${index}/0`, "&".repeat(50)]));
  expect(exportLayerNames(large, "json").length).toBeLessThan(1024 * 1024);
  expect(() => exportLayerNames(large, "lyp")).toThrow("超过 1 MB");
});

const mappingCases: { name: string; buffer: Buffer; names: Record<string, string> }[] = [
    { name: "leading-zero.json", buffer: Buffer.from(JSON.stringify({ "00007/03": "metal1" })), names: { "7/3": "metal1" } },
    { name: "grouped.lyp", buffer: Buffer.from('<layer-properties><properties><name>Routing</name><source>*/*</source><group-members><name>M&lt;&amp;&quot;&apos;</name><source>7/3@1</source></group-members><group-members><name>Other layout</name><source>7/3@2</source></group-members><group-members><name>via1</name><source>9/0</source></group-members></properties></layer-properties>'), names: { "7/3": "M<&\"'", "9/0": "via1" } },
    { name: "unicode.json", buffer: Buffer.from(JSON.stringify({ "7/3": "金属一", "11/1": "label layer" })), names: { "7/3": "金属一", "11/1": "label layer" } },
    { name: "synthetic.json", buffer: readFileSync(new URL("../../../../fixtures/layer-maps/synthetic.json", import.meta.url)), names: { "64/0": "Demo base", "65/0": "Demo active", "66/0": "Demo gate", "67/0": "Demo contacts", "68/0": "Demo local routing", "69/0": "Demo vertical routing", "70/0": "Demo horizontal routing", "71/0": "Demo vias" } },
    { name: "synthetic-grouped.lyp", buffer: readFileSync(new URL("../../../../fixtures/layer-maps/synthetic-grouped.lyp", import.meta.url)), names: { "65/0": "Demo active", "66/0": "Demo gate", "67/0": "Demo contacts", "68/0": "Demo local routing", "69/0": "Demo vertical routing", "70/0": "Demo horizontal routing", "71/0": "Demo vias" } },
];
// Each fixture gets an independent browser context instead of a burst of 15 downloads.
for (const fixture of mappingCases) test(`layer mapping ${fixture.name} round trips without upload`, async ({ page }) => {
    const transfers: string[] = []; page.on("request", (request) => { if (request.method() !== "GET") transfers.push(request.url()); });
    await load(page);
    const input = page.getByTestId("layer-mapping-input");
    await input.setInputFiles({ ...fixture, mimeType: "application/octet-stream" });
    await expect(page.locator(".layer-name")).toContainText(fixture.names["7/3"] ?? "Layer 7/3");
    const json = await download(page, "导出 JSON"); expect(JSON.parse(json.buffer.toString())).toEqual(fixture.names);
    const lyp = await download(page, "导出 LYP");
    await input.setInputFiles({ ...lyp, mimeType: "application/xml" });
    expect(JSON.parse((await download(page, "导出 JSON")).buffer.toString())).toEqual(fixture.names);
    expect(transfers).toEqual([]);
});

test("invalid mappings preserve current names and never load external XML resources", async ({ page }) => {
  const transfers: string[] = []; page.on("request", (request) => { if (request.method() !== "GET" || request.url().includes("unsafe.example.invalid")) transfers.push(request.url()); });
  await load(page);
  const input = page.getByTestId("layer-mapping-input");
  await input.setInputFiles({ name: "current.json", mimeType: "application/json", buffer: Buffer.from('{"7/3":"金属一"}') });
  await expect(page.locator(".layer-name")).toContainText("金属一");
  for (const text of [
    '<layer-properties><properties><name>A</name><source>7/3</source></properties><properties><name>B</name><source>7/3@1</source></properties></layer-properties>',
    '<layer-properties><properties><name>range</name><source>1-7/*</source></properties></layer-properties>',
    '<!DOCTYPE layer-properties [<!ENTITY e SYSTEM "https://unsafe.example.invalid/">]><layer-properties/>',
    '<layer-properties><properties>',
  ]) {
    await input.setInputFiles({ name: "invalid.lyp", mimeType: "application/xml", buffer: Buffer.from(text) });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator(".layer-name")).toContainText("金属一");
  }
  expect(transfers).toEqual([]);
});

test("orthographic 2D keeps exact XY, ruler scales with zoom and review restores projection", async ({ page }) => {
  await load(page);
  await page.getByRole("button", { name: "二维", exact: true }).click();
  const canvas = page.locator(".viewer-host canvas"); await expect(canvas).toHaveAttribute("data-projection", "orthographic");
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await expect(page.getByRole("tooltip")).toBeVisible();
  expect(await page.getByRole("tooltip").locator("dt").allTextContents()).toEqual(["单元", "图层", "X", "Y"]);
  const values = await page.getByRole("tooltip").locator("dd").allTextContents();
  expect(parseFloat(values[2])).toBeCloseTo(5, 2); expect(parseFloat(values[3])).toBeCloseTo(5, 2);
  await page.getByRole("button", { name: "测量", exact: true }).click();
  await page.mouse.click(x - 30, y); await page.mouse.click(x + 30, y);
  const rulerPixels = await canvas.evaluate((element) => {
    const source = element as HTMLCanvasElement, probe = document.createElement("canvas");
    probe.width = source.width; probe.height = source.height;
    const context = probe.getContext("2d")!; context.drawImage(source, 0, 0);
    const pixels = context.getImageData(Math.floor(source.width / 2 - 20), Math.floor(source.height / 2 - 3), 40, 6).data;
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 180 && pixels[i + 1] > 60 && pixels[i + 1] < 180 && pixels[i + 2] < 100) count++;
    return count;
  });
  expect(rulerPixels).toBeGreaterThan(20);
  const readDistance = async () => Number((await page.locator(".ruler-result").innerText()).match(/距离 ([\d.]+)/)![1]);
  const before = await readDistance(); expect(before).toBeGreaterThan(0);
  await page.mouse.move(x, y); await page.mouse.wheel(0, -300); await page.waitForTimeout(150);
  await page.mouse.click(x - 30, y); await page.mouse.click(x + 30, y);
  expect(await readDistance()).toBeLessThan(before);
  await page.getByRole("button", { name: "测量", exact: true }).click();
  const review = await download(page, "导出审阅记录"); const state = JSON.parse(review.buffer.toString());
  expect(state.camera.projection).toBe("2d"); expect(state.camera.zoom).toBeGreaterThan(1);
  await page.getByRole("button", { name: "三维", exact: true }).click(); await expect(canvas).toHaveAttribute("data-projection", "perspective");
  await page.getByTestId("review-file-input").setInputFiles({ ...review, mimeType: "application/json" });
  await expect(canvas).toHaveAttribute("data-projection", "orthographic");
  expect(JSON.parse((await download(page, "导出审阅记录")).buffer.toString()).camera.zoom).toBeCloseTo(state.camera.zoom, 5);
  state.camera.zoom = -1;
  await page.getByTestId("review-file-input").setInputFiles({ name: review.name, buffer: Buffer.from(JSON.stringify(state)), mimeType: "application/json" });
  await expect(page.getByRole("alert")).toContainText("无效");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("hierarchy uses stored cell names, groups repeated references and shows missing definitions", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic-hierarchy.gds", buffer: metadataFixture(false, ["MISSING", "MISSING"]), mimeType: "application/octet-stream" });
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
  await page.getByRole("button", { name: "单元", exact: true }).click();
  await expect(page.locator(".hierarchy-cell", { hasText: "MISSING" })).toHaveCount(1);
  await expect(page.locator(".hierarchy-cell", { hasText: "MISSING" })).toBeDisabled();
  await expect(page.locator(".hierarchy-list")).toContainText("缺失单元定义");
  await page.locator(".hierarchy-toggle[aria-expanded]").click(); await expect(page.locator(".hierarchy-cell")).toHaveCount(1);
  await page.getByLabel("筛选单元", { exact: true }).fill("SYNTHETIC"); await expect(page.locator(".cell-row")).toHaveCount(1);
  await page.getByLabel("筛选单元", { exact: true }).fill("");
  await page.getByRole("button", { name: "全部单元", exact: true }).click(); await expect(page.locator(".cell-list")).toContainText("SYNTHETIC_CELL");
});
