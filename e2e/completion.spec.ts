import { test, expect } from '@playwright/test';
import type { Row } from '../packages/core/src/types';

test('Ctrl+Home 跳过不可导航行，动态数字编辑器粘贴先归一化再拦截', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [
        { id: 'r0', special: true, a: '跳过', b: '跳过' },
        { id: 'r1', a: 0, b: '起点' },
      ],
      config: {
        columns: [
          {
            field: 'a',
            title: '数字',
            editable: true,
            editor: () => 'number',
            updateValueBefore: (value) => typeof value === 'number',
          },
          { field: 'b', title: '文本', editable: true },
        ],
        editorOptions: { number: { precision: 1 } },
        rowRules: [
          {
            id: 'special',
            match: { field: 'special', equals: true },
            layout: {
              cells: [
                { column: 'a', field: 'a', behaviors: { navigable: false } },
                { column: 'b', field: 'b', behaviors: { navigable: false } },
              ],
            },
          },
        ],
      },
    });
    window.customTable.setSelection([{ anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } }]);
    window.customTable.focus();
  });
  await page.keyboard.press('Control+Home');
  expect(await page.evaluate(() => window.customTable.getSelection().active)).toEqual({
    row: 1,
    col: 0,
  });
  const result = await page.evaluate(() => window.customTable.executeCommand('paste', '4.25'));
  expect(result.ok).toBe(true);
  expect(await page.evaluate(() => window.customTable.getDataSource()[1]!.a)).toBe(4.3);
  await page.evaluate(() => {
    window.customTable.updateConfig({
      columns: [
        { field: 'a', title: 'a', navigable: false },
        { field: 'b', title: 'b', navigable: false },
      ],
    });
    window.customTable.setSelection([{ anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } }]);
    window.customTable.focus();
  });
  await page.keyboard.press('Control+Home');
  expect(await page.evaluate(() => window.customTable.getSelection().active)).toEqual({
    row: 1,
    col: 1,
  });
});

test('修改布局匹配字段后立即切换布局', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [{ id: '1', mode: 'normal', value: '初始' }],
      config: {
        columns: [
          { field: 'mode', title: '模式', editable: true },
          { field: 'value', title: '内容', editable: true },
        ],
        rowRules: [
          {
            id: 'special',
            match: { field: 'mode', equals: 'special' },
            layout: {
              cells: [
                { range: { from: 'mode' }, content: { parts: ['特殊：', { field: 'value' }] } },
              ],
            },
          },
        ],
      },
    });
    window.customTable.updateFields([{ rowKey: '1', fields: { mode: 'special' } }]);
  });
  await expect(page.locator('.et-body-table td[data-field=mode]')).toHaveAttribute('colspan', '2');
  await expect(page.locator('.et-body-table')).toContainText('特殊：初始');
  // 特殊布局不绑定 mode，进入后该格只读；通过事务历史恢复普通布局。
  await page.evaluate(() => window.customTable.executeCommand('undo'));
  await expect(page.locator('.et-body-table td[data-field=value]')).toHaveCount(1);
});

test('图标工具栏键盘可达，合并格和数据格带有基础无障碍信息', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.table.setSelection([{ anchor: { row: 0, col: 2 }, focus: { row: 0, col: 2 } }]);
    window.table.focus();
  });
  await page.keyboard.press('Alt+F10');
  await expect(page.getByRole('button', { name: '设置主题', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.et-toolbar-menu')).toBeVisible();
  await expect(page.locator('.et-editor')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('grid', { name: '可编辑表格' })).toBeFocused();
  const grid = page.getByRole('grid', { name: '可编辑表格' });
  await expect(grid).toHaveAttribute('aria-colcount', '13');
  await expect(page.locator('.et-merged-cell').first()).toHaveAttribute('aria-rowspan', /[2-9]\d*/);
  const labels = await page
    .locator('.et-toolbar button')
    .evaluateAll((nodes) =>
      nodes.every((node) => Boolean(node.getAttribute('aria-label') || node.textContent?.trim())),
    );
  expect(labels).toBe(true);
});

test('十万行自动高度反复抽样滚动保持锚点与 DOM 上限', async ({ page }) => {
  await page.goto('/');
  const samples = await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: Array.from({ length: 100000 }, (_, index) => ({
        id: String(index),
        value: index % 5 ? `记录 ${index}` : `长文本 ${index}，自动换行。`.repeat(12),
      })),
      config: {
        rowHeight: 'auto',
        virtualization: { threshold: 200, overscan: 8 },
        columns: [
          {
            field: 'value',
            title: '自动高度',
            width: 260,
            editable: true,
            cellStyle: { whiteSpace: 'normal' },
          },
        ],
      },
    });
    const body = document.querySelector<HTMLElement>('.et-body-viewport')!;
    const result: { count: number; drift: number }[] = [];
    for (let index = 1; index <= 30; index++) {
      body.scrollTop = index % 2 ? index * 80000 : index * 12000;
      body.dispatchEvent(new Event('scroll'));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const visible = [...body.querySelectorAll<HTMLElement>('tr[data-kind=record]')].find(
        (row) => {
          const bounds = row.getBoundingClientRect(),
            top = body.getBoundingClientRect().top;
          return bounds.top <= top + 5 && bounds.bottom > top + 5;
        },
      );
      if (!visible) throw new Error('自动行高窗口出现空白');
      const before = visible.getBoundingClientRect().top;
      body.dispatchEvent(new Event('scroll'));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      result.push({
        count: body.querySelectorAll('tr[data-kind=record]').length,
        drift: Math.abs(visible.getBoundingClientRect().top - before),
      });
    }
    return result;
  });
  expect(samples).toHaveLength(30);
  for (const sample of samples) {
    expect(sample.count).toBeLessThan(100);
    expect(sample.drift).toBeLessThanOrEqual(1);
  }
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.et-body-table');
});

