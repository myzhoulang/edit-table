import { test, expect } from '@playwright/test';
import type { TableInstance } from '../packages/core/src/types';
import type { QuoteRow } from '../examples/quotation/config';
declare global {
  interface Window {
    table: TableInstance<QuoteRow>;
    createDemo: (count?: number) => void;
  }
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.et-body-table tr[data-kind=record]').first()).toBeVisible();
});
test('截图结构、精确小计与两张表', async ({ page }) => {
  expect(await page.locator('.edit-table table').count()).toBe(2);
  await expect(page.locator('.et-derived-row').first()).toContainText('场地总计');
  await expect(page.locator('.et-derived-row').first()).toContainText('4,845.28');
  await expect(page.locator('.et-derived-row').nth(1)).toContainText('3,815.09');
  expect(await page.evaluate(() => window.table.getDataSource().length)).toBe(24);
});
test('编辑、计算、Enter 导航与事务撤销重做', async ({ page }) => {
  await page
    .locator('.et-body-table tr[data-kind=record]')
    .first()
    .locator('[data-field=qty]')
    .dblclick();
  await page.getByRole('textbox', { name: '编辑数量' }).fill('3');
  await page.getByRole('textbox', { name: '编辑数量' }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.table.getDataSource()[0]!.qty)).toBe(3);
  expect(await page.evaluate(() => Number(window.table.getDataSource()[0]!.gross))).toBe(6000);
  await page.getByRole('button', { name: '撤销 (Ctrl/Cmd+Z)', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.table.getDataSource()[0]!.qty)).toBe(1);
  await page.getByRole('button', { name: '重做 (Ctrl/Cmd+Shift+Z)', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.table.getDataSource()[0]!.qty)).toBe(3);
});
test('中文组合输入与 Esc 取消', async ({ page }) => {
  const cell = page
    .locator('.et-body-table tr[data-kind=record]')
    .first()
    .locator('[data-field=requirement]');
  await cell.dblclick();
  const input = page.getByRole('textbox', { name: '编辑需求' });
  await input.dispatchEvent('compositionstart');
  await input.fill('中文会场');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
  expect(await page.evaluate(() => window.table.getDataSource()[0]!.requirement)).toBe(
    '主会场半天',
  );
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.table.getDataSource()[0]!.requirement))
    .toBe('中文会场');
  await cell.dblclick();
  await input.fill('不保存');
  await input.press('Escape');
  expect(await page.evaluate(() => window.table.getDataSource()[0]!.requirement)).toBe('中文会场');
});
test('可搜索下拉与发票税率联动', async ({ page }) => {
  await page
    .locator('.et-body-table tr[data-kind=record]')
    .first()
    .locator('[data-field=invoiceType]')
    .dblclick();
  const input = page.getByRole('textbox', { name: '编辑发票类型' });
  await input.fill('普通发票');
  await expect(page.getByRole('option', { name: '普通发票', exact: true })).toBeVisible();
  await page.getByRole('option', { name: '普通发票', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.table.getDataSource()[0]!.taxRate)).toBe(0);
  expect(await page.evaluate(() => Number(window.table.getDataSource()[0]!.net))).toBe(2000);
});
test('日历浮层可选日期', async ({ page }) => {
  await page
    .locator('.et-body-table tr[data-kind=record]')
    .first()
    .locator('[data-field=date]')
    .dblclick();
  await expect(page.locator('.et-calendar-grid')).toBeVisible();
  await page.getByRole('button', { name: '2026-10-20', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.table.getDataSource()[0]!.date))
    .toBe('2026-10-20');
});
test('多行粘贴跳过小计、报告且一次撤销', async ({ page }) => {
  const result = await page.evaluate(async () => {
    window.table.setSelection([{ anchor: { row: 3, col: 3 }, focus: { row: 3, col: 3 } }]);
    return await window.table.executeCommand('paste', { text: '2\t3\n4\t2' });
  });
  expect(result).toMatchObject({ ok: true, data: { applied: 4, truncated: 0 } });
  expect(
    await page.evaluate(() =>
      window.table
        .getDataSource()
        .slice(3, 5)
        .map((row) => [row.qty, row.days]),
    ),
  ).toEqual([
    [2, 3],
    [4, 2],
  ]);
  await page.evaluate(() => window.table.executeCommand('undo'));
  expect(await page.evaluate(() => window.table.getDataSource()[3]!.qty)).toBe(1);
});
test('原生剪贴板事件输出 TSV 和 HTML，复制原始值', async ({ page }) => {
  const data = await page.evaluate(() => {
    window.table.setSelection([{ anchor: { row: 0, col: 3 }, focus: { row: 1, col: 4 } }]);
    window.table.focus();
    const clipboardData = new DataTransfer();
    const event = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: clipboardData });
    document.querySelector('.edit-table')!.dispatchEvent(event);
    return { text: clipboardData.getData('text/plain'), html: clipboardData.getData('text/html') };
  });
  expect(data.text).toBe('1\t1\n2\t1');
  expect(data.html).toContain('<table>');
});
test('横向同步、固定列、列宽与对比行同步', async ({ page }) => {
  await page.evaluate(() => {
    window.table.pinRow(0);
    window.table.setColumnWidth('qty', 113);
    const horizontal = document.querySelector('.et-horizontal-scroll')!;
    horizontal.scrollLeft = 411;
    horizontal.dispatchEvent(new Event('scroll'));
  });
  const offsets = await page.evaluate(() => {
    const header = document
      .querySelector('.et-head-table th[data-field=qty]')!
      .getBoundingClientRect();
    const body = document
      .querySelector('.et-body-table td[data-field=qty]')!
      .getBoundingClientRect();
    const pinned = document.querySelector('.et-pinned td:nth-child(5)')!.getBoundingClientRect();
    return [Math.abs(header.left - body.left), Math.abs(header.left - pinned.left), header.width];
  });
  expect(offsets[0]).toBeLessThanOrEqual(1);
  expect(offsets[1]).toBeLessThanOrEqual(1);
  expect(offsets[2]).toBe(113);
  await page.evaluate(() => window.table.updateFields([{ rowKey: 'r1', fields: { qty: 9 } }]));
  await expect(page.locator('.et-pinned')).toContainText('9');
  await page.evaluate(() => window.table.executeCommand('deleteRows', { rowKeys: ['r1'] }));
  expect(await page.evaluate(() => window.table.getPinnedRows().length)).toBe(0);
  await page.evaluate(() => window.table.executeCommand('undo'));
  expect(await page.evaluate(() => window.table.getPinnedRows().length)).toBe(0);
});
test('右键操作、锁定与复制', async ({ page }) => {
  await page
    .locator('.et-body-table tr[data-kind=record]')
    .first()
    .locator('[data-field=requirement]')
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: '♧  锁定当前行', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.table.getLockedRows())).toEqual(['r1']);
  const result = await page.evaluate(() =>
    window.table.updateFields([{ rowKey: 'r1', fields: { qty: 9 } }]),
  );
  expect(result.ok).toBe(false);
  await page.evaluate(() => window.table.executeCommand('duplicateRows', { rowKeys: ['r2'] }));
  expect(await page.evaluate(() => window.table.getDataSource().length)).toBe(25);
});
test('主题、密度和列显隐', async ({ page }) => {
  await page.getByRole('button', { name: '设置主题', exact: true }).click();
  await page.getByRole('button', { name: '深色', exact: false }).click();
  await expect(page.locator('.edit-table')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '设置密度', exact: true }).click();
  await page.getByRole('button', { name: '紧凑密度', exact: false }).click();
  await expect(page.locator('.edit-table')).toHaveAttribute('data-density', 'compact');
  await page.evaluate(() => window.table.setColumnVisibility('tax', false));
  await expect(page.locator('.et-head-table th[data-field=tax]')).toHaveCount(0);
  expect(await page.evaluate(() => window.table.getDataSource().length)).toBe(24);
});
test('十万行虚拟窗口、远端命中和对比行', async ({ page }) => {
  await page.getByRole('button', { name: '10 万行', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.table.getDataSource().length)).toBe(100000);
  await page.evaluate(() => {
    window.table.pinRow(0);
    const body = document.querySelector('.et-body-viewport')!;
    body.scrollTop = 2_000_000;
    body.dispatchEvent(new Event('scroll'));
  });
  expect(await page.locator('.et-body-table tr[data-kind=record]').count()).toBeLessThan(100);
  await expect(page.locator('.et-pinned')).toContainText('需求记录 1');
  const first = await page
    .locator('.et-body-table tr[data-kind=record]')
    .first()
    .getAttribute('data-view-index');
  expect(Number(first)).toBeGreaterThan(50000);
});
test('保存校验与提交数据隔离', async ({ page }) => {
  await page.getByRole('button', { name: '保存', exact: false }).click();
  await expect(page.locator('#submission')).toBeVisible();
  const submission = await page.evaluate(() => window.table.getSubmission());
  expect(submission.records).toHaveLength(24);
  expect(submission.derivedValues).toEqual([]);
  expect(Number(submission.summary.gross)).toBe(53480);
});
