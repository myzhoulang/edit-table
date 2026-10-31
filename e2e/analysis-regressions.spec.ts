import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CreateTableOptions, Row } from '../packages/core/src/types';

async function mount(page: Page, options: CreateTableOptions<Row>): Promise<void> {
  try {
    await page.goto('/');
    await page.evaluate(async (serialized: string) => {
      const options: CreateTableOptions<Row> = JSON.parse(serialized);
      const path = '/packages/core/src/index.ts';
      const core: typeof import('../packages/core/src/index') = await import(path);
      window.table.destroy();
      document.body.innerHTML =
        '<div id="regression-host" style="width:700px;margin:80px 30px"></div><button id="outside">外部按钮</button>';
      window.customTable = core.createTable<Row>(
        document.getElementById('regression-host')!,
        options,
      );
    }, JSON.stringify(options));
    await expect(page.locator('.et-body-table')).toBeVisible();
  } catch (error) {
    throw new Error('回归案例初始化失败', { cause: error });
  }
}

test('校验失败后外部点击保留活动格，修正后从原格导航', async ({ page }) => {
  await mount(page, {
    rowKey: 'id',
    height: 240,
    dataSource: Array.from({ length: 6 }, (_, i) => ({ id: String(i), a: '文本', v: i })),
    config: {
      columns: [
        { field: 'a', title: '甲', editable: true },
        { field: 'v', title: '数字', editor: 'number', valueType: 'number', editable: true },
      ],
    },
  });
  await page.evaluate(() => {
    window.customTable.setSelection([{ anchor: { row: 3, col: 1 }, focus: { row: 3, col: 1 } }]);
    window.customTable.focus();
  });
  await page.keyboard.press('F2');
  const input = page.locator('.et-editor-input');
  await input.fill('abc');
  await page.locator('#outside').click();
  await expect(page.locator('.et-editor-error')).toBeVisible();
  expect(await page.evaluate(() => window.customTable.getSelection().active)).toEqual({
    row: 3,
    col: 1,
  });
  await input.fill('9');
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  expect(await page.evaluate(() => window.customTable.getSelection().active)).toEqual({
    row: 4,
    col: 1,
  });
});

test('合并分类的冲突粘贴拒绝整个事务，同值填充仍可整组重命名', async ({ page }) => {
  await mount(page, {
    rowKey: 'id',
    height: 180,
    dataSource: ['a', 'b', 'c'].map((id) => ({ id, g: '原分类' })),
    config: {
      columns: [{ field: 'g', title: '分类', editable: true }],
      groups: [{ key: 'g', fields: ['g'], renameFields: ['g'] }],
      merges: { vertical: [{ column: 'g', by: 'g' }] },
    },
  });
  await page.evaluate(() =>
    window.customTable.setSelection([{ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }]),
  );
  expect(
    (await page.evaluate(() => window.customTable.executeCommand('paste', '分类A\n分类B\n分类C')))
      .code,
  ).toBe('conflicting-values');
  expect(await page.evaluate(() => window.customTable.getDataSource().map((row) => row.g))).toEqual(
    ['原分类', '原分类', '原分类'],
  );
  expect((await page.evaluate(() => window.customTable.executeCommand('paste', '新分类'))).ok).toBe(
    true,
  );
  expect(await page.evaluate(() => window.customTable.getDataSource().map((row) => row.g))).toEqual(
    ['新分类', '新分类', '新分类'],
  );
});

