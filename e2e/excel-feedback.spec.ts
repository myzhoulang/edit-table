import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('点击表格外部清除多区域、整行、整列和全选，并重置扩选起点', async ({ page }) => {
  await page.locator('.page-header h1').evaluate((node) => {
    node.addEventListener('pointerdown', (event) => event.stopPropagation());
  });
  for (const mode of ['multiple', 'row', 'column', 'all']) {
    if (mode === 'multiple') {
      await page.locator('tr[data-view-index="0"] [data-field=requirement]').click();
      await page
        .locator('tr[data-view-index="1"] [data-field=qty]')
        .click({ modifiers: ['ControlOrMeta'] });
      expect(await page.evaluate(() => window.table.getSelection().ranges)).toHaveLength(2);
    } else if (mode === 'row') {
      await page.locator('tr[data-view-index="1"] .et-row-number').click();
      await page.locator('tr[data-view-index="3"] .et-row-number').click({ modifiers: ['Shift'] });
    } else if (mode === 'column') await page.locator('.et-head-table th[data-field=qty]').click();
    else {
      await page.locator('tr[data-view-index="0"] [data-field=requirement]').click();
      await page.keyboard.press('ControlOrMeta+a');
    }
    expect((await page.evaluate(() => window.table.getSelection().ranges)).length).toBeGreaterThan(
      0,
    );
    await page.locator('.page-header h1').click();
    expect(await page.evaluate(() => window.table.getSelection())).toEqual({
      ranges: [],
      active: null,
    });
    await expect(page.locator('.et-select-layer > *')).toHaveCount(0);
    await expect(page.locator('.et-active-row, .et-row-selected')).toHaveCount(0);
    await expect(page.locator('.et-column-selected')).toHaveCount(0);
    expect(await page.evaluate(() => window.table.getCommandState('pinRow').enabled)).toBe(false);
  }
  await page
    .locator('tr[data-view-index="1"] [data-field=requirement]')
    .click({ modifiers: ['Shift'] });
  expect(await page.evaluate(() => window.table.getSelection().ranges)).toEqual([
    { anchor: { row: 1, col: 2 }, focus: { row: 1, col: 2 } },
  ]);
});

test('工具栏和挂载到表格外的编辑器及日历操作保留本表选区', async ({ page }) => {
  await page.evaluate(async () => {
    const corePath = '/packages/core/src/index.ts',
      dataPath = '/examples/quotation/config.ts';
    const core: typeof import('../packages/core/src/index') = await import(corePath),
      data: typeof import('../examples/quotation/config') = await import(dataPath);
    window.table.destroy();
    window.table = core.createTable(document.querySelector<HTMLElement>('#table')!, {
      rowKey: 'id',
      config: data.createQuotationConfig(),
      dataSource: data.createQuotationRows(),
      getPopupContainer: () => document.body,
    });
  });
  await expect(page.locator('.edit-table .et-popup-layer')).toHaveCount(0);
  await page.locator('tr[data-view-index="0"] [data-field=requirement]').click();
  const selected = await page.evaluate(() => window.table.getSelection());
  await page.getByRole('button', { name: '设置主题', exact: true }).click();
  expect(await page.evaluate(() => window.table.getSelection())).toEqual(selected);
  await page.getByRole('button', { name: '绿色', exact: false }).click();
  expect(await page.evaluate(() => window.table.getSelection())).toEqual(selected);
  await page.locator('tr[data-view-index="0"] [data-field=date]').dblclick();
  const dateSelection = await page.evaluate(() => window.table.getSelection());
  await page.getByRole('textbox', { name: '编辑消费日期' }).click();
  expect(await page.evaluate(() => window.table.getSelection())).toEqual(dateSelection);
  await page.getByRole('button', { name: '2026-10-20', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.table.getDataSource()[0]!.date))
    .toBe('2026-10-20');
  expect(await page.evaluate(() => window.table.getSelection())).toEqual(dateSelection);
  await page.locator('.page-header h1').click();
  expect(await page.evaluate(() => window.table.getSelection())).toEqual({
    ranges: [],
    active: null,
  });
});

