import { test, expect } from '@playwright/test';
import type { Row } from '../packages/core/src/types';

// 需要真实拖动原生滑块；关闭 Chromium 无头模式默认的隐藏滚动条参数。
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/packages/core/src/index.ts';
    const core: typeof import('../packages/core/src/index') = await import(path);
    window.table.destroy();
    const host = document.querySelector<HTMLElement>('#table')!;
    host.style.width = '640px';
    window.customTable = core.createTable<Row>(host, {
      rowKey: 'id',
      height: 360,
      dataSource: Array.from({ length: 30 }, (_, index) => ({
        id: `r${index}`,
        name: `记录 ${index + 1}`,
        qty: index + 1,
        date: '2026-10-30',
        status: 'ready',
        region: '华东',
      })),
      config: {
        rowNumbers: true,
        rowPinning: { maxRows: 3 },
        pinnedDiff: true,
        columns: [
          { field: 'name', title: '名称', width: 160, fixed: 'left', editable: true },
          { field: 'qty', title: '数量', width: 110, editable: true },
          { field: 'date', title: '日期', width: 150 },
          { field: 'status', title: '状态', width: 150 },
          { field: 'region', title: '地区', width: 160, fixed: 'right' },
        ],
      },
    });
    window.customTable.pinRow(0);
  });
});

test('横向滚轮在事件结束前同步头体、左右固定列和固定对比行', async ({ page }) => {
  const result = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.et-body-viewport')!,
      nodes = [
        ...document.querySelectorAll(
          'th[data-fixed], .et-body-table tr[data-view-index="0"] [data-fixed], .et-pinned [data-fixed]',
        ),
      ],
      initial = nodes.map((node) => node.getBoundingClientRect().left);
    let maxDrift = 0,
      maxHeaderMismatch = 0,
      canceled = true;
    for (const deltaX of [35, 70, 60, -25, -50, 200, -400]) {
      const event = new WheelEvent('wheel', { deltaX, bubbles: true, cancelable: true });
      body.dispatchEvent(event);
      canceled &&= event.defaultPrevented;
      for (const [index, node] of nodes.entries())
        maxDrift = Math.max(
          maxDrift,
          Math.abs(node.getBoundingClientRect().left - initial[index]!),
        );
      const head = document.querySelector('th[data-field=qty]')!.getBoundingClientRect(),
        cell = document
          .querySelector('.et-body-table tr[data-view-index="0"] [data-field=qty]')!
          .getBoundingClientRect();
      maxHeaderMismatch = Math.max(maxHeaderMismatch, Math.abs(head.left - cell.left));
    }
    return { maxDrift, maxHeaderMismatch, canceled, count: nodes.length };
  });
  expect(result.count).toBeGreaterThanOrEqual(9);
  expect(result.canceled).toBe(true);
  expect(result.maxDrift).toBeLessThan(0.01);
  expect(result.maxHeaderMismatch).toBeLessThan(0.01);
});

test('Shift 横滚、斜向手势与行页增量正确，纯纵向和缩放不被接管', async ({ page }) => {
  const dispatch = async (
    init: Pick<
      WheelEventInit,
      'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey' | 'ctrlKey' | 'metaKey'
    >,
  ): Promise<{
    x: number;
    y: number;
    canceled: boolean;
  }> =>
    page.locator('.et-body-viewport').evaluate((body, options) => {
      const event = new WheelEvent('wheel', { ...options, bubbles: true, cancelable: true });
      body.dispatchEvent(event);
      return {
        x: document.querySelector<HTMLElement>('.et-horizontal-scroll')!.scrollLeft,
        y: body.scrollTop,
        canceled: event.defaultPrevented,
      };
    }, init);
  expect(await dispatch({ deltaY: 40, shiftKey: true })).toEqual({ x: 40, y: 0, canceled: true });
  expect(await dispatch({ deltaX: 15, deltaY: 30 })).toEqual({ x: 55, y: 30, canceled: true });
  expect(await dispatch({ deltaX: 1, deltaMode: 1 })).toEqual({ x: 93, y: 30, canceled: true });
  const end = await dispatch({ deltaX: 1, deltaMode: 2 });
  expect(end.canceled).toBe(true);
  expect(end.x).toBeGreaterThan(93);
  expect(await dispatch({ deltaY: 80 })).toEqual({ ...end, canceled: false });
  expect(await dispatch({ deltaX: -20, ctrlKey: true })).toEqual({ ...end, canceled: false });
  expect(await dispatch({ deltaX: -20, metaKey: true })).toEqual({ ...end, canceled: false });
});

