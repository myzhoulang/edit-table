import { test, expect } from '@playwright/test';
import type { TableInstance, Row } from '../packages/core/src/types';
declare global {
  interface Window {
    customTable: TableInstance<Row>;
  }
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.et-body-table');
});
test('密度与主题切换保留编辑草稿', async ({ page }) => {
  await page
    .locator('.et-body-table tr[data-kind=record]')
    .first()
    .locator('[data-field=requirement]')
    .dblclick();
  const input = page.getByRole('textbox', { name: '编辑需求' });
  await input.fill('未提交草稿');
  await page.getByRole('button', { name: '设置密度', exact: true }).click();
  await page.getByRole('button', { name: '紧凑密度', exact: false }).click();
  await expect(input).toHaveValue('未提交草稿');
  expect(await page.evaluate(() => window.table.getDataSource()[0]!.requirement)).toBe(
    '主会场半天',
  );
  await input.press('Escape');
});
test('派生输入完整管线、零值、一次撤销', async ({ page }) => {
  await page.evaluate(async () => {
    const corePath = '/packages/core/src/index.ts',
      dataPath = '/examples/minimal.ts';
    const core: typeof import('../packages/core/src/index') = await import(corePath),
      data: typeof import('../examples/minimal') = await import(dataPath);
    window.table.destroy();
    const host = document.querySelector<HTMLElement>('#table')!;
    const table = core.createTable(host, {
      config: data.createMinimalConfig(),
      dataSource: data.rows,
      rowKey: 'id',
    });
    Reflect.set(window, 'customTable', table);
  });
  await page.locator('.et-derived-row').nth(1).locator('[data-field=total]').dblclick();
  const input = page.getByRole('textbox', { name: '编辑金额' });
  await input.fill('180');
  await input.press('Enter');
  expect(await page.evaluate(() => window.customTable.getSummary().payable)).toBe(180);
  await page.evaluate(() => window.customTable.executeCommand('undo'));
  expect(await page.evaluate(() => window.customTable.getDerivedValues())).toEqual([]);
  await page.locator('.et-derived-row').nth(1).locator('[data-field=total]').dblclick();
  await input.fill('-1');
  await input.press('Enter');
  await expect(page.locator('.et-editor-error')).toContainText('优惠价不能为负数');
  expect(await page.evaluate(() => window.customTable.getSummary().payable)).toBe(250);
});
test('异步候选晚到结果与旧错误不覆盖新搜索', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    const host = document.querySelector<HTMLElement>('#table')!;
    window.customTable = core.createTable<Row>(host, {
      dataSource: [{ id: '1', value: 'initial' }],
      rowKey: 'id',
      config: {
        columns: [
          {
            field: 'value',
            title: '候选',
            editable: true,
            editor: 'select',
            options: async (_row, search) => {
              try {
                await new Promise<void>((resolve) =>
                  setTimeout(resolve, search === '旧' ? 180 : 15),
                );
                if (search === '旧') throw new Error('过期错误');
                return [{ label: `${search || '初始'}选项`, value: search || 'initial' }];
              } catch (error) {
                throw new Error('测试异步流程失败', { cause: error });
              }
            },
          },
        ],
      },
    });
  });
  await page.locator('.et-body-table [data-field=value]').dblclick();
  const input = page.getByRole('textbox', { name: '编辑候选' });
  await input.fill('旧');
  await input.fill('新');
  await expect(page.getByRole('option', { name: '新选项' })).toBeVisible();
  await page.waitForTimeout(240);
  await expect(page.getByRole('option', { name: '新选项' })).toBeVisible();
  await expect(page.locator('.et-editor-dropdown')).not.toContainText('过期错误');
});
test('手动合并预览、确认与拆分历史', async ({ page }) => {
  await page.evaluate(() => {
    const col = 12;
    window.table.setSelection([{ anchor: { row: 0, col }, focus: { row: 1, col } }]);
  });
  await page.getByRole('button', { name: '合并单元格', exact: true }).click();
  await expect(page.locator('.et-merge-preview')).toContainText('原始值保留');
  await page.getByRole('button', { name: '确认合并', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.table.getCommandState('undo').enabled))
    .toBe(true);
  expect(await page.evaluate(() => window.table.getDataSource()[0]!.remark)).toBe('请提前布置桌椅');
  await page.evaluate(() => window.table.executeCommand('undo'));
});
test('异步写入检查旧结果被外部换数丢弃', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      dataSource: [{ id: '1', value: '初始' }],
      rowKey: 'id',
      config: {
        columns: [
          {
            field: 'value',
            title: '名称',
            editable: true,
            updateValueBefore: async () => {
              try {
                await new Promise<void>((resolve) => setTimeout(resolve, 160));
                return true;
              } catch (error) {
                throw new Error('测试异步流程失败', { cause: error });
              }
            },
          },
        ],
      },
    });
  });
  await page.locator('.et-body-table [data-field=value]').dblclick();
  await page.getByRole('textbox', { name: '编辑名称' }).fill('旧编辑');
  await page.getByRole('textbox', { name: '编辑名称' }).press('Enter');
  await page.evaluate(() => window.customTable.setDataSource([{ id: '1', value: '外部新值' }]));
  await page.waitForTimeout(220);
  expect(await page.evaluate(() => window.customTable.getDataSource()[0]!.value)).toBe('外部新值');
});

