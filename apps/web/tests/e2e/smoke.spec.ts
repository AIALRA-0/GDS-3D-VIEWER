import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../fixtures");

test("cockpit runs the backend-backed review workflow", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");

  await expect(page.getByTestId("scene-viewer")).toBeVisible({ timeout: 90000 });
  await expect(page.getByRole("heading", { name: /explainable 3d ic layout review/i })).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".viewer-shell h2")).toContainText("No layout loaded", { timeout: 30000 });
  await page.waitForLoadState("networkidle");

  await page.getByTestId("upload-input").setInputFiles([
    path.join(fixtureRoot, "example/example.gds"),
    path.join(fixtureRoot, "compat/openroad-manifest.json"),
    path.join(fixtureRoot, "compat/openroad-metrics.json"),
    path.join(fixtureRoot, "compat/openroad-markers.json")
  ]);

  await expect(page.locator(".viewer-shell h2")).toContainText("tt_um_hh", { timeout: 60000 });
  await expect(page.locator(".metadata-grid")).toContainText("openroad-markers.json");
  await expect(page.locator(".hierarchy-row").first()).toBeVisible();

  await page.locator("[data-testid^='layer-']").first().click();
  await expect(page.locator(".scene-footbar")).toContainText(/Simplified|Hierarchy preview|Full/);

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
});
