import BigNumber from 'bignumber.js';
import type { DerivedRowView, Scalar, TableConfig } from 'edit-table';
export interface QuoteRow {
  id: string;
  categoryName: string;
  projectName: string;
  projectId: string;
  requirement: string;
  qty: number;
  days: number;
  price: number;
  invoiceType: string;
  taxRate: number;
  date: string;
  remark: string;
  gross?: string;
  net?: string;
  tax?: string;
  region?: string[];
}
const decimal = (value: unknown): BigNumber =>
  BigNumber.isBigNumber(value)
    ? value
    : new BigNumber(value == null || value === '' ? 0 : String(value));
export const invoiceRates: Readonly<Record<string, number>> = {
  vat: 6,
  vatNormal: 6,
  electronic: 6,
  normal: 0,
  none: 0,
};
const invoiceLabels: Readonly<Record<string, string>> = {
  vat: '增值税专用发票',
  vatNormal: '增值税普通发票',
  electronic: '电子普通发票',
  normal: '普通发票',
  none: '不开发票',
};
const amount = (value: unknown): string => decimal(value).toFixed(10);
export const sumDecimal = (rows: readonly QuoteRow[], field: 'gross' | 'net' | 'tax'): string =>
  rows.reduce((sum, row) => sum.plus(decimal(row[field])), decimal(0)).toFixed(10);
export function createQuotationConfig(): TableConfig<QuoteRow> {
  return {
    rowNumbers: true,
    rowPinning: { maxRows: 3 },
    pinnedDiff: true,
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
    manualMerge: { rules: [{ column: 'remark', rowKinds: ['record'] }] },
    columns: [
      { field: 'categoryName', title: '分类', width: 96, fixed: 'left', editable: true },
      { field: 'projectName', title: '项目', width: 118, editable: true },
      {
        field: 'requirement',
        title: '需求',
        width: 192,
        editable: true,
        rules: [{ required: true, message: '请填写需求名称' }],
        comment: (row) => (row.id === 'r1' ? '会场使用半天，请提前确认布置时间' : undefined),
      },
      {
        field: 'qty',
        title: '数量',
        width: 82,
        align: 'right',
        editable: true,
        editor: 'number',
        valueType: 'number',
        editorProps: { min: 0, step: 1 },
        rules: [{ type: 'number', min: 0, required: true, message: '数量必须为非负数字' }],
      },
      {
        field: 'days',
        title: '天数',
        width: 76,
        align: 'right',
        editable: true,
        editor: 'number',
        valueType: 'number',
        editorProps: { min: 0, step: 1 },
      },
      {
        field: 'price',
        title: '含税单价',
        width: 120,
        align: 'right',
        editable: true,
        editor: 'number',
        valueType: 'number',
        editorProps: { min: 0, precision: 2 },
        formatter: (value) => decimal(value).toFormat(2),
      },
      {
        field: 'invoiceType',
        title: '发票类型',
        width: 178,
        editable: true,
        editor: 'select',
        editorProps: { searchable: true },
        options: Object.entries(invoiceLabels).map(([value, label]) => ({ value, label })),
        formatter: (value) => invoiceLabels[String(value)] ?? String(value),
      },
      {
        field: 'taxRate',
        title: '税率',
        width: 78,
        align: 'center',
        editable: true,
        editor: 'number',
        valueType: 'number',
        formatter: (value) => `${String(value)}%`,
      },
      { field: 'gross', title: '含税金额', width: 138, align: 'right', format: 'amount' },
      { field: 'net', title: '不含税金额', width: 142, align: 'right', format: 'amount' },
      { field: 'tax', title: '税额', width: 122, align: 'right', format: 'amount' },
      {
        field: 'date',
        title: '消费日期',
        width: 138,
        editable: true,
        editor: 'date',
        valueType: 'date',
      },
      {
        field: 'remark',
        title: '备注',
        width: 216,
        editable: true,
        emptyValue: '—',
        comment: (row) => row.remark || undefined,
      },
    ],
    calculations: [
      {
        id: 'gross',
        scope: 'row',
        reads: ['qty', 'days', 'price'],
        writes: ['gross'],
        compute: ({ row }) => ({
          gross: amount(decimal(row.qty).times(row.days).times(row.price)),
        }),
      },
      {
        id: 'tax',
        scope: 'row',
        reads: ['gross', 'taxRate'],
        writes: ['net', 'tax'],
        compute: ({ row }) => {
          const gross = decimal(row.gross);
          const net = gross.div(decimal(1).plus(decimal(row.taxRate).div(100))).decimalPlaces(10);
          return { net: amount(net), tax: amount(gross.minus(net)) };
        },
      },
    ],
    fieldTransitions: [
      {
        id: 'invoice-rate',
        trigger: { field: 'invoiceType' },
        apply: ({ newValue }) => ({ taxRate: invoiceRates[String(newValue)] ?? 0 }),
      },
    ],
    derivedRows: [
      {
        id: 'project-total',
        level: 'project',
        labelColumn: 'projectName',
        label: ({ group }) => `${String(group.values.projectName)}总计`,
        cells: {
          gross: { type: 'aggregate', agg: (rows) => sumDecimal(rows, 'gross') },
          net: { type: 'aggregate', agg: (rows) => sumDecimal(rows, 'net') },
          tax: { type: 'aggregate', agg: (rows) => sumDecimal(rows, 'tax') },
        },
      },
    ],
    summary: {
      items: (['gross', 'net', 'tax'] as const).map((field) => ({
        key: field,
        label: field,
        compute: ({ rows }) => sumDecimal(rows, field),
        update: ({ previous, changes }) =>
          changes
            .reduce(
              (sum, change) =>
                sum.plus(decimal(change.after?.[field])).minus(decimal(change.before?.[field])),
              decimal(previous),
            )
            .toFixed(10),
      })),
    },
  };
}
export function createQuotationRows(): QuoteRow[] {
  const items: [string, string, string, number, number, number, string, string][] = [
    ['会务', '场地', '主会场半天', 1, 1, 2000, 'vat', '请提前布置桌椅'],
    ['会务', '场地', '分会场讨论室', 2, 1, 800, 'vat', ''],
    ['会务', '场地', '签到区', 1, 1, 600, 'normal', ''],
    ['会务', '场地', '贵宾休息室', 1, 1, 900, 'vat', '包含茶歇服务'],
    ['会务', '设备', '投影设备', 1, 1, 500, 'vat', ''],
    ['会务', '设备', '无线话筒', 4, 1, 100, 'vat', ''],
    ['会务', '设备', '同声传译', 30, 1, 80, 'normal', ''],
    ['会务', '设备', '备用音响', 2, 1, 300, 'vat', '按实际使用结算'],
    ['会务', '会场布置', '主舞台', 1, 1, 2200, 'vat', ''],
    ['会务', '会场布置', '背景板', 2, 1, 800, 'vat', ''],
    ['住宿', '酒店', '商务大床房', 10, 2, 480, 'vat', '包含早餐'],
    ['住宿', '酒店', '商务双床房', 8, 2, 480, 'vat', '包含早餐'],
    ['交通', '接送', '机场接机', 2, 1, 350, 'vat', ''],
    ['交通', '接送', '高铁站接送', 2, 1, 250, 'vat', ''],
    ['交通', '接送', '大巴车', 1, 2, 1200, 'vat', ''],
    ['交通', '接送', '商务用车', 1, 2, 800, 'vat', ''],
    ['活动', '执行', '主持服务', 1, 1, 2000, 'vat', ''],
    ['活动', '执行', '摄影服务', 1, 1, 1800, 'vat', ''],
    ['活动', '执行', '摄像服务', 1, 1, 2200, 'vat', ''],
    ['活动', '执行', '活动策划', 1, 1, 3500, 'vat', ''],
    ['物料', '印刷', '会议手册', 100, 1, 18, 'vat', ''],
    ['物料', '印刷', '参会证件', 100, 1, 5, 'vat', ''],
    ['人员', '保障', '现场执行', 4, 2, 500, 'normal', ''],
    ['人员', '保障', '礼仪服务', 4, 1, 600, 'normal', ''],
  ];
  return items.map(
    ([categoryName, projectName, requirement, qty, days, price, invoiceType, remark], index) => ({
      id: `r${index + 1}`,
      categoryName,
      projectName,
      projectId: `p-${projectName}`,
      requirement,
      qty,
      days,
      price,
      invoiceType,
      taxRate: invoiceRates[invoiceType] ?? 0,
      date: index < 10 ? '2026-10-18' : '2026-10-19',
      remark,
    }),
  );
}
export function createLargeRows(count: number): QuoteRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `large-${index}`,
    categoryName: '性能验证',
    projectName: `项目 ${Math.floor(index / 100) + 1}`,
    projectId: `group-${Math.floor(index / 100)}`,
    requirement: `需求记录 ${index + 1}`,
    qty: (index % 10) + 1,
    days: 1,
    price: 100 + (index % 500),
    invoiceType: 'vat',
    taxRate: 6,
    date: '2026-10-30',
    remark: '',
  }));
}