test('点击外部后异步编辑提交和等待中的单格点击不会恢复旧选区', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/examples/quotation/config.ts';
    const data: typeof import('../examples/quotation/config') = await import(path),
      config = data.createQuotationConfig();
    config.columns.find((column) => column.field === 'requirement')!.updateValueBefore = () =>
      new Promise<boolean>((resolve) => {
        document.addEventListener('allow-edit', () => resolve(true), { once: true });
      });
    window.table.updateConfig(config);
  });
  await page.locator('tr[data-view-index="0"] [data-field=requirement]').dblclick();
  const input = page.getByRole('textbox', { name: '编辑需求' });
  await input.fill('异步保存的需求');
  await input.press('Enter');
  await expect(page.locator('.et-committing')).toBeVisible();
  await page.locator('tr[data-view-index="1"] [data-field=qty]').click();
  await page.locator('.page-header h1').click();
  expect(await page.evaluate(() => window.table.getSelection())).toEqual({
    ranges: [],
    active: null,
  });
  await page.evaluate(() => document.dispatchEvent(new Event('allow-edit')));
  await expect
    .poll(() => page.evaluate(() => window.table.getDataSource()[0]!.requirement))
    .toBe('异步保存的需求');
  await expect(page.locator('.et-editor')).toHaveCount(0);
  expect(await page.evaluate(() => window.table.getSelection())).toEqual({
    ranges: [],
    active: null,
  });
  await expect(page.locator('.et-select-layer > *')).toHaveCount(0);
});

test('整行选框包含行号与固定列，主题行号白字且横滚后边框仍连续', async ({ page }) => {
  const number = page.locator('tr[data-view-index="1"] .et-row-number');
  await number.click();
  await expect(number).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(number).toHaveCSS('background-color', 'rgb(22, 119, 255)');
  await expect(number).toHaveCSS('border-right-color', 'rgb(22, 119, 255)');
  await expect(number).toHaveCSS('border-bottom-color', 'rgb(22, 119, 255)');
  await expect(page.locator('.et-select-layer .et-layer-segment')).toHaveCount(0);
  await expect(page.locator('.et-row-selection')).toHaveCount(1);
  const geometry = async () =>
    page.evaluate(() => {
      const selection = document.querySelector('.et-row-selection')!.getBoundingClientRect(),
        body = document.querySelector<HTMLElement>('.et-body-viewport')!,
        rows = document.querySelectorAll('.et-body-table .et-row-selected'),
        first = rows[0]!.getBoundingClientRect(),
        last = rows[rows.length - 1]!.getBoundingClientRect();
      return {
        left: Math.abs(selection.left - body.getBoundingClientRect().left),
        top: Math.abs(selection.top - (first.top - 1)),
        bottom: Math.abs(selection.bottom - last.bottom),
        width: selection.width,
        viewport: body.clientWidth,
      };
    });
  const expectAligned = async (): Promise<void> => {
    const bounds = await geometry();
    for (const mismatch of [bounds.left, bounds.top, bounds.bottom])
      expect(mismatch).toBeLessThan(0.01);
    expect(bounds.width).toBe(bounds.viewport);
  };
  await expectAligned();
  await page.locator('.et-horizontal-scroll').evaluate((horizontal) => {
    horizontal.scrollLeft = 350;
    horizontal.dispatchEvent(new Event('scroll'));
  });
  await expectAligned();
  await page.evaluate(() => window.table.setTheme('green'));
  await expect(number).toHaveCSS('background-color', 'rgb(21, 150, 107)');
  await page.locator('tr[data-view-index="3"] .et-row-number').click({ modifiers: ['Shift'] });
  await expect(page.locator('.et-row-selected')).toHaveCount(3);
  await expect(page.locator('.et-row-selection')).toHaveCount(1);
  await expectAligned();
  await page.locator('tr[data-view-index="6"] .et-row-number').click();
  await expect(number).toHaveCSS('color', 'rgb(130, 144, 165)');
  await expect(number).toHaveCSS('border-right-color', 'rgb(229, 234, 241)');
  await page.locator('tr[data-view-index="0"] .et-row-number').click();
  await expect(page.locator('.edit-table')).toHaveAttribute('data-row-selection-top', 'true');
  await expect(page.locator('.et-head-viewport')).toHaveCSS('position', 'relative');
  expect(
    await page.locator('.et-head-viewport').evaluate((node) => {
      const edge = getComputedStyle(node, '::after');
      return { height: edge.height, bottom: edge.bottom, color: edge.backgroundColor };
    }),
  ).toEqual({ height: '1px', bottom: '0px', color: 'rgb(21, 150, 107)' });
  await page.locator('.page-header h1').click();
  await expect(page.locator('.edit-table')).toHaveAttribute('data-row-selection-top', 'false');
});

