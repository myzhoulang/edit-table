import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results/e2e',
  testIgnore: 'visual.spec.ts',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 3,
  reporter: [['list'], ['json', { outputFile: 'artifacts/e2e-results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5179',
    viewport: { width: 1512, height: 982 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'bun run dev --port 5179 --strictPort',
      url: 'http://127.0.0.1:5179',
      reuseExistingServer: true,
    },
    {
      command: 'bun run docs:dev --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
    },
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
