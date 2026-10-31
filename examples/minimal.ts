import type { TableConfig } from 'edit-table';
export interface MinimalRow {
  id: string;
  projectId: string;
  project: string;
  name: string;
  qty: number;
  price: number;
  total?: number;
  category?: string;
}
export const rows: MinimalRow[] = [
  { id: 'r1', projectId: 'p1', project: '会场', name: '租赁', qty: 2, price: 100 },
  { id: 'r2', projectId: 'p1', project: '会场', name: '布置', qty: 1, price: 50 },
];
export function createMinimalConfig(): TableConfig<MinimalRow> {
  return {
    rowNumbers: true,
    rowPinning: { maxRows: 3 },
    columns: [
      { field: 'project', title: '项目', editable: true },
      { field: 'name', title: '需求', editable: true },
      {
        field: 'qty',
        title: '数量',
        editable: true,
        editor: 'number',
        valueType: 'number',
        rules: [{ type: 'number', min: 0, message: '数量不能为负数' }],
      },
      { field: 'price', title: '单价', editable: true, editor: 'number', valueType: 'number' },
      { field: 'total', title: '金额', format: 'amount' },
    ],
    groups: [
      { key: 'project', fields: ['project'], idField: 'projectId', renameFields: ['project'] },
    ],
    merges: { vertical: [{ column: 'project', by: 'project' }] },
    calculations: [
      {
        id: 'amount',
        scope: 'row',
        reads: ['qty', 'price'],
        writes: ['total'],
        compute: ({ row }) => ({ total: row.qty * row.price }),
      },
    ],
    derivedRows: [
      {
        id: 'subtotal',
        level: 'project',
        labelColumn: 'name',
        label: '项目小计',
        cells: { total: { type: 'aggregate', of: 'total', agg: 'sum' } },
      },
      {
        id: 'offer',
        level: 'project',
        labelColumn: 'name',
        label: '项目打包价',
        cells: {
          total: {
            type: 'input',
            field: 'total',
            default: null,
            editor: 'number',
            rules: [
              {
                validator: (_rule, value: unknown) => value === null || Number(value) >= 0,
                message: '优惠价不能为负数',
              },
            ],
          },
        },
      },
    ],
    summary: {
      items: [
        {
          key: 'payable',
          label: '应付金额',
          compute: ({ results }) =>
            results
              .filter((r) => r.ruleKey === 'subtotal')
              .reduce((sum, subtotal) => {
                const offer = results.find(
                  (r) => r.ruleKey === 'offer' && r.groupKey === subtotal.groupKey,
                );
                return sum + Number(offer?.values.total ?? subtotal.values.total);
              }, 0),
        },
      ],
    },
  };
}
