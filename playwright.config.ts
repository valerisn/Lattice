import { defineConfig } from "@playwright/test";
import path from "node:path";
const port = 3211;
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL,
    headless: !!process.env.CI,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: process.env.DATABASE_URL
      ? "npm run start"
      : `npm run dev -- --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      APP_URL: baseURL,
      SETUP_TOKEN: "automated-test-setup-token",
      DATA_DIR: path.join(process.cwd(), "data", `e2e-${Date.now()}`),
      UPLOAD_DIR: path.join(process.cwd(), "data", `e2e-uploads-${Date.now()}`),
    },
  },
});