test('动态配置更新同步列设置、列宽与工具栏', async ({ page }) => {
  const accepted = await page.evaluate(async () => {
    const path = '/examples/quotation/config.ts';
    const data: typeof import('../examples/quotation/config') = await import(path);
    window.table.pinRow(0);
    window.table.setColumnWidth('qty', 210);
    const config = data.createQuotationConfig();
    config.rowPinning = false;
    config.columns.find((column) => column.field === 'qty')!.width = 166;
    config.columns.push({ field: 'extra', title: '新增列', width: 100 });
    return window.table.updateConfig(config);
  });
  expect(accepted).toBe(true);
  expect(await page.evaluate(() => window.table.getPinnedRows().length)).toBe(0);
  await expect(page.getByRole('button', { name: '固定当前行为对比行', exact: true })).toHaveCount(
    0,
  );
  expect(
    await page
      .locator('.et-head-table th[data-field=qty]')
      .evaluate((node) => node.getBoundingClientRect().width),
  ).toBe(166);
  await page.getByRole('button', { name: '设置显示列', exact: true }).click();
  await expect(page.locator('.et-toolbar-menu')).toContainText('新增列');
});

test('Ctrl 方向键先到连续区块边缘，再跳过空白', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      dataSource: [{ id: '1', a: 'A', b: 'B', c: '', d: 'D' }],
      rowKey: 'id',
      config: {
        columns: ['a', 'b', 'c', 'd'].map((field) => ({ field, title: field, editable: true })),
      },
    });
    window.customTable.setSelection([{ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }]);
    window.customTable.focus();
  });
  await page.keyboard.press('Control+ArrowRight');
  expect(await page.evaluate(() => window.customTable.getSelection().active)).toEqual({
    row: 0,
    col: 1,
  });
  await page.keyboard.press('Control+ArrowRight');
  expect(await page.evaluate(() => window.customTable.getSelection().active)).toEqual({
    row: 0,
    col: 3,
  });
});

test('自动行高测量与坐标导航', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: [
        { id: '1', text: '需要自动换行的长文本。'.repeat(20) },
        { id: '2', text: '第二行' },
      ],
      config: {
        rowHeight: 'auto',
        columns: [
          {
            field: 'text',
            title: '文本',
            width: 160,
            editable: true,
            cellStyle: { whiteSpace: 'normal' },
          },
        ],
      },
    });
  });
  const row = page.locator('.et-body-table tr[data-kind=record]').first();
  await expect
    .poll(() => row.evaluate((node) => node.getBoundingClientRect().height))
    .toBeGreaterThan(38);
  await page.evaluate(() => {
    window.customTable.setSelection([{ anchor: { row: 1, col: 0 }, focus: { row: 1, col: 0 } }]);
    window.customTable.focus();
  });
  await page.keyboard.press('F2');
  await expect(page.getByRole('textbox', { name: '编辑文本' })).toHaveValue('第二行');
});

