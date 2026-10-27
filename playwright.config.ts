import { defineConfig } from '@playwright/test'

// End-to-end tests of the whole product: real browser, the real Worker and Durable Objects, and a fake
// Supabase backed by the real migrations (see apps/realtime/e2e/devStack.ts). Two people are two browser
// contexts on different origins (localhost and 127.0.0.1), so each has its own guest session.
//
//   pnpm test:ui            run everything (starts the stack if it is not already running)
//   PW_CHANNEL=msedge pnpm test:ui   use Edge instead of Chrome
//
// It drives an installed Chrome or Edge, so no browser download is needed.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  // One worker: the backend is shared and the Worker rate-limits per IP, which is part of what is tested.
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    channel: process.env.PW_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev:local',
    url: 'http://127.0.0.1:8787/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true }, grep: /@mobile/ },
  ],
})
