import { describe, expect, it } from 'vitest';
import type { Row, TableConfig } from '../../src/types';
import { createController } from '../../src/model/model';
import {
  createQuotationConfig,
  createQuotationRows,
  sumDecimal,
} from '../../../../examples/quotation/config';
import { RowMetrics } from '../../src/view/metrics';

describe('增量汇总与结构更新', () => {
  it('浅层复用既有记录仍隔离新补丁的嵌套所有权和特殊自有字段', () => {
    const data: Row = JSON.parse(
      '{"id":"r1","value":[{"name":"原始"}],"other":{"keep":true},"__proto__":{"payload":1}}',
    );
    const model = createController<Row>({
      config: { columns: [{ field: 'value', title: '内容', editable: true }] },
      dataSource: [data],
      rowKey: 'id',
    });
    const before = model.api.getDataSource()[0]!,
      nested = [{ name: '更新' }];
    model.api.updateFields([{ rowKey: 'r1', fields: { value: nested } }]);
    nested[0]!.name = '宿主改动';
    const after = model.api.getDataSource()[0]!;
    expect(after.value).toEqual([{ name: '更新' }]);
    expect(after.other).toBe(before.other);
    expect(Object.isFrozen(after.value)).toBe(true);
    expect(Object.hasOwn(after, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(after)).toBe(Object.prototype);
    expect(Reflect.get(after, 'payload')).toBeUndefined();
  });
  it('精确金额在编辑、增删、复制和历史恢复后等于全量求和', async () => {
    const model = createController({
      config: createQuotationConfig(),
      dataSource: createQuotationRows(),
      rowKey: 'id',
    });
    let seed = 53;
    for (let index = 0; index < 120; index++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const entries = model.getState().entries,
        key = entries[seed % entries.length]!.key;
      if (index % 9 === 0) await model.handleCommand('duplicateRows', { rowKeys: [key] });
      else if (index % 9 === 1 && entries.length > 2)
        await model.handleCommand('deleteRows', { rowKeys: [key] });
      else if (index % 9 === 2) await model.handleCommand('undo', undefined);
      else if (index % 9 === 3) await model.handleCommand('redo', undefined);
      else
        model.api.updateFields([
          { rowKey: key, fields: { qty: seed % 10, price: (seed % 9876) / 100 } },
        ]);
      for (const field of ['gross', 'net', 'tax'] as const)
        expect(model.api.getSummary()[field]).toBe(sumDecimal(model.api.getDataSource(), field));
      const full = createController({
        config: createQuotationConfig(),
        dataSource: [...model.api.getDataSource()],
        rowKey: 'id',
      });
      expect(model.getState().tree).toEqual(full.getState().tree);
      expect(model.api.getDerivedRows()).toEqual(full.api.getDerivedRows());
      full.api.destroy();
    }
  });
  it('update 使用最终计算记录，冻结差量；失败整体回滚；配置刷新走 compute', () => {
    let computes = 0,
      updates = 0,
      fail = false;
    const config: TableConfig<Row> = {
      columns: [
        { field: 'value', title: '输入', editable: true },
        { field: 'double', title: '结果' },
      ],
      calculations: [
        {
          id: 'double',
          scope: 'row',
          reads: ['value'],
          writes: ['double'],
          compute: ({ row }) => ({ double: Number(row.value) * 2 }),
        },
      ],
      summary: {
        items: [
          {
            key: 'sum',
            label: '和',
            compute: ({ rows }) => {
              computes++;
              return rows.reduce((sum, row) => sum + Number(row.double), 0);
            },
            update: ({ previous, changes }) => {
              updates++;
              expect(Object.isFrozen(changes)).toBe(true);
              expect(Object.isFrozen(changes[0]!.after)).toBe(true);
              if (fail) throw new Error('差量失败');
              return (
                Number(previous) +
                changes.reduce(
                  (sum, change) =>
                    sum + Number(change.after?.double ?? 0) - Number(change.before?.double ?? 0),
                  0,
                )
              );
            },
          },
        ],
      },
    };
    const model = createController<Row>({
      config,
      dataSource: [{ id: 'r1', value: 2 }],
      rowKey: 'id',
    });
    expect(model.api.updateFields([{ rowKey: 'r1', fields: { value: 3 } }]).ok).toBe(true);
    expect(model.api.getSummary().sum).toBe(6);
    expect(computes).toBe(1);
    expect(updates).toBe(1);
    fail = true;
    const before = model.api.getDataSource();
    expect(model.api.updateFields([{ rowKey: 'r1', fields: { value: 4 } }]).ok).toBe(false);
    expect(model.api.getDataSource()).toBe(before);
    expect(model.api.getSummary().sum).toBe(6);
    fail = false;
    model.api.updateConfig(config);
    expect(computes).toBe(2);
  });
  it('500 次行高测量和块拼接与普通数组一致，前后实例互不污染', () => {
    let metrics = new RowMetrics(1025, 38),
      expected = Array<number>(1025).fill(38),
      seed = 17;
    for (let iteration = 0; iteration < 500; iteration++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      if (iteration % 3 && expected.length) {
        const at = seed % expected.length,
          height = 20 + (seed % 150);
        metrics.setHeight(at, height);
        expected[at] = height;
      } else {
        const start = seed % (expected.length + 1),
          removed = Math.min(seed % 300, expected.length - start),
          added = seed % 277;
        const previous = metrics,
          total = previous.total();
        metrics = metrics.splice(start, removed, added);
        expected.splice(start, removed, ...Array<number>(added).fill(38));
        if (metrics.count) {
          expected[0] = expected[0]! + 1;
          metrics.setHeight(0, expected[0]);
        }
        expect(previous.total()).toBe(total);
      }
      expect(metrics.count).toBe(expected.length);
      expect(metrics.total()).toBe(expected.reduce((sum, value) => sum + value, 0));
      let prefix = 0;
      for (let index = 0; index < expected.length; index++) {
        if (
          iteration % 25 === 0 ||
          index === seed % expected.length ||
          index === 0 ||
          index === expected.length - 1
        ) {
          expect(metrics.rowTop(index)).toBe(prefix);
          expect(metrics.height(index)).toBe(expected[index]);
          expect(metrics.rowAtOffset(prefix)).toBe(index);
          expect(metrics.rowAtOffset(prefix + expected[index]! - 0.5)).toBe(index);
        }
        prefix += expected[index]!;
      }
    }
  });
});
