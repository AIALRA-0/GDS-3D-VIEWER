import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../fixtures");

test("cockpit runs the backend-backed review workflow", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");

  await expect(page.getByTestId("scene-viewer")).toBeVisible({ timeout: 90000 });
  await expect(page.getByRole("heading", { name: /explainable 3d ic layout review/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("sample-list")).toContainText("OpenROAD Bundle Demo", { timeout: 30000 });
  await expect(page.getByText("example.gds")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".viewer-shell h2")).toContainText("TinyTapeout", { timeout: 30000 });
  await page.waitForLoadState("networkidle");

  await page.locator(".panel-tab-row").getByRole("button", { name: "Layers", exact: true }).click();
  await expect(page.locator(".panel-hint")).toContainText("Filter summarized review layers");
  await expect(page.locator(".layers-panel")).toHaveClass(/is-panel-focus/);

  await page.locator(".panel-tab-row").getByRole("button", { name: "Explain", exact: true }).click();
  await expect(page.locator(".panel-hint")).toContainText("Generate an AI explanation");
  await expect(page.locator(".rail-right .panel").nth(1)).toHaveClass(/is-panel-focus/);

  const sampleResponse = page.waitForResponse((response) => response.url().includes("/api/samples/openroad-demo") && response.status() === 200);
  await page.getByRole("button", { name: /openroad bundle demo/i }).click();
  await sampleResponse;
  await expect(page.locator(".viewer-shell h2")).toContainText("OpenROAD", { timeout: 30000 });
  await expect(page.getByText("openroad-metrics.json")).toBeVisible({ timeout: 30000 });

  await page.locator("[data-testid^='layer-']").first().click();
  await expect(page).toHaveURL(/layers=/);

  await page.getByTestId("explain-button").click();
  await expect(page.getByTestId("explain-output")).toContainText(/Confidence/i);

  await page.getByTestId("operator-button").click();
  await expect(page.locator(".action-button").first()).toBeVisible();

  await page.getByPlaceholder("Leave a review note tied to the current visible layers.").fill("First demo note");
  await page.getByTestId("note-add-button").click();
  await expect(page.getByText("First demo note")).toBeVisible();

  await page.getByPlaceholder("Bookmark label").fill("Smoke bookmark");
  await page.getByTestId("save-bookmark-button").click();
  await expect(page.getByRole("button", { name: /smoke bookmark/i }).first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-session-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("session.json");

  await page.getByTestId("upload-input").setInputFiles([
    path.join(fixtureRoot, "example/example.gds"),
    path.join(fixtureRoot, "compat/openroad-manifest.json"),
    path.join(fixtureRoot, "compat/openroad-metrics.json"),
    path.join(fixtureRoot, "compat/openroad-markers.json")
  ]);

  await expect(page.locator(".viewer-shell h2")).toContainText("OpenROAD", { timeout: 60000 });
  await expect(page.locator(".load-panel .mini-chip")).toContainText(/upload/i, { timeout: 30000 });
  await expect(page.locator(".metadata-grid")).toContainText("openroad-markers.json");
});
