import { expect, test } from "@playwright/test";
import { parseGds } from "../../src/public/gds";
import { metadataFixture } from "./metadata-fixture";

test("source records preserve units, text types and properties without fabricating process names", () => {
  const bytes = metadataFixture(); const layout = parseGds(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "synthetic.gds2");
  expect(layout.layers[0].name).toBe("Layer 7/3");
  expect(layout.layers[0].features![0].properties).toEqual([{ attribute: 9, value: "synthetic property" }]);
  expect(layout.gds!.databaseUnitMeters).toBeCloseTo(1e-9, 15);
  expect(layout.gds!.userUnitMeters).toBeCloseTo(1e-6, 12);
  expect(layout.gds!.labels[0]).toMatchObject({ cell: "SYNTHETIC_CELL", layer: "7/4", angle: 90, presentation: 5, xy: [1, 2] });
  expect(layout.gds!.labels[0].text).toContain("PIN_A");
  expect(layout.gds!.records.find((record) => record.type === 0x2A)).toEqual({ type: 0x2A, count: 1, handled: false });
});

test("toolbar order, named layers, safe source data and review restoration preserve the scene", async ({ page }) => {
  const transfers: string[] = []; page.on("request", (request) => { if (request.method() !== "GET") transfers.push(request.url()); });
  await page.goto("/");
  expect(await page.locator(".top-actions > *").evaluateAll((controls) => controls.map((control) => control.getAttribute("aria-label")))).toEqual(["打开文件", "加载示例", "切换为英文", "导出审阅记录", "切换浅色主题", "使用说明与隐私", "查看源码"]);
  const sizes = await page.locator(".top-actions > *").evaluateAll((controls) => controls.map((control) => ({ height: control.getBoundingClientRect().height, background: getComputedStyle(control).backgroundColor })));
  expect(new Set(sizes.map((size) => size.height)).size).toBe(1); expect(new Set(sizes.map((size) => size.background)).size).toBe(1);
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic.gds2", mimeType: "application/octet-stream", buffer: metadataFixture() });
  const canvas = await page.locator(".viewer-host canvas").elementHandle();
  await page.getByRole("button", { name: "Layer 7/3", exact: false }).first().click();
  await page.getByLabel("图层名称", { exact: true }).fill("metal1"); await page.getByRole("button", { name: "保存名称", exact: true }).click();
  await expect(page.locator(".layer-name")).toContainText("metal1");
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  const panel = page.getByRole("region", { name: "AI 讲解", exact: true }); await panel.getByText("配置本次会话", { exact: true }).click();
  await panel.getByLabel("本次会话密钥", { exact: true }).fill("synthetic-tab-key");
  await page.getByRole("tab", { name: "源数据", exact: true }).click();
  await expect(page.getByRole("heading", { name: "版图库信息", exact: true })).toBeVisible();
  await expect(page.locator("#inspector-panel-source")).toContainText("SYNTHETIC_LIBRARY");
  await expect(page.locator("#inspector-panel-source")).toContainText("PIN_A"); await expect(page.locator("#inspector-panel-source img")).toHaveCount(0);
  await page.getByRole("tab", { name: "AI", exact: true }).click(); await expect(panel.getByLabel("本次会话密钥", { exact: true })).toHaveValue("synthetic-tab-key");
  await page.getByRole("tab", { name: "概览", exact: true }).click();
  await page.getByRole("button", { name: "恢复默认", exact: true }).click(); await expect(page.locator(".layer-name")).toContainText("Layer 7/3");
  const mapping = '<layer-properties><properties><name>metal2</name><source>7/3@1</source></properties></layer-properties>';
  await page.getByTestId("layer-mapping-input").setInputFiles({ name: "synthetic.lyp", mimeType: "application/xml", buffer: Buffer.from(mapping) });
  await expect(page.locator(".layer-name")).toContainText("metal2");
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "导出审阅记录", exact: true }).click();
  const stream = await (await download).createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk); const exported = Buffer.concat(chunks);
  expect(JSON.parse(exported.toString()).layerNames).toEqual({ "7/3": "metal2" }); expect(exported.toString()).not.toContain("synthetic-tab-key");
  await page.getByRole("button", { name: "恢复默认", exact: true }).click();
  await page.getByTestId("review-file-input").setInputFiles({ name: "synthetic.review.json", mimeType: "application/json", buffer: exported }); await expect(page.locator(".layer-name")).toContainText("metal2");
  await page.getByTestId("layer-mapping-input").setInputFiles({ name: "invalid.lyp", mimeType: "application/xml", buffer: Buffer.from('<!DOCTYPE layer-properties [<!ENTITY e SYSTEM "https://unsafe.example.invalid/x">]>'+mapping) });
  await expect(page.getByRole("alert")).toContainText("不允许外部实体"); await expect(page.locator(".layer-name")).toContainText("metal2");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("metal2"); expect(transfers).toEqual([]);
});

test("text-only cells open source data and English tabs work on a narrow viewport", async ({ page }) => {
  await page.goto("/"); await page.getByTestId("public-file-input").setInputFiles({ name: "labels.gds2", mimeType: "application/octet-stream", buffer: metadataFixture(true) });
  await expect(page.getByRole("tab", { name: "源数据", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#inspector-panel-source")).toContainText("PIN_A"); await expect(page.locator(".viewer-host canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "收起检查器", exact: true }).click();
  await page.getByRole("button", { name: "切换为英文", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "Toggle inspector", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Text labels", exact: false })).toBeVisible();
  const tab = page.getByRole("tab", { name: "Source data", exact: true }); await tab.focus(); await tab.press("ArrowRight"); await expect(page.getByRole("tab", { name: "AI", exact: true })).toBeFocused();
});
