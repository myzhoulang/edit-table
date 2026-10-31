import { describe, expect, it } from 'vitest';
import { createController } from '../../src/model/model';
import { createView, expandRange } from '../../src/view/view';
import { RowMetrics } from '../../src/view/metrics';
import { parseTSV, stringifyTSV } from '../../src/utils/clipboard';
import { config, rows } from '../fixture';
import {
  createQuotationConfig,
  createQuotationRows,
  calculateFinance,
  calculatePackage,
} from '../../../../examples/quotation/config';

describe('M3 分组跨度与逻辑坐标', () => {
  it('分类穿过内层小计，项目排除自己的小计，标签在声明列', () => {
    const controller = createController({
      config: createQuotationConfig(),
      dataSource: createQuotationRows(),
      rowKey: 'id',
    });
    const view = createView(
      controller.getState(),
      controller.getConfig(),
      new Set(),
      new Map(),
      38,
      [],
    );
    const category = view.spans.find((span) => span.col === 0 && span.start === 0)!;
    expect(category.end).toBe(12);
    const project = view.spans.find((span) => span.col === 1 && span.start === 0)!;
    expect(project.end).toBe(3);
    expect(view.rows[4]?.kind).toBe('derived');
    expect(view.anchorOf(11, 0)).toEqual({ row: 0, col: 0 });
    expect(view.anchorOf(3, 1)).toEqual({ row: 0, col: 1 });
    expect(view.anchorOf(4, 1)).toEqual({ row: 4, col: 1 });
    for (const [index, row] of view.rows.entries())
      if (row.kind === 'record') {
        expect(view.viewIndexOfRow(row.rowKey)).toBe(index);
        expect(view.sourceIndexOfView(index)).toBe(row.sourceIndex);
      } else expect(view.sourceIndexOfView(index)).toBe(-1);
  });
  it('非连续的相同路径分开分组，隐藏列不占坐标', () => {
    const data = [
      rows[0]!,
      { ...rows[1]!, project: '其他', projectId: 'p2' },
      { ...rows[0]!, id: 'r3' },
    ];
    const model = createController({ config: config(), dataSource: data, rowKey: 'id' });
    expect(model.getState().tree.roots).toHaveLength(3);
    const view = createView(
      model.getState(),
      model.getConfig(),
      new Set(['qty']),
      new Map(),
      36,
      [],
    );
    expect(view.columns.some((col) => col.field === 'qty')).toBe(false);
    expect(view.colAtOffset(view.lefts[1]! + 3)).toBe(1);
  });
  it('合并递归扩选至稳定范围', () => {
    const model = createController({ config: config(), dataSource: rows, rowKey: 'id' });
    const view = createView(model.getState(), model.getConfig(), new Set(), new Map(), 36, []);
    expect(expandRange({ anchor: { row: 1, col: 0 }, focus: { row: 1, col: 2 } }, view)).toEqual({
      anchor: { row: 0, col: 0 },
      focus: { row: 1, col: 2 },
    });
  });
  it('100 次更新后的重建坐标一致', () => {
    const model = createController({ config: config(), dataSource: rows, rowKey: 'id' });
    for (let i = 0; i < 100; i++) {
      model.api.updateFields([{ rowKey: i % 2 ? 'r1' : 'r2', fields: { qty: i } }]);
      const first = createView(model.getState(), model.getConfig(), new Set(), new Map(), 36, []),
        second = createView(model.getState(), model.getConfig(), new Set(), new Map(), 36, []);
      expect(first.rows).toEqual(second.rows);
      expect(first.spans).toEqual(second.spans);
    }
  });
});
describe('行度量与剪贴板', () => {
  it('高度更新后前缀和、二分往返一致', () => {
    const metrics = new RowMetrics(100000, 36);
    metrics.setHeight(5, 72);
    expect(metrics.rowTop(6)).toBe(252);
    expect(metrics.total()).toBe(3600036);
    for (const index of [0, 5, 6, 2999, 99999])
      expect(metrics.rowAtOffset(metrics.rowTop(index) + 1)).toBe(index);
  });
  it('TSV 引号、换行、制表符和末尾换行', () => {
    const data = [
      ['中文', 'a\tb', 'a"b'],
      ['多\n行', '0', ''],
    ];
    expect(parseTSV(stringifyTSV(data))).toEqual(data);
    expect(parseTSV('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});
describe('M8 精确金额手算', () => {
  it('截图场地、设备、布置小计由精确值汇总', () => {
    const model = createController({
      config: createQuotationConfig(),
      dataSource: createQuotationRows(),
      rowKey: 'id',
    });
    const results = model.api.getDerivedRows();
    for (const [groupKey, gross, net, tax] of [
      ['p-场地', 5100, 4845.28, 254.72],
      ['p-设备', 3900, 3815.09, 84.91],
      ['p-会场布置', 3800, 3584.91, 215.09],
    ] as const) {
      const values = results.find((row) => row.groupKey === groupKey)!.values;
      expect(Number(values.gross)).toBe(gross);
      expect(Number(Number(values.net).toFixed(2))).toBe(net);
      expect(Number(Number(values.tax).toFixed(2))).toBe(tax);
    }
  });
  it('案例 A 明细、180 打包价与零值', () => {
    const result = calculateFinance({ qualityA: 2, qualityB: 1, unitPrice: 100, taxRate: 0 });
    expect(Number(result.totalize)).toBe(224.04);
    expect(Number(result.taxDifference)).toBe(1.44);
    expect(Number(calculatePackage(180, 0).totalize)).toBe(201.636);
    expect(Number(calculatePackage(0, 0).totalize)).toBe(0);
  });
});

describe('案例 A 分层优惠与互斥', () => {
  it('项目价替代明细、0 有效、总价互斥、外部回填也拒绝', async () => {
    const { createFinanceConfig } = await import('../../../../examples/quotation/finance');
    const controller = createController({
      config: createFinanceConfig(0.05),
      rowKey: 'id',
      dataSource: [
        {
          id: 'f1',
          categoryName: '会务',
          projectName: '场地',
          projectId: 'p1',
          requirement: '租赁',
          qualityA: 2,
          qualityB: 1,
          unitPrice: 100,
          taxRate: 0,
          invoiceType: 'normal',
          remark: '',
        },
      ],
    });
    expect(Number(controller.api.getSummary().totalize)).toBe(224.04);
    expect(
      (
        await controller.api.executeCommand('setDerivedValue', {
          ruleKey: 'project-offer',
          groupKey: 'p1',
          field: 'unitPrice',
          value: 180,
        })
      ).ok,
    ).toBe(true);
    expect(Number(controller.api.getSummary().totalize)).toBe(201.636);
    expect(
      (
        await controller.api.executeCommand('setDerivedValue', {
          ruleKey: 'grand-offer',
          groupKey: 'table',
          field: 'unitPrice',
          value: 200,
        })
      ).ok,
    ).toBe(false);
    await controller.api.executeCommand('setDerivedValue', {
      ruleKey: 'project-offer',
      groupKey: 'p1',
      field: 'unitPrice',
      value: 0,
    });
    expect(Number(controller.api.getSummary().totalize)).toBe(0);
    await controller.api.executeCommand('setDerivedValue', {
      ruleKey: 'project-offer',
      groupKey: 'p1',
      field: 'unitPrice',
      value: null,
    });
    expect(Number(controller.api.getSummary().totalize)).toBe(224.04);
  });
});

describe('分组身份隔离', () => {
  it('不同层级可使用相同 ID，业务 ID table 不影响整表派生行', () => {
    const model = createController({
      rowKey: 'id',
      dataSource: [
        {
          id: 'r1',
          categoryId: '1',
          category: 'A',
          projectId: '1',
          project: 'P',
          name: '第一项',
          qty: 1,
        },
        {
          id: 'r2',
          categoryId: '1',
          category: 'A',
          projectId: 'table',
          project: 'Q',
          name: '第二项',
          qty: 2,
        },
        {
          id: 'r3',
          categoryId: '2',
          category: 'B',
          projectId: '2',
          project: 'R',
          name: '第三项',
          qty: 3,
        },
      ],
      config: {
        columns: ['category', 'project', 'name', 'qty'].map((field) => ({ field, title: field })),
        groups: [
          { key: 'category', fields: ['category'], idField: 'categoryId' },
          { key: 'project', fields: ['project'], idField: 'projectId' },
        ],
        derivedRows: [
          {
            id: 'project-input',
            level: 'project',
            labelColumn: 'name',
            label: '输入',
            cells: {
              qty: {
                type: 'input',
                field: 'qty',
                default: null,
                editable: ({ group }) => group.key === 'project',
              },
            },
          },
          {
            id: 'category-total',
            level: 'category',
            labelColumn: 'name',
            label: '分类小计',
            cells: { qty: { type: 'aggregate', agg: 'sum' } },
          },
          {
            id: 'grand',
            level: 'table',
            labelColumn: 'name',
            label: '整表合计',
            cells: { qty: { type: 'aggregate', agg: 'sum' } },
          },
        ],
      },
    });
    const view = createView(model.getState(), model.getConfig(), new Set(), new Map(), 38, []);
    const category = view.rows.findIndex(
      (row) => row.kind === 'derived' && row.ruleKey === 'category-total' && row.groupKey === '1',
    );
    expect(category).toBeGreaterThan(view.viewIndexOfRow('r2'));
    expect(category).toBeLessThan(view.viewIndexOfRow('r3'));
    const final = view.rows.at(-1);
    expect(final).toMatchObject({ kind: 'derived', ruleKey: 'grand' });
    expect(
      model.canWrite({ kind: 'derived', ruleKey: 'project-input', groupKey: '1', field: 'qty' }),
    ).toBe(true);
  });
});
