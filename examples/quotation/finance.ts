import BigNumber from 'bignumber.js';
import type {
  DerivedCell,
  DerivedContext,
  DerivedRowRule,
  DerivedRowView,
  TableConfig,
} from 'edit-table';
import { calculateFinance, calculatePackage, type FinanceInput } from './config';
export interface FinanceRow extends FinanceInput {
  id: string;
  categoryName: string;
  projectName: string;
  projectId: string;
  requirement: string;
  invoiceType: string;
  remark: string;
  unitCost?: string;
  itemPrice?: string;
  itemCost?: string;
  taxDifference?: string | null;
  serviceFee?: string;
  taxFee?: string;
  totalize?: string;
}
const financialFields = [
  'itemPrice',
  'itemCost',
  'taxDifference',
  'serviceFee',
  'taxFee',
  'totalize',
] as const;
export const columnPresets = {
  standard: [
    'categoryName',
    'projectName',
    'requirement',
    'qualityA',
    'qualityB',
    'unitPrice',
    'invoiceType',
    'taxRate',
    'itemPrice',
    'itemCost',
    'taxDifference',
    'remark',
  ],
  compact: ['requirement', 'qualityA', 'unitPrice', 'itemPrice'],
  finance: [
    'categoryName',
    'projectName',
    'requirement',
    'unitPrice',
    'itemCost',
    'taxDifference',
    'serviceFee',
    'totalize',
  ],
} as const;
const hasInput = (value: unknown): boolean => value !== null && value !== undefined && value !== '';
const bn = (value: unknown): BigNumber =>
  new BigNumber(value == null || value === '' ? 0 : String(value));
