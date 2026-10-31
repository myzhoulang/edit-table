// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTable } from '../../src/dom/table';
import { config, rows, type TestRow } from '../fixture';
import type { TableInstance } from '../../src/types';
let table: TableInstance<TestRow> | undefined;
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  return {
    promise: new Promise<T>((done, fail) => {
      resolve = done;
      reject = fail;
    }),
    resolve: (value) => resolve(value),
    reject: (error) => reject(error),
  };
}
beforeEach(() => {
  document.body.innerHTML = '<div id="host" style="height:420px"></div>';
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  table?.destroy();
  table = undefined;
  vi.unstubAllGlobals();
});
const host = (): HTMLElement => {
  const element = document.getElementById('host');
  if (!element) throw new Error('测试容器不存在');
  return element;
};
describe('M4 生命周期与固定对比', () => {
  it('工具栏按选区与只读状态更新合并和固定按钮', () => {
    const next = config();
    next.rowPinning = true;
    next.manualMerge = { rules: [{ column: 'name' }] };
    table = createTable(host(), { config: next, dataSource: rows, rowKey: 'id' });
    const merge = host().querySelector<HTMLButtonElement>('button[aria-label="合并单元格"]')!,
      pin = host().querySelector<HTMLButtonElement>('button[aria-label="固定当前行为对比行"]')!;
    expect(merge.disabled).toBe(true);
    expect(pin.disabled).toBe(true);
    table.setSelection([{ anchor: { row: 0, col: 1 }, focus: { row: 1, col: 1 } }]);
    expect(merge.disabled).toBe(false);
    expect(pin.disabled).toBe(false);
    table.setReadonly(true);
    expect(merge.disabled).toBe(true);
  });
  it('复制回退未写入剪贴板时，剪切失败且保留数据', async () => {
    table = createTable(host(), { config: config(), dataSource: rows, rowKey: 'id' });
    table.setSelection([{ anchor: { row: 0, col: 1 }, focus: { row: 0, col: 1 } }]);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (): boolean => true,
    });
    try {
      const result = await table.executeCommand('cut');
      expect(result.ok).toBe(false);
      expect(table.getDataSource()[0]!.name).toBe('租赁');
    } finally {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });
  it('两表、FIFO、源删除取消、销毁清理', async () => {
    const next = config();
    next.rowPinning = { maxRows: 1 };
    table = createTable(host(), { config: next, dataSource: rows, rowKey: 'id' });
    expect(document.querySelectorAll('.edit-table table')).toHaveLength(2);
    expect(table.pinRow(0)).toBe(true);
    expect(table.pinRow(0)).toBe(false);
    table.pinRow(1);
    expect(table.getPinnedRows()[0]!.target).toEqual({ kind: 'record', rowKey: 'r2' });
    await table.executeCommand('deleteRows', { rowKeys: ['r2'] });
    expect(table.getPinnedRows()).toHaveLength(0);
    await table.executeCommand('undo');
    expect(table.getPinnedRows()).toHaveLength(0);
    table.destroy();
    table.destroy();
    expect(document.querySelector('.et-popup-layer')).toBeNull();
    expect((await table.executeCommand('redo')).code).toBe('destroyed');
  });
  it('多个实例隔离，外部 popup 容器销毁清理', () => {
    const popup = document.createElement('aside');
    document.body.append(popup);
    table = createTable(host(), {
      config: config(),
      dataSource: rows,
      rowKey: 'id',
      getPopupContainer: () => popup,
    });
    const anotherHost = document.createElement('div');
    document.body.append(anotherHost);
    const another = createTable(anotherHost, { config: config(), dataSource: rows, rowKey: 'id' });
    table.updateFields([{ rowKey: 'r1', fields: { qty: 5 } }]);
    expect(another.getDataSource()[0]!.qty).toBe(2);
    table.destroy();
    expect(popup.children).toHaveLength(0);
    expect(another.getDataSource()).toHaveLength(2);
    another.destroy();
  });
});
describe('M6 加载状态与竞态', () => {
  it('慢旧响应不能覆盖新响应', async () => {
    const old = deferred<TestRow[]>(),
      recent = deferred<TestRow[]>();
    let count = 0;
    table = createTable(host(), {
      config: config(),
      rowKey: 'id',
      dataLoader: () => (++count === 1 ? old.promise : recent.promise),
    });
    await vi.waitFor(() => expect(count).toBe(1));
    const next = table.loadData();
    await vi.waitFor(() => expect(count).toBe(2));
    recent.resolve([{ ...rows[0]!, name: '最新' }]);
    expect(await next).toBe(true);
    old.resolve([{ ...rows[0]!, name: '旧结果' }]);
    await Promise.resolve();
    expect(table.getDataSource()[0]!.name).toBe('最新');
    expect(table.getDataState().status).toBe('ready');
  });
  it('旧请求的拒绝不能污染新请求状态', async () => {
    const old = deferred<TestRow[]>(),
      recent = deferred<TestRow[]>();
    let count = 0;
    table = createTable(host(), {
      config: config(),
      rowKey: 'id',
      dataLoader: () => (++count === 1 ? old.promise : recent.promise),
    });
    await vi.waitFor(() => expect(count).toBe(1));
    const next = table.loadData();
    await vi.waitFor(() => expect(count).toBe(2));
    old.reject(new Error('旧错误'));
    await Promise.resolve();
    expect(table.getDataState().loading).toBe(true);
    recent.resolve(rows);
    expect(await next).toBe(true);
    expect(table.getDataState().error).toBeUndefined();
  });
  it('刷新失败保留旧数据，重试空态，宿主状态', async () => {
    let fail = false;
    table = createTable(host(), {
      config: config(),
      dataSource: rows,
      rowKey: 'id',
      dataLoader: async () => {
        try {
          if (fail) throw new Error('网络失败');
          return rows;
        } catch (error) {
          throw new Error('测试异步流程失败', { cause: error });
        }
      },
    });
    await vi.waitFor(() => expect(table!.getDataState().status).toBe('ready'));
    fail = true;
    expect(await table.loadData()).toBe(false);
    expect(table.getDataState().status).toBe('refresh-error');
    expect(table.getDataSource()).toHaveLength(2);
    table.setLoadingState({ loading: true });
    expect(table.getDataState().status).toBe('refreshing');
    table.setDataSource([]);
    table.setLoadingState({ loading: false, emptyReason: 'filtered', loadError: null });
    expect(table.getDataState().status).toBe('filtered-empty');
  });
  it('本地编辑和外部换数使请求失效', async () => {
    const pending = deferred<TestRow[]>();
    table = createTable(host(), {
      config: config(),
      dataSource: rows,
      rowKey: 'id',
      dataLoader: () => pending.promise,
    });
    await vi.waitFor(() => expect(table!.getDataState().loading).toBe(true));
    table.updateFields([{ rowKey: 'r1', fields: { qty: 7 } }]);
    pending.resolve([{ ...rows[0]!, qty: 99 }]);
    await Promise.resolve();
    expect(table.getDataSource()[0]!.qty).toBe(7);
    expect(table.getDataState().loading).toBe(false);
  });
});
