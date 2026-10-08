import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/public",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  timeout: 60000,
  use: {
    baseURL: process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:4175",
    trace: "retain-on-failure",
    launchOptions: process.env.PUBLIC_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PUBLIC_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: process.env.PUBLIC_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4175",
        url: "http://127.0.0.1:4175",
        reuseExistingServer: true,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
      },
    },
  ],
});
