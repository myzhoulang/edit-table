import { describe, expect, it } from 'vitest';
import { createController, createModel } from '../../src/model/model';
import { config, rows, type TestRow } from '../fixture';
describe('增量与范围', () => {
  it('组作用域计算重新计算整个受影响组', () => {
    const next = config();
    next.calculations = [
      {
        id: 'group',
        scope: { group: 'project' },
        reads: ['qty'],
        writes: ['total'],
        compute: ({ rows: scopeRows }) => ({
          total: scopeRows.reduce((sum, row) => sum + row.qty, 0),
        }),
      },
    ];
    const model = createModel({ config: next, rowKey: 'id', dataSource: rows });
    expect(model.getDataSource().map((row) => row.total)).toEqual([3, 3]);
    model.updateFields([{ rowKey: 'r1', fields: { qty: 5 } }]);
    expect(model.getDataSource().map((row) => row.total)).toEqual([6, 6]);
  });
  it('无关分组复用派生结果，受影响组差量求和等于全量', () => {
    const data = [...rows, { ...rows[0]!, id: 'r3', project: '住宿', projectId: 'p2' }];
    const model = createModel({ config: config(), rowKey: 'id', dataSource: data });
    const before = model.getDerivedRows().find((row) => row.groupKey === 'p2');
    model.updateFields([{ rowKey: 'r1', fields: { qty: 4 } }]);
    expect(model.getDerivedRows().find((row) => row.groupKey === 'p2')).toBe(before);
    const full = createModel({
      config: config(),
      rowKey: 'id',
      dataSource: [...model.getDataSource()],
    });
    expect(model.getDerivedRows()).toEqual(full.getDerivedRows());
  });
  it('手动合并保留数据并参与历史，删除范围失效', async () => {
    const next = config();
    next.manualMerge = { rules: [{ column: 'name' }] };
    const model = createController({ config: next, rowKey: 'id', dataSource: rows });
    expect(
      (await model.api.executeCommand('mergeCells', { rowKeys: ['r1', 'r2'], field: 'name' })).ok,
    ).toBe(true);
    expect(model.getMerges()).toHaveLength(1);
    expect(model.api.getDataSource()[1]!.name).toBe('布置');
    await model.api.executeCommand('undo');
    expect(model.getMerges()).toHaveLength(0);
    await model.api.executeCommand('redo');
    await model.api.executeCommand('deleteRows', { rowKeys: ['r1'] });
    expect(model.getMerges()).toHaveLength(0);
  });
  it('组消失丢弃人工输入并报告，清空完整替换', async () => {
    const model = createModel<TestRow>({ config: config(), rowKey: 'id', dataSource: rows });
    await model.executeCommand('setDerivedValue', {
      ruleKey: 'offer',
      groupKey: 'p1',
      field: 'total',
      value: 180,
    });
    let dropped = 0;
    model.on('derivedValuesChange', (event) => {
      dropped += event.dropped.length;
    });
    await model.executeCommand('deleteRows', { rowKeys: ['r1', 'r2'] });
    expect(model.getDerivedValues()).toEqual([]);
    expect(dropped).toBe(1);
  });
});