test('浏览器真实横向滚轮的每次回调均已完成固定列补偿', async ({ page }) => {
  await page.locator('.et-body-viewport').evaluate((body) => {
    const fixed = body.querySelector('tr[data-view-index="0"] [data-field=name]')!,
      x = fixed.getBoundingClientRect().left;
    body.addEventListener('wheel', (event) => {
      if (!(event instanceof WheelEvent) || !event.deltaX) return;
      body.dataset.wheelCount = String(Number(body.dataset.wheelCount ?? 0) + 1);
      body.dataset.maxDrift = String(
        Math.max(
          Number(body.dataset.maxDrift ?? 0),
          Math.abs(fixed.getBoundingClientRect().left - x),
        ),
      );
      if (!event.defaultPrevented) body.dataset.uncanceledWheel = 'true';
    });
  });
  const body = page.locator('.et-body-viewport'),
    bounds = await body.boundingBox();
  if (!bounds) throw new Error('滚动视口不可见');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 80);
  for (const delta of [30, 40, 30, -20]) await page.mouse.wheel(delta, 0);
  await expect.poll(() => body.getAttribute('data-wheel-count')).toBe('4');
  await expect(body).not.toHaveAttribute('data-uncanceled-wheel', 'true');
  expect(Number(await body.getAttribute('data-max-drift'))).toBeLessThan(0.01);
  expect(
    await page.locator('.et-horizontal-scroll').evaluate((node) => node.scrollLeft),
  ).toBeGreaterThan(0);
});

test('不可取消的惯性增量只转发横向位置，不重复应用原生纵向位移', async ({ page }) => {
  const result = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.et-body-viewport')!,
      horizontal = document.querySelector<HTMLElement>('.et-horizontal-scroll')!;
    body.dispatchEvent(new WheelEvent('wheel', { deltaX: 30, deltaY: 15, cancelable: false }));
    const afterBody = { x: horizontal.scrollLeft, y: body.scrollTop };
    horizontal.dispatchEvent(new WheelEvent('wheel', { deltaX: 20, cancelable: false }));
    return { afterBody, afterBar: horizontal.scrollLeft, bodyX: body.scrollLeft };
  });
  expect(result).toEqual({ afterBody: { x: 30, y: 0 }, afterBar: 30, bodyX: 0 });
});

test('原生滚动条在 scroll 回调执行前后都不会移动固定列', async ({ page }) => {
  const result = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.et-body-viewport')!,
      horizontal = document.querySelector<HTMLElement>('.et-horizontal-scroll')!,
      nodes = [
        ...document.querySelectorAll(
          'th[data-fixed], .et-body-table tr[data-view-index="0"] [data-fixed], .et-pinned [data-fixed]',
        ),
      ],
      initial = nodes.map((node) => node.getBoundingClientRect().left);
    let beforeCallback = 0,
      afterCallback = 0;
    for (const left of [25, 90, 150, 10, 0]) {
      // 此时不派发 scroll，模拟原生滚动已发生而主线程回调尚未执行的窗口。
      horizontal.scrollLeft = left;
      for (const [index, node] of nodes.entries())
        beforeCallback = Math.max(
          beforeCallback,
          Math.abs(node.getBoundingClientRect().left - initial[index]!),
        );
      horizontal.dispatchEvent(new Event('scroll'));
      for (const [index, node] of nodes.entries())
        afterCallback = Math.max(
          afterCallback,
          Math.abs(node.getBoundingClientRect().left - initial[index]!),
        );
    }
    return {
      beforeCallback,
      afterCallback,
      bodyScrollLeft: body.scrollLeft,
      overflow: body.scrollWidth - body.clientWidth,
    };
  });
  expect(result.beforeCallback).toBeLessThan(0.01);
  expect(result.afterCallback).toBeLessThan(0.01);
  expect(result.bodyScrollLeft).toBe(0);
  expect(result.overflow).toBe(0);
});

test('原生横向条的滑块或键盘输入保持固定列原位', async ({ page, browserName }) => {
  const horizontal = page.locator('.et-horizontal-scroll'),
    bounds = await horizontal.boundingBox(),
    before = await page.locator('th[data-field=name]').boundingBox(),
    metrics = await horizontal.evaluate((node) => ({
      width: node.clientWidth,
      total: node.scrollWidth,
    }));
  if (!bounds || !before) throw new Error('横向滚动条或固定表头不可见');
  if (browserName === 'firefox') {
    // Firefox 无头输入无法命中系统匿名滑块，改测同一原生滚动条的键盘默认动作。
    await horizontal.focus();
    for (let step = 0; step < 4; step++) {
      await page.keyboard.press('ArrowRight');
      const current = await page.locator('th[data-field=name]').boundingBox();
      if (!current) throw new Error('键盘横滚期间固定列不可见');
      expect(Math.abs(current.x - before.x)).toBeLessThan(0.01);
    }
    await expect.poll(() => horizontal.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    return;
  }
  const thumb = (metrics.width * metrics.width) / metrics.total,
    x = bounds.x + thumb / 2,
    y = bounds.y + bounds.height - 2;
  await page.mouse.move(x, y);
  await page.mouse.wheel(1, 0);
  const start = await horizontal.evaluate((node) => node.scrollLeft);
  // 等覆盖式原生滑块完成首帧绘制，再开始命中测试和拖动。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.mouse.down();
  try {
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(x + step * 8, y);
      const current = await page.locator('th[data-field=name]').boundingBox();
      if (!current) throw new Error('拖动期间固定列不可见');
      expect(Math.abs(current.x - before.x)).toBeLessThan(0.01);
    }
  } finally {
    await page.mouse.up();
  }
  await expect.poll(() => horizontal.evaluate((node) => node.scrollLeft)).toBeGreaterThan(start);
});

