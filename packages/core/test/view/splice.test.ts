import { describe, expect, it } from 'vitest';
import type { Row, TableConfig } from '../../src/types';
import { createController } from '../../src/model/model';
import { createView } from '../../src/view/view';

function config(): TableConfig<Row> {
  return {
    columns: ['category', 'project', 'name', 'value'].map((field) => ({
      field,
      title: field,
      editable: true,
      fixed: field === 'category' ? 'left' : undefined,
    })),
    groups: [
      { key: 'category', fields: ['category'] },
      { key: 'project', fields: ['project'] },
    ],
    merges: {
      vertical: [
        { column: 'category', by: 'category' },
        { column: 'project', by: 'project' },
      ],
    },
    derivedRows: [
      {
        id: 'before',
        level: 'project',
        position: 'before-group',
        labelColumn: 'name',
        label: ({ group }) => `起点 ${group.start}`,
        cells: { value: { type: 'aggregate', agg: 'count' } },
      },
      {
        id: 'subtotal',
        level: 'project',
        labelColumn: 'name',
        label: '小计',
        cells: { value: { type: 'aggregate', agg: 'sum' } },
      },
      {
        id: 'conditional',
        level: 'category',
        labelColumn: 'name',
        label: '条件',
        visible: ({ group }) => group.start % 2 === 0,
        cells: {
          value: { type: 'compute', fn: ({ group, results }) => group.start + results.length },
        },
      },
      {
        id: 'grand',
        level: 'table',
        labelColumn: 'name',
        label: '合计',
        cells: { value: { type: 'aggregate', agg: 'sum' } },
      },
    ],
    rowRules: [
      {
        id: 'special',
        match: { field: 'special', equals: true },
        layout: {
          cells: [
            { column: 'category', field: 'category' },
            { range: { from: 'project' }, content: { parts: ['说明：', { field: 'name' }] } },
          ],
        },
      },
    ],
  };
}
const rows = Array.from({ length: 32 }, (_, index) => ({
  id: `r${index}`,
  category: Math.floor(index / 8),
  project: Math.floor(index / 4),
  name: String(index),
  value: index,
  special: index % 11 === 0,
}));
describe('视图局部行段拼接', () => {
  it('一万行中间插入只投影一个新增行，前后高度可直接迁移', async () => {
    const model = createController<Row>({
      config: { columns: [{ field: 'value', title: '内容', editable: true }] },
      dataSource: Array.from({ length: 10000 }, (_, index) => ({ id: `r${index}`, value: index })),
      rowKey: 'id',
    });
    const before = createView(model.getState(), model.getConfig(), new Set(), new Map(), 38, []);
    before.metrics.setHeight(9000, 81);
    await model.handleCommand('insertRowAbove', { rowKeys: ['r5000'], rowDefaults: { value: -1 } });
    const after = createView(
      model.getState(),
      model.getConfig(),
      new Set(),
      new Map(),
      38,
      [],
      before,
    );
    expect(after.splice).toEqual({ start: 5000, deleteCount: 0, insertCount: 1 });
    expect(after.rows[4999]).toBe(before.rows[4999]);
    expect(after.metrics.height(9001)).toBe(81);
    expect(after.rows).toEqual(
      createView(model.getState(), model.getConfig(), new Set(), new Map(), 38, []).rows,
    );
  });
  it('300 次编辑、增删、复制和历史恢复后的行、跨度与坐标等于完整构造', async () => {
    const model = createController<Row>({ config: config(), dataSource: rows, rowKey: 'id' });
    let view = createView(model.getState(), model.getConfig(), new Set(), new Map(), 38, []),
      seed = 91;
    for (let index = 0; index < 300; index++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const entries = model.getState().entries,
        key = entries[seed % entries.length]!.key;
      if (index % 7 === 0)
        await model.handleCommand('insertRowAbove', {
          rowKeys: [key],
          rowDefaults: { value: index, name: `新 ${index}`, special: index % 2 === 0 },
        });
      else if (index % 7 === 1 && entries.length > 2)
        await model.handleCommand('deleteRows', {
          rowKeys: [...new Set([key, entries[(seed + 3) % entries.length]!.key])],
        });
      else if (index % 7 === 2) await model.handleCommand('duplicateRows', { rowKeys: [key] });
      else if (index % 7 === 3) await model.handleCommand('undo', undefined);
      else if (index % 7 === 4) await model.handleCommand('redo', undefined);
      else model.api.updateFields([{ rowKey: key, fields: { project: seed % 5 } }]);
      const next = createView(
          model.getState(),
          model.getConfig(),
          new Set(),
          new Map(),
          38,
          [],
          view,
        ),
        full = createView(model.getState(), model.getConfig(), new Set(), new Map(), 38, []);
      expect(next.rows, `第 ${index} 步的行`).toEqual(full.rows);
      expect(next.spans, `第 ${index} 步的跨度`).toEqual(full.spans);
      for (const row of next.rows) {
        if (row.kind === 'record') expect(next.viewIndexOfRow(row.rowKey)).toBe(row.viewIndex);
        for (let col = 0; col < next.columns.length; col++)
          expect(next.anchorOf(row.viewIndex, col)).toEqual(full.anchorOf(row.viewIndex, col));
      }
      const rebuilt = createController<Row>({
        config: config(),
        dataSource: [...model.api.getDataSource()],
        rowKey: 'id',
      });
      expect(model.getState().tree).toEqual(rebuilt.getState().tree);
      expect(model.api.getDerivedRows()).toEqual(rebuilt.api.getDerivedRows());
      rebuilt.api.destroy();
      view = next;
    }
  });
  it('保留不受增删影响的行高度、前段对象和布局跨度，旧实例保持稳定', async () => {
    const model = createController<Row>({ config: config(), dataSource: rows, rowKey: 'id' });
    const before = createView(model.getState(), model.getConfig(), new Set(), new Map(), 38, []);
    const at = before.viewIndexOfRow('r29');
    before.metrics.setHeight(at, 91);
    const first = before.rows[0],
      oldHeight = before.metrics.total();
    await model.handleCommand('insertRowAbove', {
      rowKeys: ['r12'],
      rowDefaults: { name: '新', value: 0 },
    });
    const after = createView(
      model.getState(),
      model.getConfig(),
      new Set(),
      new Map(),
      38,
      [],
      before,
    );
    expect(after.splice).toBeDefined();
    expect(after.rows[0]).toEqual(first);
    expect(after.metrics.height(after.viewIndexOfRow('r29'))).toBe(91);
    expect(before.metrics.total()).toBe(oldHeight);
    after.metrics.setHeight(after.viewIndexOfRow('r29'), 120);
    expect(before.metrics.height(at)).toBe(91);
  });
});
