import { defineConfig } from 'vitest/config'

// Separate from the unit tests: this one starts `wrangler dev`, so it is slower and needs free ports.
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
