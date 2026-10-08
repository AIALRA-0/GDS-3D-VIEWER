import { expect, test, type Page } from "@playwright/test";
import { metadataFixture } from "./metadata-fixture";
import { instanceFixture } from "./instance-fixture";
import { parseGds } from "../../src/public/gds";
import { BUILTIN_PALETTES, DEFAULT_PALETTE_PREFERENCES, importPalettePreferences, exportPalettePreferences, PALETTE_STORAGE } from "../../src/public/palettes";

async function load(page: Page, buffer = metadataFixture()) {
  await page.goto("/"); await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic.gds", buffer, mimeType: "application/octet-stream" });
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
}
async function download(page: Page, label: string) {
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: label, exact: true }).click();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}
async function camera(page: Page) { await page.getByRole("button", { name: "导出", exact: true }).click(); return JSON.parse(await download(page, "导出审阅记录")).camera; }

test("file-wide heights and layer order stay identical in flat, standalone and reused cell geometry", () => {
  const bytes = Uint8Array.from(instanceFixture());
  const full = parseGds(bytes.buffer, "synthetic.gds"), child = parseGds(bytes.buffer, "synthetic.gds", "TILE/with:marker");
  expect(full.gds!.stack).toEqual(child.gds!.stack);
  expect(full.gds!.stack!.layers).toEqual(["7/0", "8/0", "9/0"]);
  const height = (points: Float32Array) => { const ys: number[] = []; for (let i = 1; i < points.length; i += 3) ys.push(points[i]); return [Math.min(...ys), Math.max(...ys)]; };
  expect(height(full.layers.find(l => l.id === "7/0")!.positions)).toEqual(height(child.layers[0].positions));
  const reusedBytes = Uint8Array.from(instanceFixture(25, 41, 200));
  const reused = parseGds(reusedBytes.buffer, "synthetic.gds"), standalone = parseGds(reusedBytes.buffer, "synthetic.gds", "TOP");
  expect(reused.rendering?.kind).toBe("instanced"); expect(reused.gds!.stack).toEqual(standalone.gds!.stack);
  for (const layer of reused.layers) for (const batch of layer.batches!) {
    const local = parseGds(reusedBytes.buffer, "synthetic.gds", batch.cell).layers.find(l => l.id === layer.id)!;
    expect(height(batch.positions)).toEqual(height(local.batches?.find(b => b.cell === batch.cell)?.positions ?? local.positions));
  }
});

test("palette transfer validates limits, merges deterministically and strips unrelated fields", () => {
  const custom = { id: "palette-synthetic", name: "Synthetic", colors: ["#AABBCC", "#000000"] };
  const text = JSON.stringify({ version: 1, custom: [{ ...custom, apiKey: "excluded" }], defaultId: custom.id, apiKey: "excluded" });
  const result = importPalettePreferences(text, DEFAULT_PALETTE_PREFERENCES);
  expect(exportPalettePreferences(result)).not.toContain("excluded");
  expect(importPalettePreferences(exportPalettePreferences(result), result)).toEqual(result);
  expect(result.custom[0].colors[0]).toBe("#aabbcc");
  for (const bad of ["{", " ".repeat(65537), JSON.stringify({ version: 1, custom: [{ ...custom, colors: ["url(https://unsafe.example.invalid)"] }], defaultId: custom.id })]) expect(() => importPalettePreferences(bad, result)).toThrow();
  expect(result.custom).toHaveLength(1); expect(BUILTIN_PALETTES).toHaveLength(10);
});

