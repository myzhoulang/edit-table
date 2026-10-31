import type { Page } from '@playwright/test';
import type { Row } from '../../packages/core/src/types';
export type StructureSample = {
  browser: string;
  version: string;
  scenario: string;
  count: number;
  initMs: number;
  insertMs: number[];
  deleteMs: number[];
  domRows: number;
  summaryStable: boolean;
  headerReused: boolean;
};

export async function measureStructure(
  page: Page,
  browser: string,
  version: string,
): Promise<StructureSample[]> {
  try {
    const samples: StructureSample[] = [];
    for (const grouped of [false, true]) {
      const result = await page.evaluate(async (grouped) => {
        const corePath = '/packages/core/src/index.ts',
          dataPath = '/website/demos/big-data/config.ts';
        const core: typeof import('../../packages/core/src/index') = await import(corePath),
          data: typeof import('../../website/demos/big-data/config') = await import(dataPath);
        const host = document.querySelector<HTMLElement>('#table');
        if (!host) throw new Error('结构基准容器不存在');
        const started = performance.now(),
          rows = data.createRows(100000);
        for (const [index, row] of rows.entries()) {
          row.col2 = index % 10;
          if (grouped) row.col0 = `组 ${Math.floor(index / 100)}`;
        }
        const table = core.createTable<Row>(host, {
          rowKey: 'id',
          dataSource: rows,
          config: {
            ...data.bigConfig,
            groups: grouped ? [{ key: 'group', fields: ['col0'] }] : [],
            merges: grouped ? { vertical: [{ column: 'col0', by: 'group' }] } : {},
            derivedRows: grouped
              ? [
                  {
                    id: 'subtotal',
                    level: 'group',
                    labelColumn: 'col1',
                    label: '小计',
                    cells: { col2: { type: 'aggregate', agg: 'sum' } },
                  },
                ]
              : [],
            summary: {
              items: [
                {
                  key: 'sum',
                  label: '合计',
                  compute: ({ rows }) => rows.reduce((sum, row) => sum + Number(row.col2 ?? 0), 0),
                  update: ({ previous, changes }) =>
                    Number(previous) +
                    changes.reduce(
                      (sum, change) =>
                        sum + Number(change.after?.col2 ?? 0) - Number(change.before?.col2 ?? 0),
                      0,
                    ),
                },
              ],
            },
          },
        });
        const initMs = performance.now() - started,
          initialSummary = table.getSummary().sum;
        table.scrollToRow({ kind: 'record', rowKey: 'row-50000' });
        const header = host.querySelector('th[data-field=col2]'),
          insertMs: number[] = [],
          deleteMs: number[] = [];
        try {
          for (let index = 0; index < 5; index++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const insertedAt = performance.now();
            const inserted = await table.executeCommand('insertRowAbove', {
              rowKeys: ['row-50000'],
              rowDefaults: { col2: index + 1, col3: `结构基准 ${index}` },
            });
            if (!inserted.ok) throw new Error(inserted.message);
            insertMs.push(performance.now() - insertedAt);
            // 获取新身份属于完整读取，放在写入采样之外；完整快照成本另有独立采样。
            const row = table.getDataSource()[50000];
            if (typeof row?.id !== 'string') throw new Error('新增记录身份无效');
            const removedAt = performance.now(),
              removed = await table.executeCommand('deleteRows', { rowKeys: [row.id] });
            if (!removed.ok) throw new Error(removed.message);
            deleteMs.push(performance.now() - removedAt);
          }
          return {
            initMs,
            insertMs,
            deleteMs,
            domRows: host.querySelectorAll('.et-body-table tr[data-kind=record]').length,
            summaryStable:
              table.getSummary().sum === initialSummary && table.getDataSource().length === 100000,
            headerReused: header === host.querySelector('th[data-field=col2]'),
          };
        } finally {
          table.destroy();
        }
      }, grouped);
      samples.push({
        browser,
        version,
        scenario: grouped ? '12 列 / 1000 分组与小计' : '12 列 / 无分组',
        count: 100000,
        ...result,
      });
    }
    return samples;
  } catch (error) {
    throw new Error('结构性能采样失败', { cause: error });
  }
}
