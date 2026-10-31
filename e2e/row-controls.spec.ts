import { test, expect } from '@playwright/test';
import type { Row } from '../packages/core/src/types';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('固定区支持逐行、勾选批量与全部取消，源行显示同步标记', async ({ page }) => {
  await page.evaluate(() => {
    window.table.pinRow(0);
    window.table.pinRow(1);
    window.table.pinRow(2);
  });
  const manager = page.locator('.et-pinned-manager');
  await expect(manager).toContainText('已固定 3 行');
  await expect(page.locator('.et-body-table .et-row-pin-marker')).toHaveCount(3);
  await page.getByRole('button', { name: '取消固定第 2 行', exact: true }).click();
  await expect(manager).toContainText('已固定 2 行');
  await expect(page.locator('tr[data-view-index="1"] .et-row-pin-marker')).toHaveCount(0);
  await page.getByRole('checkbox', { name: '选择固定的第 1 行', exact: true }).check();
  await page.getByRole('checkbox', { name: '选择固定的第 3 行', exact: true }).check();
  await page.getByRole('button', { name: '取消选中固定', exact: true }).click();
  await expect(manager).toBeHidden();
  await expect(page.locator('.et-body-table .et-row-pin-marker')).toHaveCount(0);
  await page.evaluate(() => {
    window.table.pinRow(0);
    window.table.pinRow(2);
  });
  await page.locator('.et-horizontal-scroll').evaluate((horizontal) => {
    horizontal.scrollLeft = 500;
    horizontal.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByRole('button', { name: '取消固定第 1 行', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: '取消全部固定', exact: true }).click();
  expect(await page.evaluate(() => window.table.getPinnedRows())).toEqual([]);
  await expect(page.locator('tr[data-pinned="true"]')).toHaveCount(0);
});

test('行号选择只包含当前逻辑行，支持 Shift 连选与 Ctrl 多选', async ({ page }) => {
  const number = (index: number) =>
    page.locator(`.et-body-table tr[data-view-index="${index}"] .et-row-number`);
  await number(1).click();
  expect(await page.evaluate(() => window.table.getSelection())).toMatchObject({
    mode: 'row',
    ranges: [{ anchor: { row: 1, col: 0 }, focus: { row: 1, col: 12 } }],
    active: { row: 1 },
  });
  const height = await page
    .locator('.et-row-selection')
    .first()
    .evaluate((node) => node.getBoundingClientRect().height);
  // 选框额外覆盖上一行底部的 1px 网格线，数据行本身仍为 38px。
  expect(height).toBe(39);
  await expect(number(1)).toHaveCSS('height', '38px');
  await number(3).click({ modifiers: ['Shift'] });
  expect(await page.evaluate(() => window.table.getSelection().ranges)).toEqual([
    { anchor: { row: 1, col: 0 }, focus: { row: 3, col: 12 } },
  ]);
  await number(6).click({ modifiers: ['Control'] });
  expect(await page.evaluate(() => window.table.getSelection().ranges)).toHaveLength(2);
  await page.evaluate(() =>
    window.table.scrollToRow({ kind: 'record', rowKey: 'r2' }, { select: true }),
  );
  expect(await page.evaluate(() => window.table.getSelection().ranges)).toEqual([
    { anchor: { row: 1, col: 0 }, focus: { row: 1, col: 12 } },
  ]);
});

test('派生行参与连续编号，固定副本沿用原行号且可定位', async ({ page }) => {
  await expect(page.locator('tr[data-view-index="4"]')).toHaveAttribute('data-kind', 'derived');
  await expect(page.locator('tr[data-view-index="4"] .et-row-number')).toHaveText('5');
  await expect(page.locator('tr[data-view-index="5"] .et-row-number')).toHaveText('6');
  await page.locator('tr[data-view-index="4"] .et-row-number').click();
  expect(await page.evaluate(() => window.table.getSelection().active?.row)).toBe(4);
  await page.evaluate(() => window.table.executeCommand('pinRow'));
  await expect(page.locator('tr[data-view-index="4"] .et-row-pin-marker')).toHaveCount(1);
  await page.getByRole('button', { name: '定位到第 5 行', exact: true }).click();
  expect(await page.evaluate(() => window.table.getSelection().ranges[0])).toEqual({
    anchor: { row: 4, col: 0 },
    focus: { row: 4, col: 12 },
  });
  await expect(page.locator('.et-toolbar-status')).toContainText('32 行');
});

test('整行清空与单值粘贴不会改动未完整选中的分类合并区', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [
        { id: 'a', group: '同组', value: '甲' },
        { id: 'b', group: '同组', value: '乙' },
      ],
      config: {
        rowNumbers: true,
        columns: [
          { field: 'group', title: '分类', editable: true },
          { field: 'value', title: '值', editable: true },
        ],
        groups: [{ key: 'group', fields: ['group'], renameFields: ['group'] }],
        merges: { vertical: [{ column: 'group', by: 'group' }] },
      },
    });
  });
  await page.locator('tr[data-view-index="1"] .et-row-number').click();
  await page.evaluate(() => window.customTable.executeCommand('clear'));
  expect(
    await page.evaluate(() =>
      window.customTable.getDataSource().map((row) => [row.group, row.value]),
    ),
  ).toEqual([
    ['同组', '甲'],
    ['同组', ''],
  ]);
  await page.evaluate(() => window.customTable.executeCommand('paste', '更新'));
  expect(
    await page.evaluate(() =>
      window.customTable.getDataSource().map((row) => [row.group, row.value]),
    ),
  ).toEqual([
    ['同组', '甲'],
    ['同组', '更新'],
  ]);
});

test('列宽不足时填满容器，显隐、拖拽宽度与容器变化后头体仍对齐', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    const host = document.querySelector<HTMLElement>('#table')!;
    host.style.width = '750px';
    window.customTable = core.createTable<Row>(host, {
      rowKey: 'id',
      dataSource: [{ id: 'a', a: '甲', b: '乙', c: '丙' }],
      config: {
        rowNumbers: true,
        columns: [
          { field: 'a', title: '甲', width: 80, fixed: 'left' },
          { field: 'b', title: '乙', width: 100 },
          { field: 'c', title: '丙', width: 120, fixed: 'right' },
        ],
      },
    });
  });
  const geometry = async () =>
    page.evaluate(() => {
      const body = document.querySelector<HTMLElement>('.et-body-viewport')!,
        header = document.querySelector<HTMLElement>('.et-head-table')!,
        table = document.querySelector<HTMLElement>('.et-body-table')!;
      return {
        gap: body.clientWidth - table.getBoundingClientRect().width,
        mismatch: Math.abs(
          header.getBoundingClientRect().width - table.getBoundingClientRect().width,
        ),
      };
    });
  await expect.poll(async () => (await geometry()).gap).toBe(0);
  await page.evaluate(() => window.customTable.setColumnWidth('a', 130));
  await expect(page.locator('th[data-field=a]')).toHaveCSS('width', '130px');
  await page.evaluate(() => window.customTable.setHiddenColumns(['b']));
  await expect.poll(async () => (await geometry()).gap).toBe(0);
  await page.locator('#table').evaluate((node) => {
    node.style.width = '1040px';
  });
  await expect.poll(async () => (await geometry()).gap).toBe(0);
  expect((await geometry()).mismatch).toBeLessThanOrEqual(1);
  await page.evaluate(() => {
    window.customTable.setHiddenColumns([]);
    window.customTable.setColumnWidth('b', 1200);
  });
  await expect.poll(async () => (await geometry()).gap).toBeLessThan(0);
});
