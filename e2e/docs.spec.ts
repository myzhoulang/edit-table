import { test, expect } from '@playwright/test';
test.use({ baseURL: 'http://127.0.0.1:5173' });
test('React 示例支持 portal 编辑并在 SPA 离开时清理', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/guide/framework-integration');
  await expect(page.locator('.react-demo .edit-table')).toHaveCount(1);
  await expect(page.locator('.react-demo .et-body-table')).toHaveCSS('border-collapse', 'separate');
  await expect(
    page.locator('.vp-doc table').filter({ hasNot: page.locator('colgroup') }),
  ).toHaveCSS('border-collapse', 'collapse');
  await expect(page.locator('.react-demo .et-body-table strong')).toHaveText('React portal 单元格');
  await page.locator('.react-demo .et-body-table [data-field=name]').dblclick();
  await page.getByRole('textbox', { name: '编辑项目' }).fill('React 更新');
  await page.getByRole('textbox', { name: '编辑项目' }).press('Enter');
  await expect(page.locator('.react-demo .et-body-table strong')).toHaveText('React 更新');
  await page.locator('.VPSidebar a[href="/guide/getting-started"]').first().click();
  await expect(page.locator('.edit-table')).toHaveCount(0);
  await expect(page.locator('.et-popup-layer')).toHaveCount(0);
  expect(errors).toEqual([]);
});
const demos = [
  'basic',
  'group-merge',
  'subtotal-offer',
  'pinned-compare',
  'big-data',
  'validation-submit',
  'loading-states',
  'theme-density',
  'quotation',
];
for (const name of ['group-merge', 'quotation'])
  test(`文档示例 ${name} 的合并格、小计与列选框精确对齐`, async ({ page }) => {
    await page.goto(`/demos/${name}/`);
    const table = page.locator('.et-body-table');
    await expect(table).toBeVisible();
    await expect(table).toHaveCSS('border-collapse', 'separate');
    const geometry = async (): Promise<Record<string, number>> =>
      page.evaluate(() => {
        const table = document.querySelector<HTMLTableElement>('.et-body-table')!,
          tableRect = table.getBoundingClientRect(),
          canvas = document.querySelector<HTMLElement>('.et-body-canvas')!,
          merged = document
            .querySelector('.et-merged-cell[data-field=projectName]')!
            .getBoundingClientRect(),
          placeholder = document
            .querySelector('tr[data-view-index="0"] [data-field=projectName]')!
            .getBoundingClientRect(),
          subtotal = document
            .querySelector('tr[data-view-index="4"] [data-field=projectName]')!
            .getBoundingClientRect();
        return {
          width: Math.abs(tableRect.width - Number.parseFloat(table.style.width)),
          height: Math.abs(tableRect.height - Number.parseFloat(canvas.style.height)),
          mergeLeft: Math.abs(merged.left - placeholder.left),
          mergeRight: Math.abs(merged.right - placeholder.right),
          mergeTop: Math.abs(merged.top - placeholder.top),
          subtotalTop: Math.abs(merged.bottom - subtotal.top),
          subtotalLeft: Math.abs(merged.left - subtotal.left),
        };
      });
    for (const mismatch of Object.values(await geometry())) expect(mismatch).toBeLessThan(0.01);
    await page.locator('th[data-field=projectName]').click();
    await expect(page.locator('.et-column-selection')).toHaveCount(1);
    await expect(page.locator('th[data-field=projectName]')).toHaveCSS('z-index', '5');
    expect(
      await page.evaluate(() => {
        const box = document.querySelector('.et-column-selection')!.getBoundingClientRect(),
          clip = document
            .querySelector('.et-column-selection')!
            .parentElement!.getBoundingClientRect(),
          header = document.querySelector('th[data-field=projectName]')!.getBoundingClientRect(),
          body = document.querySelector('.et-body-viewport')!.getBoundingClientRect();
        return {
          left: Math.abs(box.left - (header.left - 1)),
          right: Math.abs(box.right - header.right),
          top: Math.abs(box.top - body.top),
          clippedLeft: Math.max(0, clip.left - box.left),
        };
      }),
    ).toEqual({ left: 0, right: 0, top: 0, clippedLeft: 0 });
  });
for (const name of demos)
  test(`文档示例 ${name} 可创建、操作和销毁`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`/demos/${name}/`);
    await expect(page.locator('.edit-table')).toHaveCount(1);
    await expect(page.locator('.et-head-table th')).not.toHaveCount(0);
    await page.locator('.VPSwitchAppearance:visible').click();
    await expect(page.locator('.edit-table')).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
  });
test('文档 SPA 连续切页无残留实例或浮层', async ({ page }) => {
  await page.goto('/demos/basic/');
  for (const name of ['group-merge', 'subtotal-offer', 'pinned-compare', 'quotation', 'basic']) {
    await page.locator(`.VPSidebar a[href="/demos/${name}/"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/demos/${name}/`));
    await expect(page.locator('.edit-table')).toHaveCount(1);
    await expect(page.locator('.et-popup-layer')).toHaveCount(1);
  }
});

test('财务案例项目优惠可编辑与采集', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demos/quotation/finance');
  await expect(page.locator('.edit-table')).toHaveCount(1);
  const price = page.locator('.et-derived-row').nth(1).locator('[data-field=unitPrice]');
  await price.scrollIntoViewIfNeeded();
  const target = await price.boundingBox(),
    viewport = await page.locator('.et-body-viewport').boundingBox();
  if (!target || !viewport) throw new Error('财务案例的单价格或滚动视口不可见');
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + 40);
  await page.mouse.wheel(Math.max(0, target.x + target.width - viewport.x - viewport.width + 1), 0);
  await price.dblclick();
  const input = page.getByRole('textbox', { name: '编辑含税单价 / 打包价' });
  await input.fill('180');
  await input.press('Enter');
  await page.getByRole('button', { name: '采集提交数据', exact: true }).click();
  await expect(page.locator('.demo-message')).toContainText('project-offer');
  await expect(page.locator('.demo-message')).toContainText('"value":180');
  expect(errors).toEqual([]);
});
