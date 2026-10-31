import { describe, expect, it } from 'vitest';
import { createController } from '../../src/model/model';
import { createView } from '../../src/view/view';
import type { CellTarget, Row, TableConfig } from '../../src/types';

function config(): TableConfig<Row> {
  return {
    columns: [
      { field: 'g', title: '分组', editable: true },
      { field: 'v', title: '值', editable: true },
      { field: 'calc', title: '计算' },
    ],
  };
}
const target = (rowKey: string, field: string): CellTarget => ({ kind: 'record', rowKey, field });
const input: CellTarget = { kind: 'derived', ruleKey: 'd', groupKey: 'table', field: 'v' };

describe('分析报告的数据一致性回归', () => {
  it.each([
    ['数字', 10, null],
    ['文本', '默认备注', ''],
  ] as const)('%s派生输入清空后跨重算和撤销仍保持空值', async (_name, defaultValue, empty) => {
    const next = config();
    next.derivedRows = [
      {
        id: 'd',
        level: 'table',
        labelColumn: 'g',
        label: '输入',
        cells: { v: { type: 'input', field: 'v', default: defaultValue } },
      },
    ];
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: [{ id: 'r1', g: 'A', v: 1 }],
    });
    expect((await m.write([{ target: input, value: empty }], 'edit')).ok).toBe(true);
    expect(m.api.getDerivedRows()[0]!.values.v).toBe(empty);
    expect(m.api.getDerivedValues()[0]!.value).toBe(empty);
    m.api.updateFields([{ rowKey: 'r1', fields: { v: 2 } }]);
    expect(m.api.getDerivedRows()[0]!.values.v).toBe(empty);
    await m.handleCommand('undo', undefined);
    expect(m.api.getDerivedRows()[0]!.values.v).toBe(empty);
    await m.write([{ target: input, value: defaultValue }], 'edit');
    expect(m.api.getDerivedValues()).toEqual([]);
  });

  it('合并组冲突粘贴整体拒绝，相同值的千行写入只产生千条变更', async () => {
    const next = config();
    next.groups = [{ key: 'g', fields: ['g'], renameFields: ['g'] }];
    next.merges = { vertical: [{ column: 'g', by: 'g' }] };
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: Array.from({ length: 1000 }, (_, i) => ({ id: String(i), g: 'A' })),
    });
    expect(
      (
        await m.write(
          [
            { target: target('0', 'g'), value: 'B' },
            { target: target('1', 'g'), value: 'C' },
          ],
          'paste',
        )
      ).code,
    ).toBe('conflicting-values');
    expect(m.api.getDataSource().every((row) => row.g === 'A')).toBe(true);
    let count = 0;
    m.api.on('dataChange', (event) => {
      count = event.changes.length;
    });
    await m.write(
      Array.from({ length: 1000 }, (_, i) => ({ target: target(String(i), 'g'), value: 'B' })),
      'paste',
    );
    expect(count).toBe(1000);
    expect(m.api.getDataSource().every((row) => row.g === 'B')).toBe(true);
    await m.handleCommand('undo', undefined);
    expect(m.api.getDataSource().every((row) => row.g === 'A')).toBe(true);
  });

  it.each([
    [
      [10, null, '', undefined, false],
      [10, 10, 10],
    ],
    [
      [-10, null],
      [-10, -10, -10],
    ],
    [
      [null, '', undefined],
      [null, null, null],
    ],
  ])('聚合排除空值和布尔值 %j', (values, expected) => {
    const next = config();
    next.columns.push(...['avg', 'min', 'max'].map((field) => ({ field, title: field })));
    next.derivedRows = [
      {
        id: 'd',
        level: 'table',
        labelColumn: 'g',
        label: '聚合',
        cells: {
          avg: { type: 'aggregate', of: 'v', agg: 'avg' },
          min: { type: 'aggregate', of: 'v', agg: 'min' },
          max: { type: 'aggregate', of: 'v', agg: 'max' },
        },
      },
    ];
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: values.map((v, i) => ({ id: String(i), v })),
    });
    expect(Object.values(m.api.getDerivedRows()[0]!.values)).toEqual(expected);
  });

  it('即时校验涵盖联动字段与计算字段', async () => {
    const next = config();
    next.columns[1]!.rules = [{ required: true, message: '不能为空' }];
    next.columns[2]!.rules = [{ type: 'number', min: 0, message: '不能为负数' }];
    next.fieldTransitions = [{ id: 'clear', trigger: { field: 'g' }, apply: () => ({ v: '' }) }];
    next.calculations = [
      {
        id: 'calc',
        scope: 'row',
        reads: ['g'],
        writes: ['calc'],
        compute: ({ row }) => ({ calc: row.g === 'B' ? -1 : 1 }),
      },
    ];
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: [{ id: 'r1', g: 'A', v: '有效' }],
    });
    await m.write([{ target: target('r1', 'g'), value: 'B' }], 'edit');
    expect(
      m
        .getErrors()
        .map((error) => error.target?.field)
        .sort(),
    ).toEqual(['calc', 'v']);
  });

  it('重复值产生与解除时同步校验双方，API 清空错误会通知宿主', async () => {
    const next = config();
    next.columns[1]!.deduplication = { message: '重复' };
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: [
        { id: 'a', v: 'a' },
        { id: 'b', v: 'b' },
      ],
    });
    await m.write([{ target: target('a', 'v'), value: 'b' }], 'edit');
    expect(m.getErrors()).toHaveLength(2);
    await m.write([{ target: target('a', 'v'), value: 'a' }], 'edit');
    expect(m.getErrors()).toEqual([]);
    await m.write([{ target: target('a', 'v'), value: 'b' }], 'edit');
    let latest = -1;
    m.api.on('validationChange', ({ errors }) => {
      latest = errors.length;
    });
    m.api.updateFields([{ rowKey: 'a', fields: { v: 'a' } }]);
    expect(latest).toBe(0);
  });

  it('不同父组的同名子组 ID 唯一，小计保持各自位置；0 继续视为未指定', async () => {
    const next = config();
    next.columns.push({ field: 'child', title: '子组' });
    next.groups = [
      { key: 'parent', fields: ['g'], idField: 'pid' },
      { key: 'child', fields: ['child'], idField: 'cid' },
    ];
    next.derivedRows = [
      {
        id: 'sub',
        level: 'child',
        labelColumn: 'g',
        label: '小计',
        cells: { v: { type: 'aggregate', agg: 'sum' } },
      },
    ];
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: [
        { id: 'a', g: 'A', pid: 'p1', child: 'x', cid: 'same', v: 1 },
        { id: 'b', g: 'B', pid: 'p2', child: 'x', cid: 'same', v: 2 },
        { id: 'c', g: 'C', pid: 0, child: 'x', cid: 'same~1', v: 3 },
      ],
    });
    const view = createView(m.getState(), m.getConfig(), new Set(), new Map(), 40, []);
    expect(view.rows.map((row) => (row.kind === 'record' ? row.rowKey : row.values.v))).toEqual([
      'a',
      1,
      'b',
      2,
      'c',
      3,
    ]);
    expect(
      new Set(
        m
          .getState()
          .tree.nodes.filter((group) => group.key === 'child')
          .map((group) => group.id),
      ).size,
    ).toBe(3);
    expect(m.getState().tree.roots[2]!.id).not.toBe('0');
    await m.handleCommand('insertRowAbove', {
      rowKeys: ['a'],
      rows: [{ g: '新组', pid: 'p0', child: 'x', cid: 'same', v: 4 }],
    });
    const full = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: [...m.api.getDataSource()],
    });
    expect(m.getState().tree).toEqual(full.getState().tree);
  });
});

