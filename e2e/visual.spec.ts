import { test, expect } from '@playwright/test';
// 系统字体影响像素结果；macOS 基线在独立 macOS CI 作业中比较。
test.skip(process.platform !== 'darwin', '当前截图基线针对 macOS，其他系统继续运行结构和交互断言');
for (const theme of ['light', 'dark'] as const)
  test(`设计结构视觉基线 ${theme}`, async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.et-body-table');
    await page.evaluate(async (value) => {
      await document.fonts.ready;
      window.table.setTheme(value);
      window.table.pinRow(0);
    }, theme);
    await page.locator('tr[data-view-index="1"] .et-row-number').click();
    await page.mouse.move(0, 0);
    await expect(page.locator('.edit-table')).toHaveScreenshot(`${theme}.png`, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.005,
    });
  });
