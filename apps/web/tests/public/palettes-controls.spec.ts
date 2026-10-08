import { expect, test, type Page, type Locator } from "@playwright/test";
import { metadataFixture } from "./metadata-fixture";
import { packedLayerOffsets } from "../../src/public/Viewer";
import { PALETTE_STORAGE, validatePalettePreferences } from "../../src/public/palettes";

async function load(page: Page) {
  await page.goto("/");
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic.gds", mimeType: "application/octet-stream", buffer: metadataFixture() });
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
}
async function color(input: Locator, value: string) {
  await input.evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await expect(input).toHaveValue(value);
}
async function pixels(page: Page) {
  return page.locator(".viewer-host canvas").evaluate((source: HTMLCanvasElement) => {
    const copy = document.createElement("canvas"); copy.width = source.width; copy.height = source.height;
    const context = copy.getContext("2d")!; context.drawImage(source, 0, 0);
    const data = context.getImageData(source.width / 2, source.height / 2, 1, 1).data;
    return [...data];
  });
}

test("zero spacing touches adjacent surfaces without removing thickness; unsafe palette preferences are rejected", () => {
  const bounds: [number, number][] = [[0, .3], [1, 1.3], [2, 2.3]];
  for (const gap of [0, .25]) {
    const offsets = packedLayerOffsets(bounds, gap);
    expect(bounds[0][0] + offsets[0] + bounds[2][1] + offsets[2]).toBeCloseTo(2.3, 10);
    for (let i = 1; i < bounds.length; i++) expect(bounds[i][0] + offsets[i] - bounds[i - 1][1] - offsets[i - 1]).toBeCloseTo(gap, 10);
    expect(bounds[0][1] + offsets[0] - bounds[0][0] - offsets[0]).toBeCloseTo(.3, 10);
  }
  const palette = { id: "palette-synthetic", name: " Synthetic ", colors: ["#ABCDEF"] };
  expect(validatePalettePreferences({ version: 1, custom: [palette], defaultId: palette.id, key: "excluded" })).toEqual({ version: 1, custom: [{ ...palette, name: "Synthetic", colors: ["#abcdef"] }], defaultId: palette.id });
  for (const custom of [[{ ...palette, colors: ["url(https://unsafe.example.invalid)"] }], [palette, palette], Array(33).fill(palette)]) expect(() => validatePalettePreferences({ version: 1, custom, defaultId: "original" })).toThrow();
});

test("palette CRUD, search and default survive refresh without retaining layout or AI credentials", async ({ page }) => {
  await load(page);
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  await page.getByText("配置本次会话", { exact: true }).click();
  const key = page.getByLabel("本次会话密钥", { exact: true }); await key.fill("synthetic-palette-key");
  await page.getByRole("button", { name: "配色组合", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "配色组合", exact: true });
  await expect(dialog.locator(".palette-row")).toHaveCount(5);
  await dialog.getByRole("button", { name: "复制配色 清晰对比", exact: true }).click();
  await dialog.getByLabel("组合名称", { exact: true }).fill("我的组合");
  await color(dialog.getByLabel("组合颜色 1", { exact: true }), "#abcdef");
  await dialog.getByRole("button", { name: "保存并应用配色", exact: true }).click();
  await dialog.getByRole("button", { name: "设为默认配色 我的组合", exact: true }).click();
  await dialog.getByLabel("筛选配色组合", { exact: true }).fill("我的"); await expect(dialog.locator(".palette-row")).toHaveCount(1);
  await dialog.getByRole("button", { name: "编辑配色 我的组合", exact: true }).click();
  await dialog.getByLabel("组合名称", { exact: true }).fill("我的新组合");
  await dialog.getByRole("button", { name: "删除颜色 8", exact: true }).click();
  await dialog.getByRole("button", { name: "添加颜色", exact: true }).click();
  await dialog.getByRole("button", { name: "保存并应用配色", exact: true }).click();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(key).toHaveValue("synthetic-palette-key");
  const raw = await page.evaluate(storage => localStorage.getItem(storage)!, PALETTE_STORAGE);
  expect(raw).not.toContain("synthetic.gds"); expect(raw).not.toContain("synthetic-palette-key"); expect(raw).not.toContain("SYNTHETIC_CELL");
  expect(JSON.parse(raw).custom[0].colors[0]).toBe("#abcdef");
  await load(page); await expect(page.getByLabel("修改图层 7/3 的颜色", { exact: true })).toHaveValue("#abcdef");
  await page.getByRole("tab", { name: "AI", exact: true }).click(); await page.getByText("配置本次会话", { exact: true }).click(); await expect(key).toHaveValue("");
  await page.getByRole("button", { name: "配色组合", exact: true }).click();
  await dialog.getByRole("button", { name: "删除配色 我的新组合", exact: true }).click();
  expect(JSON.parse(await page.evaluate(storage => localStorage.getItem(storage)!, PALETTE_STORAGE)).defaultId).toBe("original");
  await expect(dialog.locator(".palette-row")).toHaveCount(5);
});

