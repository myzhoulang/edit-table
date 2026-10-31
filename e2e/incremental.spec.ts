import { test, expect } from '@playwright/test';
import type { Row } from '../packages/core/src/types';

test('自动行高中在视口上方增删行保持原记录位置并复用表头', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: Array.from({ length: 10000 }, (_, index) => ({
        id: `r${index}`,
        name: `记录 ${index}`,
        value: index % 5 === 0 ? '自动换行内容。'.repeat(15) : '短内容',
      })),
      config: {
        rowNumbers: true,
        rowHeight: 'auto',
        columns: [
          { field: 'name', title: '名称', width: 140, editable: true },
          {
            field: 'value',
            title: '内容',
            width: 220,
            editable: true,
            cellStyle: { whiteSpace: 'normal' },
          },
        ],
      },
    });
    window.customTable.scrollToRow({ kind: 'record', rowKey: 'r7000' });
  });
  const row = page.getByText('记录 7000', { exact: true });
  await expect(row).toBeVisible();
  const result = await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const header = document.querySelector('th[data-field=name]'),
      cell = [...document.querySelectorAll<HTMLElement>('.et-cell-content')].find(
        (node) => node.textContent === '记录 7000',
      )!;
    const before = cell.getBoundingClientRect().top;
    await window.customTable.executeCommand('insertRowAbove', {
      rowKeys: ['r10'],
      rowDefaults: { name: '新增记录', value: '新内容' },
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const added = window.customTable.getDataSource().find((row) => row.name === '新增记录');
    const position = (): number =>
      [...document.querySelectorAll<HTMLElement>('.et-cell-content')]
        .find((node) => node.textContent === '记录 7000')!
        .getBoundingClientRect().top;
    const afterInsert = position();
    await window.customTable.executeCommand('deleteRows', { rowKeys: [String(added?.id)] });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return {
      headerReused: header === document.querySelector('th[data-field=name]'),
      insertDrift: Math.abs(afterInsert - before),
      deleteDrift: Math.abs(position() - before),
      domRows: document.querySelectorAll('.et-body-table tr[data-kind=record]').length,
    };
  });
  expect(result.headerReused).toBe(true);
  expect(result.insertDrift).toBeLessThanOrEqual(1);
  expect(result.deleteDrift).toBeLessThanOrEqual(1);
  expect(result.domRows).toBeLessThan(100);
});

test('增删行更新布局占位和依赖源下标的样式', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [
        { id: 'r0', special: true, name: '原特殊行', value: '原值' },
        { id: 'r1', name: '普通行', value: '值' },
      ],
      config: {
        columns: [
          { field: 'name', title: '名称', editable: true },
          {
            field: 'value',
            title: '值',
            editable: true,
            cellStyle: ({ rowIndex }) => ({
              color: rowIndex % 2 ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)',
            }),
          },
        ],
        rowRules: [
          {
            id: 'special',
            match: { field: 'special', equals: true },
            layout: {
              cells: [
                {
                  range: { from: 'name' },
                  content: { parts: ['特殊行'] },
                  cellStyle: { color: 'rgb(0, 128, 0)' },
                },
              ],
            },
          },
        ],
      },
    });
    await window.customTable.executeCommand('insertRowAbove', {
      rowKeys: ['r0'],
      rowDefaults: { name: '新增', value: '新值' },
    });
  });
  const records = page.locator('.et-body-table tr[data-kind=record]');
  await expect(records.nth(0).locator('[data-field=value]')).toHaveCSS('color', 'rgb(0, 0, 255)');
  await expect(records.nth(1).locator('[data-field=name]')).toHaveAttribute('colspan', '2');
  await expect(records.nth(2).locator('[data-field=value]')).toHaveCSS('color', 'rgb(0, 0, 255)');
  await page.evaluate(() => window.customTable.executeCommand('undo'));
  await expect(records.nth(0).locator('[data-field=name]')).toHaveAttribute('colspan', '2');
  await expect(records.nth(1).locator('[data-field=value]')).toHaveCSS('color', 'rgb(255, 0, 0)');
});
