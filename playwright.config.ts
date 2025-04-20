import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: true,
  timeout: 120000,
  expect: {
    timeout: 20000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  outputDir: "./test-results",
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}",
  use: {
    trace: "on",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: process.platform === "linux" ? ["--no-sandbox"] : [],
        },
      },
    },
  ],
});
