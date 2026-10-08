import { expect, test, type Page } from "@playwright/test";
import { metadataFixture } from "./metadata-fixture";
import { instanceFixture } from "./instance-fixture";

async function load(page: Page, bytes?: Buffer) {
  await page.goto("/");
  if (bytes) await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic.gds", buffer: bytes, mimeType: "application/octet-stream" });
  else await page.getByRole("button", { name: "试用合成示例", exact: true }).click();
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
}
async function review(page: Page) {
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "导出审阅记录", exact: true }).click();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function coloredHeight(page: Page) {
  return page.locator(".viewer-host canvas").evaluate((canvas: HTMLCanvasElement) => {
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const c = copy.getContext("2d")!; c.drawImage(canvas, 0, 0); const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = Infinity, max = -Infinity;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) > 25 && Math.max(r, g, b) > 80) { min = Math.min(min, y); max = Math.max(max, y); }
    }
    return max - min + 1;
  });
}

test("cell height toggle visibly flattens geometry without replacing canvas, camera or preferences", async ({ page }) => {
  await load(page); await page.getByRole("button", { name: "单元", exact: true }).click();
  await page.locator("button.cell-row").filter({ hasText: "logic_tile" }).click();
  await expect(page.locator(".main-foot")).toContainText("logic_tile");
  const canvas = page.locator(".viewer-host canvas"), original = await canvas.elementHandle();
  await page.getByRole("button", { name: "正视", exact: true }).click();
  const before = await review(page); let tall = 0;
  await expect.poll(async () => tall = await coloredHeight(page)).toBeGreaterThan(50);
  await page.locator(".cell-root-field").getByRole("button", { name: "切换为紧凑层高", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-height-mode", "compact");
  await expect.poll(() => coloredHeight(page)).toBeLessThan(tall / 2);
  expect(await original!.evaluate(el => el.isConnected)).toBe(true);
  const compact = await review(page); expect(compact.camera.heightMode).toBe("compact");
  expect(compact.camera.position).toEqual(before.camera.position); expect(compact.camera.target).toEqual(before.camera.target);
  expect(compact.layerColors).toEqual(before.layerColors); expect(compact.visible).toEqual(before.visible);
  await page.getByRole("tab", { name: "显示", exact: true }).click();
  await page.locator("#inspector-panel-display").getByRole("button", { name: "切换为一致层高", exact: true }).click();
  await expect.poll(() => coloredHeight(page)).toBe(tall);
  await page.getByTestId("review-file-input").setInputFiles({ name: "review.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(compact)) });
  await expect(canvas).toHaveAttribute("data-height-mode", "compact");
  const invalid = { ...compact, camera: { ...compact.camera, heightMode: "unsafe" } };
  await page.getByTestId("review-file-input").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.locator(".error-banner")).toContainText("审阅记录无效"); await expect(canvas).toHaveAttribute("data-height-mode", "compact");
  delete before.camera.heightMode;
  await page.getByTestId("review-file-input").setInputFiles({ name: "old.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(before)) });
  await expect(canvas).toHaveAttribute("data-height-mode", "consistent");
});

test("compact height preference follows cells, keeps exact 2D picking and fits bilingual mobile controls", async ({ page }) => {
  await load(page, instanceFixture()); await page.getByRole("button", { name: "单元", exact: true }).click();
  await page.locator(".cell-root-field").getByRole("button", { name: "切换为紧凑层高", exact: true }).click();
  await page.locator("button.cell-row").filter({ hasText: "TILE/with:marker" }).first().click();
  await expect(page.locator(".main-foot")).toContainText("TILE/with:marker");
  const canvas = page.locator(".viewer-host canvas"); await expect(canvas).toHaveAttribute("data-height-mode", "compact");
  await page.getByRole("button", { name: "二维", exact: true }).click();
  const box = (await canvas.boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("tooltip").filter({ hasText: "边界多边形" })).toContainText("5.000");
  await page.getByRole("button", { name: "切换为英文", exact: true }).click();
  await expect(page.locator(".cell-root-field .height-control")).toContainText("Compact heights");
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole("button", { name: "Cells", exact: true }).click();
  expect(await page.locator(".cell-root-field .height-control").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator(".cell-root-field").getByRole("button", { name: "Switch to consistent heights", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-height-mode", "consistent");
});