test('虚拟滚动复用单元格节点并清除旧内容', async ({ page }) => {
  const result = await page.evaluate(() => {
    window.createDemo(10000);
    const body = document.querySelector<HTMLElement>('.et-body-viewport');
    const first = body?.querySelector<HTMLElement>(
      'tr[data-kind=record] td[data-field=requirement]',
    );
    if (!body || !first) throw new Error('测试窗口不存在');
    const oldText = first.textContent;
    body.scrollTop = 180000;
    body.dispatchEvent(new Event('scroll'));
    return {
      connected: first.isConnected,
      oldText,
      newText: first.textContent,
      rowCount: body.querySelectorAll('tr[data-kind=record]').length,
    };
  });
  expect(result.connected).toBe(true);
  expect(result.newText).not.toBe(result.oldText);
  expect(result.rowCount).toBeLessThan(100);
});

test('连续滚动不移除仍在窗口内的行', async ({ page }) => {
  const result = await page.evaluate(() => {
    window.createDemo(10000);
    const body = document.querySelector<HTMLElement>('.et-body-viewport');
    const tbody = body?.querySelector('tbody');
    const row = tbody?.querySelector('tr[data-view-index="10"]');
    if (!body || !tbody || !row) throw new Error('窗口交集测试行不存在');
    const observer = new MutationObserver(() => undefined);
    observer.observe(tbody, { childList: true });
    body.scrollTop = 600;
    body.dispatchEvent(new Event('scroll'));
    const removed = observer.takeRecords().some((record) => [...record.removedNodes].includes(row));
    observer.disconnect();
    return { removed, connected: row.isConnected };
  });
  expect(result).toEqual({ removed: false, connected: true });
});

test('合并格文字固定在完整单元格中央随正文滚动，节点复用且固定列对齐', async ({ page }) => {
  const result = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.et-body-viewport'),
      layer = document.querySelector<HTMLElement>('.et-merge-layer'),
      category = layer?.querySelector<HTMLElement>('[data-field=categoryName]'),
      project = layer?.querySelector<HTMLElement>('[data-field=projectName]');
    if (!body || !layer || !category || !project) throw new Error('合并滚动测试节点不存在');
    const retained = [category, project, ...layer.querySelectorAll('.et-layer-segment')],
      contents = [category.firstElementChild, project.firstElementChild],
      texts = contents.map((content) => content?.firstChild),
      observer = new MutationObserver(() => undefined);
    let centerError = 0,
      fixedDrift = 0,
      scrollCorrection = 0,
      removed = false;
    observer.observe(layer, { childList: true, subtree: true });
    for (const [top, left] of [
      [5, 0],
      [17, 0],
      [39, 0],
      [80, 200],
      [40, 360],
      [0, 0],
    ] satisfies [number, number][]) {
      body.scrollTop = top;
      document.querySelector<HTMLElement>('.et-horizontal-scroll')!.scrollLeft = left;
      const beforeScrollHandler = [category, project].map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node.firstElementChild!);
        return range.getBoundingClientRect().top;
      });
      body.dispatchEvent(new Event('scroll'));
      const bounds = body.getBoundingClientRect();
      fixedDrift = Math.max(
        fixedDrift,
        Math.abs(category.getBoundingClientRect().left - bounds.left - 54),
      );
      for (const [index, node] of [category, project].entries()) {
        const rect = node.getBoundingClientRect(),
          content = node.firstElementChild!.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node.firstElementChild!);
        scrollCorrection = Math.max(
          scrollCorrection,
          Math.abs(range.getBoundingClientRect().top - beforeScrollHandler[index]!),
        );
        centerError = Math.max(
          centerError,
          Math.abs(content.top + content.height / 2 - (rect.top + rect.bottom) / 2),
        );
      }
      removed ||= observer
        .takeRecords()
        .some((record) =>
          [...record.removedNodes].some((node) => retained.some((item) => node.contains(item))),
        );
    }
    observer.disconnect();
    return {
      removed,
      retained: retained.every((node) => node.isConnected),
      sameContents: contents.every(
        (content, index) =>
          content?.isConnected &&
          [category, project][index]?.firstElementChild === content &&
          content.firstChild === texts[index],
      ),
      centerError,
      fixedDrift,
      scrollCorrection,
    };
  });
  expect(result).toMatchObject({ removed: false, retained: true, sameContents: true });
  expect(result.centerError).toBeLessThanOrEqual(1);
  expect(result.fixedDrift).toBeLessThanOrEqual(1);
  expect(result.scrollCorrection).toBeLessThanOrEqual(0.01);
});