test('带平移和缩放的祖先内编辑框对齐，外层滚动后跟随单元格', async ({ page }) => {
  await mount(page, {
    rowKey: 'id',
    height: 180,
    dataSource: [{ id: 'a', v: '内容' }],
    config: { columns: [{ field: 'v', title: '值', editable: true }] },
  });
  await page.evaluate(() => {
    const host = document.getElementById('regression-host')!;
    host.style.transform = 'translateX(80px) scale(0.9)';
    host.style.transformOrigin = 'top left';
    host.style.marginTop = '400px';
    document.body.style.height = '2200px';
    window.customTable.setSelection([{ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }]);
    window.customTable.focus();
  });
  await page.keyboard.press('F2');
  const aligned = async (): Promise<number> => {
    try {
      return await page.evaluate(() => {
        const editor = document.querySelector('.et-editor')!.getBoundingClientRect(),
          cell = document.querySelector('td[data-field="v"]')!.getBoundingClientRect();
        return Math.max(
          Math.abs(editor.left - cell.left),
          Math.abs(editor.top - cell.top),
          Math.abs(editor.width - cell.width),
        );
      });
    } catch (error) {
      throw new Error('读取编辑框位置失败', { cause: error });
    }
  };
  await expect.poll(aligned).toBeLessThan(3);
  await page.evaluate(() => window.scrollTo(0, 100));
  await expect.poll(aligned).toBeLessThan(3);
});

test('合并格仍部分可见时保持编辑，完全横向移出时提交关闭', async ({ page }) => {
  await mount(page, {
    rowKey: 'id',
    height: 180,
    dataSource: Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      g: i < 10 ? 'A' : 'B',
      v: i,
    })),
    config: {
      columns: [
        { field: 'g', title: '组', editable: true, width: 200 },
        { field: 'v', title: '值', width: 1200 },
      ],
      groups: [{ key: 'g', fields: ['g'], renameFields: ['g'] }],
      merges: { vertical: [{ column: 'g', by: 'g' }] },
    },
  });
  await page.evaluate(() => {
    window.customTable.setSelection([{ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }]);
    window.customTable.focus();
  });
  await page.keyboard.press('F2');
  await page.locator('.et-body-viewport').evaluate((body) => {
    body.scrollTop = 55;
    body.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('.et-editor')).toBeVisible();
  await page.locator('.et-horizontal-scroll').evaluate((scroll) => {
    scroll.scrollLeft = 600;
    scroll.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('.et-editor')).toHaveCount(0);
});

test('无行号时逐行固定按钮留在管理区，不随横向滚动消失', async ({ page }) => {
  await mount(page, {
    rowKey: 'id',
    height: 180,
    dataSource: [{ id: 'a', v: '内容', x: '其他' }],
    config: {
      rowNumbers: false,
      rowPinning: true,
      columns: [
        { field: 'v', title: '值', width: 200 },
        { field: 'x', title: '其他', width: 1200 },
      ],
    },
  });
  await page.evaluate(() => window.customTable.pinRow(0));
  await page.locator('.et-horizontal-scroll').evaluate((scroll) => {
    scroll.scrollLeft = 600;
    scroll.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByRole('button', { name: '定位到第 1 行', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: '取消固定第 1 行', exact: true }).click();
  expect(await page.evaluate(() => window.customTable.getPinnedRows())).toEqual([]);
});

test('多选数组经原生复制和粘贴保持结构', async ({ page }) => {
  await mount(page, {
    rowKey: 'id',
    height: 180,
    dataSource: [
      { id: 'a', v: ['a,b', 'c'] },
      { id: 'b', v: [] },
    ],
    config: {
      columns: [
        {
          field: 'v',
          title: '多选',
          editable: true,
          editor: 'select',
          editorProps: { multiple: true },
        },
      ],
    },
  });
  const copied = await page.evaluate(() => {
    window.customTable.setSelection([{ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }]);
    const data = new DataTransfer(),
      event = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    document.querySelector('.edit-table')!.dispatchEvent(event);
    window.customTable.setSelection([{ anchor: { row: 1, col: 0 }, focus: { row: 1, col: 0 } }]);
    return { text: data.getData('text/plain'), html: data.getData('text/html') };
  });
  expect(
    (await page.evaluate((copied) => window.customTable.executeCommand('paste', copied), copied))
      .ok,
  ).toBe(true);
  expect(await page.evaluate(() => window.customTable.getDataSource()[1]!.v)).toEqual(['a,b', 'c']);
});
