import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../fixtures");

test("fullscreen cockpit runs the backend-backed workflow", async ({ page }) => {
  test.setTimeout(120000);

  await page.goto("/legacy.html");
  await expect(page.locator(".empty-stage strong")).toHaveText("Empty", { timeout: 30000 });

  await page.getByTestId("upload-input").setInputFiles(path.join(fixtureRoot, "example/example.gds"));

  await expect(page.locator("iframe[title='ICViewer core']")).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".brand-block")).toContainText("tt_um_hh", { timeout: 90000 });

  const frame = page.frameLocator("iframe[title='ICViewer core']");
  await expect(frame.locator("#instanceClassTitle")).toContainText("tt_um_hh", { timeout: 90000 });

  await page.getByTestId("viewer-drawer-button").evaluate((node) => (node as HTMLButtonElement).click());
  await expect(frame.locator("body")).toHaveClass(/controls-open/, { timeout: 15000 });
  await expect(frame.locator(".lil-gui.root.autoPlace")).toContainText("Layers");
  await expect(frame.locator(".lil-gui.root.autoPlace")).toContainText("Cells/Instances");

  await page.getByTestId("ai-drawer-button").evaluate((node) => (node as HTMLButtonElement).click());
  await expect(page.getByTestId("side-drawer")).toContainText("AI");
  await expect(page.getByTestId("explain-button")).toBeVisible();
  await expect(page.getByTestId("operator-button")).toBeVisible();

  await page.getByTestId("review-drawer-button").evaluate((node) => (node as HTMLButtonElement).click());
  await page.getByTestId("note-input").fill("Smoke note");
  await page.getByTestId("note-add-button").evaluate((node) => (node as HTMLButtonElement).click());
  await expect(page.getByText("Smoke note")).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    const closeButton = document.querySelector(".drawer .icon-button");
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.click();
    }
  });

  const downloadPromise = page.waitForEvent("download");
  await page.locator(".topbar-actions .pill-button").nth(2).evaluate((node) => (node as HTMLButtonElement).click());
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("session.json");
});
