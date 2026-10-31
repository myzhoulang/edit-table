import { defineConfig } from '@playwright/test';
export default defineConfig({
  outputDir: '../test-results/spikes',
  testDir: '.', testMatch: 'layout.spec.ts',
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5179', viewport: { width: 1280, height: 800 } },
  webServer: { command: 'bun run dev --port 5179 --strictPort', url: 'http://127.0.0.1:5179', reuseExistingServer: true },
  projects: ['chromium', 'firefox', 'webkit'].flatMap((browserName) => [1, 2].map((deviceScaleFactor) => ({ name: `${browserName}-dpr${deviceScaleFactor}`, use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit', deviceScaleFactor } }))),
});