describe('数组输入和事件契约回归', () => {
  it('数组通过 TSV 往返后仍按编辑器还原数组，非法文本明确报错', async () => {
    const { stringifyTSV, parseTSV } = await import('../../src/utils/clipboard');
    const next = config();
    next.columns[1]!.editor = 'select';
    next.columns[1]!.editorProps = { multiple: true };
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: [{ id: 'r1', v: [] }],
    });
    const values = ['a,b', '带\t制表符', '带"引号'];
    const text = parseTSV(stringifyTSV([[values]]))[0]![0]!;
    expect((await m.write([{ target: target('r1', 'v'), value: text }], 'paste')).ok).toBe(true);
    expect(m.api.getDataSource()[0]!.v).toEqual(values);
    expect((await m.write([{ target: target('r1', 'v'), value: 'a,b' }], 'paste')).ok).toBe(false);
  });

  it('配置阶段拒绝派生输入的数组编辑器，继续允许标量单选', () => {
    const next = config();
    next.derivedRows = [
      {
        id: 'd',
        level: 'table',
        labelColumn: 'g',
        label: '输入',
        cells: { v: { type: 'input', field: 'v', editor: 'cascader' } },
      },
    ];
    expect(() => createController({ config: next })).toThrow('派生输入只支持标量');
    next.derivedRows[0]!.cells.v = { type: 'input', field: 'v', editor: 'select' };
    expect(() => createController({ config: next })).not.toThrow();
    next.columns[1]!.editorProps = { multiple: true };
    expect(() => createController({ config: next })).toThrow('派生输入只支持标量');
  });

  it('空表先显示 before-group，再显示 after-group，同位置保持声明顺序', () => {
    const next = config();
    next.derivedRows = ['after1', 'before1', 'after2', 'before2'].map((id) => ({
      id,
      level: 'table',
      position: id.startsWith('before') ? 'before-group' : 'after-group',
      labelColumn: 'g',
      label: id,
      cells: {},
    }));
    const m = createController({ config: next });
    expect(
      createView(m.getState(), m.getConfig(), new Set(), new Map(), 40, []).rows.map(
        (row) => row.kind === 'derived' && row.ruleKey,
      ),
    ).toEqual(['before1', 'before2', 'after1', 'after2']);
  });

  it('增删和历史恢复提供单元格差量及带源下标的记录差量', async () => {
    const m = createController<Row>({
      config: config(),
      rowKey: 'id',
      dataSource: [{ id: 'a', v: 1 }],
    });
    const events: import('../../src/types').TableEvents<Row>['dataChange'][] = [];
    m.api.on('dataChange', (event) => {
      events.push(event);
    });
    m.api.updateFields([{ rowKey: 'a', fields: { v: 2 } }]);
    await m.handleCommand('undo', undefined);
    expect(events.at(-1)!.changes).toContainEqual({
      target: target('a', 'v'),
      oldValue: 2,
      newValue: 1,
    });
    await m.handleCommand('duplicateRows', { rowKeys: ['a'] });
    const inserted = events.at(-1)!.recordChanges.find((change) => !change.before)!;
    expect(inserted.afterIndex).toBe(1);
    expect(inserted.after?.v).toBe(1);
    expect(events.at(-1)!.changes.length).toBeGreaterThan(0);
    await m.handleCommand('deleteRows', { rowKeys: ['a'] });
    expect(events.at(-1)!.recordChanges.find((change) => change.rowKey === 'a')).toMatchObject({
      before: { id: 'a', v: 1 },
      after: undefined,
      beforeIndex: 0,
    });
  });
});

