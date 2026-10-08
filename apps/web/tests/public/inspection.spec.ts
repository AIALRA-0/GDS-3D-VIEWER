import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";

// Original tiny GDS fixture: one wide PATH and one intentionally absent reference
function fixture() {
  const rec = (type: number, dtype: number, data = Buffer.alloc(0)) => {
    const head = Buffer.alloc(4);
    const body = data.length % 2 ? Buffer.concat([data, Buffer.alloc(1)]) : data;
    head.writeUInt16BE(body.length + 4); head[2] = type; head[3] = dtype;
    return Buffer.concat([head, body]);
  };
  const shorts = (...values: number[]) => {
    const b = Buffer.alloc(values.length * 2); values.forEach((v, i) => b.writeUInt16BE(v, i * 2)); return b;
  };
  const ints = (...values: number[]) => {
    const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32BE(v, i * 4)); return b;
  };
  const real = (value: number) => {
    let exponent = 64;
    while (value >= 1) { value /= 16; exponent++; }
    while (value < 1 / 16) { value *= 16; exponent--; }
    const b = Buffer.alloc(8); b[0] = exponent;
    let fraction = BigInt(Math.round(value * 2 ** 56));
    for (let i = 7; i >= 1; i--) { b[i] = Number(fraction & 255n); fraction >>= 8n; }
    return b;
  };
  return Buffer.concat([
    rec(0, 2, shorts(600)), rec(1, 2, Buffer.alloc(24)), rec(2, 6, Buffer.from("SYNTHETIC")),
    rec(3, 5, Buffer.concat([real(1), real(1e-6)])),
    rec(5, 2, Buffer.alloc(24)), rec(6, 6, Buffer.from("WIRE_DEMO")),
    rec(9, 0), rec(13, 2, shorts(7)), rec(14, 2, shorts(3)), rec(15, 3, ints(30)),
    rec(16, 3, ints(0, 0, 100, 0)), rec(17, 0),
    rec(10, 0), rec(18, 6, Buffer.from("ABSENT_CELL")), rec(16, 3, ints(120, 0)), rec(17, 0),
    rec(7, 0), rec(4, 0),
  ]);
}
async function load(page: Page) {
  await page.goto("/");
  await page.getByTestId("public-file-input").setInputFiles({ name: "synthetic-wire.gds2", mimeType: "application/octet-stream", buffer: fixture() });
  await expect(page.locator(".viewer-host canvas")).toBeVisible();
  await page.getByRole("button", { name: "俯视", exact: true }).click();
  const box = (await page.locator(".viewer-host canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("tooltip")).toContainText("路径几何");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
test("missing reference preview retains wire, hover and exact click facts", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  const hit = await load(page);
  await expect(page.locator(".incomplete-banner")).toContainText("不完整预览");
  await expect(page.getByRole("tooltip")).toContainText("WIRE_DEMO");
  await page.mouse.click(hit.x, hit.y);
  await expect(page.locator(".object-inspection")).toContainText("路径宽度");
  await expect(page.locator(".object-inspection")).toContainText("30.000 µm");
  await expect(page.locator(".object-inspection")).toContainText("100.000 µm");
  await expect(page.locator(".object-inspection")).toContainText("7/3");
  await expect(page.locator(".object-inspection")).toContainText(/50\.000, -?0\.000/);
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.locator(".object-inspection")).toContainText("WIRE_DEMO");
  await page.locator(".missing-references summary").click();
  await expect(page.locator(".missing-references")).toContainText("ABSENT_CELL");
  await expect(page.getByRole("link", { name: "查看源码" })).toHaveAttribute("href", "https://github.com/AIALRA-0/GDS-3D-VIEWER");
  expect(errors).toEqual([]);
});
test("AI requires consent, sends bounded facts directly, masks responses and drops key on refresh", async ({ page }) => {
  const hit = await load(page); await page.mouse.click(hit.x, hit.y);
  const panel = page.getByRole("region", { name: "AI 讲解", exact: true });
  await panel.getByText("配置本次会话", { exact: true }).click();
  const endpoint = "https://models.example.invalid/v1/chat/completions";
  const key = "synthetic-test-key";
  const requests: { url: string; headers: Record<string, string>; body: any }[] = [];
  await page.route(endpoint, async (route) => {
    requests.push({ url: route.request().url(), headers: route.request().headers(), body: route.request().postDataJSON() });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: `已知事实：路径宽度 30 µm\n<script>alert(1)</script>\n${key}` } }] }) });
  });
  await panel.getByLabel("模型接口地址", { exact: true }).fill(endpoint);
  await panel.getByLabel("本次会话密钥", { exact: true }).fill(key);
  await panel.getByLabel("讲解对象", { exact: true }).selectOption("geometry");
  await panel.getByText("查看将发送的对象摘要", { exact: true }).click();
  await expect(panel.locator(".request-preview")).toContainText('"pathWidth": 30');
  await expect(panel.getByRole("button", { name: "生成讲解", exact: true })).toBeDisabled();
  expect(requests).toHaveLength(0);
  await panel.getByLabel("确认发送所选摘要", { exact: true }).check();
  await panel.getByRole("button", { name: "生成讲解", exact: true }).click();
  await expect(panel.getByLabel("讲解结果", { exact: true })).toContainText("[已隐藏密钥]");
  await expect(panel.locator(".explanation-result script")).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(endpoint);
  expect(requests[0].headers.authorization).toBe(`Bearer ${key}`);
  expect(requests[0].headers.referer).toBeUndefined();
  const context = JSON.parse(requests[0].body.messages[1].content);
  expect(context.harness).toBe("gds-3d-viewer-explain-v1"); expect(context.target).toBe("geometry");
  expect(context.geometry.pathWidth).toBe(30); expect(context.incomplete).toBe(true);
  expect(JSON.stringify(context)).not.toContain(key); expect(JSON.stringify(context)).not.toContain("synthetic-wire.gds2");
  expect(context.geometry.positions).toBeUndefined();
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(storage).not.toContain(key); expect(storage).not.toContain(endpoint);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出审阅记录", exact: true }).click();
  const exported = await fs.readFile((await (await downloaded).path())!, "utf8");
  expect(exported).not.toContain(key); expect(exported).not.toContain(endpoint); expect(exported).not.toContain("已隐藏密钥");
  await page.reload();
  await panel.getByText("配置本次会话", { exact: true }).click();
  await expect(panel.getByLabel("本次会话密钥", { exact: true })).toHaveValue("");
  expect(requests).toHaveLength(1);
});
test("AI rejects website proxy, hides provider errors and invalidates cancelled work", async ({ page }) => {
  await load(page);
  const panel = page.getByRole("region", { name: "AI 讲解", exact: true });
  await panel.getByText("配置本次会话", { exact: true }).click();
  const key = "synthetic-sensitive-key";
  await panel.getByLabel("模型接口地址", { exact: true }).fill(new URL("/chat/completions", page.url()).href);
  await panel.getByLabel("本次会话密钥", { exact: true }).fill(key);
  await panel.getByLabel("确认发送所选摘要", { exact: true }).check();
  await panel.getByRole("button", { name: "生成讲解", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("不能发送到预览器服务器");
  const endpoint = "https://models.example.invalid/v1/chat/completions";
  await page.route(endpoint, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: `Do not expose ${key}` }) }));
  await panel.getByLabel("模型接口地址", { exact: true }).fill(endpoint);
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await panel.getByLabel("确认发送所选摘要", { exact: true }).check();
  await panel.getByRole("button", { name: "生成讲解", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("HTTP 401");
  await expect(panel.getByRole("alert")).not.toContainText(key);
  await page.unroute(endpoint);
  await page.route(endpoint, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: "STALE_RESULT" } }] }) }).catch(() => {});
  });
  await panel.getByRole("button", { name: "生成讲解", exact: true }).click();
  await panel.getByRole("button", { name: "清除密钥", exact: true }).click();
  await expect(panel.getByLabel("本次会话密钥", { exact: true })).toHaveValue("");
  await page.waitForTimeout(800);
  await expect(panel.getByLabel("讲解结果", { exact: true })).toHaveCount(0);
});