test('相邻多选区剪切全部复制，非矩形剪切拒绝且不清数据', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const col = 2;
    const ranges = (cells: [number, number][]): import('../packages/core/src/types').CellRange[] =>
      cells.map(([row, col]) => ({ anchor: { row, col }, focus: { row, col } }));
    function cut(): DataTransfer {
      const data = new DataTransfer(),
        event = new Event('cut', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: data });
      document.querySelector('.edit-table')!.dispatchEvent(event);
      return data;
    }
    window.table.setSelection(
      ranges([
        [0, col],
        [1, col + 1],
      ]),
    );
    const rejected = cut().getData('text/plain');
    const before = window.table
      .getDataSource()
      .slice(0, 2)
      .map((row) => row.requirement);
    window.table.setSelection(
      ranges([
        [0, col],
        [1, col],
      ]),
    );
    const copied = cut().getData('text/plain');
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    return {
      rejected,
      before,
      copied,
      after: window.table
        .getDataSource()
        .slice(0, 2)
        .map((row) => row.requirement),
    };
  });
  expect(result.rejected).toBe('');
  expect(result.before).toEqual(['主会场半天', '分会场讨论室']);
  expect(result.copied).toBe('主会场半天\n分会场讨论室');
  expect(result.after).toEqual(['', '']);
});

test('剪切不清空禁止复制的单元格', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [{ id: '1', a: '可复制', b: '不能复制' }],
      config: {
        columns: [
          { field: 'a', title: 'a', editable: true },
          { field: 'b', title: 'b', editable: true, copyable: false },
        ],
      },
    });
    window.customTable.setSelection([{ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 1 } }]);
    const data = new DataTransfer(),
      event = new Event('cut', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    document.querySelector('.edit-table')!.dispatchEvent(event);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    return { copied: data.getData('text/plain'), row: window.customTable.getDataSource()[0] };
  });
  expect(result.copied).toBe('可复制\t');
  expect(result.row).toMatchObject({ a: '', b: '不能复制' });
});

test('布局行为控制导航、整列选择和粘贴起点', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [
        { id: '1', special: true, a: 'A', b: 'B', c: 'C' },
        { id: '2', a: 'D', b: 'E', c: 'F' },
      ],
      config: {
        columns: ['a', 'b', 'c'].map((field) => ({ field, title: field, editable: true })),
        rowRules: [
          {
            id: 'special',
            match: { field: 'special', equals: true },
            layout: {
              cells: [
                { column: 'a', field: 'a' },
                {
                  column: 'b',
                  field: 'b',
                  behaviors: { navigable: false, columnSelectable: false, pasteTarget: false },
                },
                { column: 'c', field: 'c' },
              ],
            },
          },
        ],
      },
    });
    window.customTable.setSelection([{ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }]);
    window.customTable.focus();
  });
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.customTable.getSelection().active?.col)).toBe(2);
  await page.locator('th[data-field=b]').click();
  expect(await page.evaluate(() => window.customTable.getSelection().ranges)).toEqual([
    { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } },
  ]);
  const result = await page.evaluate(async () => {
    window.customTable.setSelection([{ anchor: { row: 0, col: 1 }, focus: { row: 0, col: 1 } }]);
    return await window.customTable.executeCommand('paste', '禁止');
  });
  expect(result).toMatchObject({ ok: false, code: 'readonly' });
});

test('全局 number 参数参与提交检查', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [{ id: '1', value: 2 }],
      config: {
        columns: [{ field: 'value', title: '数字', editable: true, editor: 'number' }],
        editorOptions: { number: { min: 1, max: 5, precision: 1 } },
      },
    });
  });
  await page.locator('.et-body-table [data-field=value]').dblclick();
  const input = page.getByRole('textbox', { name: '编辑数字' });
  await input.fill('8');
  await input.press('Enter');
  await expect(page.locator('.et-editor-error')).toContainText('数值不能大于 5');
  await input.fill('3.14');
  await input.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.customTable.getDataSource()[0]!.value))
    .toBe(3.1);
});

