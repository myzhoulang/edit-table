import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results/visual',
  testMatch: 'visual.spec.ts',
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'artifacts/visual-results.json' }]],
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:5179',
    viewport: { width: 1512, height: 982 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'bun run dev --port 5179 --strictPort',
    url: 'http://127.0.0.1:5179',
    reuseExistingServer: true,
  },
});