function effective(
  results: readonly DerivedRowView[],
  level: string,
  groupId: string,
): DerivedRowView | undefined {
  const offer = results.find((row) => row.ruleKey === `${level}-offer` && row.groupKey === groupId);
  return offer && hasInput(offer.values.unitPrice)
    ? offer
    : results.find((row) => row.ruleKey === `${level}-total` && row.groupKey === groupId);
}
function sumField(ctx: DerivedContext<FinanceRow>, field: string): string {
  if (ctx.group.children.length)
    return ctx.group.children
      .reduce(
        (sum, group) => sum.plus(bn(effective(ctx.results, group.key, group.id)?.values[field])),
        bn(0),
      )
      .toFixed(10);
  return ctx.rows.reduce((sum, row) => sum.plus(bn(Reflect.get(row, field))), bn(0)).toFixed(10);
}
/** 父级只聚合直接子级的有效结果，避免把明细、小计、优惠重复累加。 */
export function createFinanceConfig(
  serviceRate = 0,
  preset: keyof typeof columnPresets = 'standard',
): TableConfig<FinanceRow> {
  const labels: Record<string, string> = {
    categoryName: '分类',
    projectName: '项目',
    requirement: '需求',
    qualityA: '数量',
    qualityB: '天数',
    unitPrice: '含税单价 / 打包价',
    invoiceType: '发票类型',
    taxRate: '税率',
    unitCost: '不含税单价',
    itemPrice: '含税金额',
    itemCost: '不含税金额',
    taxDifference: '税差',
    serviceFee: '服务费',
    taxFee: '税费',
    totalize: '应付金额',
    remark: '备注',
  };
  const displayed = new Set<string>(columnPresets[preset]);
  const derivedRows: DerivedRowRule<FinanceRow>[] = [];
  for (const level of ['project', 'category']) {
    const totalCells: Record<string, DerivedCell<FinanceRow>> = {};
    for (const field of financialFields)
      totalCells[field] = { type: 'compute', fn: (ctx) => sumField(ctx, field) };
    derivedRows.push({
      id: `${level}-total`,
      level,
      labelColumn: 'requirement',
      label: level === 'project' ? '项目小计' : '分类小计',
      visible: () => level === 'project',
      cells: totalCells,
    });
    const offerCells: Record<string, DerivedCell<FinanceRow>> = {
      unitPrice: {
        type: 'input',
        field: 'unitPrice',
        default: null,
        editor: 'number',
        editable: (ctx) =>
          level !== 'project' ||
          !ctx.results.some(
            (row) => row.ruleKey === 'grand-offer' && hasInput(row.values.unitPrice),
          ),
        rules: [
          {
            validator: (_rule, value: unknown) =>
              !hasInput(value) || bn(value).isGreaterThanOrEqualTo(0),
            message: '打包价不能为负数',
          },
        ],
      },
    };
    for (const field of financialFields)
      offerCells[field] = {
        type: 'compute',
        fn: (ctx) =>
          hasInput(ctx.inputs.unitPrice)
            ? (calculatePackage(ctx.inputs.unitPrice, ctx.rows[0]?.taxRate ?? 0, serviceRate)[
                field
              ] ?? null)
            : null,
      };
    derivedRows.push({
      id: `${level}-offer`,
      level,
      labelColumn: 'requirement',
      label: level === 'project' ? '项目打包价' : '分类打包价',
      visible: () => level === 'project',
      cells: offerCells,
    });
  }
  const grandCells: Record<string, DerivedCell<FinanceRow>> = {
    unitPrice: {
      type: 'input',
      field: 'unitPrice',
      default: null,
      editor: 'number',
      editable: (ctx) =>
        !ctx.results.some(
          (row) => row.ruleKey === 'project-offer' && hasInput(row.values.unitPrice),
        ),
      rules: [
        {
          validator: (_rule, value: unknown) =>
            !hasInput(value) || bn(value).isGreaterThanOrEqualTo(0),
          message: '总打包价不能为负数',
        },
      ],
    },
  };
  for (const field of financialFields)
    grandCells[field] = {
      type: 'compute',
      fn: (ctx) =>
        hasInput(ctx.inputs.unitPrice)
          ? (calculatePackage(ctx.inputs.unitPrice, ctx.rows[0]?.taxRate ?? 0, serviceRate)[
              field
            ] ?? null)
          : null,
    };
  derivedRows.push({
    id: 'grand-offer',
    level: 'table',
    labelColumn: 'requirement',
    label: '整表打包价',
    cells: grandCells,
  });
  return {
    rowNumbers: true,
    rowPinning: { maxRows: 3 },
    columns: Object.entries(labels).map(([field, title]) => ({
      field,
      title,
      width: field === 'requirement' ? 170 : 135,
      hidden: !displayed.has(field),
      fixed: field === 'categoryName' ? 'left' : undefined,
      editable: [
        'categoryName',
        'projectName',
        'requirement',
        'qualityA',
        'qualityB',
        'unitPrice',
        'invoiceType',
        'remark',
      ].includes(field),
      editor:
        field === 'invoiceType'
          ? 'select'
          : ['qualityA', 'qualityB', 'unitPrice', 'taxRate'].includes(field)
            ? 'number'
            : 'text',
      valueType: ['qualityA', 'qualityB', 'unitPrice', 'taxRate'].includes(field)
        ? 'number'
        : undefined,
      format: [...financialFields, 'unitCost', 'unitPrice'].includes(field) ? 'amount' : undefined,
      options:
        field === 'invoiceType'
          ? [
              { value: 'normal', label: '普通发票' },
              { value: 'vat', label: '增值税发票' },
            ]
          : undefined,
    })),
    groups: [
      { key: 'category', fields: ['categoryName'], renameFields: ['categoryName'] },
      {
        key: 'project',
        fields: ['projectName'],
        idField: 'projectId',
        renameFields: ['projectName'],
      },
    ],
    merges: {
      vertical: [
        { column: 'categoryName', by: 'category' },
        { column: 'projectName', by: 'project' },
      ],
    },
    calculations: [
      {
        id: 'financial',
        scope: 'row',
        reads: ['qualityA', 'qualityB', 'unitPrice', 'taxRate'],
        writes: ['unitCost', ...financialFields],
        compute: ({ row }) => calculateFinance(row, serviceRate),
      },
    ],
    fieldTransitions: [
      {
        id: 'invoice-rate',
        trigger: { field: 'invoiceType' },
        apply: ({ newValue }) => ({ taxRate: newValue === 'vat' ? 1.6 : 0 }),
      },
    ],
    derivedRows,
    validateDerivedValues: (values) =>
      values.some((value) => value.ruleKey === 'project-offer' && hasInput(value.value)) &&
      values.some((value) => value.ruleKey === 'grand-offer' && hasInput(value.value))
        ? '项目打包价与整表打包价不能同时输入'
        : null,
    summary: {
      items: financialFields.map((field) => ({
        key: field,
        label: labels[field]!,
        compute: ({ results }) => {
          const grand = results.find((row) => row.ruleKey === 'grand-offer');
          if (grand && hasInput(grand.values.unitPrice)) return grand.values[field];
          return results
            .filter((row) => row.ruleKey === 'category-total')
            .reduce(
              (sum, row) =>
                sum.plus(bn(effective(results, 'category', row.groupKey)?.values[field])),
              bn(0),
            )
            .toFixed(10);
        },
      })),
    },
  };
}
export function createFinanceRows(): FinanceRow[] {
  return ['会务', '住宿', '交通', '活动', '物料', '人员'].flatMap((categoryName, category) =>
    Array.from({ length: 4 }, (_, item) => ({
      id: `f-${category}-${item}`,
      categoryName,
      projectName: `${categoryName}项目`,
      projectId: `fp-${category}`,
      requirement: `${categoryName}需求 ${item + 1}`,
      qualityA: item + 1,
      qualityB: 1,
      unitPrice: 100,
      taxRate: 0,
      invoiceType: 'normal',
      remark: '',
    })),
  );
}
