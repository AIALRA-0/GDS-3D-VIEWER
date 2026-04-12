import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "cd ../api && ../../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 34000",
          url: "http://127.0.0.1:34000/health",
          reuseExistingServer: true,
          timeout: 120000
        },
        {
          command: "npm run dev -- --host 127.0.0.1 --port 4173",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120000
        }
      ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