test('整列使用贯穿小计行的单一选框，表头高亮并保持滚动与重建同步', async ({ page }) => {
  const header = page.locator('.et-head-table th[data-field=qty]');
  await header.hover();
  await expect(header).toHaveCSS('cursor', 'pointer');
  await expect(header.locator('.et-resize-handle')).toHaveCSS('cursor', 'col-resize');
  await header.click();
  expect(await page.evaluate(() => window.table.getSelection().mode)).toBe('column');
  await expect(page.locator('.et-select-layer .et-selection')).toHaveCount(1);
  await expect(page.locator('.et-active-cell')).toHaveCount(0);
  await expect(header).toHaveAttribute('aria-selected', 'true');
  await expect(header).toHaveCSS('background-color', 'rgb(22, 119, 255)');
  await expect(header).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(header).toHaveCSS('border-right-color', 'rgb(22, 119, 255)');
  await expect(header).toHaveCSS('border-bottom-color', 'rgb(22, 119, 255)');
  await expect(header).toHaveCSS(
    'box-shadow',
    'rgb(22, 119, 255) -1px 0px 0px 0px, rgb(22, 119, 255) 0px -1px 0px 0px, rgb(22, 119, 255) -1px -1px 0px 0px',
  );
  await expect(page.locator('.et-column-selection')).toHaveCSS('border-top-width', '0px');
  const geometry = async () =>
    page.evaluate(() => {
      const box = document.querySelector('.et-select-layer .et-selection')!.getBoundingClientRect(),
        heading = document.querySelector('th[data-field=qty]')!.getBoundingClientRect(),
        head = document.querySelector('.et-head-viewport')!.getBoundingClientRect(),
        toolbar = document.querySelector('.et-toolbar')!.getBoundingClientRect(),
        cell = document.querySelector('.et-body-table [data-field=qty]')!.getBoundingClientRect(),
        body = document.querySelector<HTMLElement>('.et-body-viewport')!,
        canvas = document.querySelector<HTMLElement>('.et-body-canvas')!;
      return {
        left: Math.abs(box.left - (heading.left - 1)),
        right: Math.abs(box.right - heading.right),
        gridLeft: Math.abs(box.left - (cell.left - 1)),
        gridRight: Math.abs(box.right - cell.right),
        width: Math.abs(box.width - (heading.width + 1)),
        seam: Math.abs(heading.bottom - body.getBoundingClientRect().top),
        headerTopClip: Math.abs(heading.top - 1 - head.top),
        headerPosition: Math.abs(heading.top - toolbar.bottom),
        top: Math.abs(box.top - (body.getBoundingClientRect().top - body.scrollTop)),
        height: Math.abs(box.height - Number.parseFloat(canvas.style.height)),
      };
    });
  const expectAligned = async (): Promise<void> => {
    for (const mismatch of Object.values(await geometry())) expect(mismatch).toBeLessThan(0.01);
    await expect(page.locator('.et-select-layer .et-selection')).toHaveCount(1);
  };
  await expectAligned();
  await page.locator('.et-body-viewport').evaluate((body) => {
    document.querySelector<HTMLElement>('.et-horizontal-scroll')!.scrollLeft = 300;
    body.scrollTop = 230;
    body.dispatchEvent(new Event('scroll'));
  });
  await expectAligned();
  await page.evaluate(() => {
    window.table.setColumnWidth('qty', 113);
    window.table.setDensity('compact');
    window.table.setTheme('green');
  });
  await expect(header).toHaveCSS('background-color', 'rgb(21, 150, 107)');
  await expect(header).toHaveAttribute('aria-selected', 'true');
  await expectAligned();
});