test('分类合并格在原生横滚回调前也不会漂移', async ({ page }) => {
  await page.evaluate(async () => {
    const corePath = '/packages/core/src/index.ts',
      dataPath = '/examples/quotation/config.ts';
    const core: typeof import('../packages/core/src/index') = await import(corePath),
      data: typeof import('../examples/quotation/config') = await import(dataPath);
    window.customTable.destroy();
    window.table = core.createTable(document.querySelector<HTMLElement>('#table')!, {
      config: data.createQuotationConfig(),
      dataSource: data.createQuotationRows(),
      rowKey: 'id',
      height: 360,
    });
  });
  const drift = await page.evaluate(() => {
    const horizontal = document.querySelector<HTMLElement>('.et-horizontal-scroll')!,
      merged = document.querySelector('.et-merged-cell[data-field=categoryName]')!,
      x = merged.getBoundingClientRect().left;
    let maximum = 0;
    for (const left of [50, 200, 400, 0]) {
      horizontal.scrollLeft = left;
      maximum = Math.max(maximum, Math.abs(merged.getBoundingClientRect().left - x));
      horizontal.dispatchEvent(new Event('scroll'));
      maximum = Math.max(maximum, Math.abs(merged.getBoundingClientRect().left - x));
    }
    return maximum;
  });
  expect(drift).toBeLessThan(0.01);
});

test('程序定位同时滚动横向条与纵向正文，并保持命中坐标正确', async ({ page }) => {
  await page.evaluate(() =>
    window.customTable.scrollToCell({ kind: 'record', rowKey: 'r25', field: 'status' }),
  );
  const cell = page.locator('tr[data-view-index="25"] [data-field=status]');
  await expect(cell).toBeInViewport();
  await cell.click();
  expect(await page.evaluate(() => window.customTable.getSelection().active)).toEqual({
    row: 25,
    col: 3,
  });
  expect(
    await page.locator('.et-horizontal-scroll').evaluate((node) => node.scrollLeft),
  ).toBeGreaterThan(0);
  expect(await page.locator('.et-body-viewport').evaluate((node) => node.scrollLeft)).toBe(0);
});

test('列选择保留键盘起点，但不高亮首行或默认操作该行', async ({ page }) => {
  await page.locator('tr[data-view-index="5"] [data-field=qty]').click();
  await expect(page.locator('.et-active-row')).toHaveCount(1);
  await page.locator('th[data-field=name]').click();
  expect(await page.evaluate(() => window.customTable.getSelection())).toMatchObject({
    mode: 'column',
    active: { row: 0, col: 0 },
  });
  await expect(page.locator('.et-column-selected')).toHaveCount(1);
  await expect(
    page.locator('.et-active-row, .et-row-selected, .et-active-cell, .et-diff'),
  ).toHaveCount(0);
  await expect(page.locator('tr[data-view-index="0"] .et-row-number')).toHaveCSS(
    'color',
    'rgb(130, 144, 165)',
  );
  expect(await page.evaluate(() => window.customTable.getCommandState('pinRow').enabled)).toBe(
    false,
  );
  expect(await page.evaluate(() => window.customTable.getCommandState('unpinRow').enabled)).toBe(
    false,
  );
  expect(await page.evaluate(() => window.customTable.executeCommand('unpinRow'))).toMatchObject({
    ok: false,
    code: 'invalid-target',
  });
  expect(await page.evaluate(() => window.customTable.executeCommand('pinRow'))).toMatchObject({
    ok: false,
    code: 'invalid-target',
  });
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => window.customTable.getSelection().active)).toEqual({
    row: 1,
    col: 0,
  });
  await expect(page.locator('.et-active-row')).toHaveAttribute('data-view-index', '1');
});

