import { createElement, createRef, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditTable } from '../packages/react/src/index';
import type { TableConfig, TableInstance } from 'edit-table';
type Item = { id: string; name: string; qty: number };
const config: TableConfig<Item> = {
  columns: [
    { field: 'name', title: '项目', editable: true, width: 230 },
    { field: 'qty', title: '数量', editable: true, editor: 'number' },
  ],
};
export function mountReactDemo(host: HTMLElement): () => void {
  const root = createRoot(host),
    ref = createRef<TableInstance<Item>>();
  root.render(
    createElement(
      StrictMode,
      null,
      createElement(EditTable<Item>, {
        ref,
        config,
        dataSource: [{ id: 'r1', name: 'React portal 单元格', qty: 2 }],
        dataVersion: 1,
        options: { rowKey: 'id', height: 220 },
        renderers: {
          name: (value) => createElement('strong', { style: { color: '#1677ff' } }, String(value)),
        },
      }),
    ),
  );
  return () => root.unmount();
}
