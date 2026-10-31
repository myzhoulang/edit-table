import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173' });
test.beforeEach(async ({ page }) => {
  await page.goto('/demos/basic/');
  await expect(page.locator('.et-body-table')).toBeVisible();
  await page.locator('.table-demo').evaluate((node) => {
    node.style.width = '640px';
  });
});

test('普通选区、活动单元格与编辑框均覆盖左上网格线', async ({ page }) => {
  await page.locator('.et-body-viewport').evaluate((node) => {
    node.scrollTop = 400;
    node.dispatchEvent(new Event('scroll'));
  });
  await page.locator('tr[data-view-index="13"] [data-field=name]').click();
  await page
    .locator('tr[data-view-index="16"] [data-field=status]')
    .click({ modifiers: ['Shift'] });
  await expect(page.locator('.et-select-layer .et-selection')).toHaveCount(1);
  const geometry = async (): Promise<Record<string, number>> =>
    page.evaluate(() => {
      const first = document
          .querySelector('tr[data-view-index="13"] [data-field=name]')!
          .getBoundingClientRect(),
        last = document
          .querySelector('tr[data-view-index="16"] [data-field=status]')!
          .getBoundingClientRect(),
        range = document.querySelector('.et-select-layer .et-selection')!.getBoundingClientRect(),
        active = document.querySelector('.et-active-cell')!.getBoundingClientRect();
      return {
        rangeLeft: Math.abs(range.left - (first.left - 1)),
        rangeTop: Math.abs(range.top - (first.top - 1)),
        rangeRight: Math.abs(range.right - last.right),
        rangeBottom: Math.abs(range.bottom - last.bottom),
        activeLeft: Math.abs(active.left - (last.left - 1)),
        activeTop: Math.abs(active.top - (last.top - 1)),
        activeRight: Math.abs(active.right - last.right),
        activeBottom: Math.abs(active.bottom - last.bottom),
      };
    });
  for (const mismatch of Object.values(await geometry())) expect(mismatch).toBeLessThan(0.01);
  await page.keyboard.type('A');
  await expect(page.getByRole('textbox', { name: '编辑状态' })).toHaveValue('A');
  const editor = await page.locator('.et-editor').boundingBox(),
    active = await page.locator('.et-active-cell').boundingBox();
  if (!editor || !active) throw new Error('活动单元格或编辑框不可见');
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(Math.abs(editor[key] - active[key])).toBeLessThan(0.01);
  await page.keyboard.press('Escape');
  for (const mismatch of Object.values(await geometry())) expect(mismatch).toBeLessThan(0.01);
});

test('首行单格选择的顶边覆盖表头下方网格线并可清除', async ({ page }) => {
  await page.locator('tr[data-view-index="0"] [data-field=name]').click();
  const alignment = await page.evaluate(() => {
    const cell = document
        .querySelector('tr[data-view-index="0"] [data-field=name]')!
        .getBoundingClientRect(),
      edges = document.querySelectorAll('.et-head-selection-edge');
    return [...edges].map((node) => {
      const edge = node.getBoundingClientRect();
      return {
        left: Math.abs(edge.left - (cell.left - 1)),
        right: Math.abs(edge.right - cell.right),
        top: Math.abs(edge.top - (cell.top - 1)),
        bottom: Math.abs(edge.bottom - cell.top),
      };
    });
  });
  expect(alignment.length).toBeGreaterThan(0);
  for (const edge of alignment)
    for (const mismatch of Object.values(edge)) expect(mismatch).toBeLessThan(0.01);
  await page.locator('h1').click();
  await expect(page.locator('.et-head-selection-edge')).toHaveCount(0);
});

test('列高亮在横向滚动后覆盖交界线且不越过固定行号', async ({ page }) => {
  await page.locator('th[data-field=name]').click();
  for (const scrollLeft of [0, 90, 0]) {
    await page.locator('.et-body-viewport').evaluate((node, x) => {
      document.querySelector<HTMLElement>('.et-horizontal-scroll')!.scrollLeft = x;
      node.scrollTop = 400;
      node.dispatchEvent(new Event('scroll'));
    }, scrollLeft);
    const alignment = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('th[data-field=name]')!,
        headerRect = header.getBoundingClientRect(),
        number = document.querySelector('th.et-row-number')!.getBoundingClientRect(),
        clip = getComputedStyle(header)
          .clipPath.replace(/^inset\(|\)$/g, '')
          .split(/\s+/)
          .map(Number.parseFloat),
        selected = document.querySelector('.et-column-selection')!,
        selectedRect = selected.getBoundingClientRect(),
        part = selected.parentElement!.getBoundingClientRect();
      return {
        headerLeft: Math.abs(
          headerRect.left + clip[3]! - Math.max(headerRect.left - 1, number.right - 1),
        ),
        headerTop: Math.abs(clip[0]! + 1),
        visibleBorder: Math.abs(part.left - (number.right - 1)),
        selectionLeft: Math.abs(selectedRect.left - (headerRect.left - 1)),
        selectionRight: Math.abs(selectedRect.right - headerRect.right),
      };
    });
    for (const mismatch of Object.values(alignment)) expect(mismatch).toBeLessThan(0.01);
  }
});