test('整列边框跨固定副本和管理栏，与头体在滚动、变宽和换密度后保持对齐', async ({ page }) => {
  await page.evaluate(() => {
    window.customTable.pinRow(5);
    window.customTable.pinRow(10);
  });
  for (const field of ['name', 'qty', 'region']) {
    await page.locator('.et-horizontal-scroll').evaluate((node) => {
      node.scrollLeft = 0;
      node.dispatchEvent(new Event('scroll'));
    });
    await page.locator(`th[data-field=${field}]`).click();
    for (const scrollLeft of [0, 80, 150]) {
      await page.locator('.et-horizontal-scroll').evaluate((node, left) => {
        node.scrollLeft = left;
        node.dispatchEvent(new Event('scroll'));
      }, scrollLeft);
      const mismatches = await page.evaluate((selectedField) => {
        const frame = document
            .querySelector('.et-pinned-column-selection')!
            .getBoundingClientRect(),
          header = document
            .querySelector(`th[data-field=${selectedField}]`)!
            .getBoundingClientRect(),
          body = document.querySelector('.et-body-viewport')!.getBoundingClientRect(),
          box = document
            .querySelector('.et-select-layer .et-column-selection')!
            .getBoundingClientRect();
        return [
          frame.left - (header.left - 1),
          frame.right - header.right,
          frame.top - header.bottom,
          frame.bottom - body.top,
          frame.left - box.left,
          frame.right - box.right,
        ];
      }, field);
      for (const mismatch of mismatches) expect(Math.abs(mismatch)).toBeLessThan(0.01);
    }
  }
  await page.evaluate(() => {
    window.customTable.setDensity('compact');
    window.customTable.setTheme('green');
    window.customTable.setColumnWidth('region', 180);
  });
  await expect(page.locator('.et-pinned-column-selection')).toHaveCSS('width', '181px');
  await expect(page.locator('.et-pinned-column-selection')).toHaveCSS(
    'border-left-color',
    'rgb(21, 150, 107)',
  );
  const geometry = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>('.et-pinned-column-selection')!,
      rect = frame.getBoundingClientRect(),
      header = document.querySelector('th[data-field=region]')!.getBoundingClientRect(),
      body = document.querySelector('.et-body-viewport')!.getBoundingClientRect(),
      pinned = document.querySelector('.et-pinned')!.getBoundingClientRect();
    return {
      top: rect.top - header.bottom,
      bottom: rect.bottom - body.top,
      gradient: getComputedStyle(frame).backgroundImage,
      pinnedHeight: pinned.height,
    };
  });
  expect(Math.abs(geometry.top)).toBeLessThan(0.01);
  expect(Math.abs(geometry.bottom)).toBeLessThan(0.01);
  expect(geometry.gradient).toContain(`${geometry.pinnedHeight}px`);
  await expect(page.locator('.et-pinned-select-layer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.et-pinned-column-selection')).toHaveCSS('pointer-events', 'none');
});

test('固定副本仅绘制列边框，复制不重复，管理按钮仍可用且切换选区后清理', async ({ page }) => {
  await page.locator('th[data-field=qty]').click();
  const selection = await page.evaluate(() => window.customTable.getSelection());
  expect(selection).toMatchObject({
    mode: 'column',
    ranges: [{ anchor: { row: 0, col: 1 }, focus: { row: 29, col: 1 } }],
  });
  await expect(page.locator('.et-pinned [aria-selected=true]')).toHaveCount(0);
  const clipboard = await page.evaluate(() => {
    const data = new DataTransfer(),
      event = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    document.querySelector('.edit-table')!.dispatchEvent(event);
    return data.getData('text/plain');
  });
  expect(clipboard).toBe(Array.from({ length: 30 }, (_, index) => index + 1).join('\n'));
  await page.getByRole('checkbox', { name: '选择固定的第 1 行', exact: true }).check();
  await page.getByRole('button', { name: '取消选中固定', exact: true }).click();
  await expect(page.locator('.et-pinned-column-selection')).toHaveCount(0);
  expect(await page.evaluate(() => window.customTable.getSelection())).toEqual(selection);
  await page.evaluate(() => window.customTable.pinRow(2));
  await expect(page.locator('.et-pinned-column-selection')).toHaveCount(1);
  await page.locator('th[data-field=name]').click();
  await expect(page.locator('.et-pinned-column-selection')).toHaveCount(1);
  await page.locator('tr[data-view-index="1"] .et-row-number').click();
  await expect(page.locator('.et-pinned-column-selection')).toHaveCount(0);
  await page.locator('th[data-field=qty]').click();
  await page.locator('.page-header h1').click();
  await expect(page.locator('.et-pinned-column-selection')).toHaveCount(0);
  await expect(page.locator('.et-column-selected')).toHaveCount(0);
});