test('日期格式与日历键盘导航', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [{ id: '1', value: '31/01/2024' }],
      config: {
        columns: [{ field: 'value', title: '日期', editable: true, editor: 'date' }],
        editorOptions: { date: { format: 'DD/MM/YYYY' } },
      },
    });
  });
  await page.locator('.et-body-table [data-field=value]').dblclick();
  await page.getByRole('textbox', { name: '编辑日期' }).press('PageDown');
  await expect(page.getByRole('button', { name: '29/02/2024', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.customTable.getDataSource()[0]!.value))
    .toBe('29/02/2024');
});

test('级联选项支持键盘进入与返回', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [{ id: '1', value: '' }],
      config: {
        columns: [
          {
            field: 'value',
            title: '城市',
            editable: true,
            editor: 'cascader',
            options: [
              {
                label: '浙江',
                value: 'zj',
                children: [
                  { label: '杭州', value: 'hz' },
                  { label: '宁波', value: 'nb' },
                ],
              },
            ],
          },
        ],
      },
    });
  });
  await page.locator('.et-body-table [data-field=value]').dblclick();
  await expect(page.getByRole('option', { name: '浙江 ›' })).toBeVisible();
  const input = page.getByRole('textbox', { name: '编辑城市' });
  await input.press('ArrowRight');
  await expect(page.getByRole('option', { name: '杭州' })).toBeVisible();
  await input.press('ArrowLeft');
  await expect(page.getByRole('option', { name: '浙江 ›' })).toBeVisible();
  await input.press('ArrowRight');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.customTable.getDataSource()[0]!.value))
    .toEqual(['zj', 'nb']);
});

test('校验 pending 与错误悬浮提示', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [{ id: '1', value: '' }],
      config: {
        columns: [
          {
            field: 'value',
            title: '名称',
            editable: true,
            rules: [
              {
                asyncValidator: async (): Promise<void> => {
                  try {
                    await new Promise<void>((resolve) => setTimeout(resolve, 300));
                    throw new Error('请补充名称');
                  } catch (error) {
                    throw new Error(error instanceof Error ? error.message : String(error));
                  }
                },
              },
            ],
          },
        ],
      },
    });
    void window.customTable.validate();
  });
  const cell = page.locator('.et-body-table [data-field=value]');
  await expect(cell).toHaveAttribute('aria-busy', 'true');
  await expect(cell).toHaveAttribute('aria-invalid', 'true');
  await expect(cell).toHaveAttribute('aria-busy', 'false');
  await cell.hover();
  await expect(page.getByRole('tooltip')).toContainText('请补充名称');
});

test('固定对比行复用外观，并可通过菜单取消固定', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [{ id: '1', value: '内容' }],
      config: {
        rowPinning: true,
        columns: [
          {
            field: 'value',
            title: '内容',
            align: 'right',
            cellClassName: 'custom-style',
            cellStyle: { color: 'rgb(255, 0, 0)' },
          },
        ],
      },
    });
    window.customTable.pinRow(0);
  });
  const pin = page.locator('.et-pinned-cell');
  await expect(pin).toHaveCSS('text-align', 'right');
  await expect(pin).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(pin).toHaveClass(/custom-style/);
  await page.locator('.et-body-table [data-field=value]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: '⌖  取消固定对比行' }).click();
  await expect(pin).toHaveCount(0);
  expect(
    await page.evaluate(() => Object.keys(window.customTable.getPinnedRows()[0] ?? {})),
  ).toEqual([]);
});

test('自定义操作 end 位置插入到末尾，删除失败显示自定义原因', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [
        { id: '1', value: '第一行' },
        { id: '2', value: '第二行' },
      ],
      config: {
        columns: [{ field: 'value', title: '内容' }],
        operations: {
          actions: [
            {
              key: 'end',
              label: '追加到末尾',
              kind: 'add',
              position: 'end',
              rowDefaults: { value: '末尾' },
            },
            {
              key: 'remove',
              label: '受限删除',
              kind: 'remove',
              minRemaining: 3,
              message: '至少保留三行',
            },
          ],
        },
      },
    });
  });
  const first = page.locator('.et-body-table [data-field=value]').first();
  await first.click({ button: 'right' });
  await page.getByRole('button', { name: '追加到末尾' }).click();
  await expect
    .poll(() => page.evaluate(() => window.customTable.getDataSource().map((row) => row.value)))
    .toEqual(['第一行', '第二行', '末尾']);
  await first.click({ button: 'right' });
  await page.getByRole('button', { name: '受限删除' }).click();
  await expect(page.locator('.et-data-state')).toContainText('至少保留三行');
});