describe('分组复用与去重范围回归', () => {
  it('删除早先的同名组后，远端复用子组身份与完整重建一致', async () => {
    const next = config();
    next.columns.push({ field: 'child', title: '子组' });
    next.groups = [
      { key: 'g', fields: ['g'], idField: 'gid' },
      { key: 'child', fields: ['child'], idField: 'cid' },
    ];
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: [
        { id: 'a', g: 'A', gid: 'A', child: 'x', cid: 'same' },
        { id: 'b', g: 'B', gid: 'B', child: 'x', cid: 'other' },
        { id: 'c', g: 'C', gid: 'C', child: 'x', cid: 'same' },
      ],
    });
    await m.handleCommand('deleteRows', { rowKeys: ['a'] });
    const full = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: [...m.api.getDataSource()],
    });
    expect(m.getState().tree).toEqual(full.getState().tree);
  });

  it('单格去重编辑只重新校验新旧值的关联行', async () => {
    let calls = 0;
    const next = config();
    next.columns[1]!.deduplication = { message: '重复' };
    next.columns[1]!.rules = [
      {
        validator: (): boolean => {
          calls++;
          return true;
        },
      },
    ];
    const m = createController<Row>({
      config: next,
      rowKey: 'id',
      dataSource: Array.from({ length: 1000 }, (_, index) => ({
        id: String(index),
        v: String(index),
      })),
    });
    await m.write([{ target: target('0', 'v'), value: '1' }], 'edit');
    expect(calls).toBe(2);
    expect(m.getErrors()).toHaveLength(2);
  });
});