test('切换选中列、固定列、行和单元格时同步清除旧表头高亮', async ({ page }) => {
  for (const field of ['qty', 'days', 'categoryName']) {
    const header = page.locator(`.et-head-table th[data-field=${field}]`);
    await header.click();
    await expect(page.locator('.et-column-selected')).toHaveCount(1);
    await expect(header).toHaveClass(/et-column-selected/);
    await expect(header).toHaveCSS('background-color', 'rgb(22, 119, 255)');
    await expect(page.locator('.et-select-layer .et-selection')).toHaveCount(1);
    await expect(page.locator('.et-active-cell')).toHaveCount(0);
  }
  await page.locator('tr[data-view-index="1"] .et-row-number').click();
  await expect(page.locator('.et-column-selected')).toHaveCount(0);
  await expect(page.locator('.et-row-selection')).toHaveCount(1);
  await page.locator('.et-head-table th[data-field=qty]').click();
  await page.locator('tr[data-view-index="1"] [data-field=requirement]').click();
  await expect(page.locator('.et-column-selected')).toHaveCount(0);
  await expect(page.locator('.et-active-cell')).toHaveCount(1);
});

test('仅校验失败显示红三角，普通批注保留悬停内容且不显示角标', async ({ page }) => {
  const cell = page.locator('tr[data-view-index="0"] [data-field=requirement]');
  await expect(cell).toHaveClass(/et-comment/);
  await expect(cell).not.toHaveClass(/et-invalid/);
  const marker = async () =>
    cell.evaluate((node) => {
      const css = getComputedStyle(node, '::after');
      return { content: css.content, border: css.borderTopWidth, color: css.borderTopColor };
    });
  expect((await marker()).content).toBe('none');
  await cell.hover();
  await expect(page.getByRole('tooltip')).toContainText('会场使用半天');
  await page.evaluate(async () => {
    window.table.updateFields([{ rowKey: 'r1', fields: { requirement: '' } }]);
    await window.table.validate();
  });
  await expect(cell).toHaveAttribute('aria-invalid', 'true');
  expect(await marker()).toMatchObject({
    content: '""',
    border: '6px',
    color: 'rgb(229, 72, 77)',
  });
  await cell.hover();
  await expect(page.getByRole('tooltip')).toContainText('请填写需求名称');
  await cell.dblclick();
  const input = page.getByRole('textbox', { name: '编辑需求' });
  await input.fill('校验通过');
  await input.press('Enter');
  await expect(cell).not.toHaveAttribute('aria-invalid', 'true');
  expect((await marker()).content).toBe('none');
  await cell.hover();
  await expect(page.getByRole('tooltip')).toContainText('会场使用半天');
});

