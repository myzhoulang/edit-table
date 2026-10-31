import { test, expect } from '@playwright/test';
for (const zoom of [0.8, 1, 1.25, 1.5, 2]) {
  test(`缩放 ${zoom}：头体、固定列、合并层与虚拟化`, async ({ page }, info) => {
    await page.goto('/spikes/two-table/');
    await page.locator('#root').evaluate((el, ratio) => { (el as HTMLElement).style.zoom = String(ratio); }, zoom);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    for (const [x, y] of [[0, 0], [211.5, 1440], [500, 720000], [0, 3599400]]) {
      await page.locator('.body').evaluate((el, pos) => { el.scrollLeft = pos.x; el.scrollTop = pos.y; el.dispatchEvent(new Event('scroll')); }, { x, y });
      const measurements = await page.evaluate(() => {
        const header = document.querySelector('.head thead tr')!;
        const row = document.querySelector('.body tr[data-row]')!;
        const offset = [...header.children].map((cell, i) => Math.abs(cell.getBoundingClientRect().left - row.children[i]!.getBoundingClientRect().left));
        const root = document.querySelector('#root')!.getBoundingClientRect();
        return { offset, left: row.children[0]!.getBoundingClientRect().left, root: root.left, rows: document.querySelectorAll('tr[data-row]').length, content: [...document.querySelectorAll('.content')].map((el) => el.getBoundingClientRect().height) };
      });
      expect(Math.max(...measurements.offset)).toBeLessThanOrEqual(1);
      expect(Math.abs(measurements.left - measurements.root)).toBeLessThanOrEqual(2 * zoom);
      expect(measurements.rows).toBeLessThan(100);
      expect(measurements.content.every((height) => height > 0 && height <= 430 * zoom + 1)).toBeTruthy();
    }
    if (zoom === 1) await page.screenshot({ path: `spikes/screenshots/${info.project.name}.png` });
  });
}
