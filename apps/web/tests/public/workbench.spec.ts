import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../../../..");
function model(uri?: string) {
  const vertices = Buffer.alloc(36);
  [0, 0, 0, 2, 0, 0, 0, 2, 0].forEach((n, i) =>
    vertices.writeFloatLE(n, i * 4),
  );
  return Buffer.from(
    JSON.stringify({
      asset: { version: "2.0" },
      buffers: [
        {
          byteLength: 36,
          uri:
            uri ??
            `data:application/octet-stream;base64,${vertices.toString("base64")}`,
        },
      ],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      ],
      meshes: [
        {
          name: "<img src=x onerror=alert(1)>",
          primitives: [{ attributes: { POSITION: 0 } }],
        },
      ],
      nodes: [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
      scene: 0,
    }),
  );
}
test("GDS2 suffix works through file selection and uppercase drag-and-drop", async ({ page }) => {
  const sample = await fs.readFile(path.join(root, "apps/web/public-static/samples/demo.gds"));
  await page.goto("/");
  const input = page.getByTestId("public-file-input");
  await expect(input).toHaveAttribute("accept", /\.gds2(?:,|$)/);
  await input.setInputFiles({ name: "picked.gds2", mimeType: "application/octet-stream", buffer: sample });
  await expect(page.locator(".filename")).toHaveText("picked.gds2");
  await expect(page.locator(".main-foot")).toContainText("AIALRA_DEMO");
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
  const transfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], "dropped.GDS2", { type: "application/octet-stream" }));
    return data;
  }, Array.from(sample));
  await page.locator(".viewer-host").dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.locator(".filename")).toHaveText("dropped.GDS2");
  await expect(page.locator(".main-foot")).toContainText("198,492");
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await transfer.dispose();
});