export interface FinanceInput {
  qualityA: Scalar;
  qualityB: Scalar;
  unitPrice: Scalar;
  taxRate: Scalar;
}
export function calculateFinance(
  row: FinanceInput,
  serviceRate = 0.05,
): Record<string, string | null> {
  const q = decimal(row.qualityA).times(decimal(row.qualityB)),
    rate = decimal(row.taxRate).div(100),
    unitCost = decimal(row.unitPrice).div(decimal(1).plus(rate)).decimalPlaces(10),
    itemCost = q.times(unitCost),
    serviceFee = itemCost.times(serviceRate),
    taxFee = itemCost.plus(serviceFee).times(0.06),
    taxDifference =
      row.taxRate == null ? null : itemCost.times(decimal(0.06).minus(rate)).times(0.12);
  return {
    unitCost: amount(unitCost),
    itemPrice: amount(q.times(decimal(row.unitPrice))),
    itemCost: amount(itemCost),
    serviceFee: amount(serviceFee),
    taxFee: amount(taxFee),
    taxDifference: taxDifference === null ? null : amount(taxDifference),
    totalize: amount(
      itemCost
        .plus(serviceFee)
        .plus(taxFee)
        .plus(taxDifference ?? 0),
    ),
  };
}
export function calculatePackage(
  gross: Scalar,
  taxRate: Scalar,
  serviceRate = 0.05,
): Record<string, string | null> {
  return calculateFinance({ qualityA: 1, qualityB: 1, unitPrice: gross, taxRate }, serviceRate);
}
export function effectiveTotal(
  results: readonly DerivedRowView[],
  subtotal: DerivedRowView,
): unknown {
  return (
    results.find(
      (row) =>
        row.ruleKey === `${subtotal.ruleKey.replace(/-total$/, '')}-offer` &&
        row.groupKey === subtotal.groupKey,
    )?.values.total ?? subtotal.values.total
  );
}
