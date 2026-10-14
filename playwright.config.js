// Playwright configuration for the end-to-end tests.
// Uses the Microsoft Edge already installed on the machine (channel "msedge")
// so no browser download is needed. Switch to "chromium" after
// `npx playwright install chromium` if Edge is not available.

import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.js/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node server/server.js`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), HOST: "127.0.0.1", AGECHECK_DATA_DIR: ".e2e-data" },
    timeout: 20_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Edge"], channel: "msedge" } },
  ],
});
