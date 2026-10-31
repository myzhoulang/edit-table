// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, createRef, StrictMode, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditTable, type EditTableProps } from '../src/index';
import type { TableConfig, TableInstance } from 'edit-table';
type TestRow = { id: string; name: string };
let root: Root, host: HTMLElement;
const config: TableConfig<TestRow> = {
  columns: [{ field: 'name', title: '名称', editable: true }],
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(
  props: EditTableProps<TestRow>,
  ref: React.RefObject<TableInstance<TestRow> | null>,
): Promise<void> {
  await act(async () => {
    root.render(
      createElement(StrictMode, null, createElement(EditTable<TestRow>, { ...props, ref })),
    );
  });
}
describe('React 薄适配', () => {
  it('StrictMode 双挂载清理旧实例，卸载无 DOM 或 popup 残留', async () => {
    const ref = createRef<TableInstance<TestRow>>(),
      instances: TableInstance<TestRow>[] = [];
    const popup = document.createElement('aside');
    document.body.append(popup);
    await render(
      {
        config,
        dataSource: [{ id: '1', name: '初始' }],
        options: { rowKey: 'id', getPopupContainer: () => popup },
        onReady: (table) => {
          instances.push(table);
        },
      },
      ref,
    );
    expect(instances).toHaveLength(2);
    expect(document.querySelectorAll('.edit-table')).toHaveLength(1);
    expect((await instances[0]!.executeCommand('undo')).code).toBe('destroyed');
    expect(ref.current).toBe(instances[1]);
    await act(async () => root.unmount());
    expect(ref.current).toBeNull();
    expect(popup.children).toHaveLength(0);
    popup.remove();
    root = createRoot(host);
  });
  it('普通重渲染保留编辑和历史，dataVersion 变化才同步外部数据', async () => {
    const ref = createRef<TableInstance<TestRow>>();
    const props: EditTableProps<TestRow> = {
      config,
      dataSource: [{ id: '1', name: '初始' }],
      dataVersion: 1,
      options: { rowKey: 'id' },
    };
    await render(props, ref);
    await act(async () => {
      ref.current!.updateFields([{ rowKey: '1', fields: { name: '本地修改' } }]);
    });
    await render({ ...props, dataSource: [{ id: '1', name: '外部修改' }] }, ref);
    expect(ref.current!.getDataSource()[0]!.name).toBe('本地修改');
    expect(ref.current!.getCommandState('undo').enabled).toBe(true);
    await render({ ...props, dataVersion: 2, dataSource: [{ id: '1', name: '外部修改' }] }, ref);
    expect(ref.current!.getDataSource()[0]!.name).toBe('外部修改');
    expect(ref.current!.getCommandState('undo').enabled).toBe(false);
  });
  it('配置失败保留有效界面并通知宿主', async () => {
    const ref = createRef<TableInstance<TestRow>>(),
      onConfigError = vi.fn();
    const props = { config, dataSource: [{ id: '1', name: '初始' }], onConfigError };
    await render(props, ref);
    await render(
      { ...props, config: { columns: [{ ...config.columns[0]!, title: '更新名称' }] } },
      ref,
    );
    expect(host.textContent).toContain('更新名称');
    await render({ ...props, config: { columns: [config.columns[0]!, config.columns[0]!] } }, ref);
    expect(onConfigError).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('更新名称');
  });
  it('portal 内容随单元格更新，卸载释放 React effect', async () => {
    const ref = createRef<TableInstance<TestRow>>(),
      cleanup = vi.fn();
    function Content({ text }: { text: string }): ReactElement {
      useEffect(() => cleanup, []);
      return createElement('b', { 'data-portal': true }, text);
    }
    await render(
      {
        config,
        dataSource: [{ id: '1', name: '初始' }],
        options: { rowKey: 'id' },
        renderers: { name: (value) => createElement(Content, { text: String(value) }) },
      },
      ref,
    );
    expect(host.querySelector('[data-portal]')?.textContent).toBe('初始');
    await act(async () => {
      ref.current!.updateFields([{ rowKey: '1', fields: { name: '更新' } }]);
    });
    expect(host.querySelectorAll('[data-portal]')).toHaveLength(1);
    expect(host.querySelector('[data-portal]')?.textContent).toBe('更新');
    await act(async () => root.unmount());
    expect(cleanup).toHaveBeenCalled();
    expect(host.children).toHaveLength(0);
    root = createRoot(host);
  });
});