test("layer color changes actual pixels and review round trips while preserving the camera and canvas", async ({ page }) => {
  const transfers: string[] = []; page.on("request", r => { if (r.method() !== "GET") transfers.push(r.url()); });
  await load(page); await page.getByRole("button", { name: "二维", exact: true }).click();
  const canvas = await page.locator(".viewer-host canvas").elementHandle();
  const swatch = page.getByLabel("修改图层 7/3 的颜色", { exact: true });
  await color(swatch, "#ff0000"); await expect.poll(async () => { const red = await pixels(page); return red[0] > red[1] * 2; }).toBe(true);
  await color(swatch, "#0000ff"); await expect.poll(async () => { const blue = await pixels(page); return blue[2] > blue[0] * 2; }).toBe(true);
  expect(await canvas!.evaluate(el => el === document.querySelector(".viewer-host canvas"))).toBe(true);
  await expect(page.locator(".viewer-host canvas")).toHaveAttribute("data-projection", "orthographic");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "导出审阅记录", exact: true }).click();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  const review = JSON.parse(Buffer.concat(chunks).toString()); expect(review.layerColors).toEqual({ "7/3": "#0000ff" });
  await color(swatch, "#00ff00");
  await page.getByTestId("review-file-input").setInputFiles({ name: "review.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(review)) });
  await expect(swatch).toHaveValue("#0000ff");
  review.layerColors = { "7/3": "invalid" };
  await page.getByTestId("review-file-input").setInputFiles({ name: "bad-review.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(review)) });
  await expect(page.getByRole("alert")).toContainText("颜色无效"); await expect(swatch).toHaveValue("#0000ff");
  expect(transfers).toEqual([]);
});

test("icon help works with hover and keyboard; export dialog returns focus and fits mobile", async ({ page }) => {
  await load(page);
  const button = page.getByRole("button", { name: "导出", exact: true });
  await button.hover(); const tip = page.getByRole("tooltip", { name: "导出", exact: true }); await expect(tip).toBeVisible();
  await tip.hover(); await expect(tip).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.locator(".button-tooltip")).toHaveCount(0);
  await button.focus(); await expect(page.locator(".button-tooltip")).toContainText("导出");
  await button.click(); const dialog = page.getByRole("dialog", { name: "导出", exact: true });
  await expect(dialog.locator(".export-option")).toHaveCount(4);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(button).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 }); await button.click();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("zero slider removes real rendered gaps between three GDS layers", async ({ page }) => {
  const source = metadataFixture(), start = source.indexOf(Buffer.from([0, 4, 8, 0])), end = source.indexOf(Buffer.from([0, 4, 17, 0]), start) + 4;
  const polygon = source.subarray(start, end), layerRecord = polygon.indexOf(Buffer.from([0, 6, 13, 2]));
  const extra = [8, 9].map(id => { const copy = Buffer.from(polygon); copy.writeUInt16BE(id, layerRecord + 4); return copy; });
  const endCell = source.lastIndexOf(Buffer.from([0, 4, 7, 0]));
  await page.goto("/");
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic-stack.gds", mimeType: "application/octet-stream", buffer: Buffer.concat([source.subarray(0, endCell), ...extra, source.subarray(endCell)]) });
  await expect(page.locator(".layer-color")).toHaveCount(3);
  for (const [i, value] of ["#ff0000", "#00ff00", "#0000ff"].entries()) await color(page.locator(".layer-color").nth(i), value);
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "导出审阅记录", exact: true }).click();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  const review = JSON.parse(Buffer.concat(chunks).toString()); review.camera = { position: [0, 0, 15], target: [0, 0, 0], projection: "3d", zoom: 1 };
  await page.getByTestId("review-file-input").setInputFiles({ name: "front-review.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(review)) });
  await page.getByRole("tab", { name: "显示", exact: true }).click();
  const gaps = () => page.locator(".viewer-host canvas").evaluate((source: HTMLCanvasElement) => {
    const copy = document.createElement("canvas"); copy.width = source.width; copy.height = source.height;
    const context = copy.getContext("2d")!; context.drawImage(source, 0, 0);
    const data = context.getImageData(source.width / 2, 0, 1, source.height).data;
    const rows: number[] = []; for (let y = 0; y < source.height; y++) {
      const rgb = [...data.subarray(y * 4, y * 4 + 3)]; if (Math.max(...rgb) - Math.min(...rgb) > 40) rows.push(y);
    }
    return rows.slice(1).reduce((count, y, i) => count + (y - rows[i] > 2 ? 1 : 0), 0);
  });
  await page.getByLabel("层间距").fill("10"); await expect.poll(gaps).toBe(2);
  await page.getByLabel("层间距").fill("0"); await expect.poll(gaps).toBe(0);
});