test("palette import and export work locally and invalid files leave current choices intact", async ({ page }) => {
  const transfers: string[] = []; page.on("request", r => { if (r.method() !== "GET") transfers.push(r.url()); });
  await load(page); await page.getByRole("button", { name: "配色组合", exact: true }).click();
  const prefs = { version: 1, custom: [{ id: "palette-transfer", name: "合成导入配色", colors: ["#ff0000", "#0000ff"] }], defaultId: "palette-transfer" };
  const input = page.getByTestId("palette-file-input"); await input.setInputFiles({ name: "palettes.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(prefs)) });
  await expect(page.getByRole("button", { name: "应用配色 合成导入配色", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(await download(page, "导出配色组合"))).toEqual(prefs);
  await input.setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"version":1,"custom":[]}') });
  await expect(page.getByRole("alert")).toContainText("原有组合未改变");
  expect(JSON.parse(await page.evaluate(key => localStorage.getItem(key)!, PALETTE_STORAGE))).toEqual(prefs);
  await page.getByRole("dialog").getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByLabel("修改图层 7/3 的颜色", { exact: true })).toHaveValue("#ff0000"); expect(transfers).toEqual([]);
});

test("default numbered layers export both JSON and LYP without requiring renamed layers", async ({ page }) => {
  await load(page);
  for (const format of ["JSON", "LYP"]) {
    await page.getByRole("button", { name: "导出", exact: true }).click();
    const text = await download(page, `导出 ${format}`);
    if (format === "JSON") expect(JSON.parse(text)).toEqual({ "7/3": "Layer 7/3" });
    else { expect(text).toContain("<source>7/3@1</source>"); await page.getByTestId("layer-mapping-input").setInputFiles({ name: "layers.lyp", mimeType: "application/xml", buffer: Buffer.from(text) }); }
  }
  await expect(page.locator(".layer-name")).toContainText("Layer 7/3");
});

test("custom dropdowns support keyboard, disabled choices and long cell names without locator overlap", async ({ page }) => {
  const long = "SYNTHETIC_" + "LONG_NAME_".repeat(20), bytes = metadataFixture();
  const original = Buffer.from("SYNTHETIC_CELL"), offset = bytes.indexOf(original), recordStart = offset - 4;
  const name = Buffer.from(long + (long.length % 2 ? "\0" : "")); const record = Buffer.alloc(4); record.writeUInt16BE(name.length + 4); record[2] = 6; record[3] = 6;
  const length = bytes.readUInt16BE(recordStart);
  const cellStart = bytes.indexOf(Buffer.from([0, 28, 5, 2])), cellEnd = bytes.lastIndexOf(Buffer.from([0, 4, 7, 0])) + 4;
  const extra = Array.from({ length: 30 }, (_, index) => {
    const label = Buffer.from(`Z_SYNTHETIC_${String(index).padStart(2, "0")}`), header = Buffer.from(record); header.writeUInt16BE(label.length + 4);
    return Buffer.concat([bytes.subarray(cellStart, recordStart), header, label, bytes.subarray(recordStart + length, cellEnd)]);
  });
  await load(page, Buffer.concat([bytes.subarray(0, recordStart), record, name, bytes.subarray(recordStart + length, cellEnd), ...extra, bytes.subarray(cellEnd)]));
  await page.getByRole("button", { name: "单元", exact: true }).click();
  const root = page.getByRole("combobox", { name: "定位顶层", exact: true }); await root.focus(); await root.press("ArrowDown");
  await expect(page.getByRole("listbox", { name: "定位顶层", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: long, exact: true })).toHaveAttribute("aria-selected", "true");
  await root.press("End"); await expect(page.getByRole("option", { name: "Z_SYNTHETIC_29", exact: true })).toBeVisible();
  expect(await page.getByRole("option").count()).toBeLessThanOrEqual(12);
  await root.press("Escape"); await expect(root).toHaveAttribute("aria-expanded", "false"); await expect(root).toBeFocused();
  const row = page.locator(".hierarchy-row").first();
  expect(await row.evaluate(el => { const title = el.querySelector(".hierarchy-cell > span")!.getBoundingClientRect(), icon = el.querySelector(".icon-button")!.getBoundingClientRect(); return title.right <= icon.left && el.scrollWidth <= el.clientWidth; })).toBe(true);
  await page.getByRole("tab", { name: "AI", exact: true }).click(); const target = page.getByRole("combobox", { name: "讲解对象", exact: true }); await target.click();
  await expect(page.getByRole("option", { name: /^选中图形/ })).toHaveAttribute("aria-disabled", "true");
  await target.press("End"); await target.press("Enter"); await expect(target).toContainText(long);
  const consent = page.getByRole("checkbox", { name: "确认发送所选摘要", exact: true }); await expect(consent).toHaveCSS("border-radius", "50%"); await consent.check(); await expect(consent).toBeChecked(); await consent.uncheck();
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole("button", { name: "显示或收起检查器", exact: true }).click(); await target.click();
  expect(await page.getByRole("listbox").evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("2D rotates in its plane, middle pans, right does not pan and reviews restore rotation", async ({ page }) => {
  await load(page); await page.getByRole("button", { name: "二维", exact: true }).click();
  const canvas = page.locator(".viewer-host canvas"), box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const drag = async (button: "left" | "middle" | "right") => { await page.mouse.move(x, y); await page.mouse.down({ button }); await page.mouse.move(x + 55, y + 20, { steps: 8 }); await page.mouse.up({ button }); };
  const before = await camera(page); await drag("left"); const rotated = await camera(page);
  expect(Math.abs(rotated.rotation)).toBeGreaterThan(.3); expect(rotated.target).toEqual(before.target); await expect(canvas).toHaveAttribute("data-projection", "orthographic");
  await drag("middle"); const panned = await camera(page); expect(panned.target).not.toEqual(rotated.target);
  await drag("right"); expect(await camera(page)).toEqual(panned);
  await page.getByRole("button", { name: "导出", exact: true }).click(); const review = await download(page, "导出审阅记录");
  await page.getByRole("button", { name: "三维", exact: true }).click();
  const spatial = await camera(page); await drag("middle"); const spatialPan = await camera(page); expect(spatialPan.target).not.toEqual(spatial.target);
  await drag("right"); expect(await camera(page)).toEqual(spatialPan);
  await page.getByTestId("review-file-input").setInputFiles({ name: "review.json", mimeType: "application/json", buffer: Buffer.from(review) });
  expect((await camera(page)).rotation).toBeCloseTo(panned.rotation, 8);
  const touchBefore = await camera(page), touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 55, y: y + 20 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const touchAfter = await camera(page); expect(touchAfter.target).not.toEqual(touchBefore.target); expect(touchAfter.rotation).toBeCloseTo(touchBefore.rotation, 8);
  await touch.detach();
  await drag("middle"); expect((await camera(page)).target).not.toEqual(panned.target);
});
