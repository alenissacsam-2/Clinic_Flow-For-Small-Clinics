import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

// The booking-RPC suite talks to Supabase directly with the anon key, the same
// way a hostile client would. Next loads .env.local itself; Playwright does not.
dotenv.config({ path: ".env.local", quiet: true })

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Reuse a dev server that's already up locally; boot one in CI.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