for (const density of ['normal', 'compact'] as const)
  test(`数字编辑器横向加减，窄列与${density}密度均不超出单元格`, async ({ page }) => {
    await page.evaluate((value) => {
      window.table.setDensity(value);
      window.table.setColumnWidth('days', 60);
    }, density);
    const cell = page.locator('tr[data-view-index="0"] [data-field=days]');
    await cell.dblclick();
    const input = page.getByRole('textbox', { name: '编辑天数' }),
      decrease = page.getByRole('button', { name: '减少', exact: true }),
      increase = page.getByRole('button', { name: '增加', exact: true });
    await expect(decrease).toHaveText('−');
    await expect(increase).toHaveText('+');
    const expectContained = async (): Promise<void> => {
      const bounds = await cell.boundingBox();
      if (!bounds) throw new Error('数字单元格不可见');
      for (const locator of [page.locator('.et-number-editor'), decrease, input, increase]) {
        const rect = await locator.boundingBox();
        if (!rect) throw new Error('数字编辑控件不可见');
        expect(rect.x).toBeGreaterThanOrEqual(bounds.x - 1);
        expect(rect.y).toBeGreaterThanOrEqual(bounds.y - 1);
        expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
        expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
      }
    };
    await expectContained();
    const left = await decrease.boundingBox(),
      center = await input.boundingBox(),
      right = await increase.boundingBox();
    if (!left || !center || !right) throw new Error('数字编辑控件不可见');
    expect(left.x + left.width).toBeLessThanOrEqual(center.x);
    expect(center.x + center.width).toBeLessThanOrEqual(right.x);
    expect(left.y).toBe(center.y);
    expect(center.y).toBe(right.y);
    await page.evaluate(() => window.table.setColumnWidth('days', 40));
    await expect(input).toHaveValue('1');
    await expectContained();
    await increase.click();
    await expect(input).toHaveValue('2');
    await expect(input).toBeFocused();
    await decrease.click();
    await expect(input).toHaveValue('1');
    await input.fill('-1');
    await input.press('Enter');
    await expect(page.locator('.et-editor-error')).toContainText('数值不能小于 0');
    await expectContained();
    await increase.click();
    await expect(input).toHaveValue('0');
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.et-editor-error')).toBeHidden();
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => window.table.getDataSource()[0]!.days)).toBe(0);
  });

for (const density of ['normal', 'compact'] as const)
  test(`文本和日期编辑框在${density}密度及校验失败时保持单元格高度`, async ({ page }) => {
    await page.evaluate((value) => window.table.setDensity(value), density);
    for (const [field, title] of [
      ['requirement', '需求'],
      ['date', '消费日期'],
      ['invoiceType', '发票类型'],
    ] satisfies [string, string][]) {
      const cell = page.locator(`tr[data-view-index="0"] [data-field=${field}]`);
      await cell.dblclick();
      const input = page.getByRole('textbox', { name: `编辑${title}` });
      const expectContainedHeight = async (): Promise<void> => {
        const bounds = await cell.boundingBox();
        if (!bounds) throw new Error('编辑中的单元格不可见');
        for (const locator of [page.locator('.et-editor'), input]) {
          const rect = await locator.boundingBox();
          if (!rect) throw new Error('编辑框不可见');
          expect(rect.y).toBeGreaterThanOrEqual(bounds.y - 1);
          expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
        }
        await expect(page.locator('.et-editor')).toHaveCSS('box-shadow', 'none');
      };
      await expectContainedHeight();
      if (field === 'date') {
        await expect(page.locator('.et-calendar-grid')).toBeVisible();
        await input.fill('2026-02-30');
        await input.press('Enter');
        const error = page.locator('.et-editor-error');
        await expect(error).toContainText('请输入有效日期');
        await expectContainedHeight();
        const errorBounds = await error.boundingBox(),
          calendarBounds = await page.locator('.et-editor-dropdown').boundingBox();
        if (!errorBounds || !calendarBounds) throw new Error('日期错误提示或日历不可见');
        expect(calendarBounds.y).toBeGreaterThanOrEqual(errorBounds.y + errorBounds.height);
        await input.fill('2026-10-20');
        await expect(error).toBeHidden();
        await input.press('Enter');
        await expect
          .poll(() => page.evaluate(() => window.table.getDataSource()[0]!.date))
          .toBe('2026-10-20');
      } else await input.press('Escape');
    }
  });

