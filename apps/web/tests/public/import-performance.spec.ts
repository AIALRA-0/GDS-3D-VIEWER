import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const demo = readFileSync(new URL("../../public-static/samples/demo.gds", import.meta.url));

test("valid GDS over the former 32 MB cap renders through the real Worker without uploads", async ({ page }) => {
  const transfers: string[] = [];
  page.on("request", r => { if (r.method() !== "GET") transfers.push(r.url()); });
  await page.goto("/");
  const padded = Buffer.concat([demo, Buffer.alloc(33 * 1024 * 1024 - demo.length)]);
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic-large.gds2", buffer: padded, mimeType: "application/octet-stream" });
  await expect(page.locator(".global-status")).toContainText("本地解析完成", { timeout: 45000 });
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".incomplete-banner")).toHaveCount(0);
  expect(transfers).toEqual([]);
});

test("GDS import is not terminated after 45 seconds and cancellation preserves the previous layout", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await expect(page.locator(".global-status")).toContainText("本地解析完成");
  const original = await page.locator(".main-foot").innerText();
  await page.evaluate(() => {
    // A controllable busy Worker isolates the UI deadline and cancellation contract.
    (window as unknown as { Worker: unknown }).Worker = class {
      onmessage?: (event: { data: unknown }) => void;
      postMessage() { this.onmessage?.({ data: { progress: { stage: "records", completed: 1, total: 2 } } }); }
      terminate() {}
    };
  });
  await page.clock.install();
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic-pending.gds", buffer: demo, mimeType: "application/octet-stream" });
  await expect(page.locator(".global-status")).toContainText("50%");
  await page.clock.fastForward(46_000);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "取消导入", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "取消导入", exact: true }).click();
  await expect(page.locator(".global-status")).toContainText("导入已取消");
  await expect(page.locator(".main-foot")).toHaveText(original);
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
});
