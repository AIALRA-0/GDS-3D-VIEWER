import { expect, test } from "@playwright/test";

test("cockpit loads and supports core interactions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /industrial layout review/i })).toBeVisible();
  await expect(page.getByTestId("scene-viewer")).toBeVisible();
  await expect(page.getByTestId("stats-grid")).toBeVisible();
  await expect(page.getByTestId("explain-output")).toBeVisible();

  await page.locator("[data-testid^='layer-']").first().click();
  await expect(page).toHaveURL(/layers=/);

  await page.getByTestId("explain-button").click();
  await expect(page.getByTestId("explain-output")).toContainText("Confidence");

  await page.getByTestId("operator-button").click();
  await expect(page.getByRole("button", { name: /focus/i }).first()).toBeVisible();

  await page.getByTestId("note-input").fill("First demo note");
  await page.getByTestId("note-add-button").click();
  await expect(page.getByText("First demo note")).toBeVisible();
});
