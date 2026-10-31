import { describe, expect, it } from 'vitest';
import type { Row, TableConfig } from '../../src/types';
import { createController } from '../../src/model/model';
import { normalizeValue } from '../../src/model/validation';
import { clipboardRange } from '../../src/utils/clipboard';

function config(): TableConfig<Row> {
  return {
    columns: [
      { field: 'group', title: '分组', editable: true },
      { field: 'label', title: '内容', editable: true },
    ],
    groups: [{ key: 'g', fields: ['group'] }],
    derivedRows: [
      {
        id: 'subtotal',
        level: 'g',
        labelColumn: 'group',
        label: '小计',
        cells: { label: { type: 'input', field: 'label' } },
      },
    ],
    manualMerge: { rules: [{ column: 'label', rowKinds: ['record'] }] },
  };
}
const rows = [
  { id: 'r1', group: 'A', label: '一' },
  { id: 'r2', group: 'A', label: '二' },
];
describe('补齐契约与安全回归', () => {
  it('局部分组重建复用无关子树，200 次编辑等于完整投影', () => {
    const next: TableConfig<Row> = {
      columns: [
        { field: 'a', title: 'a', editable: true },
        { field: 'b', title: 'b', editable: true },
      ],
      groups: [
        { key: 'a', fields: ['a'] },
        { key: 'b', fields: ['b'] },
      ],
    };
    const source = Array.from({ length: 24 }, (_, index) => ({
      id: String(index),
      a: Math.floor(index / 8),
      b: Math.floor(index / 2),
    }));
    const model = createController<Row>({ config: next, dataSource: source, rowKey: 'id' });
    const initial = model.getState().tree,
      initialPaths = JSON.stringify(initial.paths);
    model.api.updateFields([{ rowKey: '10', fields: { b: '变化' } }]);
    expect(model.getState().tree.roots[0]).toBe(initial.roots[0]);
    expect(model.getState().tree.roots[2]).toBe(initial.roots[2]);
    expect(JSON.stringify(initial.paths)).toBe(initialPaths);
    let seed = 71;
    for (let index = 0; index < 200; index++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      model.api.updateFields([
        { rowKey: String(seed % source.length), fields: { [index % 2 ? 'a' : 'b']: seed % 5 } },
      ]);
      const full = createController<Row>({
        config: next,
        dataSource: [...model.api.getDataSource()],
        rowKey: 'id',
      });
      expect(model.getState().tree).toEqual(full.getState().tree);
      full.api.destroy();
    }
  });
  it('作用域插入位于末条目标后，未知和重复删除目标不误算数量', async () => {
    const model = createController<Row>({ config: config(), dataSource: rows, rowKey: 'id' });
    await model.handleCommand('insertRowBelow', {
      rowKeys: ['r1', 'r2'],
      rowDefaults: { label: '末尾' },
    });
    expect(model.api.getDataSource().map((row) => row.label)).toEqual(['一', '二', '末尾']);
    expect((await model.handleCommand('deleteRows', { rowKeys: ['r1', 'unknown'] })).ok).toBe(
      false,
    );
    expect(
      (await model.handleCommand('deleteRows', { rowKeys: ['r1', 'r1'], minRemaining: 2 })).ok,
    ).toBe(true);
    expect(model.api.getDataSource()).toHaveLength(2);
  });
  it('延迟构造快照不改变事件冻结、历史与旧快照所有权', () => {
    const model = createController<Row>({ config: config(), dataSource: rows, rowKey: 'id' });
    const initial = model.api.getDataSource();
    model.api.updateFields([{ rowKey: 'r1', fields: { label: '第一次' } }]);
    let eventRows: readonly Row[] = [];
    model.api.on('dataChange', (event) => {
      eventRows = event.dataSource;
      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(eventRows)).toBe(true);
    });
    model.api.updateFields([{ rowKey: 'r1', fields: { label: '第二次' } }]);
    expect(initial[0]!.label).toBe('一');
    expect(eventRows).toBe(model.api.getDataSource());
    expect(eventRows[1]).toBe(initial[1]);
  });
  it('只允许派生行的规则拒绝真实记录合并', async () => {
    const next = config();
    next.manualMerge!.rules[0]!.rowKinds = ['derived'];
    const model = createController<Row>({ config: next, dataSource: rows, rowKey: 'id' });
    expect(
      (await model.handleCommand('mergeCells', { field: 'label', rowKeys: ['r1', 'r2'] })).ok,
    ).toBe(false);
    expect(model.getMerges()).toHaveLength(0);
  });
  it('分组变化插入小计行后自动拆分，撤销恢复原范围', async () => {
    const model = createController<Row>({ config: config(), dataSource: rows, rowKey: 'id' });
    let invalidated = 0;
    model.api.on('mergeInvalidated', ({ merges }) => {
      invalidated += merges.length;
    });
    expect(
      (await model.handleCommand('mergeCells', { field: 'label', rowKeys: ['r1', 'r2'] })).ok,
    ).toBe(true);
    model.api.updateFields([{ rowKey: 'r2', fields: { group: 'B' } }]);
    expect(model.getMerges()).toHaveLength(0);
    expect(invalidated).toBe(1);
    await model.handleCommand('undo', undefined);
    expect(model.getMerges()).toHaveLength(1);
  });
  it('支持连续派生行合并，并跳过覆盖格校验', async () => {
    const next = config();
    next.groups = undefined;
    next.derivedRows = ['one', 'two'].map((id) => ({
      id,
      level: 'table',
      labelColumn: 'group',
      label: id,
      cells: { label: { type: 'input', field: 'label', rules: [{ required: true, message: id }] } },
    }));
    next.manualMerge!.rules[0]!.rowKinds = ['derived'];
    const model = createController<Row>({ config: next, dataSource: rows, rowKey: 'id' });
    const targets = ['one', 'two'].map((ruleKey) => ({
      kind: 'derived',
      ruleKey,
      groupKey: 'table',
    }));
    expect((await model.handleCommand('mergeCells', { field: 'label', targets })).ok).toBe(true);
    expect((await model.api.validate()).errors.map((error) => error.message)).toEqual(['one']);
    expect(
      model.canWrite({ kind: 'derived', ruleKey: 'two', groupKey: 'table', field: 'label' }),
    ).toBe(false);
    await model.handleCommand('unmergeCells', { field: 'label', targets });
    expect(model.getMerges()).toHaveLength(0);
  });
  it('列 mergeable=false 阻止手动合并', async () => {
    const next = config();
    next.columns[1]!.mergeable = false;
    const model = createController<Row>({ config: next, dataSource: rows, rowKey: 'id' });
    expect(
      (await model.handleCommand('mergeCells', { field: 'label', rowKeys: ['r1', 'r2'] })).ok,
    ).toBe(false);
  });
  it('布局 validatable 覆盖列规则', async () => {
    const next = config();
    next.columns[1]!.rules = [{ required: true }];
    next.rowRules = [
      {
        id: 'special',
        match: { field: 'group', equals: 'A' },
        layout: { cells: [{ column: 'label', field: 'label', behaviors: { validatable: false } }] },
      },
    ];
    const model = createController<Row>({
      config: next,
      dataSource: [{ id: 'r1', group: 'A', label: '' }],
      rowKey: 'id',
    });
    expect((await model.api.validate()).valid).toBe(true);
  });
  it('相邻重叠选区可拼矩形，非矩形拒绝', () => {
    const range = (row: number, col: number): import('../../src/types').CellRange => ({
      anchor: { row, col },
      focus: { row, col },
    });
    expect(clipboardRange([range(0, 0), range(1, 0)])).toEqual({
      anchor: { row: 0, col: 0 },
      focus: { row: 1, col: 0 },
    });
    expect(() => clipboardRange([range(0, 0), range(1, 1)])).toThrow('不能拼成矩形');
  });
  it('日期格式可配置，闰年校验精确', () => {
    const column = { valueType: 'date' as const, editorProps: { format: 'DD/MM/YYYY' } };
    expect(normalizeValue('29/02/2024', column)).toBe('29/02/2024');
    expect(() => normalizeValue('29/02/2025', column)).toThrow('有效日期 DD/MM/YYYY');
    expect(() => normalizeValue('2024-02-29', column)).toThrow('有效日期');
  });
  it('并行校验丢弃旧结果，并暴露 pending', async () => {
    let call = 0;
    const next = config();
    next.columns[1]!.rules = [
      {
        asyncValidator: async (): Promise<void> => {
          try {
            const current = ++call;
            await new Promise<void>((resolve) => setTimeout(resolve, current <= 2 ? 30 : 1));
            if (current <= 2) throw new Error('旧错误');
          } catch (error) {
            throw error instanceof Error ? error : new Error(String(error));
          }
        },
      },
    ];
    const model = createController<Row>({ config: next, dataSource: rows, rowKey: 'id' });
    const first = model.api.validate();
    expect(model.getPending().has('*')).toBe(true);
    const second = model.api.validate();
    expect((await second).valid).toBe(true);
    expect((await first).errors[0]!.message).toBe('校验结果已过期');
    expect(model.getErrors()).toEqual([]);
    expect(model.getPending().size).toBe(0);
  });
});