test("local geometry, layer visibility, review export and restore; no file network transfer", async ({
  page,
}) => {
  const errors: string[] = [],
    posts: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.method() !== "GET") posts.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "试用合成示例" }).click();
  await expect(page.locator(".main-foot")).toContainText("AIALRA_DEMO");
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
  const boxes = page.locator(".layer-row input");
  expect(await boxes.count()).toBe(10);
  await boxes.first().uncheck();
  await expect(boxes.first()).not.toBeChecked();
  await page.getByRole("button", { name: "俯视", exact: true }).click();
  await page.getByLabel("层间距").fill("3");
  await page.getByRole("button", { name: "审阅记录", exact: true }).click();
  await page
    .getByLabel("新增记录")
    .fill("<script>alert('review')</script>\n观察已保存");
  await page.getByRole("button", { name: "加入记录" }).click();
  await expect(page.locator(".note-item")).toContainText("<script>");
  await expect(page.locator(".note-item script")).toHaveCount(0);
  await page.getByRole("button", { name: "视角书签", exact: true }).click();
  await page.getByRole("button", { name: "保存当前视角" }).click();
  await expect(page.getByRole("button", { name: "视角 1" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出审阅记录", exact: true }).click();
  const downloaded = await download;
  const saved = await downloaded.path();
  expect(saved).toBeTruthy();
  const exported = JSON.parse(await fs.readFile(saved!, "utf8"));
  expect(exported.notes).toHaveLength(1);
  expect(exported.bookmarks).toHaveLength(1);
  expect(exported.visible).toHaveLength(9);
  await page
    .getByTestId("review-file-input")
    .setInputFiles({
      name: "review.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
  await expect(page.locator(".global-status")).toContainText("审阅记录已恢复");
  await page.getByRole("button", { name: "单元", exact: true }).click();
  await page.getByRole("button", { name: /logic_tile/ }).click();
  await expect(page.locator(".main-foot")).toContainText("logic_tile");
  await expect(page.locator(".canvas-error")).toHaveCount(0);
  await page.screenshot({
    path: path.join(root, ".verification/desktop-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "切换浅色主题" }).click();
  await page.screenshot({
    path: path.join(root, ".verification/desktop-light.png"),
    fullPage: true,
  });
  expect(posts).toEqual([]);
  expect(errors).toEqual([]);
});
test("external resources, truncated files, huge files and invalid review are refused without replacing current geometry", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("evil.example")) external.push(r.url());
  });
  await page.goto("/");
  await page
    .getByTestId("public-file-input")
    .setInputFiles({
      name: "triangle.gltf",
      mimeType: "application/json",
      buffer: model(),
    });
  await expect(page.locator(".main-foot")).toContainText("1 个三角形");
  await expect(page.locator(".layer-name")).toContainText("<img");
  await expect(page.locator(".layer-list img")).toHaveCount(0);
  for (const uri of [
    "https://evil.example/leak",
    "http://127.0.0.1:34000/api/sessions",
    "file:///etc/passwd",
    "data:image/svg+xml;base64,PHN2Zz4=",
  ]) {
    await page
      .getByTestId("public-file-input")
      .setInputFiles({
        name: "bad.gltf",
        mimeType: "application/json",
        buffer: model(uri),
      });
    await expect(page.getByRole("alert")).toContainText("外部资源已禁用");
    await expect(page.locator(".filename")).toHaveText("triangle.gltf");
  }
  await page
    .getByTestId("public-file-input")
    .setInputFiles({
      name: "truncated.gds",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0, 6, 0, 2, 2, 88, 0, 4, 5]),
    });
  await expect(page.getByRole("alert")).toContainText("截断");
  await page
    .getByTestId("public-file-input")
    .setInputFiles({
      name: "large.gds",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(33 * 1024 * 1024),
    });
  await expect(page.getByRole("alert")).toContainText("32 MB");
  await page
    .getByTestId("review-file-input")
    .setInputFiles({
      name: "bad.review.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        '{"format":"gds-3d-viewer-review","version":1,"file":"other.gltf"}',
      ),
    });
  await expect(page.getByRole("alert")).toContainText("不匹配");
  expect(external).toEqual([]);
});
test("real repository GDS parses in the browser without the Python backend", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("public-file-input")
    .setInputFiles(path.join(root, "fixtures/example/example.gds"));
  await expect(page.locator(".global-status")).toContainText("已读取单元目录", {
    timeout: 15000,
  });
  await page.getByLabel("筛选单元").fill("sky130_fd_sc_hd__fill_1");
  await page.locator(".cell-row").first().click();
  await expect(page.locator(".viewer-host canvas")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
  await page.screenshot({
    path: path.join(root, ".verification/real-fixture.png"),
  });
});
test("mobile panels, modal keyboard return and preference storage failure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await expect(page.locator(".main-foot")).toContainText("AIALRA_DEMO");
  await page.getByRole("button", { name: "图层", exact: true }).click();
  await expect(page.getByLabel("版图导航")).toBeVisible();
  await page.getByLabel("收起导航", { exact: true }).click();
  await page.getByRole("button", { name: "显示或收起检查器" }).click();
  await expect(page.getByLabel("版图检查器")).toBeVisible();
  await page.getByLabel("收起检查器", { exact: true }).click();
  const help = page.getByRole("button", { name: "使用说明与隐私" });
  await help.click();
  await expect(page.locator("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(help).toBeFocused();
  await page.getByRole("button", { name: "切换浅色主题" }).click();
  await expect(page.locator(".global-status")).toContainText("偏好保存失败");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: path.join(root, ".verification/mobile-light.png"),
    fullPage: true,
  });
});
test("cancelled sample fetch cannot overwrite a later local import", async ({
  page,
}) => {
  await page.route("**/samples/demo.gds", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.getByRole("button", { name: "取消导入" }).click();
  await page
    .getByTestId("public-file-input")
    .setInputFiles({
      name: "new.gltf",
      mimeType: "application/json",
      buffer: model(),
    });
  await expect(page.locator(".filename")).toHaveText("new.gltf");
  await page.waitForTimeout(1600);
  await expect(page.locator(".filename")).toHaveText("new.gltf");
});