test('分组小计标签位于项目列，需求列保留空白', async ({ page }) => {
  const subtotal = page.locator('.et-derived-row').first();
  await expect(subtotal.locator('[data-field=projectName]')).toHaveText('场地总计');
  await expect(subtotal.locator('[data-field=requirement]')).toHaveText('');
  await expect(
    page.locator('.et-derived-row').nth(1).locator('[data-field=projectName]'),
  ).toHaveText('设备总计');
});

test('Excel 直接输入覆盖、Enter 与 Tab 提交移动、选中时 Enter 不进入编辑', async ({ page }) => {
  const cell = page.locator('tr[data-view-index="0"] [data-field=requirement]');
  await cell.click();
  await expect(page.locator('.et-editor')).toHaveCount(0);
  await page.keyboard.type('Replacement');
  const input = page.getByRole('textbox', { name: '编辑需求' });
  await expect(input).toHaveValue('Replacement');
  await input.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.table.getDataSource()[0]!.requirement))
    .toBe('Replacement');
  expect(await page.evaluate(() => window.table.getSelection().active)).toEqual({ row: 1, col: 2 });
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('.et-editor')).toHaveCount(0);
  expect(await page.evaluate(() => window.table.getSelection().active)).toEqual({ row: 0, col: 2 });
  await page.keyboard.type('Tab value');
  await input.press('Tab');
  expect(await page.evaluate(() => window.table.getSelection().active)).toEqual({ row: 0, col: 3 });
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => window.table.getSelection().active)).toEqual({ row: 0, col: 2 });
});

test('Excel F2 编辑原值保留光标移动，Esc 和 Backspace 草稿可取消', async ({ page }) => {
  const cell = page.locator('tr[data-view-index="0"] [data-field=requirement]');
  await cell.click();
  await page.keyboard.press('F2');
  const input = page.getByRole('textbox', { name: '编辑需求' });
  await expect(input).toHaveValue('主会场半天');
  expect(await input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(5);
  await input.press('ArrowLeft');
  await input.press('X');
  await expect(input).toHaveValue('主会场半X天');
  await input.press('Escape');
  expect(await page.evaluate(() => window.table.getDataSource()[0]!.requirement)).toBe(
    '主会场半天',
  );
  await page.keyboard.press('Backspace');
  await expect(input).toHaveValue('');
  await input.press('Escape');
  expect(await page.evaluate(() => window.table.getSelection().active)).toEqual({ row: 0, col: 2 });
  await page.keyboard.type('Arrow value');
  await input.press('ArrowDown');
  await expect
    .poll(() => page.evaluate(() => window.table.getDataSource()[0]!.requirement))
    .toBe('Arrow value');
  expect(await page.evaluate(() => window.table.getSelection().active)).toEqual({ row: 1, col: 2 });
});

test('Excel 数字输入规范化失败保留草稿，修正后导航；选择面板 Enter 提交并移动', async ({
  page,
}) => {
  await page.locator('tr[data-view-index="0"] [data-field=qty]').click();
  await page.keyboard.type('-1');
  const input = page.getByRole('textbox', { name: '编辑数量' });
  await input.press('Tab');
  await expect(input).toBeFocused();
  await expect(page.locator('.et-editor-error')).toContainText('数值不能小于 0');
  expect(await page.evaluate(() => window.table.getDataSource()[0]!.qty)).toBe(1);
  await input.fill('12');
  await input.press('Shift+Tab');
  await expect.poll(() => page.evaluate(() => window.table.getDataSource()[0]!.qty)).toBe(12);
  expect(await page.evaluate(() => window.table.getSelection().active)).toEqual({ row: 0, col: 2 });
  await page.locator('tr[data-view-index="0"] [data-field=invoiceType]').click();
  await page.keyboard.type('normal');
  const select = page.getByRole('textbox', { name: '编辑发票类型' });
  await expect(select).toHaveValue('normal');
  await select.fill('普通发票');
  await expect(page.getByRole('option', { name: '普通发票', exact: true })).toBeVisible();
  await select.press('ArrowDown');
  await select.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.table.getSelection().active))
    .toEqual({ row: 1, col: 6 });
});
