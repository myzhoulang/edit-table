// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createController } from '../../src/model/model';
import { createRenderer } from '../../src/dom/renderer';
import { createEditors } from '../../src/dom/editors';
import { createTable } from '../../src/dom/table';
import type { CreateTableOptions, Row, TableConfig } from '../../src/types';

let cleanup: (() => void)[] = [];
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(180);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(700);
});
afterEach(() => {
  for (const dispose of cleanup.reverse()) dispose();
  cleanup = [];
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(
  config: TableConfig<Row>,
  dataSource: Row[],
): {
  model: ReturnType<typeof createController<Row>>;
  renderer: ReturnType<typeof createRenderer<Row>>;
} {
  const options: CreateTableOptions<Row> = { config, dataSource, rowKey: 'id', height: 180 };
  const model = createController(options),
    renderer = createRenderer(host, options, model);
  cleanup.push(() => {
    renderer.destroy();
    model.api.destroy();
  });
  return { model, renderer };
}
const base = (): TableConfig<Row> => ({
  columns: [
    { field: 'g', title: '组', editable: true },
    { field: 'v', title: '值', editable: true },
  ],
});

describe('分析报告的 DOM 回归', () => {
  it('自动行高变化只查询当前窗口内合并块', () => {
    const config = base();
    config.rowHeight = 'auto';
    config.virtualization = { threshold: 10, overscan: 2 };
    config.groups = [{ key: 'g', fields: ['g'] }];
    config.merges = { vertical: [{ column: 'g', by: 'g' }] };
    const { renderer } = setup(
      config,
      Array.from({ length: 2000 }, (_, i) => ({ id: String(i), g: Math.floor(i / 2), v: i })),
    );
    const query = vi.spyOn(renderer.view(), 'intersecting');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ): DOMRect {
      return new DOMRect(
        0,
        0,
        700,
        this.matches('tr[data-kind="record"]') && Number(this.dataset.viewIndex) > 1000 ? 70 : 38,
      );
    });
    renderer.body.scrollTop = renderer.view().metrics.rowTop(1800);
    renderer.body.dispatchEvent(new Event('scroll'));
    expect(query.mock.calls.every(([start]) => start > 1700)).toBe(true);
    expect(host.querySelectorAll('.et-merged-cell').length).toBeLessThan(20);
  });

  it('合并格支持自定义渲染、批注和校验中样式，移除与销毁时清理', async () => {
    const config = base();
    let renders = 0,
      disposed = 0;
    config.columns[0]!.render = (_value, _row, _rows, container): (() => void) => {
      renders++;
      container.textContent = '自定义内容';
      return () => {
        disposed++;
      };
    };
    config.columns[0]!.comment = () => '批注';
    const releases: (() => void)[] = [];
    config.columns[0]!.rules = [
      {
        asyncValidator: (): Promise<void> =>
          new Promise<void>((resolve) => {
            releases.push(resolve);
          }),
      },
    ];
    config.groups = [{ key: 'g', fields: ['g'] }];
    config.merges = { vertical: [{ column: 'g', by: 'g' }] };
    const { model, renderer } = setup(config, [
      { id: '1', g: 'A' },
      { id: '2', g: 'A' },
    ]);
    expect(host.querySelector('.et-merged-content')?.textContent).toBe('自定义内容');
    expect(host.querySelector('.et-merged-cell.et-comment')).not.toBeNull();
    const pending = model.write(
      [{ target: { kind: 'record', rowKey: '1', field: 'v' }, value: 2 }],
      'edit',
    );
    await pending;
    // 全表校验保持等待状态，覆盖层必须同步可访问属性和视觉标记。
    const validation = model.api.validate();
    renderer.refresh(false);
    expect(host.querySelector('.et-merged-cell')?.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.et-merged-cell.et-validating')).not.toBeNull();
    expect(renderer.content({ row: 1, col: 0 })?.textContent).toBe('自定义内容');
    renderer.destroy();
    expect(disposed).toBe(renders);
    model.api.destroy();
    for (const release of releases) release();
    await validation;
  });

  it('复用到合并占位格时移除旧错误、批注与 ARIA 属性', async () => {
    const config = base();
    config.virtualization = { threshold: 10, overscan: 1 };
    config.columns[0]!.comment = (row) => (row.id === '0' ? '旧批注' : undefined);
    config.columns[0]!.rules = [
      { validator: (_rule, value) => (value === 'bad' ? new Error('旧错误') : true) },
    ];
    config.groups = [{ key: 'g', fields: ['g'] }];
    config.merges = { vertical: [{ column: 'g', by: 'g' }] };
    const { model, renderer } = setup(
      config,
      Array.from({ length: 200 }, (_, i) => ({ id: String(i), g: i ? 'big' : 'bad', v: i })),
    );
    await model.api.validate();
    renderer.refresh();
    renderer.body.scrollTop = renderer.view().metrics.rowTop(120);
    renderer.body.dispatchEvent(new Event('scroll'));
    expect(
      host.querySelector(
        '.et-merge-placeholder.et-invalid, .et-merge-placeholder.et-comment, .et-merge-placeholder[title], .et-merge-placeholder[data-tooltip], .et-merge-placeholder[aria-invalid]',
      ),
    ).toBeNull();
  });

  it('滚动时不扫描全表错误数组，也不构造锁定行数组', async () => {
    const config = base();
    config.virtualization = { threshold: 10, overscan: 1 };
    config.columns[1]!.rules = [{ validator: () => new Error('必填') }];
    const { model, renderer } = setup(
      config,
      Array.from({ length: 1000 }, (_, i) => ({ id: String(i), v: '' })),
    );
    await model.api.validate();
    renderer.refresh();
    const errors = [...model.getErrors()];
    vi.spyOn(model, 'getErrors').mockReturnValue(errors);
    renderer.refresh();
    const map = vi.spyOn(errors, 'map');
    const find = vi.spyOn(errors, 'find');
    const locked = vi.spyOn(model.api, 'getLockedRows');
    renderer.body.scrollTop = renderer.view().metrics.rowTop(500);
    renderer.body.dispatchEvent(new Event('scroll'));
    expect(map).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
    expect(locked).not.toHaveBeenCalled();
  });

  it('重复打开同格保持输入节点与光标，数字步进精确且受上下限约束', () => {
    const config = base();
    config.columns[1] = {
      field: 'v',
      title: '值',
      editable: true,
      editor: 'number',
      valueType: 'number',
      editorProps: { step: 0.1, min: 0, max: 0.3 },
    };
    const { model, renderer } = setup(config, [{ id: '1', v: 0.2 }]);
    const table = createTable(document.createElement('div'), {
      config,
      dataSource: [{ id: '1', v: 0.2 }],
      rowKey: 'id',
    });
    cleanup.push(() => table.destroy());
    const editors = createEditors(renderer, model, () => table);
    cleanup.push(() => editors.destroy());
    const cell = { row: 0, col: 1 };
    editors.start(cell);
    const input = host.querySelector<HTMLInputElement>('.et-editor-input')!;
    input.setSelectionRange(1, 1);
    editors.start({ ...cell });
    editors.start(cell);
    expect(host.querySelector('.et-editor-input')).toBe(input);
    expect(input.selectionStart).toBe(1);
    host.querySelector<HTMLButtonElement>('button[aria-label="增加"]')!.click();
    expect(input.value).toBe('0.3');
    host.querySelector<HTMLButtonElement>('button[aria-label="增加"]')!.click();
    expect(input.value).toBe('0.3');
    input.value = 'abc';
    host.querySelector<HTMLButtonElement>('button[aria-label="增加"]')!.click();
    expect(input.value).toBe('abc');
    expect(host.querySelector('.et-editor-error')?.textContent).toContain('请输入有效数字');
  });
});