test('虚拟合并格复用时同步内容、样式及校验状态，离窗和取消合并后回收', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    window.customTable = core.createTable<Row>(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      dataSource: Array.from({ length: 2000 }, (_, index) => ({
        id: `r${index}`,
        groupId: `g${Math.floor(index / 50)}`,
        group: `分组 ${Math.floor(index / 50)}`,
        name: `明细 ${index}`,
      })),
      config: {
        rowNumbers: true,
        virtualization: { threshold: 20, overscan: 4 },
        columns: [
          {
            field: 'group',
            title: '分类',
            width: 100,
            fixed: 'left',
            editable: true,
            rules: [{ required: true, message: '请输入分类' }],
            cellStyle: ({ row }) =>
              row.group === '分组 0' ? { color: 'rgb(255, 0, 0)' } : undefined,
            cellClassName: ({ row }) => (row.group === '分组 0' ? 'scroll-highlight' : undefined),
          },
          { field: 'name', title: '明细', width: 1600 },
        ],
        groups: [{ key: 'group', fields: ['group'], idField: 'groupId', renameFields: ['group'] }],
        merges: { vertical: [{ column: 'group', by: 'group' }] },
      },
    });
  });
  const merged = page.locator('.et-merged-cell').first();
  await expect(merged).toHaveClass(/scroll-highlight/);
  await expect(merged).toHaveCSS('color', 'rgb(255, 0, 0)');
  const result = await page.evaluate(async () => {
    const body = document.querySelector<HTMLElement>('.et-body-viewport')!,
      layer = document.querySelector<HTMLElement>('.et-merge-layer')!,
      original = layer.querySelector<HTMLElement>('.et-merged-cell')!;
    function updateGroup(group: string): void {
      const result = window.customTable.updateFields(
        Array.from({ length: 50 }, (_, index) => ({ rowKey: `r${index}`, fields: { group } })),
      );
      if (!result.ok) throw new Error(result.message ?? '更新合并组失败');
    }
    updateGroup('更新分类');
    const reused = layer.querySelector('.et-merged-cell') === original,
      updated = original.textContent === '更新分类',
      clearedAppearance =
        !original.classList.contains('scroll-highlight') && original.style.color === '';
    updateGroup('');
    await window.customTable.validate();
    const invalid =
      original.getAttribute('aria-invalid') === 'true' && original.title === '请输入分类';
    updateGroup('恢复分类');
    await window.customTable.validate();
    const valid = !original.hasAttribute('aria-invalid') && !original.hasAttribute('title');
    body.scrollTop = 760;
    body.dispatchEvent(new Event('scroll'));
    const anchorOutsideWindow =
      !body.querySelector('tr[data-view-index="0"]') && original.isConnected;
    body.scrollTop = 38000;
    body.dispatchEvent(new Event('scroll'));
    const recycled = !original.isConnected,
      mergedCount = layer.querySelectorAll('.et-merged-cell').length,
      rowCount = body.querySelectorAll('tr[data-kind=record]').length;
    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    const restored = layer.querySelector('.et-merged-cell')?.textContent === '恢复分类';
    window.customTable.updateConfig({
      columns: [
        { field: 'group', title: '分类' },
        { field: 'name', title: '明细' },
      ],
    });
    return {
      reused,
      updated,
      clearedAppearance,
      invalid,
      valid,
      anchorOutsideWindow,
      recycled,
      mergedCount,
      rowCount,
      restored,
      empty: layer.childNodes.length === 0,
    };
  });
  expect(result).toMatchObject({
    reused: true,
    updated: true,
    clearedAppearance: true,
    invalid: true,
    valid: true,
    anchorOutsideWindow: true,
    recycled: true,
    restored: true,
    empty: true,
  });
  expect(result.mergedCount).toBeGreaterThan(0);
  expect(result.mergedCount).toBeLessThan(5);
  expect(result.rowCount).toBeLessThan(100);
});

test('校验错误提示优先于业务批注', async ({ page }) => {
  await page.evaluate(async () => {
    window.table.updateFields([{ rowKey: 'r1', fields: { requirement: '' } }]);
    await window.table.validate();
  });
  const cell = page
    .locator('.et-body-table tr[data-kind=record]')
    .first()
    .locator('[data-field=requirement]');
  await expect(cell).toHaveAttribute('aria-invalid', 'true');
  await expect(cell).toHaveAttribute('title', '请填写需求名称');
});
